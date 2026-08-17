/* Durable audit execution queue — shared types.
 *
 * Queue payloads contain ONLY the audit id. No source code, secrets, Fireworks
 * keys, service-role keys, or user data ever travel through the queue. */

/* A string that must be a valid UUID. dequeue_audit(p_worker_id uuid) rejects
 * non-UUID input at the Postgres layer, so callers must pass a real UUID. The
 * brand prevents a plain string (e.g. "node-1234") from being passed by
 * accident — only crypto.randomUUID() / a uuid library produce a Uuid. */
export type Uuid = string & { readonly __uuidBrand: unique symbol };

/* Mark a string as a UUID after validating its shape. Use this to wrap values
 * known to be UUIDs (e.g. crypto.randomUUID() output, audit ids). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function asUuid(value: string): Uuid {
  if (!UUID_RE.test(value)) {
    throw new Error(`Expected a UUID, got: ${value}`);
  }
  return value as Uuid;
}

export type AuditJobStatus = "pending" | "running" | "completed" | "dead";

export type AuditJobRow = {
  id: string;
  audit_id: string;
  status: AuditJobStatus;
  attempts: number;
  max_attempts: number;
  visible_at: string;
  locked_by: string | null;
  locked_at: string | null;
  last_error: string | null;
  enqueued_at: string;
  completed_at: string | null;
};

export type DequeuedJob = {
  jobId: string;
  auditId: string;
  attempts: number;
};

/* Minimal surface satisfied by supabase-js (service-role) clients and test
 * fakes alike, keeping unit tests off real Postgres. */
export type QueueClient = {
  rpc<FN extends string, ARGS extends Record<string, unknown>, RET>(
    fn: FN,
    args: ARGS,
  ): Promise<{ data: RET | null; error: { message: string } | null }>;
};

/* Result of enqueueing. `enqueued=false` means an active job already exists
 * for this audit (duplicate enqueue is an idempotent no-op). */
export type EnqueueResult = { enqueued: boolean };

export type DequeueResult =
  | { ok: true; job: DequeuedJob }
  | { ok: false; empty: true }
  | { ok: false; error: string };

/* Bounded retry/backoff knobs (passed to fail_audit_job). */
export type RetryPolicy = {
  maxAttempts: number;
  retryDelaySeconds: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  retryDelaySeconds: 30,
};

/* Stale-job recovery threshold (seconds). A running job whose lock is older
 * than this is requeued. Must exceed the longest expected single-audit run. */
export const DEFAULT_STALE_JOB_SECONDS = 300;
