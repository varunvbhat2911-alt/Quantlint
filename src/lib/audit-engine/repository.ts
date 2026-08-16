/* Audit repository: the persistence seam between the engine and Supabase.
 *
 * runAudit() depends only on this interface, so unit tests use an in-memory
 * implementation and a future background worker can swap the Supabase one
 * without touching the engine. */

import type { Database } from "@/types/database";
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
  updateAudit(id: string, patch: { status?: AuditRow["status"]; progress?: number }): Promise<AuditRow | null>;
  getResults(auditId: string): Promise<AuditResults>;
  insertViolations(rows: ViolationInsert[]): Promise<void>;
  insertMetrics(rows: MetricInsert[]): Promise<void>;
  insertRecommendations(rows: RecommendationInsert[]): Promise<void>;
  insertTimeline(rows: TimelineInsert[]): Promise<void>;
}

/* Build a repository over an injected client.
 *
 * Default: the service-role admin client (used by the internal audit
 * executor after the calling route has verified ownership). User-facing
 * read paths pass the request-scoped session client so RLS enforces
 * ownership at the database layer. */
export function createSupabaseAuditRepository(client?: AnyDbClient): AuditRepository {
  if (client) {
    return buildRepository(client);
  }
  if (!isAdminClientConfigured()) {
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
    };
    return notConfigured;
  }

  return buildRepository(createAdminClient());
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
      const { data, error } = await db
        .from("audits")
        .update(patch)
        .eq("id", id)
        .select()
        .maybeSingle();
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
  };
}
