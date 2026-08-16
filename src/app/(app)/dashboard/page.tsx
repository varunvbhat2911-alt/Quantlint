"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  PlusCircle,
  History,
  BookOpen,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  Zap,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PrimaryButton } from "@/components/app/buttons";
import { StatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import { formatDistanceToNow } from "date-fns";
import { useAuditsList } from "@/hooks/use-audits-list";
import type { AuditListItem } from "@/lib/audits/service";
import type { AuditStats } from "@/lib/audits/service";

/* Quick actions — static navigation links, not mock data. */
type QuickAction = {
  id: string;
  title: string;
  description: string;
  href: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa-new-audit",
    title: "New Audit",
    description: "Upload or paste a strategy for validation.",
    href: "/audit/new",
  },
  {
    id: "qa-history",
    title: "View History",
    description: "Review previous strategy audits.",
    href: "/history",
  },
  {
    id: "qa-docs",
    title: "Documentation",
    description: "Learn about QuantLint rules and validation.",
    href: "/docs",
  },
];

/* Real dashboard stat shape — values derived from the user's audits only. */
type DashboardStat = {
  label: string;
  value: string;
  trend: string;
  trendDirection: "up" | "down" | "neutral";
  supporting: string;
};

/* ────────────────────────────────────────────────────────── */
/*  ICON HELPERS                                              */
/* ────────────────────────────────────────────────────────── */

const STAT_ICONS: Record<string, React.ElementType> = {
  "Total Audits": BarChart3,
  "Average Score": TrendingUp,
  "Issues Detected": ShieldAlert,
  "Avg Audit Time": Zap,
};

const QUICK_ACTION_ICONS: Record<string, React.ElementType> = {
  "New Audit": PlusCircle,
  "View History": History,
  Documentation: BookOpen,
};

/* ────────────────────────────────────────────────────────── */
/*  SMALL COMPONENTS                                          */
/* ────────────────────────────────────────────────────────── */

function StatCard({ stat }: { stat: DashboardStat }) {
  const Icon = STAT_ICONS[stat.label] ?? BarChart3;
  const isPositive = stat.trendDirection === "up";
  const isNegative = stat.trendDirection === "down";

  return (
    <Card className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200 group">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <CardDescription className="text-[11px] font-mono uppercase tracking-wider">
            {stat.label}
          </CardDescription>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 transition-colors group-hover:bg-secondary/80">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-1.5">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {stat.value}
        </p>
        <div className="flex items-center gap-1.5 text-[11px]">
          {isPositive && (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          )}
          {isNegative && (
            <TrendingDown className="h-3 w-3 text-emerald-500" />
          )}
          <span
            className={cn(
              "font-medium",
              isPositive && "text-emerald-600 dark:text-emerald-400",
              isNegative && "text-emerald-600 dark:text-emerald-400",
              stat.trendDirection === "neutral" && "text-muted-foreground"
            )}
          >
            {stat.trend}
          </span>
          <span className="text-muted-foreground">{stat.supporting}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = QUICK_ACTION_ICONS[action.title] ?? PlusCircle;

  return (
    <Link href={action.href}>
      <Card className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200 h-full group cursor-pointer">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 transition-colors group-hover:bg-secondary/80">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground group-hover:text-foreground transition-colors">
              {action.title}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {action.description}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

function ScoreIndicator({ score }: { score: number }) {
  const color =
    score >= 90
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 75
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
  const bgColor =
    score >= 90
      ? "bg-emerald-500/8"
      : score >= 75
        ? "bg-amber-500/8"
        : "bg-red-500/8";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-mono font-medium tabular-nums",
        color,
        bgColor
      )}
    >
      {score}/100
    </span>
  );
}

function ToastNotification({
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
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-5 py-3.5 shadow-lg shadow-black/8">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
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
/*  SECTION COMPONENTS                                        */
/* ────────────────────────────────────────────────────────── */

function DashboardHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Monitor your strategy validation, audit results, and recent activity.
        </p>
      </div>
      <PrimaryButton size="sm" className="text-xs px-4 shrink-0" asChild>
        <Link href="/audit/new">
          <PlusCircle className="h-3.5 w-3.5" />
          New Audit
        </Link>
      </PrimaryButton>
    </div>
  );
}

