/* Audit repository: the persistence seam between the engine and Supabase.
 *
 * runAudit() depends only on this interface, so unit tests use an in-memory
 * implementation and a future background worker can swap the Supabase one
 * without touching the engine. */

import type { Database, Json } from "@/types/database";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";

type Tables = Database["public"]["Tables"];

/* Any Supabase client bound to the Database types (session or admin). */
type AnyDbClient =
  | ReturnType<typeof createAdminClient>
  | Awaited<ReturnType<typeof createSessionClient>>;

export type AuditRow = Tables["audits"]["Row"];
export type ViolationInsert = Tables["audit_violations"]["Insert"];
export type MetricInsert = Tables["audit_metrics"]["Insert"];
export type RecommendationInsert = Tables["audit_recommendations"]["Insert"];
export type TimelineInsert = Tables["audit_timeline"]["Insert"];

export type AuditResults = {
  violations: Tables["audit_violations"]["Row"][];
  metrics: Tables["audit_metrics"]["Row"][];
  recommendations: Tables["audit_recommendations"]["Row"][];
  timeline: Tables["audit_timeline"]["Row"][];
};

export interface AuditRepository {
  getAudit(id: string): Promise<AuditRow | null>;
  /* Atomic queued→running claim; returns null when another runner claimed it. */
  claimAudit(id: string): Promise<AuditRow | null>;
  updateAudit(
    id: string,
    patch: { status?: AuditRow["status"]; progress?: number; code?: string },
  ): Promise<AuditRow | null>;
  getResults(auditId: string): Promise<AuditResults>;
  insertViolations(rows: ViolationInsert[]): Promise<void>;
  insertMetrics(rows: MetricInsert[]): Promise<void>;
  insertRecommendations(rows: RecommendationInsert[]): Promise<void>;
  insertTimeline(rows: TimelineInsert[]): Promise<void>;
  /* Phase 8: atomic result persistence — all children + status update in
   * one Postgres transaction (commit_audit_results RPC). */
  commitResults(args: {
    auditId: string;
    status: AuditRow["status"];
    progress: number;
    violations: ViolationInsert[];
    metrics: MetricInsert[];
    recommendations: RecommendationInsert[];
    timeline: TimelineInsert[];
  }): Promise<void>;
  /* Phase 8: atomically mark stale running audits as failed with a timeline
   * entry. Returns the recovered audit IDs (for logging only). */
  recoverStale(staleAfterMinutes?: number): Promise<string[]>;
  /* Phase 8: atomically delete children + reset to queued for retry.
   * Returns false if the audit is not in 'failed' state. */
  resetForRetry(auditId: string): Promise<boolean>;
}

/* Build a repository over an injected client.
 *
 * Default: the service-role admin client (used by the internal audit
 * executor after the calling route has verified ownership). User-facing
 * read paths pass the request-scoped session client so RLS enforces
 * ownership at the database layer.
 *
 * An explicit {supabaseUrl, serviceRoleKey} config is accepted so the Deno
 * Edge Function worker can build its own admin client without relying on
 * Node's process.env. */
export function createSupabaseAuditRepository(
  client?: AnyDbClient | { supabaseUrl?: string; serviceRoleKey?: string },
): AuditRepository {
  if (client && !isExplicitConfig(client)) {
    return buildRepository(client);
  }
  const cfg = client as { supabaseUrl?: string; serviceRoleKey?: string } | undefined;
  if (!isAdminClientConfigured(cfg)) {
    // Fail fast with a clear message rather than issuing RLS-denied queries.
    const notConfigured = {
      getAudit: async (): Promise<AuditRow | null> => null,
      claimAudit: async (): Promise<AuditRow | null> => {
        throw new Error(
          "Audit persistence is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured (RLS default-deny blocks the publishable key).",
        );
      },
      updateAudit: async (): Promise<AuditRow | null> => null,
      getResults: async (): Promise<AuditResults> => ({
        violations: [],
        metrics: [],
        recommendations: [],
        timeline: [],
      }),
      insertViolations: async () => undefined,
      insertMetrics: async () => undefined,
      insertRecommendations: async () => undefined,
      insertTimeline: async () => undefined,
      commitResults: async () => {
        throw new Error(
          "Audit persistence is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured.",
        );
      },
      recoverStale: async () => [],
      resetForRetry: async () => false,
    };
    return notConfigured;
  }

  return buildRepository(createAdminClient(cfg) as AnyDbClient);
}

