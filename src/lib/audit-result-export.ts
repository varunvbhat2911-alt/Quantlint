/* ── Export helpers for audit results ────────────────────── */

import type { AuditResultData } from "@/lib/audit-result-types";

export function buildExportJson(result: AuditResultData): string {
  return JSON.stringify(
    {
      auditId: result.auditId,
      strategy: result.strategyName,
      fileName: result.fileName,
      framework: result.framework,
      analysisDepth: result.analysisDepth,
      rulesVersion: result.rulesVersion,
      createdAt: result.createdAt,
      completedAt: result.completedAt,
      score: result.score,
      grade: result.grade,
      rulesChecked: result.rulesChecked,
      passed: result.rulesPassed,
      warnings: result.warnings,
      critical: result.critical,
      violations: result.violations.map((v) => ({
        ruleId: v.ruleId,
        severity: v.severity,
        title: v.title,
        description: v.description,
        file: v.file,
        line: v.line,
        status: v.status,
      })),
      metrics: Object.fromEntries(
        result.metricGroups.flatMap((g) =>
          g.metrics.map((m) => [m.key, m.value]),
        ),
      ),
      recommendations: result.recommendations.map((r) => ({
        priority: r.priority,
        title: r.title,
        severity: r.severity,
        status: r.status,
      })),
    },
    null,
    2,
  );
}
