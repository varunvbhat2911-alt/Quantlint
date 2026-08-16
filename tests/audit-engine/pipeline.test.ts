import { beforeAll, describe, expect, it } from "vitest";
import { runEngine } from "@/lib/audit-engine/engine";
import { AUDIT_STAGES, type EngineInput } from "@/lib/audit-engine/types";

const ALL_CATEGORIES: EngineInput["ruleCategories"] = [
  "Look-ahead Bias",
  "Data Leakage",
  "Survivorship Bias",
  "Risk Management",
  "Position Sizing",
  "Performance Metrics",
  "Execution Logic",
  "Transaction Costs",
  "Portfolio Logic",
];

const VALID = `import pandas as pd
import vectorbt as vbt

price = vbt.YFData.download("SPY", start="2020-01-01", end="2023-12-31").get("Close")
signal = price.shift(-1) > price.rolling(20).mean()
portfolio = vbt.Portfolio.from_signals(close=price, entries=signal, exits=~signal)
print(portfolio.stats())
`;

describe("runPipeline success path", () => {
  let result: Awaited<ReturnType<typeof runEngine>>;

  beforeAll(async () => {
    result = await runEngine({
      code: VALID,
      fileName: "strategy.py",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ALL_CATEGORIES,
    });
  });

  it("completes all stages (deterministic + AI slot + report)", () => {
    expect(result.ok).toBe(true);
    expect(result.stageResults.map((s) => s.stage)).toEqual([...AUDIT_STAGES]);
    expect(result.stageResults.every((s) => s.ok)).toBe(true);
  });

  it("records a timeline entry per stage with real timestamps", () => {
    expect(result.timeline).toHaveLength(AUDIT_STAGES.length);
    for (const entry of result.timeline) {
      expect(!Number.isNaN(Date.parse(entry.at))).toBe(true);
    }
    const times = result.timeline.map((t) => Date.parse(t.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("finds the planted look-ahead bias", () => {
    expect(result.findings.some((f) => f.ruleId === "QL-BIAS-001")).toBe(true);
  });

  it("computes deterministic metrics without trading numbers", () => {
    const keys = result.metrics.map((m) => m.key);
    expect(keys).toContain("critical");
    expect(keys).toContain("rules-executed");
    expect(keys).toContain("code-lines");
    // No fabricated trading performance metrics
    expect(keys).not.toContain("sharpe");
    expect(keys).not.toContain("cagr");
    for (const m of result.metrics) {
      expect(Number.isNaN(Number(m.value))).toBe(false);
    }
  });

  it("scores deterministically from finding severities", () => {
    const recomputed = 100 - (result.stats.criticalCount * 15 + result.stats.warningCount * 5 + result.stats.infoCount * 1);
    expect(result.score).toBe(Math.max(0, Math.min(100, recomputed)));
  });

  it("derives recommendations from real findings only", () => {
    expect(result.recommendations.length).toBeLessThanOrEqual(10);
    for (const rec of result.recommendations) {
      expect(result.findings.some((f) => f.ruleId === rec.relatedRuleId)).toBe(true);
    }
  });
});

describe("runPipeline failure path", () => {
  it("fails cleanly on malformed Python", async () => {
    const result = await runEngine({
      code: "def broken(:\n    x = (1 + 2\n",
      fileName: "bad.py",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ALL_CATEGORIES,
    });
    expect(result.ok).toBe(false);
    expect(result.fatalError).toMatch(/syntax validation failed/);
    expect(result.findings).toHaveLength(0);
    expect(result.timeline.some((t) => t.label.startsWith("Audit failed"))).toBe(true);
  });

  it("fails cleanly on empty source", async () => {
    const result = await runEngine({
      code: "   \n\t\n",
      fileName: null,
      declaredFramework: "auto",
      analysisDepth: "fast",
      ruleCategories: ALL_CATEGORIES,
    });
    expect(result.ok).toBe(false);
    expect(result.fatalError).toMatch(/empty/i);
  });

  it("never reports fabricated line numbers — null when unknown", async () => {
    const result = await runEngine({
      code: "import vectorbt as vbt\nportfolio = vbt.Portfolio.from_signals(close=price)\n",
      fileName: "x.py",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ALL_CATEGORIES,
    });
    for (const f of result.findings) {
      // Every non-null line must point at a real source line
      if (f.line !== null) {
        expect(f.line).toBeGreaterThanOrEqual(1);
        expect(f.line).toBeLessThanOrEqual(2);
      }
    }
  });
});
