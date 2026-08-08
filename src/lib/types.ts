export type AuditStatus = "completed" | "running" | "failed" | "queued";

export type RuleSeverity = "critical" | "high" | "medium" | "low" | "info";

export type Audit = {
  id: string;
  strategyName: string;
  fileName: string;
  language: "python" | "pine";
  status: AuditStatus;
  score: number | null;
  rulesChecked: number;
  violations: number;
  createdAt: string;
  durationSec: number | null;
};

export type RuleViolation = {
  id: string;
  code: string;
  title: string;
  severity: RuleSeverity;
  description: string;
  recommendation: string;
  line: number;
};

export type AuditReport = {
  id: string;
  auditId: string;
  strategyName: string;
  fileName: string;
  score: number;
  status: AuditStatus;
  createdAt: string;
  durationSec: number;
  rulesChecked: number;
  violations: RuleViolation[];
  metrics: {
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    winRate: number;
  };
};

export type DocSection = {
  id: string;
  title: string;
  slug: string;
  description: string;
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};
