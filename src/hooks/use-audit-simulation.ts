/* ── useAuditSimulation ─────────────────────────────────────
 *
 * A frontend-only hook that simulates an audit processing pipeline.
 * No real analysis is performed — this exists solely for UI demonstration.
 *
 * FUTURE: Replace this hook with useAuditJob(jobId) that polls
 * a real backend endpoint. The UI already consumes generic concepts
 * (progress, steps, logs, metrics, status) so no page rebuild is needed.
 * ──────────────────────────────────────────────────────────── */

"use client";

import * as React from "react";
import {
  PIPELINE_STEPS,
  PROGRESS_KEYFRAMES,
  SIMULATION_LOGS,
  METRIC_SNAPSHOTS,
  MOCK_COMPLETION_RESULT,
  type PipelineStep,
  type StepStatus,
  type MetricSnapshot,
  type SimulationResult,
  type LogEntry,
} from "@/lib/mock-data/audit-simulation";

/* ── Public Types ────────────────────────────────────────── */

export type AuditSimulationStatus =
  | "idle"
  | "running"
  | "completed"
  | "error";

export type StepState = PipelineStep & {
  status: StepStatus;
};

export type TimestampedLog = {
  timestamp: string;
  message: string;
};

export type AuditSimulationState = {
  /** 0–100 */
  progress: number;
  /** Index of the step currently being processed (-1 = not started) */
  currentStepIndex: number;
  /** Steps with their statuses */
  steps: StepState[];
  /** Terminal-style log entries */
  logs: TimestampedLog[];
  /** Current metric counters */
  metrics: MetricSnapshot;
  /** Overall status */
  status: AuditSimulationStatus;
  /** True when the simulation has reached 100% */
  isComplete: boolean;
  /** Error message if status === "error" */
  error: string | null;
  /** Completion result (available when isComplete) */
  result: SimulationResult | null;
  /** Restart the simulation from the beginning */
  restart: () => void;
  /** Trigger an error state (for reusable error path) */
  triggerError: (message: string) => void;
};

/* ── Helpers ─────────────────────────────────────────────── */

function formatTimestamp(): string {
  const now = new Date();
  return [
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0"),
  ].join(":");
}

function interpolateLog(message: string, framework: string): string {
  return message.replace("{framework}", framework);
}

function buildInitialSteps(): StepState[] {
  return PIPELINE_STEPS.map((step) => ({
    ...step,
    status: "pending" as StepStatus,
  }));
}

const INITIAL_METRICS: MetricSnapshot = {
  rulesChecked: 0,
  rulesPassed: 0,
  warnings: 0,
  critical: 0,
};

/* ── Hook ────────────────────────────────────────────────── */

export function useAuditSimulation(
  framework: string = "vectorbt"
): AuditSimulationState {
  const [progress, setProgress] = React.useState(0);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(-1);
  const [steps, setSteps] = React.useState<StepState[]>(buildInitialSteps);
  const [logs, setLogs] = React.useState<TimestampedLog[]>([]);
  const [metrics, setMetrics] =
    React.useState<MetricSnapshot>(INITIAL_METRICS);
  const [status, setStatus] =
    React.useState<AuditSimulationStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SimulationResult | null>(null);

  // Ref to hold all timer IDs for cleanup
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  // Ref for the restart generation — used to ignore stale timers after restart
  const genRef = React.useRef(0);

  const clearAllTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const addTimer = React.useCallback(
    (fn: () => void, delayMs: number, gen: number) => {
      const id = setTimeout(() => {
        // Ignore if generation has moved on (user restarted)
        if (genRef.current !== gen) return;
        fn();
      }, delayMs);
      timersRef.current.push(id);
    },
    []
  );

  /* ── Schedule the full pipeline ───────────────────────── */

  const startSimulation = React.useCallback(() => {
    // Bump generation
    const gen = ++genRef.current;
    clearAllTimers();

    // Reset state
    setProgress(0);
    setCurrentStepIndex(-1);
    setSteps(buildInitialSteps());
    setLogs([]);
    setMetrics(INITIAL_METRICS);
    setStatus("running");
    setError(null);
    setResult(null);

    let elapsed = 0;

    PIPELINE_STEPS.forEach((step, stepIdx) => {
      const stepStart = elapsed;
      const stepEnd = elapsed + step.durationMs;

      // Mark step as "running" at step start
      addTimer(
        () => {
          setCurrentStepIndex(stepIdx);
          setSteps((prev) =>
            prev.map((s, i) =>
              i === stepIdx ? { ...s, status: "running" } : s
            )
          );

          // Smooth progress interpolation during step
          const prevProgress = stepIdx === 0 ? 0 : PROGRESS_KEYFRAMES[stepIdx - 1];
          const targetProgress = PROGRESS_KEYFRAMES[stepIdx];
          const progressRange = targetProgress - prevProgress;
          const TICK_INTERVAL = 100; // ms
          const ticks = Math.floor(step.durationMs / TICK_INTERVAL);

          for (let t = 1; t <= ticks; t++) {
            addTimer(
              () => {
                const fraction = t / ticks;
                const p = Math.round(prevProgress + progressRange * fraction);
                setProgress(p);
              },
              t * TICK_INTERVAL,
              gen
            );
          }
        },
        stepStart,
        gen
      );

      // Mark step as "completed" at step end
      addTimer(
        () => {
          setSteps((prev) =>
            prev.map((s, i) =>
              i === stepIdx ? { ...s, status: "completed" } : s
            )
          );
          // Update metrics snapshot
          if (METRIC_SNAPSHOTS[stepIdx]) {
            setMetrics(METRIC_SNAPSHOTS[stepIdx]);
          }
          setProgress(PROGRESS_KEYFRAMES[stepIdx]);
        },
        stepEnd,
        gen
      );

      // Schedule logs for this step
      const stepLogs = SIMULATION_LOGS.filter(
        (l: LogEntry) => l.stepIndex === stepIdx
      );
      stepLogs.forEach((logEntry: LogEntry) => {
        const logTime = stepStart + logEntry.offsetRatio * step.durationMs;
        addTimer(
          () => {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: formatTimestamp(),
                message: interpolateLog(logEntry.message, framework),
              },
            ]);
          },
          logTime,
          gen
        );
      });

      elapsed = stepEnd;
    });

    // Mark completion after all steps
    addTimer(
      () => {
        setStatus("completed");
        setResult(MOCK_COMPLETION_RESULT);
        setProgress(100);
      },
      elapsed + 300, // small buffer after last step
      gen
    );
  }, [framework, clearAllTimers, addTimer]);

  /* ── Auto-start on mount ──────────────────────────────── */

  React.useEffect(() => {
    startSimulation();
    return clearAllTimers;
  }, [startSimulation, clearAllTimers]);

  /* ── triggerError ──────────────────────────────────────── */

  const triggerError = React.useCallback(
    (message: string) => {
      clearAllTimers();
      setStatus("error");
      setError(message);
    },
    [clearAllTimers]
  );

  /* ── restart ───────────────────────────────────────────── */

  const restart = React.useCallback(() => {
    startSimulation();
  }, [startSimulation]);

  return {
    progress,
    currentStepIndex,
    steps,
    logs,
    metrics,
    status,
    isComplete: status === "completed",
    error,
    result,
    restart,
    triggerError,
  };
}
