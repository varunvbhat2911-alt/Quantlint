/* Fireworks AI provider — the ONLY module that talks to Fireworks.
 *
 * Server-side only. Handles auth, timeout, bounded retries for transient
 * failures (429/5xx/network), and JSON-mode requests. Raw provider errors
 * never reach the browser; callers receive AIProviderError with status only. */

import {
  AIProviderError,
  type AICompletionRequest,
  type AICompletionResult,
  type AIConfig,
  type AIProvider,
} from "./types";

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export class FireworksProvider implements AIProvider {
  readonly name = "fireworks";

  constructor(private readonly config: AIConfig) {}

  get model(): string {
    return this.config.model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    let lastError: AIProviderError | null = null;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await this.completeOnce(request);
      } catch (err) {
        const providerError =
          err instanceof AIProviderError
            ? err
            : new AIProviderError(
                err instanceof Error ? err.message : "Unknown provider error",
                undefined,
                true,
              );
        lastError = providerError;
        if (!providerError.retryable || attempt === this.config.maxAttempts) break;
        // Linear backoff, bounded — no indefinite retries (3L)
        await sleep(Math.min(4_000, 500 * attempt));
      }
    }

    throw lastError ?? new AIProviderError("AI request failed.");
  }

  private async completeOnce(
    request: AICompletionRequest,
  ): Promise<AICompletionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Key exists only in this header; never logged, never returned.
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: request.messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          ...(request.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const retryable = RETRYABLE_STATUS.has(res.status);
        // Body text is not propagated — it could echo request metadata.
        throw new AIProviderError(
          `Fireworks API responded ${res.status}.`,
          res.status,
          retryable,
        );
      }

      const payload: unknown = await res.json().catch(() => null);
      const text = extractContent(payload);
      if (!text || text.trim().length === 0) {
        throw new AIProviderError("Fireworks API returned empty content.", undefined, true);
      }
      return { text, model: this.config.model };
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError("Fireworks API request timed out.", undefined, true);
      }
      throw new AIProviderError(
        err instanceof Error ? `Network error: ${err.message}` : "Network error.",
        undefined,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function extractContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  const content = message?.content;
  return typeof content === "string" ? content : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
