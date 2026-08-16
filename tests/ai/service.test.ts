import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  runAIStage,
  trimContext,
  validateExplanation,
  validateRecommendations,
} from "@/lib/ai/service";
import type { AIConfig, AIProvider } from "@/lib/ai/types";
import type { EngineFinding } from "@/lib/audit-engine/types";

const CONFIG: AIConfig = {
  apiKey: "fw-test",
  model: "test-model",
  baseUrl: "https://example.invalid/v1",
  temperature: 0.2,
  maxTokens: 100,
  timeoutMs: 5_000,
  maxAttempts: 1,
  maxFindings: 5,
  maxContextChars: 6_000,
};

function makeFinding(overrides: Partial<EngineFinding> = {}): EngineFinding {
  return {
    ruleId: "QL-BIAS-001",
    category: "bias",
    severity: "critical",
    title: "Look-ahead bias",
    description: "desc",
    whyItMatters: "why",
    suggestedFix: "fix",
    fileName: "s.py",
    line: 3,
    detectedPattern: "shift(-1)",
    codeSnippet: "x.shift(-1)",
    fixSnippet: null,
    ...overrides,
  };
}

function makeProvider(responder: (messages: unknown) => string): AIProvider {
  return {
    name: "fake",
    model: "test-model",
    async complete(request) {
      return { text: responder(request), model: "test-model" };
    },
  };
}

const EXPLANATION_JSON = {
  summary: "s",
  explanation: "explains the causal issue",
  why_it_matters: "matters a lot",
  suggested_fix: "use shift(1)",
  corrected_example: "signal = close.shift(1) > mean",
  confidence: 0.8,
  evidence_level: "definite",
  assumptions: [],
  caveats: ["limited context"],
};

