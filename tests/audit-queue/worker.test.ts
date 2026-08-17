/* Phase 9 unit tests — worker batch processing (durability core).
 *
 * Uses the same fakeQueue as queue.test.ts (re-implemented inline to keep this
 * file self-contained) plus a fake AuditRepository. The real runAudit() runs
 * against a tiny valid Python source with aiDeps=null (deterministic-only) so
 * no Fireworks calls are made. This validates that processQueueBatch:
 *   - acks (completeJob) successful runs
 *   - requeues (failJob) on repository errors
 *   - stops cleanly when the queue is empty
 *   - handles AuditNotFoundError by acking (audit was deleted)
 */

import { describe, it, expect } from "vitest";
import { processQueueBatch } from "@/lib/audit-queue/worker";
import { enqueueAudit } from "@/lib/audit-queue/queue";
import { AuditNotFoundError } from "@/lib/audit-engine/execution";
import type { AuditRepository, AuditRow } from "@/lib/audit-engine/repository";
import { asUuid, type QueueClient } from "@/lib/audit-queue/types";
import { DEFAULT_RETRY_POLICY } from "@/lib/audit-queue/types";

/* dequeue_audit(p_worker_id uuid) requires a valid UUID. */
const W1 = asUuid("00000000-0000-0000-0000-000000000001");

type Row = {
  id: string;
  audit_id: string;
  status: "pending" | "running" | "completed" | "dead";
  attempts: number;
  max_attempts: number;
  visible_at: number;
  locked_by: string | null;
  locked_at: number | null;
  last_error: string | null;
};

const PY = "import pandas as pd\nsignal = close.pct_change()\nreturn signal\n";

