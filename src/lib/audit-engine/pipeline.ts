/* The real audit pipeline: seven stages executed synchronously with no
 * artificial timers. Progress is derived from completed stages. Individual
 * rule failures are recorded and never abort the audit; only fatal intake
 * errors (invalid source) do. */

import type { AuditRuleCategory } from "@/types/database";
import {
  AUDIT_STAGES,
  type AuditStage,
  type EngineFinding,
  type EngineInput,
  type EngineMetricRow,
  type EngineRecommendation,
  type EngineResult,
  type EngineStats,
  type EngineTimelineEntry,
  type StageResult,
  computeGrade,
  computeScore,
} from "./types";
import { parsePythonSource, type PythonStructure } from "./parsers/python";
import { detectFramework } from "./parsers/framework";
import { rulesForStage } from "./rules/registry";
import type { RuleContext, RuleFinding } from "./rules/types";
import type { AIConfig, AIProvider, AIRecommendationData } from "@/lib/ai/types";
import { runAIStage } from "@/lib/ai/service";
import type { SourceSegment } from "@/lib/audit-ingestion/types";

export class FatalAuditError extends Error {}

export type PipelineHooks = {
  onStageComplete?: (stage: AuditStage, stageIndex: number, progress: number) => void;
  /* Fine-grained progress within the AI stage: fraction 0..1. */
  onAIProgress?: (fraction: number) => void;
};

/* AI dependencies — injected so tests and future executors can substitute or
 * omit the provider; the pipeline never constructs one itself. */
export type AIDeps = {
  provider: AIProvider;
  config: AIConfig;
};

export async function runPipeline(
  input: EngineInput,
  hooks?: PipelineHooks,
  aiDeps?: AIDeps | null,
): Promise<EngineResult> {
  const timeline: EngineTimelineEntry[] = [];
  let timelineOrder = 0;
  const addTimeline = (label: string) => {
    timeline.push({ label, at: new Date().toISOString(), sortOrder: timelineOrder++ });
  };

  const findings: EngineFinding[] = [];
  const stageResults: StageResult[] = [];
  const stats: EngineStats = {
    rulesExecuted: 0,
    rulesPassed: 0,
    rulesFailed: 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
  };

  let parsed: PythonStructure | null = null;
  let detectedFramework: ReturnType<typeof detectFramework> = "unknown";
  let fatalError: string | null = null;
  let aiRecommendations: AIRecommendationData[] = [];

  const total = AUDIT_STAGES.length;
  const selected = input.ruleCategories as readonly AuditRuleCategory[];

  for (let index = 0; index < total; index++) {
    const stage = AUDIT_STAGES[index];
    const startedAt = new Date().toISOString();
    let stageError: string | null = null;

    try {
      switch (stage) {
        case "intake": {
          if (!input.code || input.code.trim().length === 0) {
            throw new FatalAuditError("Strategy source is empty.");
          }
          if (/\u0000/.test(input.code)) {
            throw new FatalAuditError("Strategy source contains null bytes.");
          }
          parsed = parsePythonSource(input.code);
          if (parsed.issues.length > 0) {
            const first = parsed.issues[0];
            throw new FatalAuditError(
              `Python syntax validation failed at line ${first.line}: ${first.message}`,
            );
          }
          break;
        }
        case "structure": {
          detectedFramework = detectFramework(input.code, parsed!);
          const ctx = buildContext(input, parsed!, detectedFramework);
          runStageRules("structure", ctx, selected, findings, stats);
          break;
        }
        case "bias":
        case "rules":
        case "risk":
        case "performance": {
          const ctx = buildContext(input, parsed!, detectedFramework);
          runStageRules(stage, ctx, selected, findings, stats);
          break;
        }
        case "ai": {
          // Enrichment only — deterministic findings stay authoritative and
          // the audit survives any AI failure.
          if (!aiDeps) {
            addTimeline("AI enrichment unavailable — skipped");
            break;
          }
          const resolved =
            input.declaredFramework === "auto"
              ? detectedFramework
              : input.declaredFramework;
          const aiResult = await runAIStage(
            aiDeps.provider,
            aiDeps.config,
            findings,
            {
              strategyName: input.fileName ?? "Strategy",
              framework: resolved,
              analysisDepth: input.analysisDepth,
            },
            hooks?.onAIProgress,
          );
          if (aiResult.skipped) {
            addTimeline(`AI enrichment skipped — ${aiResult.skipReason}`);
            break;
          }
          for (const [findingIndex, explanation] of aiResult.explanations) {
            findings[findingIndex] = {
              ...findings[findingIndex],
              aiExplanation: explanation,
            };
          }
          aiRecommendations = aiResult.recommendations;
          addTimeline(
            aiResult.explanations.size === 0 && aiResult.failed > 0
              ? `AI enrichment failed — deterministic findings preserved (${aiResult.failed} attempts)`
              : `AI enrichment completed — ${aiResult.explanations.size} explained, ${aiResult.failed} failed`,
          );
          break;
        }
        case "report": {
          // Deterministic report assembly happens in finalizeResult.
          break;
        }
      }
    } catch (err) {
      if (err instanceof FatalAuditError) {
        stageError = err.message;
        fatalError = err.message;
      } else {
        // A rule/unexpected stage failure must not kill the audit
        stageError = err instanceof Error ? err.message : "Unknown stage error.";
      }
    }

    const completedAt = new Date().toISOString();
    stageResults.push({
      stage,
      ok: stageError === null,
      startedAt,
      completedAt,
      error: stageError,
    });
    if (stage !== "ai") {
      addTimeline(`${STAGE_LABEL[stage]} completed`);
    }

    const progress = Math.round(((index + 1) / total) * 100);
    hooks?.onStageComplete?.(stage, index, progress);

    if (fatalError) break;
  }

  if (fatalError) {
    addTimeline(`Audit failed: ${fatalError}`);
    return {
      ok: false,
      fatalError,
      framework: {
        declared: input.declaredFramework,
        detected: detectedFramework,
        resolved: detectedFramework,
      },
      findings,
      metrics: [],
      recommendations: [],
      timeline,
      stageResults,
      stats,
      score: 0,
      grade: "F",
      gradeStatus: "Audit failed — no score computed",
    };
  }

  return finalizeResult(
    input,
    parsed!,
    detectedFramework,
    findings,
    stats,
    timeline,
    stageResults,
    aiRecommendations,
  );
}

