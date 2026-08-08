"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Download,
  FileJson,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Sparkles,
  Clock,
  FileText,
  Target,
  BarChart3,
  ListChecks,
  BookOpen,
  Info,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import { ScoreBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import {
  getAuditResultById,
  buildExportJson,
  type AuditResultData,
  type Violation,
  type ViolationSeverity,
  type MetricGroup,
  type AIExplanation,
  type Recommendation,
  type TimelineEntry,
  type RuleCoverageCategory,
} from "@/lib/mock-data/audit-result";

/* ════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════ */

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
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
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

/* ════════════════════════════════════════════════════════════
   SEVERITY HELPERS
   ════════════════════════════════════════════════════════════ */

const SEVERITY_CONFIG: Record<
  ViolationSeverity,
  { label: string; icon: React.ElementType; className: string; badgeVariant: string }
> = {
  critical: {
    label: "Critical",
    icon: XCircle,
    className: "text-red-600 dark:text-red-400",
    badgeVariant: "bg-red-500/8 text-red-600 dark:text-red-400",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    className: "text-amber-600 dark:text-amber-400",
    badgeVariant: "bg-amber-500/8 text-amber-600 dark:text-amber-400",
  },
  info: {
    label: "Info",
    icon: Info,
    className: "text-muted-foreground",
    badgeVariant: "bg-foreground/5 text-muted-foreground",
  },
};

function SeverityBadge({ severity }: { severity: ViolationSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium font-mono",
        config.badgeVariant
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   REPORT NAVIGATION
   ════════════════════════════════════════════════════════════ */

const REPORT_SECTIONS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "findings", label: "Findings", icon: Shield },
  { id: "metrics", label: "Metrics", icon: BarChart3 },
  { id: "rules", label: "Rules", icon: ListChecks },
  { id: "ai-analysis", label: "AI Analysis", icon: Sparkles },
  { id: "recommendations", label: "Recommendations", icon: Target },
  { id: "audit-details", label: "Audit Details", icon: Clock },
];

function ReportNavigation({ activeSection }: { activeSection: string }) {
  return (
    <nav
      aria-label="Report sections"
      className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border/40 -mx-4 px-4 sm:-mx-0 sm:px-0"
    >
      <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
        {REPORT_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {section.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

/* ════════════════════════════════════════════════════════════
   REPORT HEADER
   ════════════════════════════════════════════════════════════ */

function ReportHeader({
  result,
  onExportJson,
  onDownloadPdf,
}: {
  result: AuditResultData;
  onExportJson: () => void;
  onDownloadPdf: () => void;
}) {
  return (
    <header className="space-y-4">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs font-mono"
      >
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-muted-foreground/50">›</span>
        <Link
          href="/history"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          History
        </Link>
        <span className="text-muted-foreground/50">›</span>
        <span className="text-foreground">Report</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            QuantLint Audit Report
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {result.strategyName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">{result.fileName}</span>
            <span className="text-border">·</span>
            <span className="font-mono">{result.frameworkLabel}</span>
            <span className="text-border">·</span>
            <span className="font-mono">{result.auditId}</span>
            <span className="text-border">·</span>
            <Badge
              variant="success"
              className="font-mono text-[10px]"
            >
              Completed
            </Badge>
            <span>{format(new Date(result.completedAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 flex-wrap">
          <SecondaryButton size="sm" className="text-xs px-3" asChild>
            <Link href="/audit/new">
              <RotateCcw className="h-3.5 w-3.5" />
              Run Again
            </Link>
          </SecondaryButton>
          <SecondaryButton
            size="sm"
            className="text-xs px-3"
            onClick={onExportJson}
          >
            <FileJson className="h-3.5 w-3.5" />
            Export JSON
          </SecondaryButton>
          <SecondaryButton
            size="sm"
            className="text-xs px-3"
            onClick={onDownloadPdf}
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </SecondaryButton>
        </div>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   EXECUTIVE SUMMARY
   ════════════════════════════════════════════════════════════ */

function ExecutiveSummary({ text }: { text: string }) {
  // Split into sentences for better rendering
  const sentences = text.split(". ").filter(Boolean);

  return (
    <section id="overview" aria-label="Executive Summary" className="scroll-mt-16">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Executive Summary
        </h2>
        <Card className="border-border/40 bg-card/40">
          <CardContent className="p-6 space-y-3">
            {sentences.map((sentence, i) => {
              const isRecommendation = sentence.startsWith("Recommendation");
              return (
                <p
                  key={i}
                  className={cn(
                    "text-sm leading-relaxed",
                    isRecommendation
                      ? "font-medium text-foreground border-l-2 border-amber-500/60 pl-3"
                      : "text-muted-foreground"
                  )}
                >
                  {sentence}
                  {!sentence.endsWith(".") ? "." : ""}
                </p>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   AUDIT SCORE BLOCK
   ════════════════════════════════════════════════════════════ */

function AuditScoreBlock({ result }: { result: AuditResultData }) {
  // SVG arc for score
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (result.score / 100) * circumference;
  const strokeColor =
    result.score >= 90
      ? "stroke-emerald-500"
      : result.score >= 75
        ? "stroke-amber-500"
        : "stroke-red-500";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Score visual */}
      <Card className="border-border/40 bg-card/40 lg:col-span-2">
        <CardContent className="p-6 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <svg
              width="140"
              height="140"
              viewBox="0 0 140 140"
              className="transform -rotate-90"
            >
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                className="stroke-border/30"
                strokeWidth="8"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                className={strokeColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums text-foreground">
                {result.score}
              </span>
              <span className="text-xs text-muted-foreground font-mono">/100</span>
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-foreground">
              Grade: {result.grade}
            </p>
            <p className="text-xs text-muted-foreground">
              {result.gradeStatus}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary metrics */}
      <div className="lg:col-span-3 grid grid-cols-2 gap-4">
        {[
          { label: "Rules Checked", value: result.rulesChecked, icon: ListChecks },
          { label: "Passed", value: result.rulesPassed, icon: CheckCircle2 },
          { label: "Warnings", value: result.warnings, icon: AlertTriangle },
          { label: "Critical", value: result.critical, icon: XCircle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className="border-border/40 bg-card/40"
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {item.value}
                  </p>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FINDINGS SECTION
   ════════════════════════════════════════════════════════════ */

function FindingsSection({ violations }: { violations: Violation[] }) {
  const critical = violations.filter((v) => v.severity === "critical");
  const warnings = violations.filter((v) => v.severity === "warning");
  const passed =
    317 - violations.length; // Derive from rulesChecked minus violations

  return (
    <section id="findings" aria-label="Findings" className="space-y-6 scroll-mt-16">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Findings
      </h2>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Critical",
            count: critical.length,
            icon: XCircle,
            color: "text-red-600 dark:text-red-400",
            bg: "bg-red-500/8",
          },
          {
            label: "Warnings",
            count: warnings.length,
            icon: AlertTriangle,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/8",
          },
          {
            label: "Passed",
            count: passed,
            icon: CheckCircle2,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/8",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="border-border/40 bg-card/40">
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    item.bg
                  )}
                >
                  <Icon className={cn("h-4 w-4", item.color)} />
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {item.count}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Priority findings list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Priority Findings
        </h3>
        <div className="space-y-2">
          {[...critical, ...warnings.slice(0, 5)].map((v) => (
            <div
              key={v.id}
              className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 p-4 hover:bg-card/60 transition-colors"
            >
              <SeverityBadge severity={v.severity} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{v.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{v.ruleId}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed findings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          Detailed Findings
        </h3>

        {[...critical, ...warnings].map((v) => (
          <Card key={v.id} className="border-border/40 bg-card/40">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {v.ruleId}
                    </span>
                    {v.title}
                  </CardTitle>
                </div>
                <SeverityBadge severity={v.severity} />
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              {/* Description */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Description
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {v.description}
                </p>
              </div>

              {/* Why it matters */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Why It Matters
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {v.whyItMatters}
                </p>
              </div>

              {/* Location */}
              {v.file && v.line && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Detected Location
                  </p>
                  <p className="text-sm font-mono text-foreground">
                    {v.file}:{v.line}
                  </p>
                </div>
              )}

              {/* Detected pattern */}
              {v.codeSnippet && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Detected Pattern
                  </p>
                  <div className="rounded-lg bg-muted/40 border border-border/40 p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre">
                      {v.codeSnippet}
                    </pre>
                  </div>
                </div>
              )}

              {/* Suggested fix */}
              {v.suggestedFix && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Suggested Fix
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {v.suggestedFix}
                  </p>
                </div>
              )}

              {v.fixSnippet && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Suggested Example
                  </p>
                  <div className="rounded-lg bg-muted/40 border border-border/40 p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-emerald-600 dark:text-emerald-400 whitespace-pre">
                      {v.fixSnippet}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   FINANCIAL METRICS SECTION
   ════════════════════════════════════════════════════════════ */

function MetricsSection({ groups }: { groups: MetricGroup[] }) {
  return (
    <section id="metrics" aria-label="Performance Metrics" className="space-y-6 scroll-mt-16">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Performance Metrics
      </h2>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.label} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {group.label}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {group.metrics.map((metric) => (
                <Card
                  key={metric.key}
                  className="border-border/40 bg-card/40 group"
                >
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xl font-semibold tabular-nums text-foreground">
                      {metric.value}
                    </p>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {metric.label}
                      </p>
                      <div className="relative group/tooltip">
                        <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 pointer-events-none z-50">
                          {metric.tooltip}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/60 font-mono">
        All metrics are derived from mock demonstration data. Not financial advice.
      </p>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   RULE COVERAGE SECTION
   ════════════════════════════════════════════════════════════ */

function RuleCoverageSection({
  coverage,
}: {
  coverage: RuleCoverageCategory[];
}) {
  return (
    <section id="rules" aria-label="Rule Coverage" className="space-y-6 scroll-mt-16">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Rule Coverage
      </h2>

      <Card className="border-border/40 bg-card/40">
        <CardContent className="p-5 space-y-4">
          {coverage.map((cat) => {
            const pct = Math.round((cat.passed / cat.checked) * 100);
            const needsAttention = cat.checked - cat.passed;
            return (
              <div key={cat.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {cat.label}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground text-xs">
                    {cat.passed} / {cat.checked}
                    {needsAttention > 0 && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">
                        ({needsAttention} to review)
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border/30 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      pct === 100
                        ? "bg-emerald-500"
                        : pct >= 90
                          ? "bg-emerald-500/80"
                          : pct >= 80
                            ? "bg-amber-500"
                            : "bg-red-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   AI ANALYSIS SECTION
   ════════════════════════════════════════════════════════════ */

function AIAnalysisSection({
  explanations,
}: {
  explanations: AIExplanation[];
}) {
  return (
    <section id="ai-analysis" aria-label="AI Analysis" className="space-y-6 scroll-mt-16">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          AI Analysis
        </h2>
        <Badge variant="secondary" className="text-[10px] font-mono">
          AI-generated
        </Badge>
      </div>

      <div className="space-y-4">
        {explanations.map((ai) => (
          <Card key={ai.id} className="border-border/40 bg-card/40">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                  <CardTitle className="text-sm">{ai.finding}</CardTitle>
                </div>
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                  Confidence: {ai.confidence}%
                </span>
              </div>
              <CardDescription className="text-xs font-mono">
                {ai.ruleId}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Explanation
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {ai.explanation}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Why This Matters
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {ai.whyItMatters}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Suggested Remediation
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {ai.suggestedFix}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/60 font-mono leading-relaxed">
        AI-generated explanations are provided as development assistance and should be reviewed by a qualified researcher.
      </p>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   RECOMMENDATIONS SECTION
   ════════════════════════════════════════════════════════════ */

function RecommendationsSection({
  recommendations,
  onStatusChange,
}: {
  recommendations: Recommendation[];
  onStatusChange: (id: string, status: Recommendation["status"]) => void;
}) {
  const statusOptions: Recommendation["status"][] = [
    "open",
    "resolved",
    "ignored",
  ];
  const statusConfig: Record<
    Recommendation["status"],
    { label: string; className: string }
  > = {
    open: {
      label: "Open",
      className: "bg-amber-500/8 text-amber-600 dark:text-amber-400",
    },
    resolved: {
      label: "Resolved",
      className: "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400",
    },
    ignored: {
      label: "Ignored",
      className: "bg-foreground/5 text-muted-foreground",
    },
  };

  return (
    <section
      id="recommendations"
      aria-label="Recommendations"
      className="space-y-6 scroll-mt-16"
    >
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Recommended Actions
      </h2>

      <div className="space-y-3">
        {recommendations.map((rec) => {
          const currentStatus = statusConfig[rec.status];
          return (
            <Card key={rec.id} className="border-border/40 bg-card/40">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/50 text-xs font-mono font-bold tabular-nums text-muted-foreground">
                      {rec.priority}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {rec.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={rec.severity} />
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {rec.relatedRuleId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status selector */}
                  <select
                    value={rec.status}
                    onChange={(e) =>
                      onStatusChange(
                        rec.id,
                        e.target.value as Recommendation["status"]
                      )
                    }
                    aria-label={`Status for ${rec.title}`}
                    className={cn(
                      "h-7 rounded-full px-2.5 text-[10px] font-medium font-mono border-0 cursor-pointer appearance-none",
                      currentStatus.className
                    )}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {statusConfig[s].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 pl-10">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Why
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {rec.why}
                  </p>
                </div>

                <div className="space-y-1.5 pl-10">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Action
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {rec.suggestedAction}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   AUDIT TIMELINE SECTION
   ════════════════════════════════════════════════════════════ */

function AuditTimelineSection({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Audit Timeline
      </h3>
      <Card className="border-border/40 bg-card/40">
        <CardContent className="p-5">
          <ol className="relative border-l border-border/40 ml-3 space-y-4">
            {timeline.map((entry, i) => {
              const isLast = i === timeline.length - 1;
              return (
                <li key={i} className="ml-6">
                  <div
                    className={cn(
                      "absolute -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-background",
                      isLast ? "bg-emerald-500" : "bg-border"
                    )}
                    style={{ top: `${i * 56 + 8}px` }}
                  />
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground min-w-[64px]">
                      {entry.timestamp}
                    </span>
                    <span className="text-sm text-foreground">
                      {entry.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AUDIT METADATA SECTION
   ════════════════════════════════════════════════════════════ */

function AuditMetadataSection({ result }: { result: AuditResultData }) {
  const fields = [
    { label: "Audit ID", value: result.auditId },
    { label: "Strategy", value: result.strategyName },
    { label: "Filename", value: result.fileName },
    { label: "Framework", value: result.frameworkLabel },
    { label: "Analysis Depth", value: result.analysisDepth },
    { label: "Rules Version", value: result.rulesVersion },
    {
      label: "Created",
      value: format(new Date(result.createdAt), "MMM d, yyyy HH:mm"),
    },
    {
      label: "Completed",
      value: format(new Date(result.completedAt), "MMM d, yyyy HH:mm"),
    },
    { label: "Input", value: result.inputType },
  ];

  return (
    <section id="audit-details" aria-label="Audit Details" className="space-y-6 scroll-mt-16">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Audit Details
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/40 bg-card/40">
          <CardContent className="p-5">
            <dl className="space-y-3">
              {fields.map((field) => (
                <div key={field.label} className="flex justify-between gap-4">
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="text-xs font-mono text-foreground text-right truncate max-w-[60%]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <AuditTimelineSection timeline={result.timeline} />
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   REPORT FOOTER
   ════════════════════════════════════════════════════════════ */

function ReportFooter({ result }: { result: AuditResultData }) {
  return (
    <footer className="border-t border-border/40 pt-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">QuantLint</p>
          <p className="text-xs text-muted-foreground">
            Quality assurance for quantitative trading.
          </p>
          <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
            <span>Audit ID: {result.auditId}</span>
            <span className="text-border">·</span>
            <span>
              Generated:{" "}
              {format(new Date(result.completedAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton size="sm" className="text-xs px-4" asChild>
            <Link href="/history">
              <History className="h-3.5 w-3.5" />
              Back to History
            </Link>
          </SecondaryButton>
          <PrimaryButton size="sm" className="text-xs px-4" asChild>
            <Link href="/audit/new">
              <Plus className="h-3.5 w-3.5" />
              Run Another Audit
            </Link>
          </PrimaryButton>
        </div>
      </div>
    </footer>
  );
}

/* ════════════════════════════════════════════════════════════
   REPORT NOT FOUND
   ════════════════════════════════════════════════════════════ */

function ReportNotFound() {
  return (
    <div className="space-y-8">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs font-mono"
      >
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-muted-foreground/50">›</span>
        <Link
          href="/history"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          History
        </Link>
        <span className="text-muted-foreground/50">›</span>
        <span className="text-foreground">Report</span>
      </nav>

      <EmptyState
        icon={FileText}
        title="Report Not Found"
        description="The audit report you're looking for could not be found."
        action={
          <div className="flex items-center gap-2">
            <PrimaryButton size="sm" className="text-xs px-4" asChild>
              <Link href="/audit/new">Start New Audit</Link>
            </PrimaryButton>
            <SecondaryButton size="sm" className="text-xs px-4" asChild>
              <Link href="/history">Back to History</Link>
            </SecondaryButton>
          </div>
        }
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN REPORT PAGE
   ════════════════════════════════════════════════════════════ */

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const reportId = params.id;

  const result = getAuditResultById(reportId);

  const [activeSection, setActiveSection] = React.useState("overview");
  const [toastMessage, setToastMessage] = React.useState("");
  const [toastVisible, setToastVisible] = React.useState(false);

  // Local recommendation status state (not persisted)
  const [recommendations, setRecommendations] = React.useState(
    result?.recommendations ?? []
  );

  const showToast = React.useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  }, []);

  // Intersection Observer for active section tracking
  React.useEffect(() => {
    if (!result) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    REPORT_SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [result]);

  const handleExportJson = React.useCallback(() => {
    if (!result) return;
    const json = buildExportJson(result);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quantlint-audit-${result.auditId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("JSON export downloaded.");
  }, [result, showToast]);

  const handleDownloadPdf = React.useCallback(() => {
    showToast(
      "PDF export will be available when report generation is connected."
    );
  }, [showToast]);

  const handleStatusChange = React.useCallback(
    (id: string, status: Recommendation["status"]) => {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    },
    []
  );

  if (!result) {
    return (
      <>
        <ReportNotFound />
      </>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-10">
        <ReportHeader
          result={result}
          onExportJson={handleExportJson}
          onDownloadPdf={handleDownloadPdf}
        />

        <ReportNavigation activeSection={activeSection} />

        <ExecutiveSummary text={result.executiveSummary} />

        <AuditScoreBlock result={result} />

        <FindingsSection violations={result.violations} />

        <MetricsSection groups={result.metricGroups} />

        <RuleCoverageSection coverage={result.ruleCoverage} />

        <AIAnalysisSection explanations={result.aiExplanations} />

        <RecommendationsSection
          recommendations={recommendations}
          onStatusChange={handleStatusChange}
        />

        <AuditMetadataSection result={result} />

        <ReportFooter result={result} />
      </div>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
    </>
  );
}
