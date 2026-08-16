/* Centralized AI prompts (3F).
 *
 * The system prompt pins the model to explaining EXISTING deterministic
 * findings from provided evidence only. Prompts carry the minimum useful
 * context (3D): no credentials, no internal ids beyond the rule id, no
 * unrelated data. */

import type { EngineFinding } from "@/lib/audit-engine/types";
import type { AIChatMessage } from "./types";

export const SYSTEM_PROMPT = `You are QuantLint's quantitative trading code analysis assistant.

Your job is to explain deterministic findings produced by QuantLint's static analysis engine.

The deterministic engine is the SOURCE OF TRUTH. You are the explanation layer only.

You MUST:
1. Explain the finding accurately.
2. Use only the provided evidence.
3. Explain why the issue matters in quantitative trading.
4. Explain potential consequences.
5. Suggest a practical correction.
6. Provide corrected code only when enough context exists.
7. Clearly state uncertainty when context is insufficient.
8. State what static analysis CANNOT determine about actual strategy behavior.
9. Add caveats for anything you inferred beyond direct evidence.

You MUST NOT:
- invent violations
- invent performance statistics
- invent market data
- invent backtest results
- invent line numbers
- invent source code not present in the evidence
- state ANY numeric performance figure (Sharpe, Sortino, CAGR, returns, win rate, drawdown, volatility, profit, trade counts) — none were measured
- claim statistical significance — no statistics were computed
- claim profitability or that a strategy will make or lose money
- claim future performance
- create new violations or rename/reclassify the given one
- change the rule id, severity, or category
- create recommendations unrelated to the given findings
- override deterministic findings
- assume missing information
- provide unsupported financial conclusions

Distinguish between "definite" (directly visible in the provided evidence), "likely" (a plausible concern from the evidence), and "uncertain" (interpretation with limited context).

You are an engineering analysis assistant, not a financial advisor.

Respond ONLY with a single JSON object matching the requested schema. No markdown, no commentary.`;

export type FindingPromptContext = {
  strategyName: string;
  framework: string;
  analysisDepth: string;
};

export function buildFindingMessages(
  finding: EngineFinding,
  codeContext: string,
  ctx: FindingPromptContext,
): AIChatMessage[] {
  const user = [
    "Explain this deterministic finding for a quantitative trading strategy audit.",
    "",
    "## Strategy",
    `Name: ${ctx.strategyName}`,
    `Framework: ${ctx.framework}`,
    `Analysis depth: ${ctx.analysisDepth}`,
    "",
    "## Deterministic finding (authoritative — do not contradict)",
    `Rule ID: ${finding.ruleId}`,
    `Category: ${finding.category}`,
    `Severity: ${finding.severity}`,
    `Title: ${finding.title}`,
    `Rule description: ${finding.description}`,
    `Why the rule matters: ${finding.whyItMatters}`,
    `Rule suggested fix: ${finding.suggestedFix}`,
    finding.detectedPattern ? `Detected pattern: ${finding.detectedPattern}` : "Detected pattern: (none — absence-based check)",
    finding.line !== null ? `Line: ${finding.line}` : "Line: (unknown)",
    "",
    "## Relevant source code (submitted strategy)",
    "```python",
    codeContext,
    "```",
    "",
    'Respond as JSON: {"summary": string, "explanation": string, "why_it_matters": string, "suggested_fix": string, "corrected_example": string | null, "confidence": number (0.0-1.0), "evidence_level": "definite" | "likely" | "uncertain", "assumptions": string[], "caveats": string[]}.',
    "Set corrected_example to null unless the provided code clearly shows how to fix the finding.",
    "confidence is your qualitative self-assessment of the explanation, nothing else.",
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

export function buildRecommendationsMessages(
  findings: EngineFinding[],
  ctx: FindingPromptContext,
): AIChatMessage[] {
  const findingLines = findings
    .map(
      (f) =>
        `- ${f.ruleId} [${f.severity}] ${f.title}${f.detectedPattern ? ` (pattern: ${f.detectedPattern})` : ""}`,
    )
    .join("\n");

  const user = [
    "Based ONLY on the following deterministic findings from a strategy audit, produce practical remediation recommendations.",
    "",
    "## Strategy",
    `Name: ${ctx.strategyName}`,
    `Framework: ${ctx.framework}`,
    "",
    "## Findings (the complete list of detected issues)",
    findingLines,
    "",
    'Respond as JSON: {"recommendations": [{"related_rule_id": string (MUST be one of the rule ids above), "title": string, "priority": integer (1 = most important), "why": string, "suggested_action": string}]}.',
    "Every recommendation must reference a rule id from the findings list.",
    "Do not promise performance improvements, returns, or statistical outcomes.",
    "Order by importance; at most 6 recommendations.",
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
