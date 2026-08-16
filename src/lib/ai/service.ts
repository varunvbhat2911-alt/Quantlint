/* AI enrichment service (3G/3H/3K/3L).
 *
 * Orchestrates finding-by-finding explanation and grounded recommendations
 * through the provider abstraction. Every model response is validated before
 * use; validation or provider failures degrade to "no AI enrichment" without
 * touching the deterministic findings. */

import type { EngineFinding } from "@/lib/audit-engine/types";
import type { ViolationSeverity } from "@/types/database";
import {
  AIProviderError,
  EVIDENCE_LEVELS,
  type AIConfig,
  type AIExplanationData,
  type AIProvider,
  type AIRecommendationData,
  type AIStageResult,
  type EvidenceLevel,
} from "./types";
import {
  buildFindingMessages,
  buildRecommendationsMessages,
  type FindingPromptContext,
} from "./prompts";

export type EnrichProgress = (fraction: number) => void;

export async function runAIStage(
  provider: AIProvider,
  config: AIConfig,
  findings: EngineFinding[],
  ctx: FindingPromptContext,
  onProgress?: EnrichProgress,
): Promise<AIStageResult> {
  const result: AIStageResult = {
    explanations: new Map(),
    recommendations: [],
    requested: 0,
    failed: 0,
    skipped: false,
    skipReason: null,
  };

  if (findings.length === 0) {
    result.skipped = true;
    result.skipReason = "no deterministic findings to explain";
    return result;
  }

  // Cost control (3K): most severe findings first, capped, info findings skipped
  const severityRank: Record<ViolationSeverity, number> = { critical: 0, warning: 1, info: 2 };
  const eligible = findings
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => f.severity !== "info")
    .sort((a, b) => severityRank[a.f.severity] - severityRank[b.f.severity])
    .slice(0, config.maxFindings);

  if (eligible.length === 0) {
    result.skipped = true;
    result.skipReason = "only informational findings — AI enrichment skipped";
    return result;
  }

  result.requested = eligible.length;
  const perFinding = 0.7 / eligible.length; // 70% of the stage on explanations

  for (let i = 0; i < eligible.length; i++) {
    const { f, index } = eligible[i];
    try {
      const completion = await provider.complete({
        messages: buildFindingMessages(f, trimContext(f.codeSnippet ?? "", config.maxContextChars), ctx),
        jsonMode: true,
      });
      const parsed = validateExplanation(extractJsonObject(completion.text), f, provider.model);
      if (parsed) {
        result.explanations.set(index, parsed);
      } else {
        result.failed++;
      }
    } catch (err) {
      // Provider/network/validation failure for one finding must not stop
      // the rest (3E/3L).
      result.failed++;
      logAIError(`enrich ${f.ruleId}`, err);
    }
    onProgress?.((i + 1) * perFinding);
  }

  // Recommendations from actual findings only (3H)
  try {
    onProgress?.(0.72);
    const completion = await provider.complete({
      messages: buildRecommendationsMessages(eligible.map((e) => e.f), ctx),
      jsonMode: true,
    });
    const validRuleIds = new Set(eligible.map((e) => e.f.ruleId));
    result.recommendations = validateRecommendations(
      extractJsonObject(completion.text),
      validRuleIds,
      findings,
    );
  } catch (err) {
    logAIError("recommendations", err);
  }

  onProgress?.(1);
  return result;
}

/* ── Response parsing & validation (3E) ────────────────────── */

/* Extract a JSON object from model text, tolerating markdown fences or
 * leading/trailing prose around a {...} block. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], trimmed];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {
      // try the outermost braces
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
          if (typeof parsed === "object" && parsed !== null) return parsed;
        } catch {
          // fall through
        }
      }
    }
  }
  return null;
}

function str(value: unknown, maxLength = 4_000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .slice(0, 6);
}

/* ── Hallucination defense (7F/7G) ───────────────────────────
 *
 * No performance statistics are ever computed by the audit, so ANY numeric
 * performance figure in model output is fabricated. Conceptual mentions
 * ("consider the Sharpe ratio") stay allowed; only co-occurrence of a
 * metric term with a measured-looking number within a short window is
 * rejected. Two number classes keep source quoting safe:
 * - RATIO metrics (Sharpe, volatility, …) are claimed as bare decimals
 *   ("a Sharpe of 1.8"), so decimals OR %/x markers are flagged.
 * - PERFORMANCE terms (returns, profit, win rate, …) are claimed with %/x
 *   markers ("15% returns", "2x profit"); a bare decimal after "return" is
 *   usually quoted source code ("return signal * 20.0") and is allowed. */
const RATIO_TERMS = [
  "sharpe",
  "sortino",
  "cagr",
  "drawdown",
  "volatility",
  "\\balpha\\b",
  "\\bbeta\\b",
  "expectancy",
];

