import { NextRequest } from "next/server";
import { getAuditById, toAuditSummary } from "@/lib/audits";
import { createSupabaseAuditRepository } from "@/lib/audit-engine/repository";
import { requireUser } from "@/lib/auth/session";
import { createAuditQueueClient, enqueueAudit } from "@/lib/audit-queue";
import {
  consume,
  rateKey,
  clientIp,
  readLimits,
  tooManyRequests,
} from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";
import { requestIdFrom, withRequestId } from "@/lib/server/request";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* POST /api/audits/[id]/run — enqueue the AUTHENTICATED user's audit for
 * durable serverless execution and return 202 immediately.
 *
 * Authorization first: the audit must be visible to this user through the
 * session client (RLS-enforced). Only then do we enqueue a job on the
 * service-role queue client. The actual audit runs in a Supabase Edge Function
 * / worker that drains audit_job_queue — NEVER inline in this request. An
 * audit therefore survives this HTTP response ending.
 *
 * Phase 9 changes vs. Phase 8:
 *   - No global cross-tenant stale sweep in the request path. Stale recovery
 *     is now scheduled (pg_cron / Supabase scheduled function) and never
 *     triggered by an arbitrary user's run request.
 *   - No `void runAudit()`. Execution is durable via the queue.
 *   - Failed audits are retried by atomically resetting (reset_audit_for_retry)
 *     and re-enqueueing; the worker then processes the queued job.
 *   - Completed audits remain immutable (no rerun).
 *   - Per-IP + per-user rate limiting.
 *
 * Idempotency: enqueue_audit is a no-op when an active (pending/running) job
 * already exists for this audit, so duplicate run requests do not duplicate
 * execution. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  const requestId = requestIdFrom(request);
  const limits = readLimits();
  const ip = clientIp(request);

  const ipRes = consume(rateKey("audits:run:ip", ip), limits.auditsRunIp);
  if (!ipRes.ok) return withRequestId(tooManyRequests(ipRes), requestId);
  const userRes = consume(rateKey("audits:run:user", user.id), limits.auditsRun);
  if (!userRes.ok) return withRequestId(tooManyRequests(userRes), requestId);

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return withRequestId(
      Response.json(
        { success: false, error: "Invalid audit id." },
        { status: 400 },
      ),
      requestId,
    );
  }

  let audit;
  try {
    // Session client + RLS: another user's audit reads as missing here.
    audit = await getAuditById(id);
  } catch (err) {
    log.error("api.audits.run.fetch_failed", {
      auditId: id,
      requestId,
      errorCode: "AUDIT_FETCH_ERROR",
      ...errField(err),
    });
    return withRequestId(
      Response.json(
        { success: false, error: "Failed to start the audit." },
        { status: 500 },
      ),
      requestId,
    );
  }

  if (!audit) {
    // Foreign/nonexistent audits are indistinguishable → uniform 404 (no IDOR).
    return withRequestId(
      Response.json(
        { success: false, error: "Audit not found." },
        { status: 404 },
      ),
      requestId,
    );
  }

  if (audit.status === "queued") {
    return enqueueAndRespond(id, audit.status, audit.progress, requestId);
  }

  if (audit.status === "failed") {
    // Atomic retry: delete children + reset to queued, then enqueue.
    const repository = createSupabaseAuditRepository();
    let reset = false;
    try {
      reset = await repository.resetForRetry(id);
    } catch (err) {
      log.error("api.audits.run.retry_reset_failed", {
        auditId: id,
        requestId,
        errorCode: "AUDIT_RETRY_RESET_ERROR",
        ...errField(err),
      });
      return withRequestId(
        Response.json(
          { success: false, error: "Failed to retry the audit." },
          { status: 500 },
        ),
        requestId,
      );
    }
    if (!reset) {
      // Another concurrent retry already claimed the transition.
      return withRequestId(
        Response.json({ success: true, audit: toAuditSummary(audit) }),
        requestId,
      );
    }
    return enqueueAndRespond(id, "queued", 0, requestId);
  }

  // Idempotent: already running or completed.
  return withRequestId(
    Response.json({ success: true, audit: toAuditSummary(audit) }),
    requestId,
  );
}

/* Enqueue the audit and return 202. On enqueue failure, leave the audit in its
 * current (queued) state so a subsequent run request can retry safely — the
 * scheduled stale-job recovery will also eventually requeue any half-state. */
async function enqueueAndRespond(
  auditId: string,
  status: string,
  progress: number,
  requestId: string,
) {
  try {
    await enqueueAudit(createAuditQueueClient(), auditId);
  } catch (err) {
    log.error("api.audits.run.enqueue_failed", {
      auditId,
      requestId,
      errorCode: "AUDIT_ENQUEUE_ERROR",
      ...errField(err),
    });
    return withRequestId(
      Response.json(
        { success: false, error: "Failed to start the audit." },
        { status: 500 },
      ),
      requestId,
    );
  }
  log.info("api.audits.run.enqueued", { auditId, status, requestId });
  return withRequestId(
    Response.json(
      {
        success: true,
        audit: { id: auditId, status: "running", progress },
      },
      { status: 202 },
    ),
    requestId,
  );
}

function errField(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : "unknown error" };
}
