"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  ArrowRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Copy,
  Download,
  RotateCcw,
  FileText,
  Search,
  X,
  BarChart3,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
  History,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import { ScoreBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import {
  useAuditHistory,
  type StatusFilter,
  type FrameworkFilter,
  type ScoreFilter,
  type DateFilter,
  type SortOption,
} from "@/hooks/use-audit-history";
import type {
  AuditHistoryRecord,
  HistoryStatus,
} from "@/lib/mock-data/audit-history";

/* ════════════════════════════════════════════════════════════
   STATUS BADGE (History-specific, maps to HistoryStatus)
   ════════════════════════════════════════════════════════════ */

const HISTORY_STATUS_CONFIG: Record<
  HistoryStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  passed: {
    label: "Passed",
    icon: CheckCircle2,
    className: "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400",
  },
  "needs-review": {
    label: "Needs Review",
    icon: AlertTriangle,
    className: "bg-amber-500/8 text-amber-600 dark:text-amber-400",
  },
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    className: "bg-red-500/8 text-red-600 dark:text-red-400",
  },
  running: {
    label: "Running",
    icon: Loader2,
    className: "bg-foreground/5 text-muted-foreground",
  },
};

function HistoryStatusBadge({ status }: { status: HistoryStatus }) {
  const config = HISTORY_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium font-mono transition-colors",
        config.className
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          status === "running" && "animate-spin"
        )}
      />
      {config.label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
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
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
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
   QUICK ACTION
   ════════════════════════════════════════════════════════════ */

function QuickAction() {
  return (
    <Link href="/audit/new">
      <Card className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200 group cursor-pointer">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 transition-colors group-hover:bg-secondary/80">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Run a new strategy audit
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Validate another strategy against QuantLint&apos;s analysis rules.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════
   SUMMARY METRICS
   ════════════════════════════════════════════════════════════ */

const METRIC_ICONS: Record<string, React.ElementType> = {
  totalAudits: BarChart3,
  averageScore: Target,
  totalIssues: AlertTriangle,
  criticalFindings: ShieldAlert,
};

function SummaryMetrics({
  metrics,
}: {
  metrics: {
    totalAudits: number;
    averageScore: number;
    totalIssues: number;
    criticalFindings: number;
  };
}) {
  const items = [
    {
      key: "totalAudits",
      label: "Total Audits",
      value: metrics.totalAudits.toString(),
    },
    {
      key: "averageScore",
      label: "Average Score",
      value: metrics.averageScore.toFixed(1),
    },
    {
      key: "totalIssues",
      label: "Issues Detected",
      value: metrics.totalIssues.toString(),
    },
    {
      key: "criticalFindings",
      label: "Critical Findings",
      value: metrics.criticalFindings.toString(),
    },
  ];

  return (
    <section aria-label="History summary metrics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const Icon =
            METRIC_ICONS[item.key as keyof typeof METRIC_ICONS] ?? BarChart3;
          return (
            <Card
              key={item.key}
              className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200 group"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-[11px] font-mono uppercase tracking-wider">
                    {item.label}
                  </CardDescription>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 transition-colors group-hover:bg-secondary/80">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {item.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   FILTER SELECT
   ════════════════════════════════════════════════════════════ */

function FilterSelect<T extends string>({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id: string;
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          "flex h-9 w-full rounded-lg border border-border/60 bg-background px-3",
          "text-sm text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "transition-colors appearance-none cursor-pointer"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FILTERS + SEARCH BAR
   ════════════════════════════════════════════════════════════ */

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "passed", label: "Passed" },
  { value: "needs-review", label: "Needs Review" },
  { value: "critical", label: "Critical" },
  { value: "running", label: "Running" },
];

const FRAMEWORK_OPTIONS: { value: FrameworkFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "vectorbt", label: "vectorbt" },
  { value: "Backtrader", label: "Backtrader" },
  { value: "Zipline", label: "Zipline" },
  { value: "Pandas / Custom", label: "Pandas / Custom" },
];

const SCORE_OPTIONS: { value: ScoreFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "90-100", label: "90 – 100" },
  { value: "80-89", label: "80 – 89" },
  { value: "70-79", label: "70 – 79" },
  { value: "below-70", label: "Below 70" },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "score-high", label: "Highest Score" },
  { value: "score-low", label: "Lowest Score" },
  { value: "issues-most", label: "Most Issues" },
  { value: "issues-least", label: "Fewest Issues" },
  { value: "name-az", label: "A → Z" },
  { value: "name-za", label: "Z → A" },
];

type FiltersBarProps = {
  search: string;
  onSearchChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  framework: FrameworkFilter;
  onFrameworkChange: (v: FrameworkFilter) => void;
  score: ScoreFilter;
  onScoreChange: (v: ScoreFilter) => void;
  date: DateFilter;
  onDateChange: (v: DateFilter) => void;
  sort: SortOption;
  onSortChange: (v: SortOption) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
};

function FiltersBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  framework,
  onFrameworkChange,
  score,
  onScoreChange,
  date,
  onDateChange,
  sort,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
  filteredCount,
  totalCount,
}: FiltersBarProps) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  return (
    <section aria-label="Search and filters" className="space-y-4">
      {/* Search row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1 max-w-lg">
          <label htmlFor="audit-search" className="sr-only">
            Search audits
          </label>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="audit-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search strategies, frameworks, or audit IDs..."
            className={cn(
              "flex h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-9",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "transition-colors"
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 h-9 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors",
              filtersOpen && "border-border text-foreground"
            )}
            aria-expanded={filtersOpen}
            aria-controls="history-filters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background text-[9px] font-bold">
                ●
              </span>
            )}
          </button>

          {/* Sort (always visible) */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              aria-label="Sort audits"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className={cn(
                "h-9 rounded-lg border border-border/60 bg-background px-2 pr-6",
                "text-xs text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "transition-colors appearance-none cursor-pointer"
              )}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter dropdowns (collapsible) */}
      {filtersOpen && (
        <div
          id="history-filters"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-border/40 bg-card/30 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <FilterSelect
            label="Status"
            id="filter-status"
            value={status}
            onChange={onStatusChange}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            label="Framework"
            id="filter-framework"
            value={framework}
            onChange={onFrameworkChange}
            options={FRAMEWORK_OPTIONS}
          />
          <FilterSelect
            label="Score"
            id="filter-score"
            value={score}
            onChange={onScoreChange}
            options={SCORE_OPTIONS}
          />
          <FilterSelect
            label="Date"
            id="filter-date"
            value={date}
            onChange={onDateChange}
            options={DATE_OPTIONS}
          />
        </div>
      )}

      {/* Result count + clear */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-mono tabular-nums">
          Showing {filteredCount} of {totalCount} audits
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   ROW ACTION MENU (three-dot menu)
   ════════════════════════════════════════════════════════════ */

function RowActionMenu({
  audit,
  onCopyId,
  onDownloadJson,
}: {
  audit: AuditHistoryRecord;
  onCopyId: (id: string) => void;
  onDownloadJson: (audit: AuditHistoryRecord) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        aria-label={`More actions for ${audit.strategyName}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-border/60 bg-card shadow-lg shadow-black/8 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <Link
            href={`/report/${audit.id}`}
            className="flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary/50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            View Report
          </Link>
          <Link
            href="/audit/new"
            className="flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary/50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            Run Again
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary/50 transition-colors"
            onClick={() => {
              onCopyId(audit.id);
              setOpen(false);
            }}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            Copy Audit ID
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary/50 transition-colors"
            onClick={() => {
              onDownloadJson(audit);
              setOpen(false);
            }}
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            Download JSON
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AUDIT HISTORY TABLE (Desktop)
   ════════════════════════════════════════════════════════════ */

function AuditHistoryTable({
  audits,
  onCopyId,
  onDownloadJson,
}: {
  audits: AuditHistoryRecord[];
  onCopyId: (id: string) => void;
  onDownloadJson: (audit: AuditHistoryRecord) => void;
}) {
  return (
    <div className="hidden md:block overflow-hidden rounded-xl border border-border/40 bg-card/40">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Strategy
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Framework
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Score
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Issues
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Date
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Audit ID
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {audits.map((audit) => (
              <tr
                key={audit.id}
                className="transition-colors hover:bg-card/60"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {audit.strategyName}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {audit.fileName}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {audit.framework}
                </td>
                <td className="px-4 py-3">
                  {audit.score !== null ? (
                    <ScoreBadge score={audit.score} />
                  ) : (
                    <span className="text-muted-foreground font-mono">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono tabular-nums">
                  {audit.issues}
                </td>
                <td className="px-4 py-3">
                  <HistoryStatusBadge status={audit.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(audit.createdAt), {
                    addSuffix: true,
                  })}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {audit.id}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/report/${audit.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View Report
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                    <RowActionMenu
                      audit={audit}
                      onCopyId={onCopyId}
                      onDownloadJson={onDownloadJson}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AUDIT HISTORY MOBILE CARDS
   ════════════════════════════════════════════════════════════ */

function AuditHistoryMobileCards({
  audits,
  onCopyId,
  onDownloadJson,
}: {
  audits: AuditHistoryRecord[];
  onCopyId: (id: string) => void;
  onDownloadJson: (audit: AuditHistoryRecord) => void;
}) {
  return (
    <div className="md:hidden space-y-3">
      {audits.map((audit) => (
        <Card
          key={audit.id}
          className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200"
        >
          <CardContent className="p-4 space-y-3">
            {/* Top: Name + Status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {audit.strategyName}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {audit.framework} · {audit.id}
                </p>
              </div>
              <HistoryStatusBadge status={audit.status} />
            </div>

            {/* Middle: Score + Issues + Date */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                {audit.score !== null ? (
                  <ScoreBadge score={audit.score} />
                ) : (
                  <span className="font-mono">—</span>
                )}
                <span className="font-mono tabular-nums">
                  {audit.issues} issue{audit.issues !== 1 ? "s" : ""}
                </span>
              </div>
              <span>
                {formatDistanceToNow(new Date(audit.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>

            {/* Bottom: Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-border/30">
              <Link
                href={`/report/${audit.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                View Report
                <ArrowRight className="h-3 w-3" />
              </Link>
              <RowActionMenu
                audit={audit}
                onCopyId={onCopyId}
                onDownloadJson={onDownloadJson}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGINATION
   ════════════════════════════════════════════════════════════ */

function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  // Build page numbers to show (max 5 visible)
  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Page size */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <label htmlFor="page-size">Rows per page</label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className={cn(
            "h-8 rounded-lg border border-border/60 bg-background px-2",
            "text-xs text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "transition-colors appearance-none cursor-pointer"
          )}
        >
          {[10, 25, 50].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {/* Page numbers */}
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-mono tabular-nums transition-colors",
              p === page
                ? "bg-foreground text-background font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   NO RESULTS STATE
   ════════════════════════════════════════════════════════════ */

function NoResultsState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No matching audits"
      description="Try changing your search or filters."
      action={
        <SecondaryButton onClick={onClearFilters} className="text-xs px-4">
          Clear Filters
        </SecondaryButton>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════
   EMPTY HISTORY STATE
   ════════════════════════════════════════════════════════════ */

function EmptyHistoryState() {
  return (
    <EmptyState
      icon={History}
      title="No audits yet"
      description="Your completed strategy audits will appear here."
      action={
        <PrimaryButton asChild>
          <Link href="/audit/new">
            <Plus className="h-4 w-4" />
            Start Your First Audit
          </Link>
        </PrimaryButton>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */

export default function HistoryPage() {
  const {
    allRecords,
    filteredRecords,
    paginatedRecords,
    metrics,
    filters,
    totalPages,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useAuditHistory();

  const [toastMessage, setToastMessage] = React.useState("");
  const [toastVisible, setToastVisible] = React.useState(false);

  const showToast = React.useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  }, []);

  const handleCopyId = React.useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(id);
        showToast("Audit ID copied.");
      } catch {
        showToast("Failed to copy.");
      }
    },
    [showToast]
  );

  const handleDownloadJson = React.useCallback(
    (audit: AuditHistoryRecord) => {
      const blob = new Blob([JSON.stringify(audit, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quantlint-audit-${audit.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${audit.id}.json`);
    },
    [showToast]
  );

  const isEmpty = allRecords.length === 0;
  const noResults = !isEmpty && filteredRecords.length === 0;

  return (
    <>
      <div className="space-y-8">
        {/* 1. Page Header */}
        <PageHeader
          title="Audit History"
          subtitle="Review, compare, and revisit your previous strategy audits."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Audit History" },
          ]}
          actions={
            <PrimaryButton size="sm" className="text-xs px-4" asChild>
              <Link href="/audit/new">
                <Plus className="h-3.5 w-3.5" />
                New Audit
              </Link>
            </PrimaryButton>
          }
        />

        {isEmpty ? (
          /* 16. Empty History */
          <EmptyHistoryState />
        ) : (
          <>
            {/* 2. Quick Action */}
            <QuickAction />

            {/* 3. Summary Metrics */}
            <SummaryMetrics metrics={metrics} />

            {/* 4–6. Search + Filters + Result Count */}
            <FiltersBar
              search={filters.search}
              onSearchChange={(v) => setFilter("search", v)}
              status={filters.status}
              onStatusChange={(v) => setFilter("status", v)}
              framework={filters.framework}
              onFrameworkChange={(v) => setFilter("framework", v)}
              score={filters.score}
              onScoreChange={(v) => setFilter("score", v)}
              date={filters.date}
              onDateChange={(v) => setFilter("date", v)}
              sort={filters.sort}
              onSortChange={(v) => setFilter("sort", v)}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              filteredCount={filteredRecords.length}
              totalCount={allRecords.length}
            />

            {noResults ? (
              /* 17. No Results State */
              <NoResultsState onClearFilters={clearFilters} />
            ) : (
              <>
                {/* 7. Desktop Table */}
                <AuditHistoryTable
                  audits={paginatedRecords}
                  onCopyId={handleCopyId}
                  onDownloadJson={handleDownloadJson}
                />

                {/* 12. Mobile Cards */}
                <AuditHistoryMobileCards
                  audits={paginatedRecords}
                  onCopyId={handleCopyId}
                  onDownloadJson={handleDownloadJson}
                />

                {/* 14–15. Pagination */}
                <Pagination
                  page={filters.page}
                  totalPages={totalPages}
                  pageSize={filters.pageSize}
                  onPageChange={(p) => setFilter("page", p)}
                  onPageSizeChange={(s) => setFilter("pageSize", s)}
                />
              </>
            )}
          </>
        )}
      </div>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
    </>
  );
}
