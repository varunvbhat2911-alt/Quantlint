import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { MetricCard, RuleCard } from "@/components/app/cards";
import { ScoreBadge } from "@/components/app/badges";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import { MOCK_REPORTS } from "@/lib/mock-data/audits";

export const metadata = {
  title: "Audit Result — QuantLint",
};

export default function AuditResultPage() {
  const report = MOCK_REPORTS.rpt_001;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Audit Complete"
        subtitle={`${report.strategyName} — ${report.fileName}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "New Audit", href: "/audit/new" },
          { label: "Result" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <SecondaryButton size="sm" className="text-xs px-4">
              <Download className="h-3.5 w-3.5" />
              Export PDF
            </SecondaryButton>
            <PrimaryButton size="sm" className="text-xs px-4" asChild>
              <Link href={`/report/${report.id}`}>
                Full Report
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </PrimaryButton>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <ScoreBadge score={report.score} className="text-sm px-3 py-1" />
        <span className="text-xs font-mono text-muted-foreground">
          {report.rulesChecked} rules checked · {report.durationSec}s ·{" "}
          {report.violations.length} violation
        </span>
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
          title="Rule Violations"
          description={`${report.violations.length} issue found during validation.`}
        />
        <div className="space-y-4">
          {report.violations.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      </section>
    </div>
  );
}
