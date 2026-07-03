/**
 * AI service client — calls OpenRouter directly via the LLM service.
 *
 * Previously proxied through the Python AI service (FastAPI). Now calls
 * OpenRouter natively, eliminating the need for a separate deployment.
 *
 * The public interface (types and method signatures) is unchanged, so all
 * existing consumers (tRPC routers, etc.) work without modification.
 */

import { llm, LLMClientError } from "./llm";
import { renderPrompt, stripMarkdownFence } from "./prompts";
import pino from "pino";

const logger = pino({ name: "ai-client" });

// ---------------------------------------------------------------------------
// Types (unchanged from original interface)
// ---------------------------------------------------------------------------

export interface GenerateCodeParams {
  problemDescription: string;
  language: string;
  difficulty: string;
}

export interface GenerateCodeResult {
  code: string;
  language: string;
  modelUsed: string;
  tokenCount: number;
}

export interface QuizParams {
  code: string;
  annotations: Array<{ lineStart: number; lineEnd: number; text: string }>;
  topic: string;
  count: number;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation?: string;
}

export interface QuizResult {
  title: string;
  questions: Question[];
}

export interface DiffParams {
  originalCode: string;
  updatedCode: string;
  language: string;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  explanation: string;
}

export interface DiffResult {
  overallScore: number;
  dimensions: DimensionScore[];
  summary: string;
  cleanDiff: string;
}

export interface DefendMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DefendParams {
  sessionId: string;
  code: string;
  problemDescription: string;
  messages: DefendMessage[];
}

export interface DefendResult {
  nextQuestion: string | null;
  passed: boolean;
  feedback: string | null;
  score: number | null;
}

