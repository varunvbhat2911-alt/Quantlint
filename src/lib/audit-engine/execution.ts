/* runAudit(): server-side orchestration of one audit job.
 *
 * Loads the queued audit, claims it (atomic queued→running), executes the
 * deterministic engine, persists violations/metrics/recommendations/timeline,
 * and drives real progress from completed stages. Structured so a future
 * background worker can call runAudit(auditId) unchanged. Internal errors are
 * logged server-side and surfaced to clients only as clean failure states. */

import { runEngine } from "./engine";
import type { EngineResult } from "./types";
import {
  createSupabaseAuditRepository,
  type AuditRepository,
  type AuditRow,
  type TimelineInsert,
} from "./repository";

export class AuditNotFoundError extends Error {
  constructor(id: string) {
    super(`Audit ${id} not found.`);
    this.name = "AuditNotFoundError";
  }
}

export type RunAuditResult = {
  audit: AuditRow;
  engine: EngineResult | null;
};

export async function runAudit(
  auditId: string,
  repository: AuditRepository = createSupabaseAuditRepository(),
): Promise<RunAuditResult> {
  const audit = await repository.getAudit(auditId);
  if (!audit) throw new AuditNotFoundError(auditId);

  if (audit.status === "running") {
    // Another runner claimed it; do not double-execute.
    return { audit, engine: null };
  }
  if (audit.status === "completed" || audit.status === "failed") {
    return { audit, engine: null };
  }

  const claimed = await repository.claimAudit(auditId);
  if (!claimed) {
    // Lost the claim race; return whatever the winner reports.
    const current = await repository.getAudit(auditId);
    return { audit: current ?? claimed ?? audit, engine: null };
  }

  const startedTimeline: TimelineInsert[] = [
    {
      audit_id: auditId,
      label: "Audit started",
      entry_at: new Date().toISOString(),
      sort_order: -1,
    },
  ];

  try {
    const result = runEngine(
      {
        code: audit.code,
        fileName: audit.file_name,
        declaredFramework: audit.framework,
        analysisDepth: audit.analysis_depth,
        ruleCategories: audit.rule_categories,
      },
      {
        onStageComplete: (_stage, _index, progress) => {
          // Real progress: fraction of completed stages. Void — a progress
          // write failure must not abort the audit.
          repository
            .updateAudit(auditId, { progress })
            .catch((err) => console.error(`[runAudit] progress write failed:`, err));
        },
      },
    );

    const timelineRows: TimelineInsert[] = [
      ...startedTimeline,
      ...result.timeline.map((t) => ({
        audit_id: auditId,
        label: t.label,
        entry_at: t.at,
        sort_order: t.sortOrder,
      })),
    ];

    if (!result.ok) {
      await repository.insertTimeline(timelineRows);
      // Keep progress at the stage actually reached — failures must not
      // masquerade as complete work.
      const failed = await repository.updateAudit(auditId, {
        status: "failed",
      });
      console.error(`[runAudit] audit ${auditId} failed: ${result.fatalError}`);
      return { audit: failed ?? claimed, engine: result };
    }

    await Promise.all([
      repository.insertViolations(
        result.findings.map((f, i) => ({
          audit_id: auditId,
          rule_id: f.ruleId,
          severity: f.severity,
          category: f.category,
          title: f.title,
          description: f.description,
          why_it_matters: f.whyItMatters,
          file_name: f.fileName,
          line: f.line,
          detected_pattern: f.detectedPattern,
          suggested_fix: f.suggestedFix,
          code_snippet: f.codeSnippet,
          fix_snippet: f.fixSnippet,
          status: "open",
          sort_order: i,
        })),
      ),
      repository.insertMetrics(
        result.metrics.map((m, i) => ({
          audit_id: auditId,
          group_label: m.groupLabel,
          key: m.key,
          label: m.label,
          value: m.value,
          tooltip: m.tooltip,
          sort_order: i,
        })),
      ),
      repository.insertRecommendations(
        result.recommendations.map((r, i) => ({
          audit_id: auditId,
          priority: r.priority,
          title: r.title,
          severity: r.severity,
          why: r.why,
          suggested_action: r.suggestedAction,
          related_rule_id: r.relatedRuleId,
          status: "open",
          sort_order: i,
        })),
      ),
      repository.insertTimeline(timelineRows),
    ]);

    const completed = await repository.updateAudit(auditId, {
      status: "completed",
      progress: 100,
    });
    return { audit: completed ?? claimed, engine: result };
  } catch (err) {
    // Fatal infrastructure/engine error → clean failure state.
    console.error(`[runAudit] audit ${auditId} crashed:`, err);
    const message =
      err instanceof Error && /SUPABASE_SERVICE_ROLE_KEY|insert failed|update failed/
        ? "Audit persistence failed."
        : "Audit execution failed.";
    try {
      await repository.insertTimeline([
        ...startedTimeline,
        {
          audit_id: auditId,
          label: `Audit failed: ${message}`,
          entry_at: new Date().toISOString(),
          sort_order: 999,
        },
      ]);
      const failed = await repository.updateAudit(auditId, {
        status: "failed",
      });
      return { audit: failed ?? claimed, engine: null };
    } catch (persistErr) {
      console.error(`[runAudit] failure-state persistence error:`, persistErr);
      return { audit: claimed, engine: null };
    }
  }
}
