/**
 * Prompt template loader — ports prompt_manager.py from the Python AI service.
 *
 * Loads .txt prompt templates from the prompts/ directory and renders them
 * with the provided variables using string substitution.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import pino from "pino";

const logger = pino({ name: "prompts" });
const PROMPTS_DIR = resolve(__dirname, "../prompts");

interface TemplateCache {
  [key: string]: string;
}

const cache: TemplateCache = {};

function loadPromptTemplate(name: string, version = "v1"): string {
  const cacheKey = `${version}/${name}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const templatePath = join(PROMPTS_DIR, version, `${name}.txt`);
  if (!existsSync(templatePath)) {
    const dirPath = join(PROMPTS_DIR, version);
    let available: string[] = [];
    try {
      available = readdirSync(dirPath)
        .filter((f) => f.endsWith(".txt"))
        .map((f) => f.replace(/\.txt$/, ""));
    } catch {
      // directory doesn't exist
    }
    throw new Error(
      `Prompt template '${name}' not found at ${templatePath}.` +
        (available.length ? ` Available: ${available.join(", ")}` : ""),
    );
  }

  const content = readFileSync(templatePath, "utf-8");
  cache[cacheKey] = content;
  return content;
}

export function renderPrompt(
  name: string,
  variables: Record<string, string>,
  version = "v1",
): string {
  const template = loadPromptTemplate(name, version);
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
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