const PERFORMANCE_TERMS = [
  "\\breturn\\b",
  "\\breturns\\b",
  "\\bprofit\\b",
  "profitability",
  "win rate",
  "win-rate",
  "winrate",
  "hit rate",
  "annualized",
  "annualised",
  "trades per",
  "trade count",
];

const RATIO_NUMBER = "(\\d+\\.\\d+|\\d+\\s*[%x×])";
const PERFORMANCE_NUMBER = "(\\d+\\s*[%x×]|\\d+(?:\\.\\d+)?\\s*%)";

const CLAIM_PATTERNS: RegExp[] = [];
for (const term of RATIO_TERMS) {
  CLAIM_PATTERNS.push(
    new RegExp(`${term}[^\\d\\n]{0,30}${RATIO_NUMBER}`, "i"),
    new RegExp(`${RATIO_NUMBER}[^\\n]{0,20}${term}`, "i"),
  );
}
for (const term of PERFORMANCE_TERMS) {
  CLAIM_PATTERNS.push(
    new RegExp(`${term}[^\\d\\n]{0,30}${PERFORMANCE_NUMBER}`, "i"),
    new RegExp(`${PERFORMANCE_NUMBER}[^\\n]{0,20}${term}`, "i"),
  );
}

export function containsUnsupportedPerformanceClaim(...texts: string[]): boolean {
  const joined = texts.filter(Boolean).join(" \n ");
  return CLAIM_PATTERNS.some((re) => re.test(joined));
}

export function validateExplanation(
  payload: unknown,
  finding: EngineFinding,
  model: string,
): AIExplanationData | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;

  const explanation = str(p.explanation);
  const whyItMatters = str(p.why_it_matters);
  const suggestedFix = str(p.suggested_fix);
  if (!explanation || !whyItMatters || !suggestedFix) return null;

  /* Fabricated performance figures invalidate the whole explanation: the
   * finding keeps its deterministic fields, this AI text is omitted (7F). */
  if (
    containsUnsupportedPerformanceClaim(
      explanation,
      whyItMatters,
      suggestedFix,
      str(p.summary) ?? "",
      str(p.corrected_example) ?? "",
    )
  ) {
    return null;
  }

  const confidenceNumber = Number(p.confidence);
  if (!Number.isFinite(confidenceNumber)) return null;
  const confidence = Math.min(1, Math.max(0, confidenceNumber));

  const evidenceLevel = EVIDENCE_LEVELS.includes(p.evidence_level as EvidenceLevel)
    ? (p.evidence_level as EvidenceLevel)
    : "likely";

  const corrected = str(p.corrected_example, 4_000);

  return {
    ruleId: finding.ruleId,
    finding: finding.title,
    summary: str(p.summary, 300) ?? finding.title,
    explanation,
    whyItMatters,
    suggestedFix,
    correctedExample: corrected,
    confidence,
    evidenceLevel,
    assumptions: strArray(p.assumptions),
    caveats: strArray(p.caveats),
    model,
    generatedAt: new Date().toISOString(),
  };
}

export function validateRecommendations(
  payload: unknown,
  validRuleIds: Set<string>,
  findings: EngineFinding[],
): AIRecommendationData[] {
  if (typeof payload !== "object" || payload === null) return [];
  const list = (payload as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(list)) return [];

  const severityByRule = new Map(findings.map((f) => [f.ruleId, f.severity]));
  const out: AIRecommendationData[] = [];

  for (const item of list.slice(0, 6)) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const relatedRuleId = str(r.related_rule_id, 100);
    const title = str(r.title, 200);
    const why = str(r.why);
    const suggestedAction = str(r.suggested_action);
    if (!relatedRuleId || !validRuleIds.has(relatedRuleId)) continue;
    if (!title || !why || !suggestedAction) continue;
    if (containsUnsupportedPerformanceClaim(title, why, suggestedAction)) continue;

    const severity = severityByRule.get(relatedRuleId) ?? "info";
    const priority = Math.min(20, Math.max(1, Math.round(Number(r.priority) || 5)));

    out.push({ priority, title, severity, why, suggestedAction, relatedRuleId });
  }

  return out;
}

/* Context trimming (3K): head+tail window preserving the snippet's shape. */
export function trimContext(code: string, maxChars: number): string {
  if (code.length <= maxChars) return code;
  const half = Math.floor(maxChars / 2);
  return `${code.slice(0, half)}\n... [trimmed] ...\n${code.slice(-half)}`;
}

function logAIError(context: string, err: unknown) {
  // Server-side log with status only — never the API key, never full source.
  const detail =
    err instanceof AIProviderError
      ? `${err.message}${err.status ? ` (status ${err.status})` : ""}`
      : err instanceof Error
        ? err.message
        : "unknown error";
  console.error(`[ai] ${context} failed: ${detail}`);
}
