/* AI provider configuration and factory (server-only reads of env).
 *
 * FIREWORKS_API_KEY is referenced exclusively here — never from client code,
 * never NEXT_PUBLIC_*, never logged. When the key is absent the factory
 * returns null and audits continue deterministically. */

import type { AIConfig } from "./types";
import { FireworksProvider } from "./fireworks";

export const DEFAULT_FIREWORKS_MODEL =
  "accounts/fireworks/models/deepseek-v4-flash-0731";

export function readAIConfig(): AIConfig | null {
  const apiKey = process.env.FIREWORKS_API_KEY?.trim();
  if (!apiKey) return null;

  const num = (name: string, fallback: number, min: number, max: number) => {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };

  return {
    apiKey,
    model: process.env.FIREWORKS_MODEL?.trim() || DEFAULT_FIREWORKS_MODEL,
    baseUrl: process.env.FIREWORKS_BASE_URL?.trim() || "https://api.fireworks.ai/inference/v1",
    temperature: num("AI_TEMPERATURE", 0.2, 0, 2),
    maxTokens: Math.round(num("AI_MAX_TOKENS", 1500, 128, 8192)),
    timeoutMs: Math.round(num("AI_TIMEOUT_MS", 30_000, 5_000, 120_000)),
    maxAttempts: Math.round(num("AI_MAX_ATTEMPTS", 2, 1, 3)),
    maxFindings: Math.round(num("AI_MAX_FINDINGS", 10, 1, 25)),
    maxContextChars: Math.round(num("AI_MAX_CONTEXT_CHARS", 6_000, 500, 60_000)),
  };
}

export function getAIProvider() {
  const config = readAIConfig();
  if (!config) return null;
  return { provider: new FireworksProvider(config), config };
}
