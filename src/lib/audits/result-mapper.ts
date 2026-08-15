/* Maps persisted audit rows into the frontend AuditResultData contract
 * (src/lib/mock-data/audit-result.ts), so the result page renders real data
 * without any UI changes. Pure functions — usable server- and client-side. */

import type {
  AIExplanation,
  AuditResultData,
  MetricGroup,
  Recommendation,
  TimelineEntry,
  Violation,
  ViolationSeverity,
} from "@/lib/mock-data/audit-result";
import { computeGrade, computeScore, RULES_VERSION, type EngineStats } from "@/lib/audit-engine/types";
import type { AuditRepository, AuditRow } from "@/lib/audit-engine/repository";

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
  }));

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

  const score = computeScore(stats);
  const { grade, gradeStatus } = computeGrade(score);

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
    aiExplanations: [] as AIExplanation[],
    recommendations,
    timeline,
    ruleCoverage: [],
  };
}
