/* Audit rule contract. Every rule is a small, independently testable unit
 * with stable metadata; only deterministic pattern detection belongs here. */

import type {
  AuditRuleCategory,
  FindingCategory,
  ViolationSeverity,
} from "@/types/database";
import type { AuditStage, FrameworkId } from "../types";
import type { PythonStructure } from "../parsers/python";
import type { SourceSegment } from "@/lib/audit-ingestion/types";

export type RuleContext = {
  code: string;
  source: PythonStructure;
  fileName: string | null;
  /* Multi-file assembly layout (empty for single-source inputs); used to
   * report true original file/line positions on findings. */
  segments: readonly SourceSegment[];
  framework: { declared: string; detected: FrameworkId; resolved: FrameworkId };
};

export type RuleFinding = {
  ruleId: string;
  line: number | null;
  detectedPattern: string | null;
  codeSnippet?: string | null;
  fixSnippet?: string | null;
};

export type AuditRule = {
  ruleId: string;
  title: string;
  /* UI-facing category (audit_violations.category). */
  category: FindingCategory;
  /* User-selectable category driving rule selection (RULE_CATEGORIES). */
  userCategory: AuditRuleCategory;
  severity: ViolationSeverity;
  description: string;
  whyItMatters: string;
  suggestedFix: string;
  fixSnippet: string | null;
  /* Pipeline stage that executes this rule. */
  stage: AuditStage;
  run: (ctx: RuleContext) => RuleFinding[];
};
