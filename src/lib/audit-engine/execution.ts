/* runAudit(): server-side orchestration of one audit job.
 *
 * Loads the queued audit, claims it (atomic queued→running), executes the
 * deterministic engine, persists violations/metrics/recommendations/timeline,
 * and drives real progress from completed stages. Structured so a future
 * background worker can call runAudit(auditId) unchanged. Internal errors are
 * logged server-side and surfaced to clients only as clean failure states. */

import { runEngine } from "./engine";
import { AUDIT_STAGES, type EngineResult } from "./types";
import type { AIDeps } from "./pipeline";
import { getAIProvider } from "@/lib/ai/provider";
import type { Json } from "@/types/database";
import {
  createSupabaseAuditRepository,
  type AuditRepository,
  type AuditRow,
  type TimelineInsert,
} from "./repository";
import {
  IngestionError,
  createStrategyStorageClient,
  ingestUploadedStrategy,
  type SourceSegment,
  type StrategyStorageClient,
} from "@/lib/audit-ingestion";
import { log } from "@/lib/server/logger";

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
  aiDeps?: AIDeps | null,
  /* Injectable for tests; resolved lazily to the service-role storage
   * client only when an upload actually needs ingesting. The audit row was
   * already authorization-checked by the calling route. */
  storageClient?: StrategyStorageClient,
): Promise<RunAuditResult> {
  // AI enrichment is enabled only when FIREWORKS_API_KEY is configured;
  // otherwise the audit runs fully deterministic.
  const ai = aiDeps !== undefined ? aiDeps : getAIProvider() ?? null;
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
    const aiStageIndex = AUDIT_STAGES.indexOf("ai");
    const perStage = 100 / AUDIT_STAGES.length;

    /* Uploaded strategies ingest here: storage bytes → validated → decoded
     * → normalized source (with per-file segments for ZIP projects). The
     * normalized source is persisted so retries and the results page see
     * exactly what the engine analyzed. Ingestion failures are clean
     * user-facing errors — never internal stack traces. */
    let code = audit.code;
    let segments: SourceSegment[] | undefined;
    if (audit.input_type === "upload") {
      try {
        const storage = storageClient ?? createStrategyStorageClient();
        const ingested = await ingestUploadedStrategy(audit, storage);
        code = ingested.code;
        segments = ingested.segments.length > 0 ? ingested.segments : undefined;
        if (code !== audit.code) {
          await repository.updateAudit(auditId, { code });
        }
        const note =
          ingested.encodingNote ?? `${ingested.fileCount} Python file(s) read`;
        await repository.insertTimeline([
          {
            audit_id: auditId,
            label: `Strategy file ingested — ${note}`,
            entry_at: new Date().toISOString(),
            sort_order: 0,
          },
        ]);
      } catch (err) {
        if (err instanceof IngestionError) {
          log.error("audit.ingestion.failed", { auditId, error: err.message });
          await repository.insertTimeline([
            ...startedTimeline,
            {
              audit_id: auditId,
              label: `Audit failed: ${err.userMessage}`,
              entry_at: new Date().toISOString(),
              sort_order: 999,
            },
          ]);
          const failed = await repository.updateAudit(auditId, {
            status: "failed",
          });
          return { audit: failed ?? claimed, engine: null };
        }
        throw err;
      }
    }

    const result = await runEngine(
      {
        code,
        fileName: audit.file_name,
        declaredFramework: audit.framework,
        analysisDepth: audit.analysis_depth,
        ruleCategories: audit.rule_categories,
        segments,
      },
      {
        onStageComplete: (_stage, _index, progress) => {
          // Real progress: fraction of completed stages. Void — a progress
          // write failure must not abort the audit.
          repository
            .updateAudit(auditId, { progress })
            .catch((err) => log.error("audit.progress.write.failed", { auditId, error: String(err) }));
        },
        onAIProgress: (fraction) => {
          // Real sub-stage progress while the AI enriches findings.
          const progress = Math.round(
            aiStageIndex * perStage + perStage * Math.min(1, Math.max(0, fraction)),
          );
          repository
            .updateAudit(auditId, { progress })
            .catch((err) => log.error("audit.ai.progress.write.failed", { auditId, error: String(err) }));
        },
      },
      ai,
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
      log.error("audit.execution.failed", { auditId, error: result.fatalError });
      return { audit: failed ?? claimed, engine: result };
    }

    // Phase 8: atomic persistence — all children + status in one transaction.
    await repository.commitResults({
      auditId,
      status: "completed",
      progress: 100,
      violations: result.findings.map((f, i) => ({
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
        ai_explanation: (f.aiExplanation ?? null) as Json | null,
      })),
      metrics: result.metrics.map((m, i) => ({
        audit_id: auditId,
        group_label: m.groupLabel,
        key: m.key,
        label: m.label,
        value: m.value,
        tooltip: m.tooltip,
        sort_order: i,
      })),
      recommendations: result.recommendations.map((r, i) => ({
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
      timeline: timelineRows,
    });

    const completed = await repository.updateAudit(auditId, {
      status: "completed",
      progress: 100,
    });
    return { audit: completed ?? claimed, engine: result };
  } catch (err) {
    // Fatal infrastructure/engine error → clean failure state.
    log.error("audit.crashed", { auditId, error: String(err) });
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
      log.error("audit.failure.persistence.error", { auditId, error: String(persistErr) });
      return { audit: claimed, engine: null };
    }
  }
}
