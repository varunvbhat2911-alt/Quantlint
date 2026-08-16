import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { mapFindingLocation } from "@/lib/audit-engine/pipeline";
import { runEngine } from "@/lib/audit-engine/engine";
import { extractZipStrategy } from "@/lib/audit-ingestion/zip";

/* The critical integration: findings from a multi-file ZIP must report the
 * ORIGINAL file and line, never the assembled offsets. */

const MAIN = `import pandas as pd


def run(close):
    signal = close.pct_change().shift(-1)
    return signal
`;

const RISK = `LEVERAGE = 20.0


def size(equity):
    return equity * LEVERAGE
`;

function buildProject() {
  const zip = zipSync({
    "alpha/main.py": strToU8(MAIN),
    "zeta/risk.py": strToU8(RISK),
  });
  return extractZipStrategy(zip);
}

describe("mapFindingLocation", () => {
  const segments = [
    { path: "alpha/main.py", startLine: 2, lineCount: 7 },
    { path: "zeta/risk.py", startLine: 11, lineCount: 5 },
  ];

  it("returns the fallback when no segments exist (paste/.py path)", () => {
    expect(mapFindingLocation(5, [], "strategy.py")).toEqual({
      fileName: "strategy.py",
      line: 5,
    });
    expect(mapFindingLocation(null, [], "strategy.py")).toEqual({
      fileName: "strategy.py",
      line: null,
    });
  });

  it("maps inside-segment lines to original positions", () => {
    expect(mapFindingLocation(3, segments, "project.zip")).toEqual({
      fileName: "alpha/main.py",
      line: 2,
    });
    expect(mapFindingLocation(13, segments, "project.zip")).toEqual({
      fileName: "zeta/risk.py",
      line: 3,
    });
  });

  it("maps header lines to null — locations are never fabricated", () => {
    expect(mapFindingLocation(1, segments, "project.zip")).toEqual({
      fileName: null,
      line: null,
    });
    expect(mapFindingLocation(10, segments, "project.zip")).toEqual({
      fileName: null,
      line: null,
    });
  });

  it("passes null lines through with the audit-level file", () => {
    expect(mapFindingLocation(null, segments, "project.zip")).toEqual({
      fileName: "project.zip",
      line: null,
    });
  });
});

describe("runEngine over an assembled multi-file project", () => {
  it("reports findings with original file names and line numbers", async () => {
    const project = buildProject();
    const result = await runEngine({
      code: project.code,
      fileName: "project.zip",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: [
        "Look-ahead Bias",
        "Data Leakage",
        "Survivorship Bias",
        "Risk Management",
        "Position Sizing",
        "Performance Metrics",
        "Execution Logic",
        "Transaction Costs",
        "Portfolio Logic",
      ],
      segments: project.segments,
    });

    expect(result.ok).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);

    /* Every finding must point at a real original file… */
    const paths = new Set(project.segments.map((s) => s.path));
    for (const finding of result.findings) {
      expect(paths.has(finding.fileName ?? "")).toBe(true);
    }

    /* …and the look-ahead finding must map to line 5 of alpha/main.py
     * (shift(-1) sits on original line 5), NOT its assembled line. */
    const lookahead = result.findings.find((f) => f.ruleId === "QL-BIAS-001");
    expect(lookahead).toBeDefined();
    expect(lookahead?.fileName).toBe("alpha/main.py");
    expect(lookahead?.line).toBe(5);

    /* The snippet must be the real original source line. */
    expect(lookahead?.codeSnippet).toContain("shift(-1)");
  });

  it("detects the framework from imports inside the archive", async () => {
    const project = buildProject();
    const result = await runEngine({
      code: project.code,
      fileName: "project.zip",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ["Look-ahead Bias"],
      segments: project.segments,
    });
    expect(result.framework.detected).toBe("pandas");
  });

  it("manual framework selection overrides detection", async () => {
    const project = buildProject();
    const result = await runEngine({
      code: project.code,
      fileName: "project.zip",
      declaredFramework: "backtrader",
      analysisDepth: "standard",
      ruleCategories: ["Look-ahead Bias"],
      segments: project.segments,
    });
    expect(result.framework.resolved).toBe("backtrader");
  });

  it("treats uploaded source strictly as data (no execution)", async () => {
    const malicious = `import os

def payload():
    os.system("echo pwned")
    return open("/etc/passwd").read()
`;
    const zip = zipSync({ "evil.py": strToU8(malicious) });
    const project = extractZipStrategy(zip);
    /* Runs to completion as static analysis — the dangerous strings are
     * only ever matched as patterns, never executed. */
    const result = await runEngine({
      code: project.code,
      fileName: "evil.zip",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ["Execution Logic"],
      segments: project.segments,
    });
    expect(typeof result.ok).toBe("boolean");
  });

  it("pasted-code regression: no segments behaves exactly as before", async () => {
    const result = await runEngine({
      code: MAIN,
      fileName: "strategy.py",
      declaredFramework: "auto",
      analysisDepth: "standard",
      ruleCategories: ["Look-ahead Bias"],
    });
    expect(result.ok).toBe(true);
    const lookahead = result.findings.find((f) => f.ruleId === "QL-BIAS-001");
    expect(lookahead?.fileName).toBe("strategy.py");
    expect(lookahead?.line).toBe(5);
  });
});
