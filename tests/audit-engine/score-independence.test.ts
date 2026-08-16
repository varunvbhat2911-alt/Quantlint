import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/audit-engine/engine";
import type { AIDeps } from "@/lib/audit-engine/pipeline";
import type { AIProvider, AIConfig } from "@/lib/ai/types";

/* 7I — score/grade independence: identical deterministic findings must
 * produce an identical score/grade whether AI succeeds, fails, or is
 * absent. AI output must never alter deterministic fields. */

const ALL_CATEGORIES = [
  "Look-ahead Bias",
  "Data Leakage",
  "Survivorship Bias",
  "Risk Management",
  "Position Sizing",
  "Performance Metrics",
  "Execution Logic",
  "Transaction Costs",
  "Portfolio Logic",
] as const;

const SOURCE = `import pandas as pd


def run(close):
    signal = close.pct_change().shift(-1)
    return signal * 20.0
`;

const CONFIG: AIConfig = {
  apiKey: "fw-test",
  model: "test-model",
  baseUrl: "https://example.invalid/v1",
  temperature: 0.2,
  maxTokens: 100,
  timeoutMs: 5_000,
  maxAttempts: 1,
  maxFindings: 10,
  maxContextChars: 6_000,
};

const VALID_EXPLANATION = JSON.stringify({
  summary: "s",
  explanation: "the negative shift references future bars",
  why_it_matters: "backtests become unrealistically optimistic",
  suggested_fix: "use shift(1)",
  corrected_example: null,
  confidence: 0.7,
  evidence_level: "definite",
  assumptions: [],
  caveats: ["runtime data unseen"],
});

function input() {
  return {
    code: SOURCE,
    fileName: "strategy.py",
    declaredFramework: "pandas" as const,
    analysisDepth: "standard" as const,
    ruleCategories: [...ALL_CATEGORIES],
  };
}

function succeedingProvider(): AIProvider {
  return {
    name: "fake",
    model: "test-model",
    async complete() {
      return { text: VALID_EXPLANATION, model: "test-model" };
    },
  };
}

function hallucinatingProvider(): AIProvider {
  return {
    name: "fake",
    model: "test-model",
    async complete(request: { messages: { content: string }[] }) {
      const isRecommendations = request.messages.some((m) =>
        m.content.includes("recommendations"),
      );
      return {
        text: isRecommendations
          ? JSON.stringify({
              recommendations: [
                {
                  related_rule_id: "QL-MADE-UP-999",
                  title: "Buy my course",
                  why: "improves returns by 40%",
                  suggested_action: "send money",
                  priority: 1,
                },
                {
                  related_rule_id: "QL-BIAS-001",
                  title: "Fix the negative shift",
                  why: "removes future leakage",
                  suggested_action: "use shift(1)",
                  priority: 2,
                },
              ],
            })
          : JSON.stringify({
              summary: "s",
              explanation: "this yields a Sharpe of 2.4 in backtests",
              why_it_matters: "huge profits of 30% CAGR",
              suggested_fix: "use shift(1)",
              confidence: 0.9,
              evidence_level: "definite",
              assumptions: [],
              caveats: [],
            }),
        model: "test-model",
      };
    },
  };
}

function failingProvider(): AIProvider {
  return {
    name: "fake",
    model: "test-model",
    async complete() {
      throw new Error("provider outage");
    },
  };
}

async function runWith(aiDeps?: AIDeps | null) {
  return runEngine(input(), undefined, aiDeps);
}

describe("score/grade independence from AI (7I)", () => {
  it("AI success, AI failure, and no AI produce identical scores/grades/findings", async () => {
    const success = await runWith({ provider: succeedingProvider(), config: CONFIG });
    const failure = await runWith({ provider: failingProvider(), config: CONFIG });
    const none = await runWith(null);

    for (const result of [success, failure, none]) {
      expect(result.ok).toBe(true);
    }
    expect(success.score).toBe(failure.score);
    expect(success.score).toBe(none.score);
    expect(success.grade).toBe(failure.grade);
    expect(success.grade).toBe(none.grade);
    expect(success.gradeStatus).toBe(none.gradeStatus);

    const fingerprint = (r: typeof success) =>
      r.findings
        .map((f) => `${f.ruleId}:${f.severity}:${f.line}:${f.codeSnippet ?? ""}`)
        .sort()
        .join("|");
    expect(fingerprint(success)).toBe(fingerprint(failure));
    expect(fingerprint(success)).toBe(fingerprint(none));
  });

  it("deterministic fields are identical whether or not the AI enriched them", async () => {
    const success = await runWith({ provider: succeedingProvider(), config: CONFIG });
    const none = await runWith(null);
    for (let i = 0; i < success.findings.length; i++) {
      const a = success.findings[i];
      const b = none.findings[i];
      expect(a.ruleId).toBe(b.ruleId);
      expect(a.severity).toBe(b.severity);
      expect(a.category).toBe(b.category);
      expect(a.line).toBe(b.line);
      expect(a.fileName).toBe(b.fileName);
      expect(a.codeSnippet).toBe(b.codeSnippet);
      expect(a.detectedPattern).toBe(b.detectedPattern);
    }
  });

  it("hallucinating AI output is rejected wholesale — nothing reaches findings", async () => {
    const hostile = await runWith({ provider: hallucinatingProvider(), config: CONFIG });
    const none = await runWith(null);

    // Explanations with fabricated figures were dropped…
    const enriched = hostile.findings.filter((f) => f.aiExplanation);
    expect(enriched).toHaveLength(0);

    // …the fake recommendation rule id never entered recommendations…
    expect(
      hostile.recommendations.some((r) => r.relatedRuleId === "QL-MADE-UP-999"),
    ).toBe(false);
    expect(
      hostile.recommendations.some((r) => /course|40%/.test(`${r.title}${r.why}`)),
    ).toBe(false);

    // …and the deterministic result is byte-identical to the no-AI run.
    expect(hostile.score).toBe(none.score);
    expect(hostile.grade).toBe(none.grade);
    expect(hostile.findings.length).toBe(none.findings.length);
  });

  it("deterministic recommendations exist regardless of AI state", async () => {
    const none = await runWith(null);
    expect(none.recommendations.length).toBeGreaterThan(0);
    for (const r of none.recommendations) {
      expect(r.relatedRuleId).toMatch(/^QL-[A-Z]+-\d+$/);
    }
  });
});