describe("extractJsonObject", () => {
  it("parses plain JSON", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses markdown-fenced JSON", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON embedded in prose", () => {
    expect(extractJsonObject('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });

  it("returns null for garbage", () => {
    expect(extractJsonObject("not json at all")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
  });
});

describe("validateExplanation", () => {
  it("accepts a valid payload and fills engine-side fields", () => {
    const result = validateExplanation(EXPLANATION_JSON, makeFinding(), "m1");
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe("QL-BIAS-001");
    expect(result?.finding).toBe("Look-ahead bias");
    expect(result?.confidence).toBe(0.8);
    expect(result?.evidenceLevel).toBe("definite");
    expect(result?.model).toBe("m1");
  });

  it("rejects payloads missing required text fields", () => {
    expect(validateExplanation({ ...EXPLANATION_JSON, explanation: "" }, makeFinding(), "m")).toBeNull();
    expect(validateExplanation({ ...EXPLANATION_JSON, why_it_matters: null }, makeFinding(), "m")).toBeNull();
    expect(validateExplanation("nope", makeFinding(), "m")).toBeNull();
  });

  it("clamps confidence and defaults the evidence level", () => {
    const result = validateExplanation(
      { ...EXPLANATION_JSON, confidence: 7.5, evidence_level: "vibes" },
      makeFinding(),
      "m",
    );
    expect(result?.confidence).toBe(1);
    expect(result?.evidenceLevel).toBe("likely");
  });
});

describe("validateRecommendations", () => {
  const findings = [makeFinding(), makeFinding({ ruleId: "QL-COST-001", severity: "warning" })];
  const validIds = new Set(["QL-BIAS-001", "QL-COST-001"]);

  it("keeps only recommendations grounded in real rule ids", () => {
    const result = validateRecommendations(
      {
        recommendations: [
          { related_rule_id: "QL-BIAS-001", title: "t1", priority: 1, why: "w", suggested_action: "a" },
          { related_rule_id: "QL-INVENTED-999", title: "t2", priority: 2, why: "w", suggested_action: "a" },
        ],
      },
      validIds,
      findings,
    );
    expect(result).toHaveLength(1);
    expect(result[0].relatedRuleId).toBe("QL-BIAS-001");
    // severity comes from the deterministic finding, not the model
    expect(result[0].severity).toBe("critical");
  });

  it("clamps priority and caps the count", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      related_rule_id: "QL-BIAS-001",
      title: `t${i}`,
      priority: 99,
      why: "w",
      suggested_action: "a",
    }));
    const result = validateRecommendations({ recommendations: many }, validIds, findings);
    expect(result).toHaveLength(6);
    expect(result.every((r) => r.priority <= 20)).toBe(true);
  });
});

describe("trimContext", () => {
  it("keeps short contexts intact", () => {
    expect(trimContext("x = 1", 100)).toBe("x = 1");
  });

  it("trims head+tail with a marker", () => {
    const long = "a".repeat(300);
    const trimmed = trimContext(long, 100);
    expect(trimmed.length).toBeLessThan(160);
    expect(trimmed).toContain("[trimmed]");
    expect(trimmed.startsWith("a")).toBe(true);
    expect(trimmed.endsWith("a")).toBe(true);
  });
});

describe("runAIStage", () => {
  it("enriches eligible findings and returns grounded recommendations", async () => {
    const provider = makeProvider((request) => {
      const content = (request as { messages: { content: string }[] }).messages[1].content;
      if (content.includes("recommendations")) {
        return JSON.stringify({
          recommendations: [
            { related_rule_id: "QL-BIAS-001", title: "Fix causality", priority: 1, why: "w", suggested_action: "a" },
          ],
        });
      }
      return JSON.stringify(EXPLANATION_JSON);
    });

    const progress: number[] = [];
    const result = await runAIStage(
      provider,
      CONFIG,
      [makeFinding()],
      { strategyName: "S", framework: "vectorbt", analysisDepth: "standard" },
      (f) => progress.push(f),
    );

    expect(result.skipped).toBe(false);
    expect(result.explanations.size).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].severity).toBe("critical");
    // Real progress reported monotonically
    expect(progress.length).toBeGreaterThan(0);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
  });

  it("counts invalid model output as failed without throwing", async () => {
    const provider = makeProvider(() => "I am a chatbot, hear me roar");
    const result = await runAIStage(
      provider,
      CONFIG,
      [makeFinding()],
      { strategyName: "S", framework: "pandas", analysisDepth: "fast" },
    );
    expect(result.failed).toBe(1);
    expect(result.explanations.size).toBe(0);
  });

  it("survives provider errors for every finding (graceful degradation)", async () => {
    const provider: AIProvider = {
      name: "broken",
      model: "m",
      complete: async () => {
        throw new Error("provider down");
      },
    };
    const result = await runAIStage(
      provider,
      CONFIG,
      [makeFinding(), makeFinding({ ruleId: "QL-COST-001", severity: "warning" })],
      { strategyName: "S", framework: "pandas", analysisDepth: "fast" },
    );
    expect(result.failed).toBe(2);
    expect(result.explanations.size).toBe(0);
    expect(result.recommendations).toHaveLength(0);
  });

  it("skips when there are no findings", async () => {
    const result = await runAIStage(
      makeProvider(() => "{}"),
      CONFIG,
      [],
      { strategyName: "S", framework: "pandas", analysisDepth: "fast" },
    );
    expect(result.skipped).toBe(true);
  });

  it("skips informational-only findings (cost control)", async () => {
    let called = 0;
    const provider = makeProvider(() => {
      called++;
      return JSON.stringify(EXPLANATION_JSON);
    });
    const result = await runAIStage(
      provider,
      CONFIG,
      [makeFinding({ severity: "info" })],
      { strategyName: "S", framework: "pandas", analysisDepth: "fast" },
    );
    expect(result.skipped).toBe(true);
    expect(called).toBe(0);
  });

  it("caps the number of findings sent (cost control)", async () => {
    let called = 0;
    const provider = makeProvider(() => {
      called++;
      return JSON.stringify(EXPLANATION_JSON);
    });
    const many = Array.from({ length: 8 }, (_, i) =>
      makeFinding({ ruleId: `QL-R-${i}`, severity: i % 2 ? "warning" : "critical" }),
    );
    const result = await runAIStage(
      provider,
      { ...CONFIG, maxFindings: 3 },
      many,
      { strategyName: "S", framework: "pandas", analysisDepth: "fast" },
    );
    expect(result.requested).toBe(3);
    // 3 explanation calls + 1 recommendations call
    expect(called).toBe(4);
  });
});
