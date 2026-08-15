/* Rule registry: assembles all rule modules and applies category selection.
 *
 * Selection contract: only rules whose userCategory is in the user's selected
 * categories execute. Structure rules are ordinary category-gated rules
 * (tagged "Execution Logic"); an empty selection therefore runs no rules,
 * matching the frontend contract where 0 of 9 categories is submittable.
 * Syntax validation itself is not a rule — it is a fatal intake check. */

import type { AuditRuleCategory } from "@/types/database";
import type { AuditStage } from "../types";
import type { AuditRule } from "./types";
import { biasRules } from "./bias";
import { dataRules } from "./data";
import { executionRules } from "./execution";
import { costRules } from "./costs";
import { riskRules } from "./risk";
import { performanceRules } from "./performance";
import { structureRules } from "./structure";

export const ALL_RULES: AuditRule[] = [
  ...biasRules,
  ...dataRules,
  ...executionRules,
  ...costRules,
  ...riskRules,
  ...performanceRules,
  ...structureRules,
];

export function rulesForStage(
  stage: AuditStage,
  selectedCategories: readonly AuditRuleCategory[],
): AuditRule[] {
  return ALL_RULES.filter(
    (rule) =>
      rule.stage === stage && selectedCategories.includes(rule.userCategory),
  );
}

export function ruleById(ruleId: string): AuditRule | undefined {
  return ALL_RULES.find((r) => r.ruleId === ruleId);
}

export const RULE_COUNT = ALL_RULES.length;
