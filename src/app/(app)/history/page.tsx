"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  ArrowRight,
  BarChart3,
  FileText,
  AlertTriangle,
  Shield,
  Copy,
  Trash2,
  Search,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import { StatusBadge } from "@/components/app/badges";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { useAuditsList } from "@/hooks/use-audits-list";
import type { AuditListItem } from "@/lib/audits/service";

const METRIC_ICONS = {
  totalAudits: BarChart3,
  averageScore: Shield,
  totalIssues: AlertTriangle,
  criticalFindings: FileText,
} as const;

/* ── Score badge (real computed score; dash before completion) ── */

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 75
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
  return (
    <span className={cn("font-mono text-xs font-semibold tabular-nums", color)}>
      {score}
      <span className="text-muted-foreground/60">/100</span>
    </span>
  );
}

/* ── Summary metrics (real, from the API) ──────────────────── */

function HistoryMetrics({
  summary,
}: {
  summary: {
    totalAudits: number;
    averageScore: number | null;
    totalIssues: number;
    criticalFindings: number;
  } | null;
}) {
  const items = [
    { key: "totalAudits", label: "Total Audits", value: summary ? String(summary.totalAudits) : "—" },
    {
      key: "averageScore",
      label: "Average Score",
      value: summary?.averageScore != null ? summary.averageScore.toFixed(1) : "—",
    },
    { key: "totalIssues", label: "Issues Detected", value: summary ? String(summary.totalIssues) : "—" },
    {
      key: "criticalFindings",
      label: "Critical Findings",
      value: summary ? String(summary.criticalFindings) : "—",
    },
  ];

  return (
    <section aria-label="History summary metrics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const Icon = METRIC_ICONS[item.key as keyof typeof METRIC_ICONS] ?? BarChart3;
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

/* ── Filter select ─────────────────────────────────────────── */

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
          "transition-colors appearance-none cursor-pointer",
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

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
] as const;

const FRAMEWORK_OPTIONS = [
  { value: "all", label: "All" },
  { value: "auto", label: "Auto Detect" },
  { value: "vectorbt", label: "vectorbt" },
  { value: "backtrader", label: "Backtrader" },
  { value: "zipline", label: "Zipline" },
  { value: "pandas", label: "Pandas / Custom" },
] as const;

const DATE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7days", label: "Last 7 days" },
  { value: "30days", label: "Last 30 days" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-az", label: "Name A→Z" },
  { value: "name-za", label: "Name Z→A" },
] as const;

/* ── Row actions ───────────────────────────────────────────── */

function RowActions({
  audit,
  onCopyId,
  onDelete,
}: {
  audit: AuditListItem;
  onCopyId: (id: string) => void;
  onDelete: (audit: AuditListItem) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onCopyId(audit.id)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="Copy audit ID"
      >
        <Copy className="h-3 w-3" />
        Copy ID
      </button>
      <button
        type="button"
        onClick={() => onDelete(audit)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
        title="Delete audit"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    </div>
  );
}

function auditHref(audit: AuditListItem): string {
  return audit.status === "queued" || audit.status === "running"
    ? `/audit/running?jobId=${encodeURIComponent(audit.id)}`
    : `/audit/result?jobId=${encodeURIComponent(audit.id)}`;
}

/* ── Desktop table ─────────────────────────────────────────── */

function AuditTable({
  audits,
  onCopyId,
  onDelete,
}: {
  audits: AuditListItem[];
  onCopyId: (id: string) => void;
  onDelete: (audit: AuditListItem) => void;
}) {
  return (
    <div className="hidden md:block overflow-hidden rounded-xl border border-border/40 bg-card/40">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              {["Strategy", "Framework", "Score", "Issues", "Status", "Date", "Audit ID"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium"
                  >
                    {heading}
                  </th>
                ),
              )}
              <th className="px-4 py-3 text-right text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {audits.map((audit) => (
              <tr key={audit.id} className="transition-colors hover:bg-card/60">
                <td className="px-4 py-3">
                  <Link href={auditHref(audit)} className="group/link">
                    <p className="font-medium text-foreground text-sm group-hover/link:underline">
                      {audit.strategyName}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {audit.fileName ?? "Pasted code"}
                    </p>
                  </Link>
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
                <td className="px-4 py-3">
                  <span className="text-muted-foreground font-mono tabular-nums">
                    {audit.violations.total}
                  </span>
                  {audit.violations.critical > 0 && (
                    <span className="ml-1.5 text-[11px] font-mono text-red-600 dark:text-red-400">
                      {audit.violations.critical} crit
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={audit.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {audit.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={auditHref(audit)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Open
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                    <RowActions audit={audit} onCopyId={onCopyId} onDelete={onDelete} />
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

/* ── Mobile cards ──────────────────────────────────────────── */

function AuditMobileCards({
  audits,
  onCopyId,
  onDelete,
}: {
  audits: AuditListItem[];
  onCopyId: (id: string) => void;
  onDelete: (audit: AuditListItem) => void;
}) {
  return (
    <div className="md:hidden space-y-3">
      {audits.map((audit) => (
        <Card
          key={audit.id}
          className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200"
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={auditHref(audit)}>
                  <p className="text-sm font-medium text-foreground truncate">
                    {audit.strategyName}
                  </p>
                </Link>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {audit.framework} · {audit.id.slice(0, 8)}…
                </p>
              </div>
              <StatusBadge status={audit.status} />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                {audit.score !== null ? (
                  <ScoreBadge score={audit.score} />
                ) : (
                  <span className="font-mono">—</span>
                )}
                <span className="font-mono tabular-nums">
                  {audit.violations.total} issue{audit.violations.total !== 1 ? "s" : ""}
                </span>
              </div>
              <span>
                {formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/30">
              <Link
                href={auditHref(audit)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Open
                <ArrowRight className="h-3 w-3" />
              </Link>
              <RowActions audit={audit} onCopyId={onCopyId} onDelete={onDelete} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Pagination ────────────────────────────────────────────── */

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground font-mono">
        Showing {from}–{to} of {total}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-3 text-xs font-mono text-muted-foreground tabular-nums">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

/* ── MAIN PAGE ─────────────────────────────────────────────── */

export default function HistoryPage() {
  const {
    audits,
    pagination,
    summary,
    loading,
    error,
    filters,
    totalPages,
    setFilter,
    clearFilters,
    refresh,
    hasActiveFilters,
  } = useAuditsList();

  const [toast, setToast] = React.useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });
  const [deleteTarget, setDeleteTarget] = React.useState<AuditListItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const showToast = React.useCallback((message: string) => {
    setToast({ message, visible: true });
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
    [showToast],
  );

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/audits/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("Failed to delete the audit.");
        return;
      }
      showToast("Audit deleted.");
      setDeleteTarget(null);
      refresh();
    } catch {
      showToast("Failed to delete the audit.");
    } finally {
      setDeleting(false);
    }
  }

  const isEmpty = !loading && !error && (pagination?.total ?? 0) === 0 && !hasActiveFilters;
  const noResults = !loading && !error && (pagination?.total ?? 0) === 0 && hasActiveFilters;

  return (
    <>
      <div className="space-y-8">
        <PageHeader
          title="Audit History"
          subtitle="Review, compare, and revisit your previous strategy audits."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Audit History" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <SecondaryButton size="sm" className="text-xs" onClick={refresh}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </SecondaryButton>
              <PrimaryButton size="sm" className="text-xs px-4" asChild>
                <Link href="/audit/new">
                  <Plus className="h-3.5 w-3.5" />
                  New Audit
                </Link>
              </PrimaryButton>
            </div>
          }
        />

        {/* Summary metrics */}
        <HistoryMetrics summary={summary} />

        {/* Filters */}
        <section aria-label="Filters">
          <Card className="border-border/40 bg-card/40">
            <CardContent className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilter("search", e.target.value)}
                  placeholder="Search strategy names…"
                  aria-label="Search audits"
                  className={cn(
                    "w-full rounded-lg border border-border/60 bg-background pl-9 pr-9 py-2 text-sm text-foreground",
                    "placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setFilter("search", "")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <FilterSelect
                  label="Status"
                  id="filter-status"
                  value={filters.status}
                  onChange={(v) => setFilter("status", v)}
                  options={[...STATUS_OPTIONS]}
                />
                <FilterSelect
                  label="Framework"
                  id="filter-framework"
                  value={filters.framework}
                  onChange={(v) => setFilter("framework", v)}
                  options={[...FRAMEWORK_OPTIONS]}
                />
                <FilterSelect
                  label="Date"
                  id="filter-date"
                  value={filters.date}
                  onChange={(v) => setFilter("date", v)}
                  options={[...DATE_OPTIONS]}
                />
                <FilterSelect
                  label="Sort"
                  id="filter-sort"
                  value={filters.sort}
                  onChange={(v) => setFilter("sort", v)}
                  options={[...SORT_OPTIONS]}
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </CardContent>
          </Card>
        </section>

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading your audits…
          </div>
        )}

        {!loading && error && (
          <Card className="border-red-500/30 bg-card/60">
            <CardContent className="p-8 text-center space-y-3">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" />
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">{error}</p>
              <SecondaryButton size="sm" className="text-xs" onClick={refresh}>
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </SecondaryButton>
            </CardContent>
          </Card>
        )}

        {!loading && !error && isEmpty && (
          <Card className="border-border/40 bg-card/40">
            <CardContent className="p-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60 border border-border/40">
                  <BarChart3 className="h-7 w-7 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-foreground">No audits yet</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Your completed strategy audits will appear here once you run your first audit.
                </p>
              </div>
              <PrimaryButton asChild>
                <Link href="/audit/new">
                  <Plus className="h-4 w-4" />
                  Start Your First Audit
                </Link>
              </PrimaryButton>
            </CardContent>
          </Card>
        )}

        {!loading && !error && noResults && (
          <Card className="border-border/40 bg-card/40">
            <CardContent className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">No audits match your filters</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting or clearing the filters above.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && audits.length > 0 && (
          <>
            <AuditTable audits={audits} onCopyId={handleCopyId} onDelete={setDeleteTarget} />
            <AuditMobileCards audits={audits} onCopyId={handleCopyId} onDelete={setDeleteTarget} />
            <Pagination
              page={pagination?.page ?? 1}
              totalPages={totalPages}
              total={pagination?.total ?? 0}
              pageSize={filters.pageSize}
              onPageChange={(page) => setFilter("page", page)}
            />
          </>
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this audit?"
        description={`This permanently deletes "${deleteTarget?.strategyName ?? ""}" and all of its findings, metrics, recommendations, and timeline entries. This cannot be undone.`}
      >
        <div className="space-y-4">
          <DialogActions>
            <SecondaryButton size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              size="sm"
              disabled={deleting}
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {deleting ? "Deleting…" : "Delete Audit"}
            </PrimaryButton>
          </DialogActions>
        </div>
      </Dialog>

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-5 py-3.5 shadow-lg">
            <p className="text-sm text-foreground">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast((t) => ({ ...t, visible: false }))}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
