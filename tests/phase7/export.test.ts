import { describe, expect, it } from "vitest";
import { buildExportJson } from "@/lib/audit-result-export";
import type { AuditResultData } from "@/lib/audit-result-types";

function makeResult(overrides: Partial<AuditResultData> = {}): AuditResultData {
  return {
    auditId: "a-1",
    strategyName: "Test Strategy",
    fileName: "strategy.py",
    framework: "pandas",
    frameworkLabel: "Pandas / Custom",
    analysisDepth: "standard",
    rulesVersion: "deterministic-v1",
    createdAt: "2026-08-16T00:00:00Z",
    completedAt: "2026-08-16T00:01:00Z",
    inputType: "paste",
    score: 79,
    grade: "C",
    gradeStatus: "Fair — several issues detected",
    summary: "2 findings detected",
    executiveSummary: "exec",
    rulesChecked: 15,
    rulesPassed: 12,
    warnings: 1,
    critical: 1,
    violations: [
      {
        id: "v-1",
        ruleId: "QL-BIAS-001",
        severity: "critical",
        category: "bias",
        title: "Look-ahead bias detected",
        description: "desc",
        whyItMatters: "why",
        file: "alpha/main.py",
        line: 5,
        detectedPattern: "shift(-1)",
        suggestedFix: "use shift(1)",
        codeSnippet: "close.shift(-1)",
        fixSnippet: null,
        status: "open",
        evidence: "direct",
        aiExplanation: null,
      },
    ],
    metricGroups: [
      { label: "Rules", metrics: [{ key: "rules-executed", label: "Rules executed", value: "15", tooltip: "t" }] },
    ],
    aiExplanations: [
      {
        id: "ai-v-1",
        ruleId: "QL-BIAS-001",
        finding: "Look-ahead bias detected",
        explanation: "explains",
        whyItMatters: "w",
        suggestedFix: "s",
        confidence: 60,
        relatedViolationId: "v-1",
        evidenceLevel: "likely",
        caveats: ["static analysis cannot observe runtime data"],
        model: "deepseek-v4-flash",
      },
    ],
    recommendations: [
      {
        id: "r-1",
        priority: 1,
        title: "Address: Look-ahead bias detected",
        severity: "critical",
        why: "why",
        suggestedAction: "action",
        relatedRuleId: "QL-BIAS-001",
        status: "open",
      },
    ],
    timeline: [{ label: "Audit started", timestamp: "2026-08-16T00:00:01Z" }],
    ruleCoverage: [],
    ...overrides,
  };
}

describe("buildExportJson (7N)", () => {
  it("includes deterministic findings with file/line evidence", () => {
    const json = JSON.parse(buildExportJson(makeResult()));
    expect(json.violations[0].ruleId).toBe("QL-BIAS-001");
    expect(json.violations[0].file).toBe("alpha/main.py");
    expect(json.violations[0].line).toBe(5);
    expect(json.score).toBe(79);
    expect(json.grade).toBe("C");
  });

  it("includes AI explanations, caveats, and linkage when present", () => {
    const json = JSON.parse(buildExportJson(makeResult()));
    expect(json.aiExplanations).toHaveLength(1);
    expect(json.aiExplanations[0].ruleId).toBe("QL-BIAS-001");
    expect(json.aiExplanations[0].caveats).toContain("static analysis cannot observe runtime data");
    expect(json.aiExplanations[0].evidenceLevel).toBe("likely");
  });

  it("includes recommendations with rule linkage and the timeline", () => {
    const json = JSON.parse(buildExportJson(makeResult()));
    expect(json.recommendations[0].relatedRuleId).toBe("QL-BIAS-001");
    expect(json.timeline).toContain("Audit started");
  });

  it("exports cleanly when no AI explanations exist (AI-failure audit)", () => {
    const json = JSON.parse(buildExportJson(makeResult({ aiExplanations: [] })));
    expect(json.aiExplanations).toEqual([]);
    expect(json.violations).toHaveLength(1);
    expect(json.score).toBe(79);
  });

  it("exports a failed audit without a passing grade", () => {
    const json = JSON.parse(
      buildExportJson(makeResult({ score: 0, grade: "F", gradeStatus: "Audit failed — no score computed" })),
    );
    expect(json.score).toBe(0);
    expect(json.grade).toBe("F");
  });

  it("contains no credentials or internal fields", () => {
    const text = buildExportJson(makeResult());
    expect(text).not.toMatch(/SUPABASE_SERVICE_ROLE|FIREWORKS_API_KEY|api[_-]?key|eyJ|sbp_/i);
    const json = JSON.parse(text);
    const keys = Object.keys(json);
    expect(keys).not.toContain("user_id");
    expect(keys).not.toContain("code");
    expect(keys).not.toContain("sourceCode");
  });
});
