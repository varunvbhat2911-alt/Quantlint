/* QuantLint deterministic audit engine — shared types.
 *
 * Pure TypeScript: no React, no browser APIs, no server-only imports, so the
 * frontend can import the stage metadata directly.
 *
 * Stage mapping (frontend mock -> real engine):
 *   intake / structure / bias / rules / risk / performance / report are real
 *   stages; the mock's "ai" stage is deferred to Phase 3 (AI integration).
 */

import type {
  AuditAnalysisDepth,
  AuditFramework,
  AuditRuleCategory,
  FindingCategory,
  ViolationSeverity,
} from "@/types/database";
import type { AIExplanationData } from "@/lib/ai/types";

export const AUDIT_STAGES = [
  "intake",
  "structure",
  "bias",
  "rules",
  "risk",
  "performance",
  "ai",
  "report",
] as const;

export type AuditStage = (typeof AUDIT_STAGES)[number];

export type StageStatus = "pending" | "running" | "completed" | "error";

/* Display metadata mirroring the mock pipeline steps (labels reused by the
 * running page so the visual design stays intact). */
export const STAGE_META: Record<
  AuditStage,
  { label: string; description: string; detail: string }
> = {
  intake: {
    label: "Strategy Intake",
    description: "Loading strategy and validating input format",
    detail:
      "Validating structure, checking the source, and preparing the strategy for analysis.",
  },
  structure: {
    label: "Code Structure Analysis",
    description: "Analyzing code structure",
    detail:
      "Inspecting imports, functions, data dependencies and execution flow.",
  },
  bias: {
    label: "Bias Detection",
    description: "Scanning for look-ahead bias and data leakage",
    detail:
      "Checking for future-data access, leakage between datasets, and survivorship assumptions.",
  },
  rules: {
    label: "Rule Analysis",
    description: "Executing QuantLint validation rules",
    detail:
      "Applying execution-logic, transaction-cost, and portfolio rule checks.",
  },
  risk: {
    label: "Risk Analysis",
    description: "Evaluating risk management and position sizing",
    detail:
      "Reviewing stop-loss handling, exposure limits, and drawdown protection.",
  },
  performance: {
    label: "Performance Validation",
    description: "Validating performance calculation assumptions",
    detail:
      "Checking metric computation, sample windows, and evaluation methodology.",
  },
  ai: {
    label: "AI Explanation",
    description: "Enriching findings with AI explanations",
    detail:
      "Interpreting deterministic findings with the AI analysis assistant.",
  },
  report: {
    label: "Report Generation",
    description: "Compiling findings into the audit report",
    detail: "Scoring findings, computing metrics, and assembling the report.",
  },
};

export type FrameworkId = "vectorbt" | "backtrader" | "zipline" | "pandas" | "unknown";

export type EngineInput = {
  code: string;
  fileName: string | null;
  /* Framework chosen on the audit form ("auto" means detect). */
  declaredFramework: AuditFramework;
  analysisDepth: AuditAnalysisDepth;
  /* Categories selected on the audit form; empty means no category rules run
   * (matching the frontend contract where an empty selection is submittable). */
  ruleCategories: AuditRuleCategory[];
};

export type EngineFinding = {
  ruleId: string;
  category: FindingCategory;
  severity: ViolationSeverity;
  title: string;
  description: string;
  whyItMatters: string;
  suggestedFix: string;
  fileName: string | null;
  /* 1-based line in the submitted source, or null when unknown. */
  line: number | null;
  detectedPattern: string | null;
  codeSnippet: string | null;
  fixSnippet: string | null;
  /* Phase 3: AI enrichment — set by the AI stage, persisted to
   * audit_violations.ai_explanation. Enrichment only; deterministic fields
   * above remain authoritative. */
  aiExplanation?: AIExplanationData | null;
};

export type EngineMetricRow = {
  groupLabel: string;
  key: string;
  label: string;
  value: string;
  tooltip: string;
};

export type EngineRecommendation = {
  priority: number;
  title: string;
  severity: ViolationSeverity;
  why: string;
  suggestedAction: string;
  relatedRuleId: string;
};

export type EngineTimelineEntry = {
  label: string;
  at: string;
  sortOrder: number;
};

export type StageResult = {
  stage: AuditStage;
  ok: boolean;
  startedAt: string;
  completedAt: string;
  error: string | null;
};

export type EngineStats = {
  rulesExecuted: number;
  rulesPassed: number;
  rulesFailed: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
};

export type EngineResult = {
  /* False only when a fatal error (e.g. invalid syntax) stopped the audit. */
  ok: boolean;
  fatalError: string | null;
  framework: { declared: AuditFramework; detected: FrameworkId; resolved: FrameworkId };
  findings: EngineFinding[];
  metrics: EngineMetricRow[];
  recommendations: EngineRecommendation[];
  timeline: EngineTimelineEntry[];
  stageResults: StageResult[];
  stats: EngineStats;
  score: number;
  grade: string;
  gradeStatus: string;
};

/* Deterministic scoring shared by the engine and any consumer that needs to
 * recompute a score from persisted findings. */
export function computeScore(stats: EngineStats): number {
  const penalty =
    stats.criticalCount * 15 + stats.warningCount * 5 + stats.infoCount * 1;
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function computeGrade(score: number): { grade: string; gradeStatus: string } {
  if (score >= 90)
    return { grade: "A", gradeStatus: "Strong — few issues detected" };
  if (score >= 80)
    return { grade: "B", gradeStatus: "Good — minor issues detected" };
  if (score >= 70)
    return { grade: "C", gradeStatus: "Fair — several issues detected" };
  if (score >= 60)
    return { grade: "D", gradeStatus: "Weak — significant issues detected" };
  return { grade: "F", gradeStatus: "Poor — critical issues detected" };
}

export const RULES_VERSION = "deterministic-v1";