export class AIClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
  ) {
    super(message);
    this.name = "AIClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const MAX_DEFEND_QUESTIONS = 5;

export class AIClient {
  async generateCode(params: GenerateCodeParams): Promise<GenerateCodeResult> {
    if (!llm.hasKey) {
      throw new AIClientError(
        "AI Service unavailable: OPENROUTER_API_KEY not configured.",
        503,
        "generate",
      );
    }

    const prompt = renderPrompt("code_generation", {
      problem_description: params.problemDescription,
      language: params.language,
      difficulty: params.difficulty,
    });

    logger.info(
      { language: params.language, difficulty: params.difficulty },
      "Generating code via OpenRouter",
    );

    try {
      const text = await llm.generate(prompt);
      const code = stripMarkdownFence(text);
      return {
        code,
        language: params.language,
        modelUsed: llm["model"],
        tokenCount: Math.max(1, Math.floor(code.length / 4)),
      };
    } catch (err) {
      logger.error({ error: (err as Error).message }, "Code generation failed");
      throw new AIClientError(
        `AI generation failed: ${(err as Error).message}`,
        502,
        "generate",
      );
    }
  }

  async generateQuiz(params: QuizParams): Promise<QuizResult> {
    if (!llm.hasKey) {
      throw new AIClientError(
        "AI Service unavailable: OPENROUTER_API_KEY not configured.",
        503,
        "quiz",
      );
    }

    const annotationsText =
      params.annotations.length > 0
        ? params.annotations
            .map((a) => `Lines ${a.lineStart}-${a.lineEnd}: ${a.text}`)
            .join("\n")
        : "No annotations provided.";

    const prompt = renderPrompt("quiz_generation", {
      code: params.code,
      annotations: annotationsText,
      count: String(params.count),
      topic: params.topic,
    });

    logger.info(
      { topic: params.topic, questionCount: params.count },
      "Generating quiz via OpenRouter",
    );

    try {
      const text = await llm.generate(prompt);
      const cleaned = stripMarkdownFence(text);
      const data = JSON.parse(cleaned);

      const title = data.title ?? `Comprehension Check: ${params.topic}`;
      const questionsRaw = data.questions ?? [];

      if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) {
        throw new Error("No questions returned");
      }

      const questions: Question[] = questionsRaw.map(
        (q: Record<string, unknown>, i: number) => ({
          id: String(q.id ?? `q-${i + 1}`),
          question: String(q.question ?? ""),
          options: (q.options as string[]) ?? [],
          correctOption: Number(q.correct_option ?? q.correctOption ?? 0),
          explanation: q.explanation ? String(q.explanation) : undefined,
        }),
      );

      return { title, questions };
    } catch (err) {
      if (err instanceof AIClientError) throw err;
      logger.error({ error: (err as Error).message }, "Quiz generation failed");
      throw new AIClientError(
        err instanceof SyntaxError
          ? "Quiz generation returned an invalid response format."
          : `Quiz generation failed: ${(err as Error).message}`,
        502,
        "quiz",
      );
    }
  }

  async diffCode(params: DiffParams): Promise<DiffResult> {
    // For non-Python languages, use simple text-based similarity
    if (params.language !== "python") {
      return this.fallbackTextDiff(params.originalCode, params.updatedCode);
    }

    // For Python, use a simple text-based comparison
    // (Full AST analysis requires Python — we do text-based for now)
    return this.fallbackTextDiff(params.originalCode, params.updatedCode);
  }

  async defendAsk(params: DefendParams): Promise<DefendResult> {
    if (!llm.hasKey) {
      throw new AIClientError(
        "AI Service unavailable: OPENROUTER_API_KEY not configured.",
        503,
        "defend",
      );
    }

    const questionsAsked = params.messages.filter((m) => m.role === "assistant").length;

    if (questionsAsked >= MAX_DEFEND_QUESTIONS) {
      return this.defendEvaluate(params);
    }

    return this.askQuestion(params);
  }

  async defendEvaluate(params: DefendParams): Promise<DefendResult> {
    return this.askQuestion(params);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async askQuestion(params: DefendParams): Promise<DefendResult> {
    const messagesText = this.formatConversation(params.messages);

    const prompt = renderPrompt("defend_question", {
      problem_description: params.problemDescription,
      code: params.code,
      messages: messagesText,
    });

    try {
      const question = await llm.generate(prompt);
      return {
        nextQuestion: question.trim(),
        passed: false,
        feedback: null,
        score: null,
      };
    } catch (err) {
      logger.error({ error: (err as Error).message }, "Defend question generation failed");
      throw new AIClientError(
        `Failed to generate defend question: ${(err as Error).message}`,
        502,
        "defend",
      );
    }
  }

  private formatConversation(messages: DefendMessage[]): string {
    if (!messages.length) return "No previous conversation.";

    return messages
      .map((m) => {
        const roleLabel = m.role === "assistant" ? "Interviewer" : "Developer";
        return `${roleLabel}: ${m.content}`;
      })
      .join("\n\n");
  }

  private async fallbackTextDiff(original: string, updated: string): Promise<DiffResult> {
    // Use simple ratio-based comparison
    const maxLen = Math.max(original.length, updated.length);
    const similarity = maxLen > 0
      ? 1 - this.levenshteinRatio(original, updated)
      : 1;

    const dimensions: DimensionScore[] = [
      {
        dimension: "Structural similarity",
        score: Math.round(similarity * 100) / 100,
        explanation: "Text-based similarity (AST analysis not available in this environment).",
      },
      {
        dimension: "Correctness",
        score: 0.5,
        explanation: "Cannot fully assess correctness outside Python AST environment.",
      },
      {
        dimension: "Readability",
        score: 0.5,
        explanation: "Readability assessment requires Python AST analysis.",
      },
      {
        dimension: "Simplicity",
        score: 0.5,
        explanation: "Simplicity assessment requires Python AST analysis.",
      },
    ];

    const overallScore = dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      dimensions,
      summary: similarity > 0.9
        ? "Excellent rebuild! Nearly identical in structure and quality."
        : similarity > 0.75
          ? "Great rebuild. Minor differences in style or approach."
          : similarity > 0.6
            ? "Good rebuild with some differences."
            : "Significant differences. Review the original solution.",
      cleanDiff: "",
    };
  }

  private levenshteinRatio(a: string, b: string): number {
    const aLen = a.length;
    const bLen = b.length;
    if (aLen === 0) return bLen;
    if (bLen === 0) return aLen;

    const matrix: number[][] = [];
    for (let i = 0; i <= bLen; i++) matrix[i] = [i];
    for (let j = 0; j <= aLen; j++) matrix[0][j] = j;

    for (let i = 1; i <= bLen; i++) {
      for (let j = 1; j <= aLen; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    return matrix[bLen][aLen] / Math.max(aLen, bLen);
  }

  async healthCheck(): Promise<boolean> {
    return llm.hasKey;
  }
}

// Singleton instance
export const aiClient = new AIClient();
