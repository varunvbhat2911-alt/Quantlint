/* Durable audit execution queue — client operations (server-only).
 *
 * Thin wrappers over the plpgsql RPCs in
 * supabase/migrations/20260817130000_phase9_audit_job_queue.sql. The caller is
 * responsible for having verified audit ownership through the RLS-scoped
 * session client BEFORE enqueueing; enqueue itself runs on the service-role
 * client because the queue table is default-deny under RLS. */

import "server-only";
import {
  DEFAULT_RETRY_POLICY,
  DEFAULT_STALE_JOB_SECONDS,
  type DequeueResult,
  type DequeuedJob,
  type EnqueueResult,
  type QueueClient,
  type RetryPolicy,
  type Uuid,
} from "./types";

function asError(error: { message: string } | null): string {
  return error?.message ?? "unknown queue error";
}

/* Enqueue an audit for durable execution. Idempotent: a duplicate enqueue
 * while a job is pending/running is a no-op (returns enqueued:false). The
 * partial unique index on audit_job_queue(audit_id) enforces this at the DB. */
export async function enqueueAudit(
  client: QueueClient,
  auditId: string,
): Promise<EnqueueResult> {
  const { data, error } = await client.rpc<"enqueue_audit", { p_audit_id: string }, boolean>(
    "enqueue_audit",
    { p_audit_id: auditId },
  );
  if (error) throw new Error(`[queue] enqueue failed: ${asError(error)}`);
  return { enqueued: Boolean(data) };
}

/* Claim the next ready job for a worker. Returns {ok:false, empty:true} when
 * the queue has nothing ready (workers should idle-poll). The workerId must be
 * a valid UUID — dequeue_audit(p_worker_id uuid) rejects non-UUID input. */
export async function dequeueAudit(
  client: QueueClient,
  workerId: Uuid,
  retry: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<DequeueResult> {
  const { data, error } = await client.rpc<
    "dequeue_audit",
    { p_worker_id: string; p_max_attempts: number },
    DequeuedJob[]
  >("dequeue_audit", {
    p_worker_id: workerId,
    p_max_attempts: retry.maxAttempts,
  });
  if (error) return { ok: false, error: asError(error) };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { ok: false, empty: true };
  // PostgREST returns snake_case columns; normalize to camelCase.
  const job: DequeuedJob = {
    jobId: (row as unknown as { job_id?: string; jobId?: string }).job_id
      ?? (row as unknown as { jobId?: string }).jobId
      ?? (row as unknown as { id?: string }).id
      ?? "",
    auditId: (row as unknown as { audit_id?: string; auditId?: string }).audit_id
      ?? (row as unknown as { auditId?: string }).auditId
      ?? "",
    attempts: (row as unknown as { attempts?: number }).attempts ?? 0,
  };
  if (!job.jobId || !job.auditId) {
    return { ok: false, error: "dequeue returned an invalid job row" };
  }
  return { ok: true, job };
}

/* Acknowledge a job: the worker finished (audit completed or failed). */
export async function completeJob(client: QueueClient, jobId: string): Promise<void> {
  const { error } = await client.rpc<"complete_audit_job", { p_job_id: string }, null>(
    "complete_audit_job",
    { p_job_id: jobId },
  );
  if (error) throw new Error(`[queue] complete failed: ${asError(error)}`);
}

/* Release a job for retry with backoff, or dead-letter it once attempts hit
 * the cap. Keeps poison messages from looping forever. */
export async function failJob(
  client: QueueClient,
  jobId: string,
  errorText: string,
  retry: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<void> {
  const { error } = await client.rpc<
    "fail_audit_job",
    { p_job_id: string; p_error: string; p_retry_delay_seconds: number },
    null
  >("fail_audit_job", {
    p_job_id: jobId,
    p_error: errorText,
    p_retry_delay_seconds: retry.retryDelaySeconds,
  });
  if (error) throw new Error(`[queue] fail failed: ${asError(error)}`);
}

/* Requeue jobs whose worker vanished (stale locks). Returns recovered job ids
 * for logging. Concurrency-safe (atomic UPDATE ... WHERE status='running'). */
export async function recoverStaleJobs(
  client: QueueClient,
  staleAfterSeconds: number = DEFAULT_STALE_JOB_SECONDS,
): Promise<string[]> {
  const { data, error } = await client.rpc<
    "recover_stale_jobs",
    { p_stale_after_seconds: number },
    string[]
  >("recover_stale_jobs", { p_stale_after_seconds: staleAfterSeconds });
  if (error) throw new Error(`[queue] recover stale failed: ${asError(error)}`);
  return (data as string[] | null) ?? [];
}
