import type {
  AuditAnalysisDepth,
  AuditFramework,
  AuditInputType,
  AuditRuleCategory,
  AuditStatus,
  Database,
} from "@/types/database";

export type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

/* AuditDraft-compatible payload accepted by POST /api/audits (camelCase,
 * matching src/lib/audit-draft.ts). */
export type CreateAuditInput = {
  strategyName: string;
  inputType: AuditInputType;
  fileName: string | null;
  framework: AuditFramework;
  analysisDepth: AuditAnalysisDepth;
  ruleCategories: AuditRuleCategory[];
  code: string;
};

export type { AuditStatus };
