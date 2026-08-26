/**
 * Prompt templates — inlined from the original apps/api/src/prompts/v1/*.txt
 * files so they bundle safely into serverless functions (no fs reads).
 *
 * renderPrompt substitutes {variable} placeholders; double braces {{ }}
 * pass through untouched, which is how JSON examples survive rendering.
 */

const PROMPTS: Record<string, string> = {
  "v1/code_generation": `You are a senior software engineer. Generate a production-grade solution for the following problem.

Problem: {problem_description}

Language: {language}
Difficulty: {difficulty}

Requirements:
- Write clean, well-commented code
- Handle edge cases (empty input, invalid values, boundary conditions)
- Follow {language} best practices and conventions
- Include type hints / type annotations where applicable
- Optimize for readability and maintainability
- DO NOT include any explanation or introductory text — return ONLY the code
- Return the code inside a single markdown code block with the language identifier

Example output format:
\`\`\`python
def solution(input_data):
    # implementation
    pass
\`\`\``,

  "v1/quiz_generation": `You are a technical quiz generator. You are given a piece of code and optional annotations explaining parts of it. Generate {count} multiple-choice questions that test deep understanding of the code.

Code:
{code}

Annotations (student's explanations of code sections):
{annotations}

Instructions for each question:
1. Focus on understanding WHY the code works, not just WHAT it does
2. Include exactly 4 options labeled A through D
3. Exactly one option must be correct
4. Include at least one distractor that reflects a common misconception
5. Vary difficulty — some surface-level, some requiring deep reasoning
6. Each question should have a brief explanation of why the correct answer is right

Return ONLY a valid JSON object with no additional text. Use this exact format:
{{
  "title": "Comprehension Check: {topic}",
  "questions": [
    {{
      "id": "q-1",
      "question": "Why does the code do X on line Y?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_option": 0,
      "explanation": "Brief explanation of why A is correct."
    }}
  ]
}}

Generate exactly {count} questions.`,

  "v1/defend_question": `You are conducting a Socratic interview about a developer's code submission. The developer has rebuilt a solution from memory during a Defend session. Ask them a probing question to test whether they truly understand the code's design decisions.

Original problem: {problem_description}

Developer's submitted code:
{code}

Conversation so far:
{messages}

Ask ONE probing question that:
- Challenges a specific design choice in their code (data structure, algorithm, pattern)
- Tests understanding of time or space complexity tradeoffs
- Probes error handling or edge cases they may have missed
- Asks WHY they chose one approach over an alternative
- Pushes them to think about scalability or real-world implications

Rules:
- Do NOT ask yes/no questions — require a substantive answer
- Do NOT ask about obvious syntax — ask about design reasoning
- Do NOT repeat a question already asked (check conversation history)
- Return ONLY the question text, no explanations or prefixes`,

  "v1/defend_evaluation": `You are evaluating a developer's answer in a Defend session. Determine whether their response demonstrates genuine understanding of their code.

Question asked: {question}
Developer's answer: {answer}

Full code context:
{code}

Evaluate on these criteria:
1. Accuracy — Is the answer technically correct?
2. Depth — Does it show understanding beyond surface level?
3. Specificity — Does it reference specific lines, variables, or decisions in the code?
4. Confidence — Does the answer sound certain or guess-like?

Return ONLY a JSON object with no additional text:
{{
  "passed": true,
  "feedback": "Constructive feedback explaining what was right and what could be improved.",
  "score": 85
}}

- passed: true if score >= 60, false otherwise
- feedback: 1-3 sentences with specific, actionable feedback referencing their answer
- score: 0-100 integer reflecting overall understanding`,
};

export function renderPrompt(
  name: string,
  variables: Record<string, string>,
  version = "v1",
): string {
  const key = `${version}/${name}`;
  const template = PROMPTS[key];
  if (!template) {
    throw new Error(
      `Prompt template '${key}' not found. Available: ${Object.keys(PROMPTS).join(", ")}`,
    );
  }
  let result = template;
  for (const [key2, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key2}\\}`, "g"), value);
  }
  return result;
}

export function stripMarkdownFence(text: string): string {
  text = text.trim();
  if (text.startsWith("```")) {
    const firstNewline = text.indexOf("\n");
    if (firstNewline !== -1) {
      text = text.slice(firstNewline + 1);
    }
    if (text.endsWith("```")) {
      text = text.slice(0, -3).trim();
    } else {
      const lastFence = text.lastIndexOf("```");
      if (lastFence !== -1) {
        text = text.slice(0, lastFence).trim();
      }
    }
  }
  return text;
}