/* Discriminate a real DB client from an explicit-config object.
 *
 * A real Supabase client (session OR admin) exposes query builder methods
 * `from`, `auth`, and `rpc` — an explicit {supabaseUrl, serviceRoleKey} config
 * does NOT. (The previous check used `"supabaseUrl" in o`, which was wrong: the
 * @supabase/ssr server client carries a top-level `supabaseUrl` property, so the
 * results route's session client was misclassified as an explicit config and
 * silently rebuilt as a service-role admin client — bypassing RLS and leaking
 * other users' results. Detect configs by the ABSENCE of client methods, not
 * the presence of url/key fields.) */
function isExplicitConfig(
  v: unknown,
): v is { supabaseUrl?: string; serviceRoleKey?: string } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  // A real client has query-builder methods; a plain config object does not.
  const hasClientMethods =
    typeof o.from === "function" &&
    typeof o.auth === "object" &&
    typeof o.rpc === "function";
  if (hasClientMethods) return false;
  // Plain config: only accept it if it actually carries url/key fields.
  return "supabaseUrl" in o || "serviceRoleKey" in o;
}

function buildRepository(db: AnyDbClient): AuditRepository {
  return {
    async getAudit(id) {
      const { data, error } = await db.from("audits").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`[audits] fetch failed: ${error.message}`);
      return data;
    },

    async claimAudit(id) {
      const { data, error } = await db
        .from("audits")
        .update({ status: "running", progress: 0 })
        .eq("id", id)
        .eq("status", "queued")
        .select()
        .maybeSingle();
      if (error) throw new Error(`[audits] claim failed: ${error.message}`);
      return data;
    },

    async updateAudit(id, patch) {
      let query = db.from("audits").update(patch).eq("id", id);
      // Monotonic progress guard: only advance, never regress (Phase 8 #5).
      // Status-only updates (no progress in the patch) bypass the guard.
      if (patch.progress !== undefined) {
        query = query.lte("progress", patch.progress);
      }
      const { data, error } = await query.select().maybeSingle();
      if (error) throw new Error(`[audits] update failed: ${error.message}`);
      return data;
    },

    async getResults(auditId) {
      const [violations, metrics, recommendations, timeline] = await Promise.all([
        db.from("audit_violations").select().eq("audit_id", auditId).order("sort_order"),
        db.from("audit_metrics").select().eq("audit_id", auditId).order("sort_order"),
        db.from("audit_recommendations").select().eq("audit_id", auditId).order("priority"),
        db.from("audit_timeline").select().eq("audit_id", auditId).order("sort_order"),
      ]);
      const firstError =
        violations.error ?? metrics.error ?? recommendations.error ?? timeline.error;
      if (firstError) throw new Error(`[audits] results fetch failed: ${firstError.message}`);
      return {
        violations: violations.data ?? [],
        metrics: metrics.data ?? [],
        recommendations: recommendations.data ?? [],
        timeline: timeline.data ?? [],
      };
    },

    async insertViolations(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("audit_violations").insert(rows);
      if (error) throw new Error(`[audits] violations insert failed: ${error.message}`);
    },

    async insertMetrics(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("audit_metrics").insert(rows);
      if (error) throw new Error(`[audits] metrics insert failed: ${error.message}`);
    },

    async insertRecommendations(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("audit_recommendations").insert(rows);
      if (error) throw new Error(`[audits] recommendations insert failed: ${error.message}`);
    },

    async insertTimeline(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("audit_timeline").insert(rows);
      if (error) throw new Error(`[audits] timeline insert failed: ${error.message}`);
    },

    async commitResults(args) {
      // Postgres jsonb_array_elements needs actual jsonb values, not text.
      // supabase-js serializes objects to JSON in the RPC body, so passing
      // the arrays directly (as plain JS arrays) makes Postgres receive them
      // as jsonb — stringify would produce a text scalar that
      // jsonb_array_elements cannot iterate.
      const { error } = await db.rpc("commit_audit_results", {
        p_audit_id: args.auditId,
        p_status: args.status,
        p_progress: args.progress,
        p_violations: args.violations as unknown as Json,
        p_metrics: args.metrics as unknown as Json,
        p_recommendations: args.recommendations as unknown as Json,
        p_timeline: args.timeline as unknown as Json,
      });
      if (error) {
        throw new Error(`[audits] commit_results failed: ${error.message}`);
      }
    },

    async recoverStale(staleAfterMinutes = 10) {
      const { data, error } = await db.rpc("recover_stale_audits", {
        p_stale_after_minutes: staleAfterMinutes,
      });
      if (error) {
        throw new Error(`[audits] recover_stale failed: ${error.message}`);
      }
      return (data ?? []) as string[];
    },

    async resetForRetry(auditId) {
      const { data, error } = await db.rpc("reset_audit_for_retry", {
        p_audit_id: auditId,
      });
      if (error) {
        throw new Error(`[audits] reset_for_retry failed: ${error.message}`);
      }
      return (data as boolean) ?? false;
    },
  };
}