function QuickActionsSection() {
  return (
    <section aria-label="Quick actions">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action) => (
          <QuickActionCard key={action.id} action={action} />
        ))}
      </div>
    </section>
  );
}

function MetricsSection({ stats }: { stats: AuditStats | null }) {
  const cards: DashboardStat[] = stats
    ? [
        {
          label: "Total Audits",
          value: String(stats.total),
          trend: "—",
          trendDirection: "neutral",
          supporting: "all runs",
        },
        {
          label: "Completed",
          value: String(stats.completed),
          trend: "—",
          trendDirection: "neutral",
          supporting: "finished audits",
        },
        {
          label: "Running",
          value: String(stats.running + stats.queued),
          trend: "—",
          trendDirection: "neutral",
          supporting: "in progress",
        },
        {
          label: "Failed",
          value: String(stats.failed),
          trend: "—",
          trendDirection: "neutral",
          supporting: "failed runs",
        },
      ]
    : [];

  return (
    <section aria-label="Key metrics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

function dashboardAuditHref(audit: Pick<AuditListItem, "id" | "status">): string {
  return audit.status === "queued" || audit.status === "running"
    ? `/audit/running?jobId=${encodeURIComponent(audit.id)}`
    : `/audit/result?jobId=${encodeURIComponent(audit.id)}`;
}

function RecentAuditsSection({ audits }: { audits: AuditListItem[] }) {
  return (
    <section aria-label="Recent audits">
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Recent Audits
          </h2>
          <p className="text-xs text-muted-foreground">
            Your latest strategy validation runs.
          </p>
        </div>
        <Link
          href="/history"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Desktop table */}
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
                  <td className="px-4 py-3 text-foreground font-medium">
                    {audit.strategyName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {audit.framework}
                  </td>
                  <td className="px-4 py-3">
                    {audit.score !== null ? (
                      <ScoreIndicator score={audit.score} />
                    ) : (
                      <span className="text-muted-foreground font-mono">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono tabular-nums">
                    {audit.violations.total}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={audit.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(audit.createdAt), {
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={dashboardAuditHref(audit)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Open
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {audits.map((audit) => (
          <Link key={audit.id} href={dashboardAuditHref(audit)}>
            <Card className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {audit.strategyName}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {audit.framework}
                    </p>
                  </div>
                  <StatusBadge status={audit.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {audit.score !== null ? (
                      <ScoreIndicator score={audit.score} />
                    ) : (
                      <span className="font-mono">—</span>
                    )}
                    <span className="font-mono tabular-nums">
                      {audit.violations.total} issue
                      {audit.violations.total !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span>
                    {formatDistanceToNow(new Date(audit.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DashboardEmptyState() {
  return (
    <EmptyState
      icon={BarChart3}
      title="No audits yet"
      description="Start by uploading your first quantitative strategy and let QuantLint analyze it."
      action={
        <PrimaryButton asChild>
          <Link href="/audit/new">
            <PlusCircle className="h-4 w-4" />
            Start Your First Audit
          </Link>
        </PrimaryButton>
      }
    />
  );
}

/* ────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                 */
/* ────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  // Real, authenticated data: recent audits + status statistics.
  const { audits, loading, error } = useAuditsList({ pageSize: 5, sort: "newest" });
  const [stats, setStats] = React.useState<AuditStats | null>(null);
  const [statsLoading, setStatsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/audits/stats", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const payload: unknown = await res.json().catch(() => null);
        if (
          !cancelled &&
          typeof payload === "object" &&
          payload !== null &&
          "stats" in payload
        ) {
          setStats((payload as { stats: AuditStats }).stats);
        }
      })
      .catch(() => {
        // Error state renders below; no mock fallback.
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasAudits = (stats?.total ?? 0) > 0;

  return (
    <div className="space-y-10">
      <DashboardHeader />

      {statsLoading || loading ? (
        <>
          <QuickActionsSection />
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading your audits…
          </div>
        </>
      ) : error ? (
        <>
          <QuickActionsSection />
          <Card className="border-red-500/30 bg-card/60">
            <CardContent className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">
                Could not load your audit data.
              </p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </>
      ) : hasAudits ? (
        <>
          <QuickActionsSection />
          <MetricsSection stats={stats} />
          <RecentAuditsSection audits={audits} />
        </>
      ) : (
        <DashboardEmptyState />
      )}
    </div>
  );
}
