import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/audit-engine/engine";

/* Phase 8 #3: per-rule finding fan-out limit (MAX_FINDINGS_PER_RULE = 50).
 * A pathological source with 100+ shift(-1) calls must produce at most 50
 * QL-BIAS-001 findings. Different rules' findings are not combined. */

const ALL_CATEGORIES = [
  "Look-ahead Bias", "Data Leakage", "Survivorship Bias", "Risk Management",
  "Position Sizing", "Performance Metrics", "Execution Logic",
  "Transaction Costs", "Portfolio Logic",
] as const;

function makeSourceWithMatches(count: number): string {
  const lines = ["import pandas as pd", ""];
  for (let i = 0; i < count; i++) {
    lines.push(`    signal${i} = close.shift(-1)`);
  }
  lines.push("    return signal0");
  return lines.join("\n");
}

describe("Per-rule finding fan-out cap (MAX_FINDINGS_PER_RULE = 50)", () => {
  it("51+ findings from one rule become 50", async () => {
    const source = makeSourceWithMatches(80);
    const result = await runEngine({
      code: source,
      fileName: "pathological.py",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ["Look-ahead Bias"],
    });
    expect(result.ok).toBe(true);
    const bias001 = result.findings.filter((f) => f.ruleId === "QL-BIAS-001");
    expect(bias001.length).toBe(50);
  });

  it("findings from different rules are not incorrectly combined", async () => {
    // Source with both shift(-1) [QL-BIAS-001] and buy() without stops [QL-RISK-001]
    // Each rule's cap is independent.
    const source = [
      "import pandas as pd",
      "",
      "def run(close):",
      ...Array.from({ length: 60 }, (_, i) => `    s${i} = close.shift(-1)`),
      "    self.buy()",
      "    return s0",
    ].join("\n");

    const result = await runEngine({
      code: source,
      fileName: "multi.py",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ["Look-ahead Bias", "Risk Management"],
    });
    expect(result.ok).toBe(true);
    const bias001 = result.findings.filter((f) => f.ruleId === "QL-BIAS-001");
    const risk001 = result.findings.filter((f) => f.ruleId === "QL-RISK-001");
    expect(bias001.length).toBe(50);
    expect(risk001.length).toBe(1); // RISK-001 is absence-based, returns ≤1
  });

  it("normal strategies are unaffected (few findings per rule)", async () => {
    const normalSource = `import pandas as pd


def run(close):
    signal = close.pct_change().shift(-1)
    return signal * 20.0
`;
    const result = await runEngine({
      code: normalSource,
      fileName: "normal.py",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: [...ALL_CATEGORIES],
    });
    expect(result.ok).toBe(true);
    const bias001 = result.findings.filter((f) => f.ruleId === "QL-BIAS-001");
    expect(bias001.length).toBe(1); // one shift(-1) → one finding
  });

  it("line/snippet evidence remains intact after cap", async () => {
    const source = makeSourceWithMatches(55);
    const result = await runEngine({
      code: source,
      fileName: "evidence.py",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ["Look-ahead Bias"],
    });
    const bias001 = result.findings.filter((f) => f.ruleId === "QL-BIAS-001");
    expect(bias001).toHaveLength(50);
    // First 50 findings should have real line numbers and snippets
    for (const f of bias001) {
      expect(f.line).not.toBeNull();
      expect(f.line).toBeGreaterThan(0);
      expect(f.codeSnippet).not.toBeNull();
      expect(f.codeSnippet).toContain("shift(-1)");
    }
  });
});
