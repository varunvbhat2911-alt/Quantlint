/* QuantLint AI layer — shared types.
 *
 * The AI layer ENRICHES deterministic findings; it never creates, removes,
 * or re-grades them. Deterministic fields stay authoritative. Pure TS: no
 * React, no browser APIs, no server-only imports. */

import type { ViolationSeverity } from "@/types/database";

/* ── Provider abstraction (3C) ─────────────────────────────── */

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AICompletionRequest = {
  messages: AIChatMessage[];
  /* JSON mode hint — providers that support it must return valid JSON. */
  jsonMode?: boolean;
};

export type AICompletionResult = {
  /* Raw text of the model's final answer (may contain a JSON document). */
  text: string;
  /* Provider/model identifier that produced the answer, for audit trails. */
  model: string;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}

/* ── Config (3K) — every knob is environment-configurable ─── */

export type AIConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  /* Total attempts per request (1 = no retry). */
  maxAttempts: number;
  /* Maximum findings sent for enrichment (most severe first). */
  maxFindings: number;
  /* Maximum characters of source context per finding. */
  maxContextChars: number;
};

/* ── Structured output contract (3E) ───────────────────────── */

export const EVIDENCE_LEVELS = ["definite", "likely", "uncertain"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

/* Shape persisted into public.audit_violations.ai_explanation (jsonb). */
export type AIExplanationData = {
  ruleId: string;
  finding: string;
  summary: string;
  explanation: string;
  whyItMatters: string;
  suggestedFix: string;
  correctedExample: string | null;
  /* Model self-assessment 0..1 — qualitative only; never a probability of
   * strategy success or profitability (3O). */
  confidence: number;
  evidenceLevel: EvidenceLevel;
  assumptions: string[];
  caveats: string[];
  model: string;
  generatedAt: string;
};

export type AIRecommendationData = {
  priority: number;
  title: string;
  /* Derived from the related deterministic finding — never model-chosen. */
  severity: ViolationSeverity;
  why: string;
  suggestedAction: string;
  relatedRuleId: string;
};

export type AIStageResult = {
  /* Findings enriched, keyed by finding index in the engine result. */
  explanations: Map<number, AIExplanationData>;
  recommendations: AIRecommendationData[];
  /* Count of findings the model was asked about. */
  requested: number;
  /* Count of per-finding enrichments that failed validation/retry. */
  failed: number;
  skipped: boolean;
  skipReason: string | null;
};

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
