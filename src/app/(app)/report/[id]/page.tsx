import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ArrowLeft } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { MetricCard, RuleCard } from "@/components/app/cards";
import { ScoreBadge, StatusBadge } from "@/components/app/badges";
import { SecondaryButton } from "@/components/app/buttons";
import { CodeBlock } from "@/components/app/code-block";
import { getReportById } from "@/lib/mock-data/audits";
import { format } from "date-fns";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = getReportById(id);
  return {
    title: report
      ? `${report.strategyName} — Report — QuantLint`
      : "Report — QuantLint",
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = getReportById(id);

  if (!report) {
    notFound();
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title={report.strategyName}
        subtitle={`Audit report for ${report.fileName}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "History", href: "/history" },
          { label: "Report" },
        ]}
        actions={
          <SecondaryButton size="sm" className="text-xs px-4">
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </SecondaryButton>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
        <StatusBadge status={report.status} />
        <ScoreBadge score={report.score} />
        <span>{report.rulesChecked} rules checked</span>
        <span>{report.durationSec}s</span>
        <span>{format(new Date(report.createdAt), "MMM d, yyyy HH:mm")}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Sharpe Ratio" value={report.metrics.sharpe} />
        <MetricCard label="Sortino Ratio" value={report.metrics.sortino} />
        <MetricCard
          label="Max Drawdown"
          value={`${report.metrics.maxDrawdown}%`}
        />
        <MetricCard label="Win Rate" value={`${report.metrics.winRate}%`} />
      </div>

      <section>
        <SectionHeader
          title="Violations"
          description="Rule violations detected during static analysis."
        />
        {report.violations.length > 0 ? (
          <div className="space-y-4">
            {report.violations.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No violations detected.
          </p>
        )}
      </section>

      <section>
        <SectionHeader title="Reproduce" description="Run this audit again via CLI." />
        <CodeBlock code={`quantlint audit ${report.fileName}`} />
      </section>

      <div>
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to history
        </Link>
      </div>
    </div>
  );
}