/* ── Internals ─────────────────────────────────────────────── */

const STAGE_LABEL: Record<AuditStage, string> = {
  intake: "Strategy intake",
  structure: "Structure analysis",
  bias: "Bias analysis",
  rules: "Rule analysis",
  risk: "Risk analysis",
  performance: "Performance analysis",
  ai: "AI enrichment",
  report: "Report generation",
};

function buildContext(
  input: EngineInput,
  source: PythonStructure,
  detected: ReturnType<typeof detectFramework>,
): RuleContext {
  return {
    code: input.code,
    source,
    fileName: input.fileName,
    segments: input.segments ?? [],
    framework: {
      declared: input.declaredFramework,
      detected,
      resolved:
        input.declaredFramework === "auto" ? detected : input.declaredFramework,
    },
  };
}

/* Phase 8 #3: per-rule finding fan-out limit. Prevents a pathological source
 * from generating thousands of violation rows from a single rule. Applied
 * per rule, not globally — different rules' findings are not combined. */
const MAX_FINDINGS_PER_RULE = 50;

/* Map an assembled-source line to the original file position. With no
 * segments (paste, .py, single-file zip) lines already match the original.
 * A line outside every segment (e.g., an assembly header) maps to null —
 * locations are never fabricated. */
export function mapFindingLocation(
  line: number | null,
  segments: readonly SourceSegment[] | undefined,
  fallbackFileName: string | null,
): { fileName: string | null; line: number | null } {
  if (!segments || segments.length === 0 || line === null) {
    return { fileName: fallbackFileName, line };
  }
  for (const segment of segments) {
    const last = segment.startLine + segment.lineCount - 1;
    if (line >= segment.startLine && line <= last) {
      return { fileName: segment.path, line: line - segment.startLine + 1 };
    }
  }
  return { fileName: null, line: null };
}

function runStageRules(
  stage: AuditStage,
  ctx: RuleContext,
  selected: readonly AuditRuleCategory[],
  findings: EngineFinding[],
  stats: EngineStats,
): void {
  for (const rule of rulesForStage(stage, selected)) {
    stats.rulesExecuted++;
    try {
      const ruleFindings: RuleFinding[] = rule.run(ctx);
      if (ruleFindings.length === 0) {
        stats.rulesPassed++;
      } else {
        for (const rf of ruleFindings.slice(0, MAX_FINDINGS_PER_RULE)) {
          const location = mapFindingLocation(rf.line, ctx.segments, ctx.fileName);
          findings.push({
            ruleId: rule.ruleId,
            category: rule.category,
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            whyItMatters: rule.whyItMatters,
            suggestedFix: rule.suggestedFix,
            detectedPattern: rf.detectedPattern,
            codeSnippet: rf.codeSnippet ?? null,
            fixSnippet: rule.fixSnippet ?? rf.fixSnippet ?? null,
            fileName: location.fileName,
            line: location.line,
          });
          if (rule.severity === "critical") stats.criticalCount++;
          else if (rule.severity === "warning") stats.warningCount++;
          else stats.infoCount++;
        }
      }
    } catch {
      // One broken rule must not abort the audit.
      stats.rulesFailed++;
    }
  }
}

