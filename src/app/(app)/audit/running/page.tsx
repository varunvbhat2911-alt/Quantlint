"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Terminal,
  ArrowRight,
  RotateCcw,
  X,
  FileCode2,
  Activity,
  AlertTriangle,
  Shield,
  BarChart3,
  Sparkles,
  FileText,
  Download,
  Award,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/badges";
import type { AuditDraft } from "@/lib/audit-draft";
import {
  FRAMEWORK_OPTIONS,
  ANALYSIS_DEPTH_OPTIONS,
} from "@/lib/audit-draft";
import {
  useAuditSimulation,
  type StepState,
} from "@/hooks/use-audit-simulation";
import type { StepStatus } from "@/lib/mock-data/audit-simulation";

/* ────────────────────────────────────────────────────────── */
/*  STEP ICON MAPPING                                         */
/* ────────────────────────────────────────────────────────── */

const STEP_ICONS: Record<string, React.ElementType> = {
  intake: Download,
  structure: FileCode2,
  bias: AlertTriangle,
  rules: Shield,
  risk: Activity,
  performance: BarChart3,
  ai: Sparkles,
  report: FileText,
};

/* ────────────────────────────────────────────────────────── */
/*  STATUS ICON                                               */
/* ────────────────────────────────────────────────────────── */

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
      );
    case "running":
      return (
        <Loader2 className="h-4 w-4 animate-spin text-foreground shrink-0" />
      );
    case "error":
      return (
        <XCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
      );
    default:
      return (
        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      );
  }
}

/* ────────────────────────────────────────────────────────── */
/*  PROGRESS BAR                                              */
/* ────────────────────────────────────────────────────────── */

