import { createClient } from "@/lib/supabase/server";
import type { AuditStatus } from "@/types/database";
import type { AuditRow, CreateAuditInput } from "./types";

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

export async function createAudit(
  input: CreateAuditInput,
  userId: string,
): Promise<AuditRow> {
  const supabase = await db();

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

export async function updateAuditStatus(
  id: string,
  status: AuditStatus,
): Promise<AuditRow | null> {
  const supabase = await db();

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
