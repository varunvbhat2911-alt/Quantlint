import { describe, expect, it } from "vitest";
import {
  SYSTEM_PROMPT,
  buildFindingMessages,
  buildRecommendationsMessages,
} from "@/lib/ai/prompts";
import type { EngineFinding } from "@/lib/audit-engine/types";

const finding: EngineFinding = {
  ruleId: "QL-BIAS-001",
  category: "bias",
  severity: "critical",
  title: "Look-ahead bias detected",
  description: "Future data referenced via shift(-1).",
  whyItMatters: "Backtests become over-optimistic.",
  suggestedFix: "Use shift(1) or causal windows.",
  fileName: "strategy.py",
  line: 6,
  detectedPattern: "close.shift(-1) > mean",
  codeSnippet: "signal = close.shift(-1) > mean",
  fixSnippet: "signal = close.shift(1) > mean",
};

const ctx = { strategyName: "Test Strategy", framework: "vectorbt", analysisDepth: "standard" };

describe("SYSTEM_PROMPT", () => {
  it("pins the model to explaining deterministic findings from evidence", () => {
    expect(SYSTEM_PROMPT).toContain("deterministic findings");
    for (const banned of [
      "invent violations",
      "invent performance statistics",
      "invent backtest results",
      "claim profitability",
      "not a financial advisor",
    ]) {
      expect(SYSTEM_PROMPT).toContain(banned);
    }
    expect(SYSTEM_PROMPT).toContain('JSON object');
  });
});

describe("buildFindingMessages", () => {
  const messages = buildFindingMessages(finding, "signal = close.shift(-1) > mean", ctx);

  it("produces a system + user pair", () => {
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("carries the deterministic evidence the model needs", () => {
    const user = messages[1].content;
    expect(user).toContain("QL-BIAS-001");
    expect(user).toContain("critical");
    expect(user).toContain("Look-ahead bias detected");
    expect(user).toContain("close.shift(-1) > mean");
    expect(user).toContain("Line: 6");
    expect(user).toContain("vectorbt");
  });

  it("never includes credentials or app metadata", () => {
    const all = messages.map((m) => m.content).join("\n");
    for (const banned of [
      "SUPABASE", "API_KEY", "apiKey", "service_role", "Bearer ",
      "audit_id", "database", "sessionStorage",
    ]) {
      expect(all).not.toContain(banned);
    }
  });

  it("states the exact response schema", () => {
    expect(messages[1].content).toContain('"confidence"');
    expect(messages[1].content).toContain('"evidence_level"');
  });
});

describe("buildRecommendationsMessages", () => {
  it("lists only the provided rule ids and demands grounded references", () => {
    const messages = buildRecommendationsMessages(
      [finding, { ...finding, ruleId: "QL-COST-001", severity: "warning" }],
      ctx,
    );
    const user = messages[1].content;
    expect(user).toContain("QL-BIAS-001");
    expect(user).toContain("QL-COST-001");
    expect(user).toContain("MUST be one of the rule ids above");
    expect(user).not.toContain("Sharpe");
  });
});
