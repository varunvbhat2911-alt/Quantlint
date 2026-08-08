/* ── Mock Audit Simulation Data ─────────────────────────────
 *
 * All data here is MOCK / DEMONSTRATION ONLY.
 * No real analysis is performed.
 *
 * When a real backend is implemented, this file can be removed
 * and the useAuditSimulation hook replaced with useAuditJob().
 * ──────────────────────────────────────────────────────────── */

export type PipelineStepId =
  | "intake"
  | "structure"
  | "bias"
  | "rules"
  | "risk"
  | "performance"
  | "ai"
  | "report";

export type StepStatus = "pending" | "running" | "completed" | "error";

export type PipelineStep = {
  id: PipelineStepId;
  label: string;
  description: string;
  detail: string;
  durationMs: number;
};

export type MetricSnapshot = {
  rulesChecked: number;
  rulesPassed: number;
  warnings: number;
  critical: number;
};

export type SimulationResult = {
  score: number;
  rulesChecked: number;
  issuesFound: number;
  critical: number;
};

/* ── Pipeline Steps ─────────────────────────────────────── */

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "intake",
    label: "Strategy Intake",
    description: "Loading strategy and validating input format",
    detail:
      "Validating file structure, checking encoding, and preparing the strategy source for analysis.",
    durationMs: 1500,
  },
  {
    id: "structure",
    label: "Code Structure Analysis",
    description: "Analyzing code structure",
    detail:
      "Inspecting imports, functions, data dependencies and execution flow.",
    durationMs: 2000,
  },
  {
    id: "bias",
    label: "Bias Detection",
    description: "Detecting look-ahead bias",
    detail:
      "Checking for future information leaking into historical decisions.",
    durationMs: 2000,
  },
  {
    id: "rules",
    label: "Rule Validation",
    description: "Validating against rule library",
    detail:
      "Running strategy code against 317 quantitative validation rules across 9 categories.",
    durationMs: 2000,
  },
  {
    id: "risk",
    label: "Risk Analysis",
    description: "Validating risk management",
    detail:
      "Reviewing position sizing, stop-loss logic and exposure controls.",
    durationMs: 2000,
  },
  {
    id: "performance",
    label: "Performance Metrics",
    description: "Calculating performance metrics",
    detail:
      "Computing Sharpe ratio, Sortino ratio, maximum drawdown, and win rate estimates.",
    durationMs: 2000,
  },
  {
    id: "ai",
    label: "AI Explanation",
    description: "Generating AI explanations",
    detail:
      "Preparing human-readable explanations and contextual recommendations for findings.",
    durationMs: 2000,
  },
  {
    id: "report",
    label: "Report Generation",
    description: "Generating report",
    detail: "Preparing findings, scoring, and compiling the final audit report.",
    durationMs: 1500,
  },
];

/* ── Progress Keyframes ──────────────────────────────────── */

/** Maps each step index → the progress % reached when that step completes. */
export const PROGRESS_KEYFRAMES: number[] = [
  10, // after intake
  24, // after structure
  42, // after bias
  58, // after rules
  72, // after risk
  86, // after performance
  94, // after ai
  100, // after report
];

/* ── Log Messages ────────────────────────────────────────── */

export type LogEntry = {
  /** Which step this log is associated with */
  stepIndex: number;
  /** 0 = start of step, 1 = end (controls when this log appears relative to step timing) */
  offsetRatio: number;
  message: string;
};

export const SIMULATION_LOGS: LogEntry[] = [
  // Step 0 — Strategy Intake
  { stepIndex: 0, offsetRatio: 0.0, message: "Initializing audit session..." },
  { stepIndex: 0, offsetRatio: 0.3, message: "Loading strategy source..." },
  { stepIndex: 0, offsetRatio: 0.7, message: "Framework detected: {framework}" },

  // Step 1 — Code Structure Analysis
  { stepIndex: 1, offsetRatio: 0.0, message: "Parsing strategy structure..." },
  { stepIndex: 1, offsetRatio: 0.4, message: "Inspecting data dependencies..." },
  { stepIndex: 1, offsetRatio: 0.8, message: "Mapping execution flow..." },

  // Step 2 — Bias Detection
  { stepIndex: 2, offsetRatio: 0.0, message: "Running bias detection rules..." },
  { stepIndex: 2, offsetRatio: 0.3, message: "Checking look-ahead patterns..." },
  { stepIndex: 2, offsetRatio: 0.7, message: "Checking survivorship bias..." },

  // Step 3 — Rule Validation
  { stepIndex: 3, offsetRatio: 0.0, message: "Validating position sizing..." },
  { stepIndex: 3, offsetRatio: 0.4, message: "Evaluating transaction cost assumptions..." },
  { stepIndex: 3, offsetRatio: 0.8, message: "Checking portfolio constraints..." },

  // Step 4 — Risk Analysis
  { stepIndex: 4, offsetRatio: 0.0, message: "Analyzing risk exposure..." },
  { stepIndex: 4, offsetRatio: 0.5, message: "Validating stop-loss logic..." },

  // Step 5 — Performance Metrics
  { stepIndex: 5, offsetRatio: 0.0, message: "Calculating risk metrics..." },
  { stepIndex: 5, offsetRatio: 0.5, message: "Computing performance ratios..." },

  // Step 6 — AI Explanation
  { stepIndex: 6, offsetRatio: 0.0, message: "Generating explanations..." },
  { stepIndex: 6, offsetRatio: 0.6, message: "Building recommendations..." },

  // Step 7 — Report Generation
  { stepIndex: 7, offsetRatio: 0.0, message: "Preparing audit findings..." },
  { stepIndex: 7, offsetRatio: 0.6, message: "Compiling final report..." },
  { stepIndex: 7, offsetRatio: 0.95, message: "Audit complete ✓" },
];

/* ── Metric Snapshots ────────────────────────────────────── */

/** One snapshot per pipeline step completion (index 0 = after step 0 completes, etc.) */
export const METRIC_SNAPSHOTS: MetricSnapshot[] = [
  { rulesChecked: 0, rulesPassed: 0, warnings: 0, critical: 0 },
  { rulesChecked: 48, rulesPassed: 45, warnings: 3, critical: 0 },
  { rulesChecked: 112, rulesPassed: 102, warnings: 8, critical: 1 },
  { rulesChecked: 197, rulesPassed: 181, warnings: 11, critical: 3 },
  { rulesChecked: 248, rulesPassed: 230, warnings: 13, critical: 4 },
  { rulesChecked: 289, rulesPassed: 270, warnings: 14, critical: 4 },
  { rulesChecked: 310, rulesPassed: 291, warnings: 14, critical: 5 },
  { rulesChecked: 317, rulesPassed: 298, warnings: 14, critical: 5 },
];

/* ── Completion Result ───────────────────────────────────── */

export const MOCK_COMPLETION_RESULT: SimulationResult = {
  score: 92,
  rulesChecked: 317,
  issuesFound: 19,
  critical: 5,
};
