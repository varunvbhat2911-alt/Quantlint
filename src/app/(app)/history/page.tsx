"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { SearchBar } from "@/components/app/search-bar";
import { DataTable } from "@/components/app/data-table";
import { ScoreBadge, StatusBadge } from "@/components/app/badges";
import { PrimaryButton } from "@/components/app/buttons";
import {
  MOCK_AUDITS,
  getReportIdForAudit,
} from "@/lib/mock-data/audits";
import type { Audit } from "@/lib/types";
import { ArrowRight } from "lucide-react";

export default function HistoryPage() {
  const [query, setQuery] = React.useState("");

  const filtered = MOCK_AUDITS.filter(
    (a) =>
      a.strategyName.toLowerCase().includes(query.toLowerCase()) ||
      a.fileName.toLowerCase().includes(query.toLowerCase())
  );

  const columns = [
    {
      key: "strategy",
      header: "Strategy",
      cell: (row: Audit) => (
        <div>
          <p className="font-medium text-sm">{row.strategyName}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {row.fileName}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: Audit) => <StatusBadge status={row.status} />,
    },
    {
      key: "score",
      header: "Score",
      cell: (row: Audit) =>
        row.score !== null ? (
          <ScoreBadge score={row.score} />
        ) : (
          <span className="text-muted-foreground font-mono">—</span>
        ),
    },
    {
      key: "violations",
      header: "Violations",
      cell: (row: Audit) => (
        <span className="font-mono text-muted-foreground">{row.violations}</span>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (row: Audit) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row: Audit) => {
        const reportId = getReportIdForAudit(row.id);
        if (!reportId) return null;
        return (
          <Link
            href={`/report/${reportId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View
            <ArrowRight className="h-3 w-3" />
          </Link>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit History"
        subtitle="Browse and review all past strategy validation runs."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "History" },
        ]}
        actions={
          <PrimaryButton size="sm" className="text-xs px-4" asChild>
            <Link href="/audit/new">New Audit</Link>
          </PrimaryButton>
        }
      />

      <SearchBar
        placeholder="Search strategies..."
        value={query}
        onChange={setQuery}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(row) => row.id}
        emptyMessage="No audits match your search."
      />
    </div>
  );
}
