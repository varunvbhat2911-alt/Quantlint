/* Maps persisted audit rows into the frontend AuditResultData contract
 * (src/lib/audit-result-types.ts). Deterministic columns are authoritative:
 * AI content is carried alongside, never merged into rule fields. Pure
 * functions — usable server- and client-side. */

import type {
  AIExplanation,
  AuditResultData,
  EvidenceKind,
  MetricGroup,
  Recommendation,
  TimelineEntry,
  Violation,
} from "@/lib/audit-result-types";
import { computeGrade, computeScore, RULES_VERSION, type EngineStats } from "@/lib/audit-engine/types";
import type { AuditRepository, AuditRow } from "@/lib/audit-engine/repository";

/* Deterministically classify how a persisted finding was grounded. The
 * engine's shape decides — AI output is never consulted:
 * - a code snippet means a real source line anchored the match → direct
 * - a pattern without a line means an absence-based check → absence
 * - anything else (structural inference) → inferred */
function evidenceKindOf(v: {
  code_snippet: string | null;
  line: number | null;
  detected_pattern: string | null;
}): EvidenceKind {
  if (v.code_snippet !== null && v.code_snippet.trim().length > 0) return "direct";
  if (v.line === null && v.detected_pattern !== null) return "absence";
  return "inferred";
}

function severityCounts(violations: { severity: string }[]): EngineStats {
  const stats: EngineStats = {
    rulesExecuted: 0,
    rulesPassed: 0,
    rulesFailed: 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
  };
  for (const v of violations) {
    if (v.severity === "critical") stats.criticalCount++;
    else if (v.severity === "warning") stats.warningCount++;
    else stats.infoCount++;
  }
  return stats;
}