function finalizeResult(
  input: EngineInput,
  parsed: PythonStructure,
  detected: ReturnType<typeof detectFramework>,
  findings: EngineFinding[],
  stats: EngineStats,
  timeline: EngineTimelineEntry[],
  stageResults: StageResult[],
  aiRecommendations: AIRecommendationData[],
): EngineResult {
  const resolved =
    input.declaredFramework === "auto" ? detected : input.declaredFramework;

  const metrics: EngineMetricRow[] = buildMetricRows(parsed, findings, stats);
  const recommendations: EngineRecommendation[] = buildRecommendations(findings);

  // AI recommendations continue after the deterministic ones (priority
  // offset), all grounded in real rule ids by validation.
  for (const ai of aiRecommendations) {
    recommendations.push({
      priority: recommendations.length + ai.priority,
      title: ai.title,
      severity: ai.severity,
      why: ai.why,
      suggestedAction: ai.suggestedAction,
      relatedRuleId: ai.relatedRuleId,
    });
  }
  const score = computeScore(stats);
  const { grade, gradeStatus } = computeGrade(score);

  return {
    ok: true,
    fatalError: null,
    framework: { declared: input.declaredFramework, detected, resolved },
    findings,
    metrics,
    recommendations,
    timeline,
    stageResults,
    stats,
    score,
    grade,
    gradeStatus,
  };
}

function buildMetricRows(
  parsed: PythonStructure,
  findings: EngineFinding[],
  stats: EngineStats,
): EngineMetricRow[] {
  const rows: EngineMetricRow[] = [];

  rows.push(
    {
      groupLabel: "Findings",
      key: "critical",
      label: "Critical violations",
      value: String(stats.criticalCount),
      tooltip: "Critical-severity findings detected by the deterministic rules.",
    },
    {
      groupLabel: "Findings",
      key: "warnings",
      label: "Warnings",
      value: String(stats.warningCount),
      tooltip: "Warning-severity findings detected by the deterministic rules.",
    },
    {
      groupLabel: "Findings",
      key: "info",
      label: "Informational",
      value: String(stats.infoCount),
      tooltip: "Informational findings detected by the deterministic rules.",
    },
    {
      groupLabel: "Findings",
      key: "total",
      label: "Total findings",
      value: String(findings.length),
      tooltip: "All findings across executed rules.",
    },
  );

  rows.push(
    {
      groupLabel: "Rules",
      key: "rules-executed",
      label: "Rules executed",
      value: String(stats.rulesExecuted),
      tooltip: "Deterministic rules that ran for the selected categories.",
    },
    {
      groupLabel: "Rules",
      key: "rules-passed",
      label: "Rules passed",
      value: String(stats.rulesPassed),
      tooltip: "Executed rules that produced no findings.",
    },
    {
      groupLabel: "Rules",
      key: "rules-failed",
      label: "Rule errors",
      value: String(stats.rulesFailed),
      tooltip: "Rules that could not complete (excluded from scoring).",
    },
  );

  rows.push(
    {
      groupLabel: "Code",
      key: "code-lines",
      label: "Lines of code",
      value: String(parsed.codeLineCount),
      tooltip: "Non-blank, non-comment lines in the submitted source.",
    },
    {
      groupLabel: "Code",
      key: "functions",
      label: "Functions",
      value: String(parsed.functions.length),
      tooltip: "Top-level and nested function definitions.",
    },
    {
      groupLabel: "Code",
      key: "classes",
      label: "Classes",
      value: String(parsed.classes.length),
      tooltip: "Class definitions in the source.",
    },
    {
      groupLabel: "Code",
      key: "imports",
      label: "Imports",
      value: String(parsed.imports.length),
      tooltip: "Import statements detected.",
    },
    {
      groupLabel: "Code",
      key: "max-indent",
      label: "Max nesting",
      value: String(parsed.maxIndentLevel),
      tooltip: "Deepest indentation level (nesting indicator).",
    },
    {
      groupLabel: "Code",
      key: "branches",
      label: "Branches",
      value: String(parsed.branchCount),
      tooltip: "if/elif statements (complexity indicator).",
    },
    {
      groupLabel: "Code",
      key: "loops",
      label: "Loops",
      value: String(parsed.loopCount),
      tooltip: "for/while statements (complexity indicator).",
    },
  );

  return rows;
}

/* Deterministic recommendations derived from actual findings: one per
 * critical or warning finding, ordered critical-first. No fabricated advice. */
function buildRecommendations(findings: EngineFinding[]): EngineRecommendation[] {
  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  const ordered = [...findings]
    .filter((f) => f.severity !== "info")
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 10);

  return ordered.map((f, i) => ({
    priority: i + 1,
    title: `Address: ${f.title}`,
    severity: f.severity,
    why: f.whyItMatters,
    suggestedAction: f.suggestedFix,
    relatedRuleId: f.ruleId,
  }));
}
