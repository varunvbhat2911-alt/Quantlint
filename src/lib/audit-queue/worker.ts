/* Durable audit execution worker — server-only.
 *
 * Drains the audit_job_queue and runs each job through the UNCHANGED
 * runAudit() (deterministic engine + optional AI enrichment + atomic commit).
 * This module is the pure, injectable core shared by:
 *   - the Supabase Edge Function (supabase/functions/audit-worker), and
 *   - the Node dev worker (scripts/phase9/worker.mjs).
 *
 * Durability contract:
 *   * The HTTP run route only ENQUEUES; it never runs an audit inline. An
 *     audit survives the request ending because the queue is a Postgres table.
 *   * Idempotency: duplicate enqueue is a no-op (partial unique index); a
 *     duplicate dequeue+run is a no-op because runAudit refuses to re-execute
 *     an already-running/completed/failed audit (atomic claim).
 *   * Poison safety: attempts are capped; fail_audit_job dead-letters beyond
 *     the cap instead of looping forever.
 *   * Worker death: recover_stale_jobs requeues a stalled running job; a
 *     re-run is safe because of the atomic claim.
 *
 * Logs carry auditId, workerId, and the requestId of the enqueueing request
 * where available. No source code, secrets, or provider responses are logged.
 */

import "server-only";
import { runAudit, AuditNotFoundError } from "@/lib/audit-engine/execution";
import type { AIDeps } from "@/lib/audit-engine/pipeline";
import type { AuditRepository } from "@/lib/audit-engine/repository";
import { log, type LogFields } from "@/lib/server/logger";
import { completeJob, dequeueAudit, failJob } from "./queue";
import {
  DEFAULT_RETRY_POLICY,
  type DequeuedJob,
  type QueueClient,
  type RetryPolicy,
  type Uuid,
} from "./types";

export type WorkerOptions = {
  /* Must be a valid UUID; dequeue_audit(p_worker_id uuid) rejects non-UUID. */
  workerId: Uuid;
  queue: QueueClient;
  repository: AuditRepository;
  /* Inject AI for tests (deterministic mock). Leave undefined for real Fireworks
   * (resolved lazily inside runAudit). Pass null to force deterministic-only. */
  aiDeps?: AIDeps | null;
  retry?: RetryPolicy;
  /* Stop after processing this many jobs in one invocation (bounded batch). */
  maxJobsPerBatch?: number;
  /* Idle signal: when the queue is empty, the caller decides how long to wait
   * before the next batch. This function does not sleep. */
};

export type BatchResult = {
  processed: number;
  completed: number;
  failed: number;
  emptied: boolean;
};

/* Process up to maxJobsPerBatch jobs, or until the queue is empty. Returns a
 * summary so the host (Edge Function / Node loop) can decide idle behavior. */
export async function processQueueBatch(opts: WorkerOptions): Promise<BatchResult> {
  const retry = opts.retry ?? DEFAULT_RETRY_POLICY;
  const maxJobs = Math.max(1, Math.min(opts.maxJobsPerBatch ?? 10, 100));
  let processed = 0;
  let completed = 0;
  let failed = 0;
  let emptied = false;

  for (let i = 0; i < maxJobs; i++) {
    const dequeued = await dequeueAudit(opts.queue, opts.workerId, retry);
    if (!dequeued.ok) {
      if ("empty" in dequeued) {
        emptied = true;
        break;
      }
      log.error("queue.dequeue_failed", {
        errorCode: "QUEUE_DEQUEUE_ERROR",
        status: "error",
        ...errField(dequeued.error),
      });
      // A dequeue error is transient; stop this batch and let the host retry.
      emptied = true;
      break;
    }

    processed++;
    const outcome = await runOneJob(dequeued.job, opts, retry);
    if (outcome === "completed") completed++;
    else failed++;
  }

  return { processed, completed, failed, emptied };
}

/* Run a single dequeued job to completion (ack) or failure (requeue/dead). */
async function runOneJob(
  job: DequeuedJob,
  opts: WorkerOptions,
  retry: RetryPolicy,
): Promise<"completed" | "failed"> {
  const base: LogFields = {
    auditId: job.auditId,
    requestId: undefined, // populated below if available
    status: undefined,
  };
  const started = Date.now();

  try {
    const result = await runAudit(
      job.auditId,
      opts.repository,
      opts.aiDeps,
      undefined, // storage resolved lazily inside runAudit for uploads
    );
    const durationMs = Date.now() - started;
    const status = result.audit?.status ?? "unknown";
    log.info("audit.job_completed", {
      ...base,
      status,
      durationMs,
      jobId: job.jobId,
      attempts: job.attempts,
    });
    await completeJob(opts.queue, job.jobId);
    return "completed";
  } catch (err) {
    const durationMs = Date.now() - started;
    const isMissing = err instanceof AuditNotFoundError;
    const detail = err instanceof Error ? err.message : "unknown error";
    if (isMissing) {
      // Audit was deleted (FK would normally remove the job too). Acknowledge
      // so the job isn't retried pointlessly.
      log.warn("audit.job_missing", {
        ...base,
        jobId: job.jobId,
        durationMs,
        errorCode: "AUDIT_NOT_FOUND",
      });
      try {
        await completeJob(opts.queue, job.jobId);
      } catch {
        /* ignore — job may already be gone via CASCADE */
      }
      return "completed";
    }
    log.error("audit.job_failed", {
      ...base,
      jobId: job.jobId,
      durationMs,
      attempts: job.attempts,
      errorCode: "AUDIT_EXECUTION_ERROR",
      ...errField(detail),
    });
    try {
      await failJob(opts.queue, job.jobId, detail, retry);
    } catch (failErr) {
      // If we can't even record the failure, log it; the stale-job recovery
      // will eventually requeue this running job.
      log.error("queue.fail_record_failed", {
        jobId: job.jobId,
        errorCode: "QUEUE_FAIL_ERROR",
        ...errField(failErr instanceof Error ? failErr.message : "unknown"),
      });
    }
    return "failed";
  }
}

/* Keep error detail out of the top-level log fields to avoid accidentally
 * surfacing internals in a flat shape; nest it under `error`. */
function errField(detail: string): { error: string } {
  return { error: detail };
}
