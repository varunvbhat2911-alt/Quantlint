/* ── Audit Result Rendering Types ───────────────────────────

 *  Shape definitions used by the audit result page to render
 *  violations, metrics, AI explanations, recommendations, and
 *  the overall score card. These are NOT mock data — they describe
 *  the structure returned by the real results API
 *  (GET /api/audits/[id]/results).
 * ──────────────────────────────────────────────────────────── */

export type ViolationSeverity = "critical" | "warning" | "info";

export type ViolationStatus = "open" | "resolved" | "ignored";

export type FindingCategory =
  | "bias"
  | "risk"
  | "execution"
  | "data"
  | "performance"
  | "structure";

export type Violation = {
  id: string;
  ruleId: string;
  severity: ViolationSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  whyItMatters: string;
  file: string | null;
  line: number | null;
  detectedPattern: string | null;
  suggestedFix: string | null;
  codeSnippet: string | null;
  fixSnippet: string | null;
  status: ViolationStatus;
};

export type MetricGroup = {
  label: string;
  metrics: {
    key: string;
    label: string;
    value: string;
    tooltip: string;
  }[];
};

export type AIExplanation = {
  id: string;
  ruleId: string;
  finding: string;
  explanation: string;
  whyItMatters: string;
  suggestedFix: string;
  confidence: number;
  relatedViolationId: string;
};

export type Recommendation = {
  id: string;
  priority: number;
  title: string;
  severity: ViolationSeverity;
  why: string;
  suggestedAction: string;
  relatedRuleId: string;
  status: "open" | "resolved" | "ignored";
};

export type TimelineEntry = {
  label: string;
  timestamp: string;
};

export type RuleCoverageCategory = {
  label: string;
  checked: number;
  passed: number;
};

export type AuditResultData = {
  auditId: string;
  strategyName: string;
  fileName: string;
  framework: string;
  frameworkLabel: string;
  analysisDepth: string;
  rulesVersion: string;
  createdAt: string;
  completedAt: string;
  inputType: string;
  score: number;
  grade: string;
  gradeStatus: string;
  summary: string;
  executiveSummary: string;
  rulesChecked: number;
  rulesPassed: number;
  warnings: number;
  critical: number;
  violations: Violation[];
  metricGroups: MetricGroup[];
  aiExplanations: AIExplanation[];
  recommendations: Recommendation[];
  timeline: TimelineEntry[];
  ruleCoverage: RuleCoverageCategory[];
};
