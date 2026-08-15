import type {
  AuditAnalysisDepth,
  AuditFramework,
  AuditInputType,
  AuditRuleCategory,
} from "@/types/database";
import type { CreateAuditInput } from "./types";

/* Runtime mirrors of the CHECK constraints in
 * supabase/migrations/20260816001522_create_audits_table.sql */
const INPUT_TYPES = ["upload", "paste"] as const satisfies readonly AuditInputType[];
const FRAMEWORKS = [
  "auto",
  "vectorbt",
  "backtrader",
  "zipline",
  "pandas",
] as const satisfies readonly AuditFramework[];
const ANALYSIS_DEPTHS = [
  "standard",
  "deep",
  "fast",
] as const satisfies readonly AuditAnalysisDepth[];
const RULE_CATEGORIES = [
  "Look-ahead Bias",
  "Data Leakage",
  "Survivorship Bias",
  "Risk Management",
  "Position Sizing",
  "Performance Metrics",
  "Execution Logic",
  "Transaction Costs",
  "Portfolio Logic",
] as const satisfies readonly AuditRuleCategory[];

/* Mirrors the frontend upload limit (10 MB files) for pasted code. */
const MAX_CODE_LENGTH = 10 * 1024 * 1024;
const MAX_STRATEGY_NAME_LENGTH = 200;
const MAX_FILE_NAME_LENGTH = 260;

export type ParseResult =
  | { ok: true; data: CreateAuditInput }
  | { ok: false; error: string; details: Record<string, string> };

export function parseCreateAuditRequest(body: unknown): ParseResult {
  const details: Record<string, string> = {};

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      details: {},
    };
  }
  const raw = body as Record<string, unknown>;

  // strategyName — optional, blank falls back like the frontend does
  let strategyName = "Untitled Strategy";
  if (raw.strategyName !== undefined && raw.strategyName !== null) {
    if (typeof raw.strategyName !== "string") {
      details.strategyName = "Must be a string.";
    } else if (raw.strategyName.trim().length > MAX_STRATEGY_NAME_LENGTH) {
      details.strategyName = `Must be at most ${MAX_STRATEGY_NAME_LENGTH} characters.`;
    } else if (raw.strategyName.trim().length > 0) {
      strategyName = raw.strategyName.trim();
    }
  }

  // inputType — required
  const inputTypeRaw = raw.inputType;
  if (
    typeof inputTypeRaw !== "string" ||
    !INPUT_TYPES.includes(inputTypeRaw as AuditInputType)
  ) {
    details.inputType = `Must be one of: ${INPUT_TYPES.join(", ")}.`;
  }
  const inputType = inputTypeRaw as AuditInputType;

  // fileName — required for uploads, null for pasted code
  let fileName: string | null = null;
  if (inputType === "upload") {
    if (typeof raw.fileName !== "string" || raw.fileName.trim().length === 0) {
      details.fileName = "Required when inputType is 'upload'.";
    } else if (raw.fileName.length > MAX_FILE_NAME_LENGTH) {
      details.fileName = `Must be at most ${MAX_FILE_NAME_LENGTH} characters.`;
    } else {
      fileName = raw.fileName;
    }
  }

  // framework — optional, defaults like the DB default
  let framework: AuditFramework = "auto";
  if (raw.framework !== undefined && raw.framework !== null) {
    if (
      typeof raw.framework !== "string" ||
      !FRAMEWORKS.includes(raw.framework as AuditFramework)
    ) {
      details.framework = `Must be one of: ${FRAMEWORKS.join(", ")}.`;
    } else {
      framework = raw.framework as AuditFramework;
    }
  }

  // analysisDepth — optional, defaults like the DB default
  let analysisDepth: AuditAnalysisDepth = "standard";
  if (raw.analysisDepth !== undefined && raw.analysisDepth !== null) {
    if (
      typeof raw.analysisDepth !== "string" ||
      !ANALYSIS_DEPTHS.includes(raw.analysisDepth as AuditAnalysisDepth)
    ) {
      details.analysisDepth = `Must be one of: ${ANALYSIS_DEPTHS.join(", ")}.`;
    } else {
      analysisDepth = raw.analysisDepth as AuditAnalysisDepth;
    }
  }

  // ruleCategories — optional, defaults to none; subset of the known set
  let ruleCategories: AuditRuleCategory[] = [];
  if (raw.ruleCategories !== undefined && raw.ruleCategories !== null) {
    if (!Array.isArray(raw.ruleCategories)) {
      details.ruleCategories = "Must be an array of category strings.";
    } else {
      const invalid = raw.ruleCategories.filter(
        (c) =>
          typeof c !== "string" ||
          !RULE_CATEGORIES.includes(c as AuditRuleCategory),
      );
      if (invalid.length > 0) {
        details.ruleCategories = `Contains unknown categories: ${invalid
          .map((c) => JSON.stringify(c))
          .join(", ")}.`;
      } else {
        ruleCategories = [
          ...new Set(raw.ruleCategories as AuditRuleCategory[]),
        ];
      }
    }
  }

  // code — required non-empty for pasted input, empty for uploads
  let code = "";
  if (inputType === "paste") {
    if (typeof raw.code !== "string" || raw.code.trim().length === 0) {
      details.code = "Required when inputType is 'paste'.";
    } else if (raw.code.length > MAX_CODE_LENGTH) {
      details.code = `Must be at most ${MAX_CODE_LENGTH} characters.`;
    } else {
      code = raw.code;
    }
  }

  if (Object.keys(details).length > 0) {
    return { ok: false, error: "Invalid audit request.", details };
  }

  return {
    ok: true,
    data: {
      strategyName,
      inputType,
      fileName,
      framework,
      analysisDepth,
      ruleCategories,
      code,
    },
  };
}
