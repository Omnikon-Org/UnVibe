/**
 * Universal LLM client using OpenRouter's unified API.
 *
 * Ports the Python AI service's llm_client.py directly into the Express API.
 * Uses the OpenAI SDK pointed at OpenRouter's base URL.
 */

import OpenAI from "openai";
import pino from "pino";

const logger = pino({ name: "llm" });

export class LLMClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMClientError";
  }
}

interface LLMClientConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  siteUrl?: string;
  appName?: string;
}

export class LLMClient {
  private client: OpenAI | null = null;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly siteUrl: string;
  private readonly appName: string;

  constructor(config?: LLMClientConfig) {
    this.apiKey = config?.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
    this.baseUrl =
      config?.baseUrl ?? process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
    this.model = config?.model ?? process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001";
    this.maxTokens = config?.maxTokens ?? parseInt(process.env.LLM_MAX_TOKENS ?? "4096", 10);
    this.siteUrl = config?.siteUrl ?? process.env.OPENROUTER_SITE_URL ?? "https://github.com/unvibe";
    this.appName = config?.appName ?? process.env.OPENROUTER_APP_NAME ?? "UnVibe";
  }

  get hasKey(): boolean {
    return Boolean(this.apiKey) && !this.apiKey.startsWith("sk-or-v1-placeholder");
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      if (!this.apiKey) {
        throw new LLMClientError(
          "OPENROUTER_API_KEY is not set. Get one at https://openrouter.ai/keys",
        );
      }
      this.client = new OpenAI({
        baseURL: this.baseUrl,
        apiKey: this.apiKey,
        timeout: 30_000,
        maxRetries: 2,
        defaultHeaders: {
          "HTTP-Referer": this.siteUrl,
          "X-Title": this.appName,
        },
      });
    }
    return this.client;
  }

  async generate(
    prompt: string,
    system = "",
    maxTokens?: number,
    retries = 2,
  ): Promise<string> {
    const client = this.ensureClient();
    const maxTok = maxTokens ?? this.maxTokens;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logger.info(
          { model: this.model, promptLength: prompt.length, systemLength: system.length, attempt: attempt + 1 },
          "LLM API call via OpenRouter",
        );

        const response = await client.chat.completions.create({
          model: this.model,
          messages,
          max_tokens: maxTok,
        });

        const text = response.choices[0]?.message?.content ?? "";
          logger.info(
            {
              model: this.model,
              promptTokens: response.usage?.prompt_tokens ?? "unknown",
              completionTokens: response.usage?.completion_tokens ?? "unknown",
            },
            "LLM API success",
          );
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof OpenAI.RateLimitError) {
          const wait = 2 ** (attempt + 1) * 1000;
          logger.warn({ model: this.model, wait, attempt: attempt + 1 }, "Rate limited, retrying");
          await new Promise((r) => setTimeout(r, wait));
        } else if (
          err instanceof OpenAI.APIError &&
          attempt < retries
        ) {
          const wait = 2 ** attempt * 1000;
          logger.warn({ error: (err as Error).message, wait, attempt: attempt + 1 }, "LLM API error, retrying");
          await new Promise((r) => setTimeout(r, wait));
        } else if (!(err instanceof OpenAI.APIError)) {
          logger.error({ error: lastError.message }, "Unexpected LLM client error");
          break;
        }
      }
    }

    throw new LLMClientError(
      `LLM API call to ${this.model} failed after ${retries + 1} attempts: ${lastError?.message}`,
    );
  }
}

// Singleton instance
export const llm = new LLMClient();