function queuedAuditRow(id: string): AuditRow {
  return {
    id,
    user_id: "u-1",
    strategy_name: "s",
    input_type: "paste",
    file_name: null,
    framework: "auto",
    analysis_depth: "standard",
    rule_categories: [],
    code: PY,
    status: "queued",
    progress: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as AuditRow;
}

function fakeQueue(): QueueClient & { rows: Row[]; now: number } {
  const state: { rows: Row[]; now: number } = { rows: [], now: Date.now() };
  // The fake's rpc returns concrete union types; cast to the generic
  // QueueClient.rpc signature at the boundary.
  const rpcImpl = async (fn: string, args: Record<string, unknown>) => {
    const a = args;
      if (fn === "enqueue_audit") {
        const auditId = a.p_audit_id as string;
        if (state.rows.some((r) => r.audit_id === auditId && (r.status === "pending" || r.status === "running")))
          return { data: false, error: null };
        state.rows.push({
          id: `job-${auditId}`,
          audit_id: auditId,
          status: "pending",
          attempts: 0,
          max_attempts: DEFAULT_RETRY_POLICY.maxAttempts,
          visible_at: state.now,
          locked_by: null,
          locked_at: null,
          last_error: null,
        });
        return { data: true, error: null };
      }
      if (fn === "dequeue_audit") {
        const workerId = a.p_worker_id as string;
        const maxAtt = (a.p_max_attempts as number) ?? DEFAULT_RETRY_POLICY.maxAttempts;
        const job = state.rows
          .filter((r) => r.status === "pending" && r.visible_at <= state.now && r.attempts < maxAtt)
          .sort((x, y) => x.visible_at - y.visible_at)[0];
        if (!job) return { data: null, error: null };
        job.status = "running";
        job.attempts += 1;
        job.locked_by = workerId;
        job.locked_at = state.now;
        return { data: [{ job_id: job.id, audit_id: job.audit_id, attempts: job.attempts }], error: null };
      }
      if (fn === "complete_audit_job") {
        const id = a.p_job_id as string;
        const job = state.rows.find((r) => r.id === id && r.status === "running");
        if (job) { job.status = "completed"; job.locked_by = null; job.locked_at = null; }
        return { data: null, error: null };
      }
      if (fn === "fail_audit_job") {
        const id = a.p_job_id as string;
        const delay = (a.p_retry_delay_seconds as number) ?? 30;
        const err = (a.p_error as string) ?? "error";
        const job = state.rows.find((r) => r.id === id && r.status === "running");
        if (job) {
          job.locked_by = null; job.locked_at = null; job.last_error = err;
          if (job.attempts >= job.max_attempts) job.status = "dead";
          else { job.status = "pending"; job.visible_at = state.now + delay * 1000; }
        }
        return { data: null, error: null };
      }
      if (fn === "recover_stale_jobs") {
        const staleAfter = (a.p_stale_after_seconds as number) ?? 300;
        const recovered: string[] = [];
        for (const job of state.rows)
          if (job.status === "running" && job.locked_at !== null && state.now - job.locked_at > staleAfter * 1000) {
            job.status = "pending"; job.visible_at = state.now; job.locked_by = null; job.locked_at = null;
            recovered.push(job.id);
          }
        return { data: recovered, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${fn}` } };
  };
  const client = { rpc: rpcImpl as unknown as QueueClient["rpc"] };
  Object.defineProperty(client, "now", {
    get: () => state.now,
    set: (v: number) => {
      state.now = v;
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(client, "rows", {
    get: () => state.rows,
    enumerable: true,
    configurable: true,
  });
  return client as QueueClient & { rows: Row[]; now: number };
}

/* A fake repository whose behavior is steerable per-audit via the map. */
function fakeRepository(opts: {
  audits?: Record<string, AuditRow>;
  failOnCommit?: string[]; // audit ids whose commit should throw
}): AuditRepository {
  const audits = opts.audits ?? {};
  const rows: AuditRow[] = [];
  const timeline: { audit_id: string; label: string; sort_order: number }[] = [];
  return {
    async getAudit(id) {
      // runAudit refuses to re-execute running/completed/failed audits.
      const a = audits[id];
      if (!a) return null;
      return a;
    },
    async claimAudit(id) {
      const a = audits[id];
      if (!a || a.status !== "queued") return null;
      a.status = "running";
      a.progress = 0;
      return a;
    },
    async updateAudit(id, patch) {
      const a = audits[id];
      if (!a) return null;
      if (patch.status) a.status = patch.status;
      if (patch.progress !== undefined) a.progress = patch.progress;
      if (patch.code !== undefined) (a as { code?: string }).code = patch.code;
      return a;
    },
    async getResults() {
      return { violations: [], metrics: [], recommendations: [], timeline: [] };
    },
    async insertViolations() {},
    async insertMetrics() {},
    async insertRecommendations() {},
    async insertTimeline(r) {
      for (const r0 of r) timeline.push({ audit_id: r0.audit_id, label: r0.label, sort_order: r0.sort_order ?? 0 });
    },
    async commitResults(args) {
      if (opts.failOnCommit?.includes(args.auditId)) {
        throw new Error("commit explosion");
      }
      const a = audits[args.auditId];
      if (a) { a.status = args.status as AuditRow["status"]; a.progress = args.progress; }
      rows.push(a!);
    },
    async recoverStale() { return []; },
    async resetForRetry() { return false; },
  };
}

describe("processQueueBatch — durability core", () => {
  it("runs a queued audit to completion and acks the job", async () => {
    const q = fakeQueue();
    const repo = fakeRepository({ audits: { "a-1": queuedAuditRow("a-1") } });
    await enqueueAudit(q, "a-1");
    const result = await processQueueBatch({
      workerId: W1,
      queue: q,
      repository: repo,
      aiDeps: null,
      maxJobsPerBatch: 5,
    });
    expect(result.processed).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.emptied).toBe(true);
    expect(q.rows[0]?.status).toBe("completed");
  });

  it("stops with emptied=true when the queue has nothing ready", async () => {
    const q = fakeQueue();
    const repo = fakeRepository({});
    const result = await processQueueBatch({
      workerId: W1,
      queue: q,
      repository: repo,
      aiDeps: null,
    });
    expect(result.processed).toBe(0);
    expect(result.emptied).toBe(true);
  });

  it("marks the audit failed and acks the job when commit throws (runAudit handles it)", async () => {
    // runAudit catches commit errors internally, writes a failed state, and
    // returns normally — so the worker acks (completeJob), and the audit ends
    // up 'failed'. The job is NOT requeued (the failure was handled, not a
    // crash). This is the intended durability contract.
    const q = fakeQueue();
    const repo = fakeRepository({
      audits: { "a-1": queuedAuditRow("a-1") },
      failOnCommit: ["a-1"],
    });
    await enqueueAudit(q, "a-1");
    const result = await processQueueBatch({
      workerId: W1,
      queue: q,
      repository: repo,
      aiDeps: null,
    });
    expect(result.processed).toBe(1);
    expect(result.completed).toBe(1);
    expect(q.rows[0]?.status).toBe("completed"); // acked
  });

  it("requeues (failJob) when runAudit throws (repo getAudit error escapes)", async () => {
    // runAudit calls getAudit() before its try block, so a getAudit throw
    // escapes and the worker's catch records it via failJob → requeue.
    const q = fakeQueue();
    const base = fakeRepository({ audits: { "a-1": queuedAuditRow("a-1") } });
    const repo: AuditRepository = {
      ...base,
      async getAudit() {
        throw new Error("db connection lost");
      },
    };
    await enqueueAudit(q, "a-1");
    const result = await processQueueBatch({
      workerId: W1,
      queue: q,
      repository: repo,
      aiDeps: null,
    });
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(q.rows[0]?.status).toBe("pending"); // requeued with backoff
    expect(q.rows[0]?.last_error).toContain("db connection lost");
  });

  it("does not double-execute a duplicate dequeue (atomic claim guard)", async () => {
    // runAudit no-ops on an already-running audit; enqueue idempotency means a
    // duplicate enqueue is a no-op, so only one job exists and runs once.
    const q = fakeQueue();
    const repo = fakeRepository({ audits: { "a-1": queuedAuditRow("a-1") } });
    await enqueueAudit(q, "a-1");
    await enqueueAudit(q, "a-1"); // duplicate — no-op
    expect(q.rows).toHaveLength(1);
    const result = await processQueueBatch({
      workerId: W1,
      queue: q,
      repository: repo,
      aiDeps: null,
    });
    expect(result.processed).toBe(1);
    expect(result.completed).toBe(1);
  });

  it("acks (does not requeue) when the audit was deleted (AuditNotFound)", async () => {
    const q = fakeQueue();
    const repo = fakeRepository({ audits: {} }); // no audit → AuditNotFoundError
    await enqueueAudit(q, "a-gone");
    const result = await processQueueBatch({
      workerId: W1,
      queue: q,
      repository: repo,
      aiDeps: null,
    });
    expect(result.processed).toBe(1);
    expect(result.completed).toBe(1); // acked as completed (missing)
    expect(q.rows[0]?.status).toBe("completed");
  });

  it("bounds the batch to maxJobsPerBatch", async () => {
    const q = fakeQueue();
    const audits: Record<string, AuditRow> = {};
    for (let i = 0; i < 5; i++) {
      audits[`a-${i}`] = queuedAuditRow(`a-${i}`);
      await enqueueAudit(q, `a-${i}`);
    }
    const repo = fakeRepository({ audits });
    const result = await processQueueBatch({
      workerId: W1,
      queue: q,
      repository: repo,
      aiDeps: null,
      maxJobsPerBatch: 2,
    });
    expect(result.processed).toBe(2);
    expect(result.emptied).toBe(false);
  });
});
