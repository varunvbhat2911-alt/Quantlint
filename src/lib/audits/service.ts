import { createClient } from "@/lib/supabase/server";
import type { AuditStatus } from "@/types/database";
import { computeScore } from "@/lib/audit-engine/types";
import { maxAuditsPerUser } from "@/lib/server/rate-limit";
import type { AuditRow, CreateAuditInput } from "./types";
import {
  dateCutoff,
  frameworkConstraint,
  sortOrder,
  statusConstraint,
  type ListQueryParams,
} from "./list-query";

/* Server-side data access for public.audits.
 *
 * User-facing operations (Phase 4) run through the request-scoped session
 * client so RLS enforces ownership as defense in depth: inserts carry the
 * server-verified user id, and reads/selects only ever see rows the
 * authenticated user owns. The service-role admin client is reserved for the
 * internal audit executor (see src/lib/audit-engine/repository.ts). */

async function db() {
  return createClient();
}

function dbError(context: string, message: string): Error {
  return new Error(`[audits] ${context}: ${message}`);
}

/* Raised when a user has reached their audit quota. Routes map this to a
 * 409 Conflict so it is distinguishable from rate-limit 429s. */
export class AuditQuotaExceededError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(`Audit quota reached (${limit}). Delete an audit before creating another.`);
    this.name = "AuditQuotaExceededError";
    this.limit = limit;
  }
}

export async function createAudit(
  input: CreateAuditInput,
  userId: string,
): Promise<AuditRow> {
  const supabase = await db();

  /* Per-user audit quota — server-side, RLS-scoped count (no client input
   * trusted). RLS scopes the select to the caller's own rows. We fetch up to
   * `limit` ids (bounded — at most 100 rows) and reject when that many already
   * exist, rather than relying on the content-range count header, which some
   * supabase-js/PostgREST configurations return as null (silently disabling
   * the quota). range(0, limit-1) means we materialize at most `limit` rows. */
  const limit = maxAuditsPerUser();
  const { data: ownedIds, error: countError } = await supabase
    .from("audits")
    .select("id")
    .range(0, Math.max(0, limit - 1));
  if (countError) throw dbError("quota check failed", countError.message);
  if ((ownedIds?.length ?? 0) >= limit) throw new AuditQuotaExceededError(limit);

  const { data, error } = await supabase
    .from("audits")
    .insert({
      // Owner comes exclusively from the server-verified session.
      user_id: userId,
      strategy_name: input.strategyName,
      input_type: input.inputType,
      file_name: input.fileName,
      framework: input.framework,
      analysis_depth: input.analysisDepth,
      rule_categories: input.ruleCategories,
      code: input.code,
    })
    .select()
    .single();

  if (error) throw dbError("create failed", error.message);
  return data as AuditRow;
}

export async function getAuditById(id: string): Promise<AuditRow | null> {
  const supabase = await db();

  const { data, error } = await supabase
    .from("audits")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw dbError("fetch failed", error.message);
  return (data as AuditRow | null) ?? null;
}

/* Legal audit status transitions, mirroring the DB trigger
 * guard_audit_status_transition() in
 * supabase/migrations/20260817133000_phase9_state_machine_and_indexes.sql.
 * The DB trigger is authoritative; this map is defense-in-depth so an illegal
 * transition is rejected in TS before reaching Postgres. */
const LEGAL_TRANSITIONS: Record<AuditStatus, readonly AuditStatus[]> = {
  queued: ["running", "failed"],
  running: ["completed", "failed"],
  failed: ["queued"],
  completed: [], // terminal
};

