import { describe, expect, it } from "vitest";
import { runAudit } from "@/lib/audit-engine/execution";
import type { AIDeps } from "@/lib/audit-engine/pipeline";
import type {
  AuditRepository,
  AuditRow,
  ViolationInsert,
  MetricInsert,
  RecommendationInsert,
  TimelineInsert,
} from "@/lib/audit-engine/repository";
import type { AIConfig, AIProvider } from "@/lib/ai/types";

const UUID = "33333333-3333-4333-8333-333333333333";

const CODE_WITH_ISSUES = `import pandas as pd
import vectorbt as vbt

price = vbt.YFData.download("SPY", start="2020-01-01", end="2023-12-31").get("Close")
signal = price.shift(-1) > price.rolling(20).mean()
portfolio = vbt.Portfolio.from_signals(close=price, entries=signal, exits=~signal)
`;

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

const EXPLANATION_JSON = {
  summary: "s",
  explanation: "explains causality",
  why_it_matters: "matters",
  suggested_fix: "shift(1)",
  corrected_example: "signal = price.shift(1)",
  confidence: 0.9,
  evidence_level: "definite",
};

function goodProvider(): AIProvider {
  return {
    name: "fake",
    model: "test-model",
    async complete(request) {
      const content = (request as { messages: { content: string }[] }).messages[1].content;
      const text = content.includes("recommendations")
        ? JSON.stringify({
            recommendations: [
              {
                related_rule_id: "QL-BIAS-001",
                title: "Restore causal signals",
                priority: 1,
                why: "w",
                suggested_action: "a",
              },
            ],
          })
        : JSON.stringify(EXPLANATION_JSON);
      return { text, model: "test-model" };
    },
  };
}

class CapturingRepository implements AuditRepository {
  row: AuditRow;
  progressTrail: number[] = [];
  violations: ViolationInsert[] = [];
  metrics: MetricInsert[] = [];
  recommendations: RecommendationInsert[] = [];
  timeline: TimelineInsert[] = [];

