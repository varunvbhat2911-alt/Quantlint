import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { MetricCard, AuditCard } from "@/components/app/cards";
import { PrimaryButton } from "@/components/app/buttons";
import { DASHBOARD_METRICS, MOCK_AUDITS } from "@/lib/mock-data/audits";

export const metadata = {
  title: "Dashboard — QuantLint",
};

export default function DashboardPage() {
  const recentAudits = MOCK_AUDITS.slice(0, 4);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your strategy audits, scores, and recent activity."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Dashboard" },
        ]}
        actions={
          <PrimaryButton size="sm" className="text-xs px-4" asChild>
            <Link href="/audit/new">
              New Audit
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Audits"
          value={DASHBOARD_METRICS.totalAudits.toLocaleString()}
        />
        <MetricCard
          label="Avg Score"
          value={`${DASHBOARD_METRICS.avgScore}%`}
        />
        <MetricCard
          label="Avg Audit Time"
          value={`${DASHBOARD_METRICS.avgDurationSec}s`}
        />
        <MetricCard
          label="Active Rules"
          value={`${DASHBOARD_METRICS.activeRules}+`}
        />
      </div>

      <section>
        <SectionHeader
          title="Recent Audits"
          description="Your latest strategy validation runs."
          action={
            <Link
              href="/history"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recentAudits.map((audit) => (
            <AuditCard key={audit.id} audit={audit} />
          ))}
        </div>
      </section>
    </div>
  );
}
