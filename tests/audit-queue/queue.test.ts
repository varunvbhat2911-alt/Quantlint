/* Phase 9 unit tests — durable audit queue client operations.
 *
 * Uses an in-memory fake QueueClient that emulates the plpgsql RPCs so unit
 * tests never touch real Postgres. The fake mirrors the SQL semantics:
 * enqueue idempotency (partial-unique), dequeue FOR UPDATE SKIP LOCKED,
 * complete/fail with backoff, poison dead-lettering, and stale requeue. */

import { describe, it, expect } from "vitest";
import {
  enqueueAudit,
  dequeueAudit,
  completeJob,
  failJob,
  recoverStaleJobs,
} from "@/lib/audit-queue/queue";
import { asUuid, type QueueClient } from "@/lib/audit-queue/types";
import { DEFAULT_RETRY_POLICY } from "@/lib/audit-queue/types";

/* dequeue_audit(p_worker_id uuid) requires valid UUIDs. Use a few distinct
 * fixed UUIDs as worker ids in the tests. */
const W1 = asUuid("00000000-0000-0000-0000-000000000001");
const W2 = asUuid("00000000-0000-0000-0000-000000000002");
const WDEAD = asUuid("00000000-0000-0000-0000-0000000000ad");
const WALIVE = asUuid("00000000-0000-0000-0000-0000000000a1");
const WNEW = asUuid("00000000-0000-0000-0000-0000000000ab");
const WGEN = asUuid("00000000-0000-0000-0000-000000000000");

type Row = {
  id: string;
  audit_id: string;
  status: "pending" | "running" | "completed" | "dead";
  attempts: number;
  max_attempts: number;
  visible_at: number; // epoch ms
  locked_by: string | null;
  locked_at: number | null;
  last_error: string | null;
};

