import { describe, expect, it } from "vitest";
import { buildAuditResultData } from "@/lib/audits/result-mapper";
import type { AuditResults, AuditRow } from "@/lib/audit-engine/repository";

/* ── Fixtures shaped exactly like persisted rows ──────────── */

function makeAudit(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "u-1",
    strategy_name: "Test Strategy",
    input_type: "paste",
    file_name: null,
    framework: "pandas",
    analysis_depth: "standard",
    rule_categories: ["Look-ahead Bias"],
    code: "x = 1",
    status: "completed",
    progress: 100,
    created_at: "2026-08-16T00:00:00Z",
    updated_at: "2026-08-16T00:01:00Z",
    ...overrides,
  };
}

function makeResults(
  overrides: Partial<AuditResults> = {},
): AuditResults {
  return {
    violations: [
      {
        id: "v-1",
        audit_id: "a",
        rule_id: "QL-BIAS-001",
        severity: "critical",
        category: "bias",
        title: "Look-ahead bias detected",
        description: "desc",
        why_it_matters: "why",
        file_name: "strategy.py",
        line: 5,
        detected_pattern: "shift(-1)",
        suggested_fix: "use shift(1)",
        code_snippet: "signal = close.shift(-1)",
        fix_snippet: null,
        status: "open",
        ai_explanation: null,
        sort_order: 0,
        created_at: "2026-08-16T00:00:30Z",
      },
      {
        id: "v-2",
        audit_id: "a",
        rule_id: "QL-RISK-001",
        severity: "warning",
        category: "risk",
        title: "No stop-loss handling",
        description: "desc",
        why_it_matters: "why",
        file_name: "strategy.py",
        line: null,
        detected_pattern: "order placement without stop-loss logic",
        suggested_fix: "add stops",
        code_snippet: null,
        fix_snippet: null,
        status: "open",
        ai_explanation: null,
        sort_order: 1,
        created_at: "2026-08-16T00:00:30Z",
      },
      {
        id: "v-3",
        audit_id: "a",
        rule_id: "QL-STRUCT-002",
        severity: "info",
        category: "structure",
        title: "Deeply nested logic",
        description: "desc",
        why_it_matters: "why",
        file_name: "strategy.py",
        line: null,
        detected_pattern: null,
        suggested_fix: "simplify",
        code_snippet: null,
        fix_snippet: null,
        status: "open",
        ai_explanation: null,
        sort_order: 2,
        created_at: "2026-08-16T00:00:30Z",
      },
    ],
    metrics: [
      {
        id: "m-1",
        audit_id: "a",
        group_label: "Rules",
        key: "rules-executed",
        label: "Rules executed",
        value: "15",
        tooltip: "t",
        sort_order: 0,
        created_at: "2026-08-16T00:00:30Z",
      },
      {
        id: "m-2",
        audit_id: "a",
        group_label: "Rules",
        key: "rules-passed",
        label: "Rules passed",
        value: "12",
        tooltip: "t",
        sort_order: 1,
        created_at: "2026-08-16T00:00:30Z",
      },
    ],
    recommendations: [
      {
        id: "r-1",
        audit_id: "a",
        priority: 1,
        title: "Address: Look-ahead bias detected",
        severity: "critical",
        why: "why",
        suggested_action: "action",
        related_rule_id: "QL-BIAS-001",
        status: "open",
        sort_order: 0,
        created_at: "2026-08-16T00:00:30Z",
      },
    ],
    timeline: [
      { id: "t-1", audit_id: "a", label: "Audit started", entry_at: "2026-08-16T00:00:01Z", sort_order: -1, created_at: "x" },
      { id: "t-2", audit_id: "a", label: "Report generation completed", entry_at: "2026-08-16T00:01:00Z", sort_order: 7, created_at: "x" },
    ],
    ...overrides,
  };
}

describe("buildAuditResultData — deterministic contract", () => {
  it("maps persisted deterministic fields verbatim", () => {
    const result = buildAuditResultData(makeAudit(), makeResults());
    const v = result.violations[0];
    expect(v.ruleId).toBe("QL-BIAS-001");
    expect(v.severity).toBe("critical");
    expect(v.file).toBe("strategy.py");
    expect(v.line).toBe(5);
    expect(v.codeSnippet).toBe("signal = close.shift(-1)");
    expect(v.detectedPattern).toBe("shift(-1)");
  });

  it("computes score/grade from severity counts only", () => {
    // 1 critical (15) + 1 warning (5) + 1 info (1) = penalty 21 → score 79
    const result = buildAuditResultData(makeAudit(), makeResults());
    expect(result.score).toBe(79);
    expect(result.grade).toBe("C");
    expect(result.critical).toBe(1);
    expect(result.warnings).toBe(1);
  });

  it("classifies evidence kind from the finding shape", () => {
    const result = buildAuditResultData(makeAudit(), makeResults());
    expect(result.violations[0].evidence).toBe("direct");
    expect(result.violations[1].evidence).toBe("absence");
    expect(result.violations[2].evidence).toBe("inferred");
  });

  it("preserves multi-file attribution per violation", () => {
    const results = makeResults();
    results.violations[1].file_name = "zeta/risk.py";
    const result = buildAuditResultData(makeAudit(), results);
    expect(result.violations[0].file).toBe("strategy.py");
    expect(result.violations[1].file).toBe("zeta/risk.py");
  });

  it("handles null lines and null filenames without fabricating", () => {
    const results = makeResults();
    results.violations[0].line = null;
    results.violations[0].file_name = null;
    const result = buildAuditResultData(makeAudit({ file_name: null }), results);
    expect(result.violations[0].line).toBeNull();
    expect(result.violations[0].file).toBeNull();
    expect(result.fileName).toBe("pasted-input.py");
  });
});