export class IllegalStatusTransitionError extends Error {
  readonly from: AuditStatus;
  readonly to: AuditStatus;
  constructor(from: AuditStatus, to: AuditStatus) {
    super(`Illegal audit status transition: ${from} -> ${to}.`);
    this.name = "IllegalStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

/* Transition an audit's status with a legal-transition guard. Fetches the
 * current row (RLS-scoped) so the guard can check OLD.status; rejects illegal
 * transitions before issuing the update. Returns the updated row or null when
 * the audit is foreign/missing (uniform 404 upstream). */
export async function updateAuditStatus(
  id: string,
  status: AuditStatus,
): Promise<AuditRow | null> {
  const supabase = await db();

  const { data: current, error: fetchErr } = await supabase
    .from("audits")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw dbError("status update fetch failed", fetchErr.message);
  if (!current) return null; // foreign/missing → upstream 404

  const from = (current as { status: AuditStatus }).status;
  if (from !== status && !LEGAL_TRANSITIONS[from].includes(status)) {
    throw new IllegalStatusTransitionError(from, status);
  }

  const { data, error } = await supabase
    .from("audits")
    .update({ status })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw dbError("status update failed", error.message);
  return (data as AuditRow | null) ?? null;
}

export async function updateAuditProgress(
  id: string,
  progress: number,
): Promise<AuditRow | null> {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const supabase = await db();

  const { data, error } = await supabase
    .from("audits")
    .update({ progress: clamped })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw dbError("progress update failed", error.message);
  return (data as AuditRow | null) ?? null;
}

/* CamelCase DTO for API consumers; excludes `code` (not needed for polling). */
export type AuditSummary = {
  id: string;
  status: AuditRow["status"];
  progress: number;
  strategyName: string;
  inputType: AuditRow["input_type"];
  fileName: string | null;
  framework: AuditRow["framework"];
  analysisDepth: AuditRow["analysis_depth"];
  ruleCategories: AuditRow["rule_categories"];
  createdAt: string;
  updatedAt: string;
};

export function toAuditSummary(row: AuditRow): AuditSummary {
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    strategyName: row.strategy_name,
    inputType: row.input_type,
    fileName: row.file_name,
    framework: row.framework,
    analysisDepth: row.analysis_depth,
    ruleCategories: row.rule_categories,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ── Phase 5: user-scoped listing, stats, and delete ───────── */

export type AuditListItem = AuditSummary & {
  /* Derived from real persisted violations (null before completion). */
  score: number | null;
  violations: { critical: number; warning: number; info: number; total: number };
};

export type AuditListResult = {
  audits: AuditListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: {
    totalAudits: number;
    totalIssues: number;
    criticalFindings: number;
    averageScore: number | null;
  };
};

const LIST_COLUMNS =
  "id, strategy_name, input_type, file_name, framework, analysis_depth, status, progress, created_at, updated_at";

export async function listAudits(
  params: ListQueryParams,
): Promise<AuditListResult> {
  const supabase = await db();

  let base = supabase.from("audits").select(LIST_COLUMNS, { count: "exact" });
  const status = statusConstraint(params.status);
  if (status) base = base.eq("status", status);
  const framework = frameworkConstraint(params.framework);
  if (framework) base = base.eq("framework", framework);
  if (params.search) base = base.ilike("strategy_name", `%${params.search}%`);
  const cutoff = dateCutoff(params.date);
  if (cutoff) base = base.gte("created_at", cutoff);

  const order = sortOrder(params.sort);
  const from = (params.page - 1) * params.pageSize;
  const { data, count, error } = await base
    .order(order.column, { ascending: order.ascending })
    .range(from, from + params.pageSize - 1);

  if (error) throw dbError("list failed", error.message);

  const rows = (data ?? []) as unknown as AuditRow[];
  const total = count ?? 0;

  /* Violation counts for just this page's audits (RLS-scoped). */
  const ids = rows.map((r) => r.id);
  const counts = new Map<string, { critical: number; warning: number; info: number; total: number }>();
  if (ids.length > 0) {
    const { data: violationRows, error: vError } = await supabase
      .from("audit_violations")
      .select("audit_id, severity")
      .in("audit_id", ids);
    if (vError) throw dbError("violation counts failed", vError.message);
    for (const v of (violationRows ?? []) as { audit_id: string; severity: string }[]) {
      const entry = counts.get(v.audit_id) ?? { critical: 0, warning: 0, info: 0, total: 0 };
      if (v.severity === "critical") entry.critical++;
      else if (v.severity === "warning") entry.warning++;
      else entry.info++;
      entry.total++;
      counts.set(v.audit_id, entry);
    }
  }

  const audits: AuditListItem[] = rows.map((row) => {
    const c = counts.get(row.id) ?? { critical: 0, warning: 0, info: 0, total: 0 };
    const completed = row.status === "completed";
    return {
      ...toAuditSummary(row),
      score: completed
        ? computeScore({
            rulesExecuted: 0,
            rulesPassed: 0,
            rulesFailed: 0,
            criticalCount: c.critical,
            warningCount: c.warning,
            infoCount: c.info,
          })
        : null,
      violations: c,
    };
  });

  /* Page-independent summary across the user's audits (RLS-scoped). */
  const summary = await computeListSummary();

  return {
    audits,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    },
    summary,
  };
}

async function computeListSummary(): Promise<AuditListResult["summary"]> {
  const supabase = await db();
  // DB-side aggregate (audit_list_summary) — returns one row. RLS scopes both
  // audits and audit_violations to auth.uid() before the function sees them,
  // so no user_id is passed from the browser. Replaces the Phase 8 pattern of
  // materializing all audits + all violations into Node.
  const { data, error } = await supabase.rpc("audit_list_summary");
  if (error) throw dbError("summary failed", error.message);
  const row = (data ?? []) as unknown as {
    total_audits: number | string;
    total_issues: number | string;
    critical_findings: number | string;
    scored_count: number | string;
    score_sum: number | string;
  }[];
  const r = row[0] ?? {
    total_audits: 0,
    total_issues: 0,
    critical_findings: 0,
    scored_count: 0,
    score_sum: 0,
  };
  const scoredCount = Number(r.scored_count) || 0;
  const scoreSum = Number(r.score_sum) || 0;
  return {
    totalAudits: Number(r.total_audits) || 0,
    totalIssues: Number(r.total_issues) || 0,
    criticalFindings: Number(r.critical_findings) || 0,
    averageScore: scoredCount > 0 ? Math.round((scoreSum / scoredCount) * 10) / 10 : null,
  };
}

export type AuditStats = {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
};

export async function getAuditStats(): Promise<AuditStats> {
  const supabase = await db();
  // DB-side GROUP BY (audit_status_counts) — RLS-scoped to the caller.
  const { data, error } = await supabase.rpc("audit_status_counts");
  if (error) throw dbError("stats failed", error.message);
  const rows = (data ?? []) as unknown as { status: string; count: number | string }[];
  const stats: AuditStats = { total: 0, queued: 0, running: 0, completed: 0, failed: 0 };
  for (const row of rows) {
    const c = Number(row.count) || 0;
    stats.total += c;
    if (row.status === "queued") stats.queued += c;
    else if (row.status === "running") stats.running += c;
    else if (row.status === "completed") stats.completed += c;
    else if (row.status === "failed") stats.failed += c;
  }
  return stats;
}

/* Delete via the session client: RLS limits deletion to the caller's own
 * audits; children cascade via FK. Returns false for unknown/foreign audits. */
export async function deleteAudit(id: string): Promise<boolean> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("audits")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw dbError("delete failed", error.message);
  return data !== null;
}
