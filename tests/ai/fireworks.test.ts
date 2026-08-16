import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FireworksProvider } from "@/lib/ai/fireworks";
import { readAIConfig, DEFAULT_FIREWORKS_MODEL, getAIProvider } from "@/lib/ai/provider";
import type { AIConfig } from "@/lib/ai/types";

function testConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    apiKey: "fw-test-key-DO-NOT-LEAK",
    model: "accounts/fireworks/models/deepseek-v4-flash-0731",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    temperature: 0.2,
    maxTokens: 100,
    timeoutMs: 5_000,
    maxAttempts: 2,
    maxFindings: 10,
    maxContextChars: 6_000,
    ...overrides,
  };
}

function okResponse(text: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: text } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("readAIConfig (env)", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("returns null when the API key is missing", () => {
    vi.stubEnv("FIREWORKS_API_KEY", "");
    expect(readAIConfig()).toBeNull();
  });

  it("falls back to the default model when FIREWORKS_MODEL is unset", () => {
    vi.stubEnv("FIREWORKS_API_KEY", "k");
    delete process.env.FIREWORKS_MODEL;
    const config = readAIConfig();
    expect(config?.model).toBe(DEFAULT_FIREWORKS_MODEL);
  });

  it("respects FIREWORKS_MODEL overrides", () => {
    vi.stubEnv("FIREWORKS_API_KEY", "k");
    vi.stubEnv("FIREWORKS_MODEL", "accounts/fireworks/models/other");
    expect(readAIConfig()?.model).toBe("accounts/fireworks/models/other");
  });

  it("clamps invalid numeric tuning to sane ranges", () => {
    vi.stubEnv("FIREWORKS_API_KEY", "k");
    vi.stubEnv("AI_TEMPERATURE", "99");
    vi.stubEnv("AI_MAX_FINDINGS", "1000");
    const config = readAIConfig();
    expect(config?.temperature).toBe(2);
    expect(config?.maxFindings).toBe(25);
  });

  it("getAIProvider returns null without a key (graceful degradation)", () => {
    vi.stubEnv("FIREWORKS_API_KEY", "");
    expect(getAIProvider()).toBeNull();
  });
});

describe("FireworksProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends auth, model, messages, and JSON mode to the chat completions API", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const provider = new FireworksProvider(testConfig());
    fetchMock.mockResolvedValue(okResponse('{"summary":"ok"}'));

    await provider.complete({
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hello" },
      ],
      jsonMode: true,
    });

    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.fireworks.ai/inference/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer fw-test-key-DO-NOT-LEAK",
    );
    const body = JSON.parse(init.body);
    expect(body.model).toBe("accounts/fireworks/models/deepseek-v4-flash-0731");
    expect(body.messages).toHaveLength(2);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.temperature).toBe(0.2);
  });

  it("returns extracted content and model on success", async () => {
    const provider = new FireworksProvider(testConfig());
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      okResponse('{"a":1}'),
    );
    const result = await provider.complete({ messages: [{ role: "user", content: "x" }] });
    expect(result.text).toBe('{"a":1}');
    expect(result.model).toBe("accounts/fireworks/models/deepseek-v4-flash-0731");
  });

  it("retries once on 500 and succeeds", async () => {
    const provider = new FireworksProvider(testConfig());
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    mock.mockResolvedValueOnce(okResponse('{"a":1}'));
    const result = await provider.complete({ messages: [] });
    expect(result.text).toBe('{"a":1}');
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("stops retrying after maxAttempts on persistent 429", async () => {
    const provider = new FireworksProvider(testConfig());
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValue(new Response("rate", { status: 429 }));
    await expect(provider.complete({ messages: [] })).rejects.toThrow(/429/);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable 401", async () => {
    const provider = new FireworksProvider(testConfig());
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValue(new Response("unauth", { status: 401 }));
    await expect(provider.complete({ messages: [] })).rejects.toThrow(/401/);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("treats empty model output as a retryable provider error", async () => {
    const provider = new FireworksProvider(testConfig());
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mock.mockResolvedValue(okResponse(""));
    mock.mockResolvedValue(okResponse("   "));
    await expect(provider.complete({ messages: [] })).rejects.toThrow(/empty/i);
  });

  it("surfaces timeouts as retryable errors without leaking the key", async () => {
    const provider = new FireworksProvider(
      testConfig({ timeoutMs: 20, maxAttempts: 1 }),
    );
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error("slow")), 100)),
    );
    const error = await provider.complete({ messages: [] }).catch((e) => e);
    expect(error.message).toMatch(/network|timeout/i);
    expect(error.message).not.toContain("fw-test-key-DO-NOT-LEAK");
  });
});
