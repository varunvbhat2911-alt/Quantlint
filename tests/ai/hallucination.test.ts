import { describe, expect, it } from "vitest";
import {
  containsUnsupportedPerformanceClaim,
  validateExplanation,
  validateRecommendations,
} from "@/lib/ai/service";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { EngineFinding } from "@/lib/audit-engine/types";

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

/* ── Numeric-claim detector (7G) ─────────────────────────── */

describe("containsUnsupportedPerformanceClaim", () => {
  it("rejects fabricated measured figures", () => {
    const hardRejected = [
      "the strategy achieves a Sharpe of 1.8",
      "Sharpe ratio: 2.1 over the sample",
      "a CAGR of 22%",
      "22% CAGR after costs",
      "win rate of 65%",
      "a 65% win rate",
      "expected returns of 2x",
      "3.5x returns",
      "max drawdown around 30%",
      "portfolio volatility of 0.2",
      "annualized profit of 15%",
      "roughly 1.9 Sharpe",
      "an alpha of 0.75",
      "beta of 1.3",
    ];
    for (const text of hardRejected) {
      expect(containsUnsupportedPerformanceClaim(text), text).toBe(true);
    }
  });

  it("allows conceptual mentions without measured numbers", () => {
    const allowed = [
      "Consider the Sharpe ratio when evaluating the strategy.",
      "Without transaction costs, reported returns become unrealistic.",
      "Drawdown risk is not modeled here.",
      "This affects any profitability estimate you might compute later.",
      "Volatility scaling could change behavior.",
      "the win rate is unknown from static analysis",
    ];
    for (const text of allowed) {
      expect(containsUnsupportedPerformanceClaim(text), text).toBe(false);
    }
  });

  it("allows source-derived and code-like numbers", () => {
    const allowed = [
      "replace shift(-1) with shift(1) so signals use the prior bar",
      "use sl_stop=0.05 in Portfolio.from_signals",
      "the leverage constant of 20 defined in the source amplifies both directions",
      "a 20 period rolling window",
      "return equity * LEVERAGE as in the submitted code",
      "the submitted code multiplies the signal by 20.0 before returning it",
      "check the top 3 branches",
    ];
    for (const text of allowed) {
      expect(containsUnsupportedPerformanceClaim(text), text).toBe(false);
    }
  });

  it("scans across multiple fields as one document", () => {
    expect(
      containsUnsupportedPerformanceClaim("this is fine", "and this is fine", "Sharpe of 1.2"),
    ).toBe(true);
    expect(containsUnsupportedPerformanceClaim("fine", "also fine", "totally fine")).toBe(false);
  });

  it("plain integer near a metric term without %/x/decimal is not a measured claim", () => {
    expect(containsUnsupportedPerformanceClaim("about 40 trades per year")).toBe(false);
  });
});

/* ── Validator integration (7F) ──────────────────────────── */

const CLEAN_PAYLOAD = {
  summary: "s",
  explanation: "explains the causal issue from the evidence",
  why_it_matters: "matters for backtest integrity",
  suggested_fix: "use shift(1) instead",
  confidence: 0.8,
  evidence_level: "definite",
  assumptions: [],
  caveats: ["line-level execution semantics not verified"],
};

describe("validateExplanation hallucination rejection", () => {
  it("accepts a clean explanation", () => {
    const result = validateExplanation(CLEAN_PAYLOAD, makeFinding(), "m");
    expect(result).not.toBeNull();
    expect(result?.caveats).toEqual(["line-level execution semantics not verified"]);
  });

  it("rejects explanations containing fabricated performance figures", () => {
    for (const field of ["explanation", "why_it_matters", "suggested_fix", "summary"]) {
      const payload = { ...CLEAN_PAYLOAD, [field]: "yields a Sharpe of 1.8 in backtests" };
      expect(validateExplanation(payload, makeFinding(), "m"), field).toBeNull();
    }
  });

  it("rejects fabricated figures inside the corrected example", () => {
    const payload = {
      ...CLEAN_PAYLOAD,
      corrected_example: "# produces 25% CAGR\nx = 1",
    };
    expect(validateExplanation(payload, makeFinding(), "m")).toBeNull();
  });
});

describe("validateRecommendations hallucination rejection", () => {
  const findings = [makeFinding(), makeFinding({ ruleId: "QL-RISK-001", severity: "warning" })];

  it("skips recommendations with unsupported performance claims", () => {
    const payload = {
      recommendations: [
        {
          related_rule_id: "QL-BIAS-001",
          title: "Fix look-ahead",
          why: "improves expected returns by 30%",
          suggested_action: "use shift(1)",
          priority: 1,
        },
        {
          related_rule_id: "QL-RISK-001",
          title: "Add stops",
          why: "bounds losses per position",
          suggested_action: "attach stop orders",
          priority: 2,
        },
      ],
    };
    const out = validateRecommendations(payload, new Set(["QL-BIAS-001", "QL-RISK-001"]), findings);
    expect(out).toHaveLength(1);
    expect(out[0].relatedRuleId).toBe("QL-RISK-001");
  });
});

/* ── Prompt contract pins (7D) ───────────────────────────── */

describe("SYSTEM_PROMPT contract", () => {
  it("pins the deterministic-authority and anti-hallucination rules", () => {
    expect(SYSTEM_PROMPT).toContain("SOURCE OF TRUTH");
    expect(SYSTEM_PROMPT).toContain("explanation layer only");
    expect(SYSTEM_PROMPT).toContain("statistical significance");
    expect(SYSTEM_PROMPT).toContain("change the rule id, severity, or category");
    expect(SYSTEM_PROMPT).toContain("state ANY numeric performance figure");
    expect(SYSTEM_PROMPT).toContain("invent line numbers");
    expect(SYSTEM_PROMPT).toContain("claim profitability");
  });
});