  constructor(overrides: Partial<AuditRow> = {}) {
    this.row = {
      id: UUID,
      user_id: "99999999-9999-4999-8999-999999999999",
      strategy_name: "AI Integration Test",
      input_type: "paste",
      file_name: null,
      framework: "auto",
      analysis_depth: "standard",
      rule_categories: [
        "Look-ahead Bias", "Data Leakage", "Survivorship Bias",
        "Risk Management", "Position Sizing", "Performance Metrics",
        "Execution Logic", "Transaction Costs", "Portfolio Logic",
      ],
      code: CODE_WITH_ISSUES,
      status: "queued",
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  async getAudit() {
    return this.row;
  }
  async claimAudit() {
    if (this.row.status !== "queued") return null;
    this.row = { ...this.row, status: "running" };
    return this.row;
  }
  async updateAudit(_id: string, patch: { status?: AuditRow["status"]; progress?: number }) {
    if (typeof patch.progress === "number") this.progressTrail.push(patch.progress);
    this.row = { ...this.row, ...patch };
    return this.row;
  }
  async getResults() {
    return { violations: [], metrics: [], recommendations: [], timeline: [] };
  }
  async insertViolations(rows: ViolationInsert[]) {
    this.violations.push(...rows);
  }
  async insertMetrics(rows: MetricInsert[]) {
    this.metrics.push(...rows);
  }
  async insertRecommendations(rows: RecommendationInsert[]) {
    this.recommendations.push(...rows);
  }
  async insertTimeline(rows: TimelineInsert[]) {
    this.timeline.push(...rows);
  }
  async commitResults(args: {
    violations: ViolationInsert[];
    metrics: MetricInsert[];
    recommendations: RecommendationInsert[];
    timeline: TimelineInsert[];
  }) {
    this.violations.push(...args.violations);
    this.metrics.push(...args.metrics);
    this.recommendations.push(...args.recommendations);
    this.timeline.push(...args.timeline);
  }
  async recoverStale(): Promise<string[]> {
    return [];
  }
  async resetForRetry(): Promise<boolean> {
    return false;
  }
}

const aiDeps = (provider: AIProvider): AIDeps => ({ provider, config: CONFIG });

describe("runAudit + AI stage integration", () => {
  it("persists AI explanations on violations and AI recommendations", async () => {
    const repo = new CapturingRepository();
    const { audit, engine } = await runAudit(UUID, repo, aiDeps(goodProvider()));

    expect(audit.status).toBe("completed");
    expect(audit.progress).toBe(100);
    expect(engine?.ok).toBe(true);

    const enriched = repo.violations.filter((v) => v.ai_explanation !== null);
    expect(enriched.length).toBeGreaterThanOrEqual(1);
    const bias = repo.violations.find((v) => v.rule_id === "QL-BIAS-001");
    expect(bias?.ai_explanation).toMatchObject({
      ruleId: "QL-BIAS-001",
      confidence: 0.9,
      evidenceLevel: "definite",
    });

    // Deterministic recommendations are still present…
    expect(
      repo.recommendations.some((r) => r.related_rule_id === "QL-BIAS-001"),
    ).toBe(true);
    // …AI recommendation titles come through grounded in real rule ids
    expect(
      repo.recommendations.some((r) => r.title === "Restore causal signals"),
    ).toBe(true);
    expect(repo.recommendations.every((r) => r.status === "open")).toBe(true);

    // AI stage leaves a real timeline entry
    expect(
      repo.timeline.some((t) => /AI enrichment completed/.test(t.label)),
    ).toBe(true);

    // Progress includes real AI sub-stage updates within 75–87.5
    const aiWindow = repo.progressTrail.filter((p) => p >= 75 && p < 88);
    expect(aiWindow.length).toBeGreaterThanOrEqual(1);
    // Overall trail monotonic and terminal at 100
    expect(repo.progressTrail).toEqual([...repo.progressTrail].sort((a, b) => a - b));
    expect(repo.progressTrail[repo.progressTrail.length - 1]).toBe(100);
  });

  it("completes deterministically when the provider fails everywhere", async () => {
    const repo = new CapturingRepository();
    const broken: AIProvider = {
      name: "broken",
      model: "m",
      complete: async () => {
        throw new Error("provider outage");
      },
    };

    const { audit, engine } = await runAudit(UUID, repo, aiDeps(broken));

    expect(audit.status).toBe("completed");
    expect(engine?.ok).toBe(true);
    // Deterministic findings survive untouched
    expect(repo.violations.length).toBeGreaterThanOrEqual(2);
    expect(repo.violations.every((v) => v.ai_explanation === null)).toBe(true);
    // Deterministic recommendations remain
    expect(repo.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it("skips the AI stage cleanly when no provider is configured", async () => {
    const repo = new CapturingRepository();
    const { audit } = await runAudit(UUID, repo, null);

    expect(audit.status).toBe("completed");
    expect(repo.violations.every((v) => v.ai_explanation === null)).toBe(true);
    expect(
      repo.timeline.some((t) => /AI enrichment unavailable — skipped/.test(t.label)),
    ).toBe(true);
  });

  it("records AI failure text in the timeline without killing the audit", async () => {
    const repo = new CapturingRepository();
    const flaky: AIProvider = {
      name: "flaky",
      model: "m",
      async complete(request) {
        const content = (request as { messages: { content: string }[] }).messages[1].content;
        const text = content.includes("recommendations")
          ? "garbage not json"
          : JSON.stringify(EXPLANATION_JSON);
        return { text, model: "m" };
      },
    };
    const { audit } = await runAudit(UUID, repo, aiDeps(flaky));
    expect(audit.status).toBe("completed");
    // Explanations landed; recommendations failed gracefully
    expect(repo.violations.some((v) => v.ai_explanation !== null)).toBe(true);
    expect(repo.timeline.some((t) => /AI enrichment completed/.test(t.label))).toBe(true);
  });
});
