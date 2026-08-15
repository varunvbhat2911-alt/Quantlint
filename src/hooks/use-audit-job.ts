"use client";

/* useAuditJob — real audit job tracking.
 *
 * Polls GET /api/audits/[id] while the audit is queued/running and stops on
 * a terminal state (completed/failed). No timers simulate progress: every
 * value shown comes from the backend. Optionally auto-starts a queued audit
 * via POST /api/audits/[id]/run (once). */

import * as React from "react";
import type { AuditSummary } from "@/lib/audits";

export type AuditJobStatus =
  | "loading"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "error";

export type AuditJobState = {
  status: AuditJobStatus;
  progress: number;
  audit: AuditSummary | null;
  pollError: string | null;
  notFound: boolean;
};

const DEFAULT_POLL_MS = 1500;

export function useAuditJob(
  jobId: string | null,
  options?: { autoStart?: boolean; pollMs?: number },
): AuditJobState {
  const autoStart = options?.autoStart ?? true;
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;

  const [audit, setAudit] = React.useState<AuditSummary | null>(null);
  const [pollError, setPollError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const startRequestedRef = React.useRef(false);

  // Polling loop (re-armed only while queued/running or after transient errors)
  React.useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
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
        if (next.status === "queued" || next.status === "running") {
          timer = setTimeout(poll, pollMs);
        }
      } catch (err) {
        if (cancelled) return;
        setPollError(
          err instanceof Error ? err.message : "Failed to reach the audit API.",
        );
        timer = setTimeout(poll, pollMs * 2);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, pollMs]);

  // Auto-start a queued audit exactly once
  React.useEffect(() => {
    if (!jobId || !autoStart || startRequestedRef.current) return;
    if (!audit || audit.status !== "queued") return;
    startRequestedRef.current = true;

    void fetch(`/api/audits/${jobId}/run`, { method: "POST" })
      .then(async (res) => {
        const payload: unknown = await res.json().catch(() => null);
        if (res.ok && typeof payload === "object" && payload !== null && "audit" in payload) {
          const started = (payload as { audit: Partial<AuditSummary> }).audit;
          // Optimistically reflect the running state; polling confirms.
          setAudit((prev) =>
            prev
              ? {
                  ...prev,
                  status: (started.status as AuditSummary["status"]) ?? "running",
                }
              : prev,
          );
        }
      })
      .catch(() => {
        // Polling will retry the picture; surface nothing here.
      });
  }, [jobId, autoStart, audit]);

  const status: AuditJobStatus = notFound
    ? "error"
    : audit
      ? audit.status
      : "loading";

  return {
    status,
    progress: audit?.progress ?? 0,
    audit,
    pollError,
    notFound,
  };
}