export function buildAuditResultData(
  audit: AuditRow,
  results: Awaited<ReturnType<AuditRepository["getResults"]>>,
): AuditResultData {
  const violations: Violation[] = results.violations.map((v) => ({
    id: v.id,
    ruleId: v.rule_id,
    severity: v.severity as Violation["severity"],
    category: v.category as Violation["category"],
    title: v.title,
    description: v.description,
    whyItMatters: v.why_it_matters,
    file: v.file_name,
    line: v.line,
    detectedPattern: v.detected_pattern,
    suggestedFix: v.suggested_fix,
    codeSnippet: v.code_snippet,
    fixSnippet: v.fix_snippet,
    status: v.status as Violation["status"],
    evidence: evidenceKindOf(v),
  }));

  // AI explanations persisted on violations (Phase 3) — mapped into the
  // frontend AIExplanation shape. DETERMINISTIC COLUMNS WIN on any overlap:
  // the violation's own ruleId/title are authoritative; the persisted AI
  // payload only contributes its interpretive fields. Records written before
  // Phase 7 (no caveats/evidenceLevel) map with those fields absent.
  const aiExplanations: AIExplanation[] = [];
  const aiByViolation = new Map<string, AIExplanation>();
  for (const v of results.violations) {
    if (v.ai_explanation === null || typeof v.ai_explanation !== "object") continue;
    const ai = v.ai_explanation as {
      ruleId?: string;
      finding?: string;
      summary?: string;
      explanation?: string;
      whyItMatters?: string;
      suggestedFix?: string;
      confidence?: number;
      evidenceLevel?: string;
      caveats?: unknown;
      assumptions?: unknown;
      correctedExample?: string | null;
      model?: string;
    };
    if (typeof ai.explanation !== "string" || ai.explanation.trim().length === 0) continue;

    const explanation: AIExplanation = {
      id: `ai-${v.id}`,
      ruleId: v.rule_id,
      finding: v.title,
      explanation: ai.explanation,
      whyItMatters: typeof ai.whyItMatters === "string" ? ai.whyItMatters : "",
      suggestedFix: typeof ai.suggestedFix === "string" ? ai.suggestedFix : "",
      /* AI self-assessment (0..1), qualitative only — never a probability
       * of strategy success (3O). */
      confidence: Math.round(Math.min(1, Math.max(0, Number(ai.confidence) || 0)) * 100),
      relatedViolationId: v.id,
    };
    if (Array.isArray(ai.caveats)) {
      explanation.caveats = ai.caveats.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
    }
    if (Array.isArray(ai.assumptions)) {
      explanation.assumptions = ai.assumptions.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
    }
    if (ai.evidenceLevel === "definite" || ai.evidenceLevel === "likely" || ai.evidenceLevel === "uncertain") {
      explanation.evidenceLevel = ai.evidenceLevel;
    }
    if (typeof ai.correctedExample === "string") {
      explanation.correctedExample = ai.correctedExample;
    }
    if (typeof ai.model === "string" && ai.model.trim().length > 0) {
      explanation.model = ai.model;
    }

    aiExplanations.push(explanation);
    aiByViolation.set(v.id, explanation);
  }

  // Link each explanation onto its finding for inline display (Phase 7L) —
  // the violation object itself stays deterministic; the AI payload rides
  // along in a clearly-labeled field.
  for (const violation of violations) {
    violation.aiExplanation = aiByViolation.get(violation.id) ?? null;
  }

  // Regroup flat metric rows into the MetricGroup shape the UI renders.
  const groups = new Map<string, MetricGroup>();
  for (const m of results.metrics) {
    const group = groups.get(m.group_label) ?? { label: m.group_label, metrics: [] };
    group.metrics.push({
      key: m.key,
      label: m.label,
      value: m.value,
      tooltip: m.tooltip,
    });
    groups.set(m.group_label, group);
  }

  const recommendations: Recommendation[] = results.recommendations.map((r) => ({
    id: r.id,
    priority: r.priority,
    title: r.title,
    severity: r.severity as Recommendation["severity"],
    why: r.why,
    suggestedAction: r.suggested_action,
    relatedRuleId: r.related_rule_id,
    status: r.status as Recommendation["status"],
  }));

  const timeline: TimelineEntry[] = results.timeline.map((t) => ({
    label: t.label,
    timestamp: t.entry_at,
  }));

  const stats = severityCounts(violations);
  const rulesExecuted = results.metrics.find((m) => m.key === "rules-executed");
  const rulesPassed = results.metrics.find((m) => m.key === "rules-passed");

  /* Failed audits never receive a score computed from "whatever was
   * persisted before the failure" — that would fabricate a clean grade for
   * an audit that did not finish (7M). Mirrors the engine's fatal path. */
  const failed = audit.status === "failed";
  const score = failed ? 0 : computeScore(stats);
  const { grade, gradeStatus } = failed
    ? { grade: "F", gradeStatus: "Audit failed — no score computed" }
    : computeGrade(score);

  const critical = stats.criticalCount;
  const warning = stats.warningCount;

  const summary =
    violations.length === 0
      ? `No deterministic findings were detected across ${rulesExecuted?.value ?? 0} rules.`
      : `${violations.length} finding${violations.length === 1 ? "" : "s"} detected (${critical} critical, ${warning} warning) across ${rulesExecuted?.value ?? 0} rules.`;

  const executiveSummary =
    violations.length === 0
      ? "The deterministic rule set found no issues in the submitted source. This does not guarantee the strategy is financially correct — it means none of the implemented static checks matched. Manual review and out-of-sample testing remain recommended."
      : `Static analysis flagged ${critical} critical and ${warning} warning-level issues. Critical findings typically indicate look-ahead bias, unrealistic execution assumptions, or missing cost modeling, and should be resolved before trusting backtest results. Findings are deterministic pattern matches, not proof of financial validity.`;

  return {
    auditId: audit.id,
    strategyName: audit.strategy_name,
    fileName: audit.file_name ?? "pasted-input.py",
    framework: audit.framework,
    frameworkLabel: audit.framework === "auto" ? "Auto Detect" : audit.framework,
    analysisDepth: audit.analysis_depth,
    rulesVersion: RULES_VERSION,
    createdAt: audit.created_at,
    completedAt: audit.updated_at,
    inputType: audit.input_type,
    score,
    grade,
    gradeStatus,
    summary,
    executiveSummary,
    rulesChecked: Number(rulesExecuted?.value ?? 0),
    rulesPassed: Number(rulesPassed?.value ?? 0),
    warnings: warning,
    critical,
    violations,
    metricGroups: [...groups.values()],
    aiExplanations,
    recommendations,
    timeline,
    ruleCoverage: [],
  };
}
