"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  FileJson,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Clock,
  Shield,
  Sparkles,
  ListChecks,
  BarChart3,
  Info,
  FileCode2,
  ArrowRight,
  ExternalLink,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/app/code-block";
import { SearchBar } from "@/components/app/search-bar";
import { EmptyState } from "@/components/app/empty-state";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsIndicator,
} from "@/components/tabs";
import {
  MOCK_AUDIT_RESULT,
  buildExportJson,
  type AuditResultData,
  type Violation,
  type ViolationSeverity,
  type MetricGroup,
  type AIExplanation,
  type Recommendation,
  type TimelineEntry,
} from "@/lib/mock-data/audit-result";

/* ────────────────────────────────────────────────────────── */
/*  TOAST                                                     */
/* ────────────────────────────────────────────────────────── */

function Toast({
  message,
  visible,
  onClose,
}: {
  message: string;
  visible: boolean;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (visible) {
      const t = setTimeout(onClose, 4000);
      return () => clearTimeout(t);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-5 py-3.5 shadow-lg shadow-black/8">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-foreground">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SCORE RING                                                */
/* ────────────────────────────────────────────────────────── */

function ScoreRing({
  score,
  size = 140,
}: {
  score: number;
  size?: number;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 90
      ? "stroke-emerald-500 dark:stroke-emerald-400"
      : score >= 75
        ? "stroke-amber-500 dark:stroke-amber-400"
        : "stroke-red-500 dark:stroke-red-400";

  const textColor =
    score >= 90
      ? "text-emerald-500 dark:text-emerald-400"
      : score >= 75
        ? "text-amber-500 dark:text-amber-400"
        : "text-red-500 dark:text-red-400";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`Audit score: ${score} out of 100`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-secondary/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(color, "transition-all duration-1000 ease-out")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold tabular-nums font-mono", textColor)}>
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono uppercase">
          / 100
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  SEVERITY ICON                                             */
/* ────────────────────────────────────────────────────────── */

function SeverityIcon({
  severity,
  className,
}: {
  severity: ViolationSeverity;
  className?: string;
}) {
  switch (severity) {
    case "critical":
      return (
        <XCircle
          className={cn(
            "h-4 w-4 text-red-500 dark:text-red-400 shrink-0",
            className
          )}
        />
      );
    case "warning":
      return (
        <AlertTriangle
          className={cn(
            "h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0",
            className
          )}
        />
      );
    default:
      return (
        <Info
          className={cn(
            "h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0",
            className
          )}
        />
      );
  }
}

function SeverityBadgeLocal({
  severity,
}: {
  severity: ViolationSeverity | "pass";
}) {
  const variants: Record<string, { label: string; className: string }> = {
    critical: {
      label: "Critical",
      className: "bg-red-500/8 text-red-600 dark:text-red-400",
    },
    warning: {
      label: "Warning",
      className: "bg-amber-500/8 text-amber-600 dark:text-amber-400",
    },
    info: {
      label: "Info",
      className: "bg-blue-500/8 text-blue-600 dark:text-blue-400",
    },
    pass: {
      label: "Passed",
      className: "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400",
    },
  };

  const v = variants[severity] ?? variants.info;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium font-mono",
        v.className
      )}
    >
      {v.label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  METRIC TOOLTIP                                            */
/* ────────────────────────────────────────────────────────── */

function MetricTooltip({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip: string;
}) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div className="relative group">
      <div
        className="flex items-start justify-between gap-2 py-2.5"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <button
            type="button"
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            aria-label={`Info about ${label}`}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
          >
            <Info className="h-3 w-3" />
          </button>
        </div>
        <span className="text-sm font-medium text-foreground tabular-nums font-mono">
          {value}
        </span>
      </div>
      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-64 rounded-lg border border-border/60 bg-card p-3 shadow-lg text-xs text-muted-foreground leading-relaxed">
          {tooltip}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  OVERVIEW TAB                                              */
/* ────────────────────────────────────────────────────────── */

function OverviewTab({ result }: { result: AuditResultData }) {
  const criticalViolations = result.violations.filter(
    (v) => v.severity === "critical"
  );
  const keyMetrics = result.metricGroups[0]?.metrics.slice(0, 4) ?? [];

  return (
    <div className="space-y-8">
      {/* Score + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-start">
        <div className="flex justify-center md:justify-start">
          <ScoreRing score={result.score} />
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold text-foreground">
                Audit Score
              </h2>
              <Badge variant="secondary" className="font-mono text-xs">
                Grade: {result.grade}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{result.gradeStatus}</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.summary}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Rules Checked"
              value={result.rulesChecked}
            />
            <StatBox
              label="Passed"
              value={result.rulesPassed}
              accent="text-emerald-500 dark:text-emerald-400"
            />
            <StatBox
              label="Warnings"
              value={result.warnings}
              accent="text-amber-500 dark:text-amber-400"
            />
            <StatBox
              label="Critical"
              value={result.critical}
              accent="text-red-500 dark:text-red-400"
            />
          </div>
        </div>
      </div>

      {/* Critical Findings */}
      {criticalViolations.length > 0 && (
        <section>
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            Issues Requiring Attention
          </h3>
          <div className="space-y-2">
            {criticalViolations.slice(0, 5).map((v) => (
              <div
                key={v.id}
                className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 p-3.5"
              >
                <SeverityIcon severity={v.severity} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {v.title}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      {v.ruleId}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {v.description.split(".")[0]}.
                  </p>
                </div>
                <SeverityBadgeLocal severity={v.severity} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key Metrics */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Key Metrics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {keyMetrics.map((m) => (
            <div
              key={m.key}
              className="rounded-lg border border-border/40 bg-card/40 p-4 text-center"
            >
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                {m.label}
              </p>
              <p className="text-xl font-semibold tabular-nums font-mono text-foreground">
                {m.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Top Recommendations */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          Top Recommendations
        </h3>
        <div className="space-y-2">
          {result.recommendations.slice(0, 4).map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-[10px] font-mono font-semibold text-muted-foreground">
                {r.priority}
              </span>
              <span className="text-sm text-foreground flex-1 truncate">
                {r.title}
              </span>
              <SeverityBadgeLocal severity={r.severity} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3 text-center">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums font-mono",
          accent ?? "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  VIOLATIONS TAB                                            */
/* ────────────────────────────────────────────────────────── */

type ViolationFilter = "all" | "critical" | "warning" | "passed";

function ViolationsTab({
  violations,
  rulesPassed,
  onToast,
}: {
  violations: Violation[];
  rulesPassed: number;
  onToast: (msg: string) => void;
}) {
  const [filter, setFilter] = React.useState<ViolationFilter>("all");
  const [search, setSearch] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const filters: { value: ViolationFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: violations.length + rulesPassed },
    {
      value: "critical",
      label: "Critical",
      count: violations.filter((v) => v.severity === "critical").length,
    },
    {
      value: "warning",
      label: "Warning",
      count: violations.filter((v) => v.severity === "warning").length,
    },
    { value: "passed", label: "Passed", count: rulesPassed },
  ];

  const filtered = React.useMemo(() => {
    let items = violations;

    if (filter === "critical") {
      items = items.filter((v) => v.severity === "critical");
    } else if (filter === "warning") {
      items = items.filter((v) => v.severity === "warning");
    } else if (filter === "passed") {
      return []; // We'll handle passed differently
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.ruleId.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q)
      );
    }

    return items;
  }, [violations, filter, search]);

  return (
    <div className="space-y-4">
      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/30 p-0.5">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                filter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              <span className="ml-1.5 text-[10px] opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
        <SearchBar
          placeholder="Search rules or findings..."
          value={search}
          onChange={setSearch}
          className="w-full sm:w-64"
        />
      </div>

      {/* Passed state */}
      {filter === "passed" && (
        <div className="space-y-1">
          {Array.from({ length: Math.min(rulesPassed, 20) }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span className="text-muted-foreground font-mono text-xs">
                QL-{String(i + 1).padStart(3, "0")}
              </span>
              <span className="text-muted-foreground text-xs">
                Rule check passed
              </span>
              <SeverityBadgeLocal severity="pass" />
            </div>
          ))}
          {rulesPassed > 20 && (
            <p className="text-xs text-muted-foreground/60 text-center py-2 font-mono">
              + {rulesPassed - 20} more passed rules
            </p>
          )}
        </div>
      )}

      {/* Violations list */}
      {filter !== "passed" && filtered.length === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="No violations found"
          description={
            search
              ? "No violations match your search query."
              : "All configured validation rules passed."
          }
        />
      )}

      {filter !== "passed" && filtered.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden divide-y divide-border/40">
          {filtered.map((v) => (
            <ViolationRow
              key={v.id}
              violation={v}
              isExpanded={expandedId === v.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === v.id ? null : v.id))
              }
              onToast={onToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ViolationRow({
  violation: v,
  isExpanded,
  onToggle,
  onToast,
}: {
  violation: Violation;
  isExpanded: boolean;
  onToggle: () => void;
  onToast: (msg: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <SeverityIcon severity={v.severity} />
        <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 w-24 hidden sm:block">
          {v.ruleId}
        </span>
        <span className="text-sm text-foreground flex-1 truncate">
          {v.title}
        </span>
        {v.file && (
          <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 hidden md:block">
            {v.file}
            {v.line ? `:${v.line}` : ""}
          </span>
        )}
        <SeverityBadgeLocal severity={v.severity} />
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded detail */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/30">
            {/* Meta row */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">Rule: </span>
                <span className="font-mono text-foreground">{v.ruleId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Severity: </span>
                <SeverityBadgeLocal severity={v.severity} />
              </div>
              {v.file && (
                <div>
                  <span className="text-muted-foreground">Location: </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToast(
                        "Code navigation will be available when source mapping is connected."
                      );
                    }}
                    className="font-mono text-foreground hover:underline"
                  >
                    {v.file}
                    {v.line ? `:${v.line}` : ""}
                  </button>
                </div>
              )}
              {v.detectedPattern && (
                <div>
                  <span className="text-muted-foreground">Pattern: </span>
                  <code className="font-mono text-foreground bg-secondary/40 px-1.5 py-0.5 rounded text-[11px]">
                    {v.detectedPattern}
                  </code>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Finding
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {v.description}
              </p>
            </div>

            {/* Why it matters */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Why it matters
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {v.whyItMatters}
              </p>
            </div>

            {/* Code snippets */}
            {v.codeSnippet && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">
                  Detected Code
                </h4>
                <CodeBlock code={v.codeSnippet} showCopy={false} />
              </div>
            )}
            {v.fixSnippet && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">
                  Suggested Fix
                </h4>
                <CodeBlock code={v.fixSnippet} showCopy={false} />
              </div>
            )}

            {/* Suggested fix text */}
            {v.suggestedFix && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Recommendation
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {v.suggestedFix}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  METRICS TAB                                               */
/* ────────────────────────────────────────────────────────── */

function MetricsTab({
  metricGroups,
}: {
  metricGroups: MetricGroup[];
}) {
  if (metricGroups.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No metrics available"
        description="Metrics will be displayed when the analysis engine is connected."
      />
    );
  }

  return (
    <div className="space-y-8">
      {metricGroups.map((group) => (
        <section key={group.label}>
          <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider font-mono">
            {group.label}
          </h3>
          <Card className="border-border/40 bg-card/40">
            <CardContent className="p-0">
              <div className="divide-y divide-border/30 px-4">
                {group.metrics.map((m) => (
                  <MetricTooltip
                    key={m.key}
                    label={m.label}
                    value={m.value}
                    tooltip={m.tooltip}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  AI EXPLANATION TAB                                        */
/* ────────────────────────────────────────────────────────── */

function AIExplanationTab({
  explanations,
}: {
  explanations: AIExplanation[];
}) {
  if (explanations.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No AI explanations available"
        description="AI-generated explanations will appear here when the analysis engine is connected."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-secondary/20 p-3">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            AI-generated explanation
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Explanations are provided as development assistance and should be
            reviewed by a qualified researcher.
          </p>
        </div>
      </div>

      {explanations.map((ex) => (
        <Card key={ex.id} className="border-border/40 bg-card/40">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  {ex.finding}
                </CardTitle>
                <p className="text-[10px] font-mono text-muted-foreground/60">
                  {ex.ruleId}
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                {ex.confidence}% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Explanation
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ex.explanation}
              </p>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Why this matters
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ex.whyItMatters}
              </p>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Suggested Fix
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ex.suggestedFix}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  RECOMMENDATIONS TAB                                       */
/* ────────────────────────────────────────────────────────── */

function RecommendationsTab({
  recommendations: initialRecs,
}: {
  recommendations: Recommendation[];
}) {
  const [recs, setRecs] = React.useState(initialRecs);

  function cycleStatus(id: string) {
    setRecs((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status:
                r.status === "open"
                  ? "resolved"
                  : r.status === "resolved"
                    ? "ignored"
                    : "open",
            }
          : r
      )
    );
  }

  if (recs.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No recommendations"
        description="All configured validation rules passed with no issues."
      />
    );
  }

  const statusConfig: Record<
    string,
    { label: string; className: string }
  > = {
    open: {
      label: "Open",
      className: "bg-foreground/5 text-muted-foreground",
    },
    resolved: {
      label: "Resolved",
      className: "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400",
    },
    ignored: {
      label: "Ignored",
      className: "bg-muted text-muted-foreground/60",
    },
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-4">
        Click a status badge to cycle between Open → Resolved → Ignored.
        Status changes are local to this session only.
      </p>

      {recs.map((r) => {
        const st = statusConfig[r.status] ?? statusConfig.open;
        return (
          <Card key={r.id} className="border-border/40 bg-card/40">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-xs font-mono font-bold text-muted-foreground mt-0.5">
                  {r.priority}
                </span>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {r.title}
                    </span>
                    <SeverityBadgeLocal severity={r.severity} />
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      {r.relatedRuleId}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground/80">Why: </span>
                    {r.why}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground/80">
                      Action:{" "}
                    </span>
                    {r.suggestedAction}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cycleStatus(r.id)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium font-mono transition-colors cursor-pointer hover:opacity-80",
                    st.className
                  )}
                  aria-label={`Status: ${st.label}. Click to change.`}
                >
                  {st.label}
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  AUDIT METADATA SIDEBAR                                    */
/* ────────────────────────────────────────────────────────── */

function AuditMetadata({ result }: { result: AuditResultData }) {
  const rows = [
    { label: "Audit ID", value: result.auditId },
    { label: "Strategy", value: result.strategyName },
    { label: "File", value: result.fileName },
    { label: "Framework", value: result.frameworkLabel },
    { label: "Analysis", value: result.analysisDepth },
    { label: "Rules Version", value: result.rulesVersion },
    { label: "Input", value: result.inputType },
    { label: "Status", value: "Completed" },
  ];

  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5" />
          Audit Details
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
              <dd className="font-medium text-foreground text-right max-w-[55%] truncate font-mono text-[11px]">
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
/*  AUDIT TIMELINE                                            */
/* ────────────────────────────────────────────────────────── */

function AuditTimeline({
  timeline,
}: {
  timeline: TimelineEntry[];
}) {
  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-0">
          {timeline.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <div className="relative flex flex-col items-center">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    i === timeline.length - 1
                      ? "bg-emerald-500 dark:bg-emerald-400"
                      : "bg-muted-foreground/30"
                  )}
                />
                {i < timeline.length - 1 && (
                  <div className="absolute top-2 w-px h-[calc(100%+4px)] bg-border/40" />
                )}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 w-14">
                {entry.timestamp}
              </span>
              <span className="text-xs text-muted-foreground">
                {entry.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  MISSING STATE                                             */
/* ────────────────────────────────────────────────────────── */

function MissingResultState() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Audit Result Unavailable"
        subtitle="The audit result could not be found."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Audit Result" },
        ]}
      />
      <EmptyState
        icon={AlertTriangle}
        title="Audit result not found"
        description="The audit result is no longer available. This can happen after a page refresh in the current prototype."
        action={
          <PrimaryButton asChild>
            <Link href="/audit/new">
              Start New Audit
              <ArrowRight className="h-4 w-4" />
            </Link>
          </PrimaryButton>
        }
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                 */
/* ────────────────────────────────────────────────────────── */

export default function AuditResultPage() {
  // useSearchParams requires a Suspense boundary on a prerendered route.
  return (
    <React.Suspense fallback={null}>
      <AuditResultPageInner />
    </React.Suspense>
  );
}

function AuditResultPageInner() {
  const searchParams = useSearchParams();
  // Real audits arrive as ?jobId=<uuid>; without it the mock prototype data
  // is shown (kept as the migration path from mock to real data).
  const jobId = searchParams.get("jobId");

  const [toast, setToast] = React.useState<{
    message: string;
    visible: boolean;
  }>({ message: "", visible: false });

  const [result, setResult] = React.useState<AuditResultData | null>(
    jobId ? null : MOCK_AUDIT_RESULT,
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Load the persisted result for a completed audit.
  React.useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    void fetch(`/api/audits/${jobId}/results`, { cache: "no-store" })
      .then(async (res) => {
        const payload: unknown = await res.json().catch(() => null);
        if (cancelled) return;
        if (
          res.ok &&
          typeof payload === "object" &&
          payload !== null &&
          "result" in payload
        ) {
          setResult((payload as { result: AuditResultData }).result);
        } else {
          const message =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Failed to load audit results.";
          setLoadError(message);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Failed to load audit results.");
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // Still loading a real result — render nothing rather than flashing the
  // not-found state.
  if (jobId && !result && !loadError) {
    return null;
  }

  if (loadError || !result) {
    return <MissingResultState />;
  }

  function showToast(msg: string) {
    setToast({ message: msg, visible: true });
  }

  function handleExportJson() {
    const json = buildExportJson(result!);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quantlint-audit-${result!.auditId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("JSON export downloaded successfully.");
  }

  function handleDownloadPdf() {
    showToast(
      "PDF export will be available when report generation is connected."
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <PageHeader
          title="Audit Results"
          subtitle="QuantLint analysis for your quantitative trading strategy."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Audits", href: "/history" },
            { label: result.strategyName },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <SecondaryButton
                size="sm"
                className="text-xs"
                asChild
              >
                <Link href="/audit/new">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Run Again
                </Link>
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                className="text-xs"
                onClick={handleExportJson}
              >
                <FileJson className="h-3.5 w-3.5" />
                Export JSON
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                className="text-xs"
                onClick={handleDownloadPdf}
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </SecondaryButton>
            </div>
          }
        />

        {/* Strategy meta banner */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-foreground">
            {result.strategyName}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs text-muted-foreground">
            {result.fileName}
          </span>
          <span className="text-muted-foreground">·</span>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {result.frameworkLabel}
          </Badge>
          <Badge variant="success" className="text-[10px] font-mono">
            Completed
          </Badge>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Main content */}
          <div className="min-w-0">
            <Tabs defaultValue="overview">
              <TabsList className="overflow-x-auto">
                <TabsIndicator />
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="violations">
                  Violations
                  <span className="ml-1 text-[10px] opacity-60">
                    {result.violations.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="ai">AI Explanation</TabsTrigger>
                <TabsTrigger value="recommendations">
                  Recommendations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <OverviewTab result={result} />
              </TabsContent>

              <TabsContent value="violations" className="mt-6">
                <ViolationsTab
                  violations={result.violations}
                  rulesPassed={result.rulesPassed}
                  onToast={showToast}
                />
              </TabsContent>

              <TabsContent value="metrics" className="mt-6">
                <MetricsTab metricGroups={result.metricGroups} />
              </TabsContent>

              <TabsContent value="ai" className="mt-6">
                <AIExplanationTab explanations={result.aiExplanations} />
              </TabsContent>

              <TabsContent value="recommendations" className="mt-6">
                <RecommendationsTab
                  recommendations={result.recommendations}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <AuditMetadata result={result} />
              <AuditTimeline timeline={result.timeline} />
            </div>
          </aside>
        </div>

        {/* Mobile sidebar content */}
        <div className="lg:hidden space-y-4">
          <AuditMetadata result={result} />
          <AuditTimeline timeline={result.timeline} />
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-4 border-t border-border/40">
          <PrimaryButton asChild>
            <Link href="/audit/new">
              <RotateCcw className="h-4 w-4" />
              Run Another Audit
            </Link>
          </PrimaryButton>
          <SecondaryButton onClick={handleExportJson}>
            <FileJson className="h-4 w-4" />
            Export Results
          </SecondaryButton>
        </div>
      </div>

      <Toast
        message={toast.message}
        visible={toast.visible}
        onClose={() => setToast((s) => ({ ...s, visible: false }))}
      />
    </>
  );
}