describe("buildAuditResultData — AI is interpretive only", () => {
  it("keeps deterministic columns when the persisted AI payload contradicts them", () => {
    const results = makeResults();
    results.violations[0].ai_explanation = {
      ruleId: "QL-HALLUCINATED-999",
      finding: "Totally different finding",
      explanation: "hostile model output",
      whyItMatters: "x",
      suggestedFix: "y",
      confidence: 3.7, // out of range
      severity: "info", // AI must not change severity
    };
    const result = buildAuditResultData(makeAudit(), results);
    const v = result.violations[0];
    expect(v.ruleId).toBe("QL-BIAS-001");
    expect(v.severity).toBe("critical");
    expect(v.title).toBe("Look-ahead bias detected");
    expect(v.aiExplanation?.ruleId).toBe("QL-BIAS-001"); // deterministic id wins
    expect(v.aiExplanation?.confidence).toBe(100); // 3.7 clamped to 1 → 100
    expect(result.aiExplanations).toHaveLength(1);
  });

  it("maps Phase-7 enrichment fields when present", () => {
    const results = makeResults();
    results.violations[0].ai_explanation = {
      ruleId: "QL-BIAS-001",
      finding: "Look-ahead bias detected",
      explanation: "explains",
      whyItMatters: "w",
      suggestedFix: "s",
      confidence: 0.6,
      evidenceLevel: "likely",
      caveats: ["static analysis cannot see runtime data"],
      assumptions: ["execution is bar-close"],
      correctedExample: "close.shift(1)",
      model: "deepseek-v4-flash",
    };
    const result = buildAuditResultData(makeAudit(), results);
    const ai = result.aiExplanations[0];
    expect(ai.evidenceLevel).toBe("likely");
    expect(ai.caveats).toEqual(["static analysis cannot see runtime data"]);
    expect(ai.assumptions).toEqual(["execution is bar-close"]);
    expect(ai.correctedExample).toBe("close.shift(1)");
    expect(ai.model).toBe("deepseek-v4-flash");
    expect(ai.relatedViolationId).toBe("v-1");
    expect(result.violations[0].aiExplanation?.id).toBe(ai.id);
  });

  it("old Phase-3 AI records (no caveats/evidenceLevel) remain readable", () => {
    const results = makeResults();
    results.violations[0].ai_explanation = {
      ruleId: "QL-BIAS-001",
      finding: "Look-ahead bias detected",
      explanation: "legacy explanation",
      whyItMatters: "w",
      suggestedFix: "s",
      confidence: 0.5,
    };
    const result = buildAuditResultData(makeAudit(), results);
    const ai = result.aiExplanations[0];
    expect(ai.explanation).toBe("legacy explanation");
    expect(ai.caveats).toBeUndefined();
    expect(ai.evidenceLevel).toBeUndefined();
    expect(ai.model).toBeUndefined();
  });

  it("audit with no AI explanations maps cleanly", () => {
    const result = buildAuditResultData(makeAudit(), makeResults());
    expect(result.aiExplanations).toEqual([]);
    for (const v of result.violations) expect(v.aiExplanation).toBeNull();
  });

  it("AI explanations with empty text are dropped", () => {
    const results = makeResults();
    results.violations[0].ai_explanation = { explanation: "   " };
    const result = buildAuditResultData(makeAudit(), results);
    expect(result.aiExplanations).toEqual([]);
    expect(result.violations[0].aiExplanation).toBeNull();
  });
});

describe("buildAuditResultData — failed audits (7M)", () => {
  it("never computes a passing grade for a failed audit", () => {
    const result = buildAuditResultData(makeAudit({ status: "failed" }), makeResults());
    expect(result.score).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.gradeStatus).toBe("Audit failed — no score computed");
  });

  it("preserves the timeline for failed audits (failure reason survives)", () => {
    const results = makeResults({ violations: [], recommendations: [] });
    results.timeline.push({
      id: "t-3",
      audit_id: "a",
      label: "Audit failed: Python syntax validation failed at line 1",
      entry_at: "2026-08-16T00:00:59Z",
      sort_order: 999,
      created_at: "x",
    });
    const result = buildAuditResultData(makeAudit({ status: "failed" }), results);
    expect(result.timeline.map((t) => t.label)).toContain(
      "Audit failed: Python syntax validation failed at line 1",
    );
    expect(result.violations).toEqual([]);
  });
});