function ProgressBar({
  progress,
  status,
}: {
  progress: number;
  status: string;
}) {
  const isComplete = status === "completed";
  const isError = status === "error";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
          Audit Progress
        </span>
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums font-mono",
            isComplete && "text-emerald-500 dark:text-emerald-400",
            isError && "text-red-500 dark:text-red-400"
          )}
        >
          {progress}%
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Audit progress: ${progress}%`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            isError
              ? "bg-red-500/70"
              : isComplete
                ? "bg-emerald-500/70"
                : "bg-foreground/70"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {isComplete
          ? "Analysis complete"
          : isError
            ? "Analysis interrupted"
            : "Analyzing strategy..."}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  PIPELINE                                                  */
/* ────────────────────────────────────────────────────────── */

function Pipeline({ steps }: { steps: StepState[] }) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.id] ?? Circle;
        const isActive = step.status === "running";
        const isDone = step.status === "completed";

        return (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
              isActive && "bg-secondary/50",
              isDone && "opacity-80"
            )}
          >
            <StepStatusIcon status={step.status} />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isDone
                    ? "text-muted-foreground/60"
                    : isActive
                      ? "text-foreground"
                      : "text-muted-foreground/40"
                )}
              />
              <span
                className={cn(
                  "text-sm truncate",
                  isDone
                    ? "text-muted-foreground"
                    : isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground/60"
                )}
              >
                {step.label}
              </span>
            </div>
            <span
              className={cn(
                "text-[10px] font-mono uppercase tracking-wider shrink-0",
                step.status === "completed" &&
                  "text-emerald-600 dark:text-emerald-400",
                step.status === "running" && "text-foreground",
                step.status === "pending" && "text-muted-foreground/30",
                step.status === "error" && "text-red-500 dark:text-red-400"
              )}
            >
              {step.status === "completed"
                ? "Done"
                : step.status === "running"
                  ? "Running"
                  : step.status === "error"
                    ? "Error"
                    : "Pending"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  TERMINAL LOG                                              */
/* ────────────────────────────────────────────────────────── */

function TerminalLog({
  logs,
}: {
  logs: { timestamp: string; message: string }[];
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <Card className="border-border/40 bg-card/40 overflow-hidden">
      <CardHeader className="p-4 pb-0">
        <CardTitle className="text-xs flex items-center gap-2 font-mono uppercase tracking-wider text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          Analysis Log
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        <div
          ref={scrollRef}
          className="h-[240px] overflow-y-auto overflow-x-auto rounded-lg border border-border/40 bg-code p-3 font-mono text-[11px] leading-relaxed text-code-foreground scrollbar-thin"
        >
          {logs.length === 0 && (
            <span className="text-muted-foreground/50">
              Waiting for output...
            </span>
          )}
          {logs.map((log, i) => (
            <div key={i} className="whitespace-nowrap">
              <span className="text-muted-foreground/50">[{log.timestamp}]</span>{" "}
              <span className="text-code-foreground">{log.message}</span>
            </div>
          ))}
          {logs.length > 0 && (
            <span className="inline-block w-1.5 h-3.5 bg-foreground/60 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  METRIC COUNTERS                                           */
/* ────────────────────────────────────────────────────────── */

function MetricCounters({
  metrics,
}: {
  metrics: {
    rulesChecked: number;
    rulesPassed: number;
    warnings: number;
    critical: number;
  };
}) {
  const items = [
    { label: "Rules Checked", value: metrics.rulesChecked },
    { label: "Rules Passed", value: metrics.rulesPassed },
    {
      label: "Warnings",
      value: metrics.warnings,
      accent: metrics.warnings > 0 ? "text-amber-500 dark:text-amber-400" : undefined,
    },
    {
      label: "Critical",
      value: metrics.critical,
      accent: metrics.critical > 0 ? "text-red-500 dark:text-red-400" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-border/40 bg-card/40 p-3 text-center"
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            {item.label}
          </p>
          <p
            className={cn(
              "text-xl font-semibold tabular-nums font-mono",
              item.accent ?? "text-foreground"
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  CURRENT ANALYSIS DETAIL                                   */
/* ────────────────────────────────────────────────────────── */

function CurrentAnalysisDetail({
  steps,
  currentStepIndex,
}: {
  steps: StepState[];
  currentStepIndex: number;
}) {
  const currentStep =
    currentStepIndex >= 0 && currentStepIndex < steps.length
      ? steps[currentStepIndex]
      : null;

  if (!currentStep || currentStep.status !== "running") return null;

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-4 space-y-1.5">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground shrink-0" />
        <p className="text-sm font-medium text-foreground">
          {currentStep.description}
        </p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-5.5">
        {currentStep.detail}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  STRATEGY INFO CARD                                        */
/* ────────────────────────────────────────────────────────── */

function StrategyInfoCard({ draft }: { draft: AuditDraft }) {
  const fwLabel =
    FRAMEWORK_OPTIONS.find((f) => f.value === draft.framework)?.label ??
    draft.framework;
  const depthLabel =
    ANALYSIS_DEPTH_OPTIONS.find((d) => d.value === draft.analysisDepth)
      ?.label ?? draft.analysisDepth;

  const rows = [
    {
      label: "Strategy",
      value: draft.fileName ?? draft.strategyName,
    },
    { label: "Framework", value: fwLabel },
    {
      label: "Input",
      value: draft.inputType === "upload" ? "Python file" : "Pasted code",
    },
    { label: "Analysis Depth", value: depthLabel },
    {
      label: "Rules",
      value:
        draft.ruleCategories.length === 9
          ? "All categories"
          : `${draft.ruleCategories.length} categories`,
    },
  ];

  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs flex items-center gap-2 font-mono uppercase tracking-wider text-muted-foreground">
          <FileCode2 className="h-3.5 w-3.5" />
          Strategy
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <dl className="space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between text-xs"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium text-foreground text-right max-w-[60%] truncate">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  CANCEL DIALOG                                             */
/* ────────────────────────────────────────────────────────── */

function CancelDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Trap focus & ESC
  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    // Focus the dialog
    dialogRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="mx-4 w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-2xl space-y-4 focus:outline-none"
      >
        <div className="space-y-2">
          <h2
            id="cancel-dialog-title"
            className="text-base font-semibold text-foreground"
          >
            Cancel this audit?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your current audit progress will be discarded.
          </p>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <SecondaryButton size="sm" onClick={onClose}>
            Continue Audit
          </SecondaryButton>
          <PrimaryButton
            size="sm"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
          >
            Cancel Audit
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  COMPLETION STATE                                          */
/* ────────────────────────────────────────────────────────── */

function CompletionState({
  result,
}: {
  result: {
    score: number;
    rulesChecked: number;
    issuesFound: number;
    critical: number;
  };
}) {
  const scoreColor =
    result.score >= 90
      ? "text-emerald-500 dark:text-emerald-400"
      : result.score >= 75
        ? "text-amber-500 dark:text-amber-400"
        : "text-red-500 dark:text-red-400";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Audit Complete
        </h2>
        <p className="text-sm text-muted-foreground">
          Your strategy analysis is ready.
        </p>
      </div>

      {/* Score + Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border/40 bg-card/40 p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Overall Score
          </p>
          <p className={cn("text-3xl font-bold tabular-nums font-mono", scoreColor)}>
            {result.score}
            <span className="text-base text-muted-foreground">/100</span>
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/40 p-4 text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Rules Checked
          </p>
          <p className="text-2xl font-semibold tabular-nums font-mono text-foreground">
            {result.rulesChecked}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/40 p-4 text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Issues Found
          </p>
          <p className="text-2xl font-semibold tabular-nums font-mono text-amber-500 dark:text-amber-400">
            {result.issuesFound}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/40 p-4 text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Critical
          </p>
          <p className="text-2xl font-semibold tabular-nums font-mono text-red-500 dark:text-red-400">
            {result.critical}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
        <PrimaryButton asChild className="w-full sm:w-auto">
          <Link href="/audit/result">
            View Audit Results
            <ArrowRight className="h-4 w-4" />
          </Link>
        </PrimaryButton>
        <SecondaryButton asChild className="w-full sm:w-auto">
          <Link href="/audit/new">
            <RotateCcw className="h-3.5 w-3.5" />
            Run Another Audit
          </Link>
        </SecondaryButton>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  ERROR STATE                                               */
/* ────────────────────────────────────────────────────────── */

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-center space-y-4 py-8">
      <div className="flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <XCircle className="h-7 w-7 text-red-500 dark:text-red-400" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Audit could not be completed
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {error}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
        <PrimaryButton onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5" />
          Try Again
        </PrimaryButton>
        <SecondaryButton asChild>
          <Link href="/audit/new">Back to New Audit</Link>
        </SecondaryButton>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  MISSING SESSION STATE                                     */
/* ────────────────────────────────────────────────────────── */

function MissingSessionState() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Audit Session Unavailable"
        subtitle="This prototype audit session is no longer available."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "New Audit", href: "/audit/new" },
          { label: "Running" },
        ]}
      />
      <div className="text-center space-y-4 py-8">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60 border border-border/40">
            <AlertTriangle className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Audit session not found
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The audit session data was not found. This can happen after a page
            refresh in the current prototype.
          </p>
        </div>
        <PrimaryButton asChild>
          <Link href="/audit/new">
            Start New Audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                 */
/* ────────────────────────────────────────────────────────── */

export default function AuditRunningPage() {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<AuditDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = React.useState(false);

  // Load draft from sessionStorage
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("quantlint_audit_draft");
      if (raw) {
        setDraft(JSON.parse(raw) as AuditDraft);
      }
    } catch {
      // sessionStorage unavailable
    }
    setDraftLoaded(true);
  }, []);

  // Don't render until draft check is done (prevents flash)
  if (!draftLoaded) {
    return null;
  }

  // Missing session
  if (!draft) {
    return <MissingSessionState />;
  }

  return (
    <AuditRunningContent
      draft={draft}
      cancelOpen={cancelOpen}
      setCancelOpen={setCancelOpen}
      router={router}
    />
  );
}

/* ────────────────────────────────────────────────────────── */
/*  RUNNING CONTENT (separated to use hook after draft check) */
/* ────────────────────────────────────────────────────────── */

function AuditRunningContent({
  draft,
  cancelOpen,
  setCancelOpen,
  router,
}: {
  draft: AuditDraft;
  cancelOpen: boolean;
  setCancelOpen: (open: boolean) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const simulation = useAuditSimulation(draft.framework);

  const fwLabel =
    FRAMEWORK_OPTIONS.find((f) => f.value === draft.framework)?.label ??
    draft.framework;
  const depthLabel =
    ANALYSIS_DEPTH_OPTIONS.find((d) => d.value === draft.analysisDepth)
      ?.label ?? draft.analysisDepth;

  // If completed, show completion state
  if (simulation.isComplete && simulation.result) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Audit Complete"
          subtitle={`${draft.strategyName} analysis finished successfully.`}
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "New Audit", href: "/audit/new" },
            { label: "Complete" },
          ]}
        />
        <CompletionState result={simulation.result} />
      </div>
    );
  }

  // If error, show error state
  if (simulation.status === "error" && simulation.error) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Audit Error"
          subtitle="Something went wrong while processing this strategy."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "New Audit", href: "/audit/new" },
            { label: "Error" },
          ]}
        />
        <ErrorState error={simulation.error} onRetry={simulation.restart} />
      </div>
    );
  }

  // Running state
  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <PageHeader
          title="Analyzing Strategy"
          subtitle="QuantLint is validating your strategy against its analysis pipeline."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "New Audit", href: "/audit/new" },
            { label: "Running" },
          ]}
          actions={
            <div className="flex items-center gap-3">
              <StatusBadge status="running" />
            </div>
          }
        />

        {/* Strategy name banner */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-foreground">
            {draft.strategyName}
          </span>
          <span className="text-muted-foreground">·</span>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {fwLabel}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {depthLabel}
          </Badge>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Main column */}
          <div className="space-y-6">
            {/* Progress */}
            <Card className="border-border/40 bg-card/40">
              <CardContent className="p-5">
                <ProgressBar
                  progress={simulation.progress}
                  status={simulation.status}
                />
              </CardContent>
            </Card>

            {/* Current analysis detail */}
            <CurrentAnalysisDetail
              steps={simulation.steps}
              currentStepIndex={simulation.currentStepIndex}
            />

            {/* Pipeline */}
            <Card className="border-border/40 bg-card/40">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Analysis Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Pipeline steps={simulation.steps} />
              </CardContent>
            </Card>

            {/* Metrics */}
            <MetricCounters metrics={simulation.metrics} />

            {/* Terminal */}
            <TerminalLog logs={simulation.logs} />
          </div>

          {/* Right sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              {/* Strategy info */}
              <StrategyInfoCard draft={draft} />

              {/* Cancel */}
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-medium font-mono text-muted-foreground hover:text-foreground hover:border-border transition-all duration-150"
              >
                <X className="h-3.5 w-3.5" />
                Cancel Audit
              </button>
            </div>
          </aside>
        </div>

        {/* Mobile cancel */}
        <div className="lg:hidden">
          <StrategyInfoCard draft={draft} />
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-medium font-mono text-muted-foreground hover:text-foreground hover:border-border transition-all duration-150"
          >
            <X className="h-3.5 w-3.5" />
            Cancel Audit
          </button>
        </div>
      </div>

      {/* Cancel dialog */}
      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          router.push("/audit/new");
        }}
      />
    </>
  );
}