function fakeQueue(): QueueClient & { rows: Row[]; now: number } {
  const state: { rows: Row[]; now: number } = { rows: [], now: Date.now() };
  // The fake's rpc returns concrete union types; cast to the generic
  // QueueClient.rpc signature at the boundary.
  const rpcImpl = async (fn: string, args: Record<string, unknown>) => {
    const a = args;
      if (fn === "enqueue_audit") {
        const auditId = a.p_audit_id as string;
        // partial-unique: no-op if an active job exists
        const active = state.rows.find(
          (r) => r.audit_id === auditId && (r.status === "pending" || r.status === "running"),
        );
        if (active) return { data: false, error: null };
        state.rows.push({
          id: `job-${auditId}-${state.rows.length}`,
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
        // earliest visible pending job under the attempt cap
        const job = state.rows
          .filter((r) => r.status === "pending" && r.visible_at <= state.now && r.attempts < maxAtt)
          .sort((x, y) => x.visible_at - y.visible_at)[0];
        if (!job) return { data: null, error: null };
        job.status = "running";
        job.attempts += 1;
        job.locked_by = workerId;
        job.locked_at = state.now;
        // Return snake_case to mirror PostgREST.
        return {
          data: [{ job_id: job.id, audit_id: job.audit_id, attempts: job.attempts }],
          error: null,
        };
      }
      if (fn === "complete_audit_job") {
        const id = a.p_job_id as string;
        const job = state.rows.find((r) => r.id === id && r.status === "running");
        if (job) {
          job.status = "completed";
          job.locked_by = null;
          job.locked_at = null;
        }
        return { data: null, error: null };
      }
      if (fn === "fail_audit_job") {
        const id = a.p_job_id as string;
        const delay = (a.p_retry_delay_seconds as number) ?? 30;
        const err = (a.p_error as string) ?? "error";
        const job = state.rows.find((r) => r.id === id && r.status === "running");
        if (job) {
          job.locked_by = null;
          job.locked_at = null;
          job.last_error = err;
          if (job.attempts >= job.max_attempts) {
            job.status = "dead";
          } else {
            job.status = "pending";
            job.visible_at = state.now + delay * 1000;
          }
        }
        return { data: null, error: null };
      }
      if (fn === "recover_stale_jobs") {
        const staleAfter = (a.p_stale_after_seconds as number) ?? 300;
        const recovered: string[] = [];
        for (const job of state.rows) {
          if (job.status === "running" && job.locked_at !== null && state.now - job.locked_at > staleAfter * 1000) {
            job.status = "pending";
            job.visible_at = state.now;
            job.locked_by = null;
            job.locked_at = null;
            recovered.push(job.id);
          }
        }
        return { data: recovered, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${fn}` } };
  };
  const client = { rpc: rpcImpl as unknown as QueueClient["rpc"] };
  // Expose `now` as a getter/setter backed by state.now, so tests can advance
  // time via q.now += ms and the rpc closure observes the same value.
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

describe("enqueueAudit — idempotent enqueue", () => {
  it("creates a pending job for a new audit", async () => {
    const q = fakeQueue();
    const res = await enqueueAudit(q, "a-1");
    expect(res.enqueued).toBe(true);
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0]?.status).toBe("pending");
  });

  it("is a no-op when an active job already exists (duplicate enqueue)", async () => {
    const q = fakeQueue();
    await enqueueAudit(q, "a-1");
    const second = await enqueueAudit(q, "a-1");
    expect(second.enqueued).toBe(false);
    expect(q.rows).toHaveLength(1);
  });

  it("allows re-enqueue after the prior job completed", async () => {
    const q = fakeQueue();
    await enqueueAudit(q, "a-1");
    const deq = await dequeueAudit(q, W1);
    if (!deq.ok) throw new Error("dequeue failed");
    await completeJob(q, deq.job.jobId);
    const again = await enqueueAudit(q, "a-1");
    expect(again.enqueued).toBe(true);
    expect(q.rows.filter((r) => r.audit_id === "a-1")).toHaveLength(2);
  });
});

describe("dequeueAudit — worker claim", () => {
  it("returns empty when nothing is ready", async () => {
    const q = fakeQueue();
    const res = await dequeueAudit(q, W1);
    expect(res.ok).toBe(false);
    expect("empty" in res && res.empty).toBe(true);
  });

  it("claims the earliest visible pending job", async () => {
    const q = fakeQueue();
    await enqueueAudit(q, "a-1");
    await enqueueAudit(q, "a-2");
    const res = await dequeueAudit(q, W1);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.job.auditId).toBe("a-1");
  });

  it("does not return a job still in its backoff window", async () => {
    const q = fakeQueue();
    await enqueueAudit(q, "a-1");
    const deq = await dequeueAudit(q, W1);
    if (!deq.ok) throw new Error("dequeue failed");
    await failJob(q, deq.job.jobId, "boom", { ...DEFAULT_RETRY_POLICY, retryDelaySeconds: 30 });
    // Immediately re-dequeue: job is in backoff → empty
    const res = await dequeueAudit(q, W2);
    expect(res.ok).toBe(false);
    expect("empty" in res && res.empty).toBe(true);
  });

  it("returns the job again after the backoff window elapses", async () => {
    const q = fakeQueue();
    await enqueueAudit(q, "a-1");
    const deq = await dequeueAudit(q, W1);
    if (!deq.ok) throw new Error("dequeue failed");
    await failJob(q, deq.job.jobId, "boom", { ...DEFAULT_RETRY_POLICY, retryDelaySeconds: 30 });
    q.now += 31 * 1000;
    const res = await dequeueAudit(q, W2);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.job.attempts).toBe(2);
  });
});

describe("failJob — poison dead-lettering", () => {
  it("dead-letters a job after the row's max_attempts (default 5)", async () => {
    const q = fakeQueue();
    // fail_audit_job uses the job row's max_attempts column (default 5), not a
    // per-call value — mirror the SQL exactly.
    const retry = { maxAttempts: DEFAULT_RETRY_POLICY.maxAttempts, retryDelaySeconds: 0 };
    await enqueueAudit(q, "a-1");
    for (let i = 0; i < retry.maxAttempts; i++) {
      const deq = await dequeueAudit(q, WGEN);
      if (!deq.ok) throw new Error(`dequeue failed at iteration ${i}`);
      await failJob(q, deq.job.jobId, "always fails", retry);
      q.now += 1; // advance past the 0s backoff so the next dequeue is visible
    }
    const job = q.rows[0]!;
    expect(job.status).toBe("dead");
    expect(job.last_error).toBe("always fails");
    expect(job.attempts).toBe(retry.maxAttempts);
    // A dead job is not re-dequeueable.
    const res = await dequeueAudit(q, WGEN);
    expect(res.ok).toBe(false);
  });
});

describe("recoverStaleJobs — worker death recovery", () => {
  it("requeues a running job whose lock has aged past the threshold", async () => {
    const q = fakeQueue();
    await enqueueAudit(q, "a-1");
    const deq = await dequeueAudit(q, WDEAD);
    if (!deq.ok) throw new Error("dequeue failed");
    // Simulate the worker vanishing 6 minutes ago.
    q.now += 6 * 60 * 1000;
    const recovered = await recoverStaleJobs(q, 300);
    expect(recovered).toContain(deq.job.jobId);
    expect(q.rows[0]?.status).toBe("pending");
  });

  it("leaves a recently-locked running job alone", async () => {
    const q = fakeQueue();
    await enqueueAudit(q, "a-1");
    await dequeueAudit(q, WALIVE);
    q.now += 10 * 1000; // only 10s
    const recovered = await recoverStaleJobs(q, 300);
    expect(recovered).toEqual([]);
    expect(q.rows[0]?.status).toBe("running");
  });

  it("is concurrency-safe (a re-run is re-dequeueable)", async () => {
    const q = fakeQueue();
    await enqueueAudit(q, "a-1");
    const deq = await dequeueAudit(q, WDEAD);
    if (!deq.ok) throw new Error("dequeue failed");
    q.now += 6 * 60 * 1000;
    await recoverStaleJobs(q, 300);
    const again = await dequeueAudit(q, WNEW);
    expect(again.ok).toBe(true);
  });
});
