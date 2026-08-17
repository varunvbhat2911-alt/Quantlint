"use client";

/* useAuditJob — real audit job tracking.
 *
 * Polls GET /api/audits/[id] while the audit is queued/running and stops on
 * a terminal state (completed/failed). No timers simulate progress: every
 * value shown comes from the backend. Optionally auto-starts a queued audit
 * via POST /api/audits/[id]/run.
 *
 * Phase 9 reliability bounds (no infinite polling):
 *   - MAX_POLL_MS: a wall-clock cap (default 10 min). The server's scheduled
 *     stale recovery fails a stuck running audit within ~10 min, so by the time
 *     this fires the audit should already be terminal. If not, we surface a
 *     "stale" state with a retry affordance instead of spinning forever.
 *   - MAX_CONSECUTIVE_ERRORS: after N transient poll errors we stop and surface
 *     an error state (the user can retry). Prevents an indefinite error loop.
 *   - Auto-start retries: the POST /run is retried a few times (queued audits
 *     that never started because the first POST failed transiently would
 *     otherwise sit in queued until stale recovery).
 *
 * The client never takes responsibility for SERVER recovery — it only stops
 * spinning and tells the user something is taking longer than expected. It
 * never falsely marks an audit completed. */

import * as React from "react";
import type { AuditSummary } from "@/lib/audits";

export type AuditJobStatus =
  | "loading"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "error"
  | "stale";

export type AuditJobState = {
  status: AuditJobStatus;
  progress: number;
  audit: AuditSummary | null;
  pollError: string | null;
  notFound: boolean;
  stale: boolean;
};

const DEFAULT_POLL_MS = 1500;
const DEFAULT_MAX_POLL_MS = 10 * 60 * 1000; // 10 min — past stale-recovery threshold
const MAX_CONSECUTIVE_ERRORS = 6;
const START_MAX_ATTEMPTS = 3;
const START_RETRY_DELAY_MS = 1500;

export function useAuditJob(
  jobId: string | null,
  options?: {
    autoStart?: boolean;
    pollMs?: number;
    maxPollMs?: number;
  },
): AuditJobState {
  const autoStart = options?.autoStart ?? true;
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const maxPollMs = options?.maxPollMs ?? DEFAULT_MAX_POLL_MS;

  const [audit, setAudit] = React.useState<AuditSummary | null>(null);
  const [pollError, setPollError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [stale, setStale] = React.useState(false);
  const startRequestedRef = React.useRef(false);
  const startAttemptsRef = React.useRef(0);

  // Polling loop (re-armed only while queued/running or after transient errors)
  React.useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let consecutiveErrors = 0;

    const poll = async () => {
      if (cancelled) return;
      // Wall-clock staleness guard: if we've polled this long without a
      // terminal state, stop and surface a stale state (server recovery owns
      // the actual transition; we just stop spinning).
      if (Date.now() - startedAt > maxPollMs) {
        setStale(true);
        return;
      }
      try {
        const res = await fetch(`/api/audits/${jobId}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const payload: unknown = await res.json().catch(() => null);
        const ok =
          typeof payload === "object" &&
          payload !== null &&
          "success" in payload &&
          (payload as { success?: unknown }).success === true;
        if (!res.ok || !ok) {
          throw new Error(
            typeof payload === "object" &&
              payload !== null &&
              "error" in payload &&
              typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : `HTTP ${res.status}`,
          );
        }
        const next = (payload as unknown as { audit: AuditSummary }).audit;
        if (cancelled) return;
        setAudit(next);
        setPollError(null);
        consecutiveErrors = 0;
        if (next.status === "queued" || next.status === "running") {
          timer = setTimeout(poll, pollMs);
        }
      } catch (err) {
        if (cancelled) return;
        consecutiveErrors++;
        setPollError(
          err instanceof Error ? err.message : "Failed to reach the audit API.",
        );
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          // Stop the loop; the user can retry from the error state.
          return;
        }
        timer = setTimeout(poll, pollMs * 2);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, pollMs, maxPollMs]);

  // Auto-start a queued audit. Retries a few times if the POST fails
  // transiently so a queued audit is not stranded by a single network blip.
  React.useEffect(() => {
    if (!jobId || !autoStart || !audit || audit.status !== "queued") return;
    if (startRequestedRef.current && startAttemptsRef.current >= START_MAX_ATTEMPTS) {
      return;
    }

    let cancelled = false;
    const attempt = async (attemptNum: number) => {
      if (cancelled) return;
      startAttemptsRef.current = attemptNum;
      try {
        const res = await fetch(`/api/audits/${jobId}/run`, { method: "POST" });
        const payload: unknown = await res.json().catch(() => null);
        if (res.ok && typeof payload === "object" && payload !== null && "audit" in payload) {
          const started = (payload as { audit: Partial<AuditSummary> }).audit;
          startRequestedRef.current = true;
          // Optimistically reflect the running state; polling confirms.
          setAudit((prev) =>
            prev
              ? {
                  ...prev,
                  status: (started.status as AuditSummary["status"]) ?? "running",
                }
              : prev,
          );
          return;
        }
      } catch {
        // transient — fall through to retry
      }
      // Retry until the cap; polling continues independently.
      if (attemptNum < START_MAX_ATTEMPTS && !cancelled) {
        setTimeout(() => void attempt(attemptNum + 1), START_RETRY_DELAY_MS);
      }
    };

    if (!startRequestedRef.current) void attempt(1);
    return () => {
      cancelled = true;
    };
  }, [jobId, autoStart, audit]);

  const status: AuditJobStatus = notFound
    ? "error"
    : stale
      ? "stale"
      : audit
        ? audit.status
        : "loading";

  return {
    status,
    progress: audit?.progress ?? 0,
    audit,
    pollError,
    notFound,
    stale,
  };
}
