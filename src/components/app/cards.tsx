import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreBadge, StatusBadge } from "@/components/app/badges";
import { getReportIdForAudit } from "@/lib/mock-data/audits";
import type { Audit, AuditReport, RuleViolation } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, FileText } from "lucide-react";
import { SeverityBadge } from "@/components/app/badges";

export function MetricCard({
  label,
  value,
  description,
  className,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200",
        className
      )}
    >
      <CardHeader className="p-5 pb-2">
        <CardDescription className="text-xs font-mono uppercase tracking-wider">
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      {description && (
        <CardContent className="p-5 pt-0">
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      )}
    </Card>
  );
}

export function AuditCard({ audit }: { audit: Audit }) {
  const reportId = getReportIdForAudit(audit.id);
  const href = reportId ? `/report/${reportId}` : `/history`;

  return (
    <Link href={href}>
      <Card className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200 h-full">
        <CardHeader className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-sm truncate">{audit.strategyName}</CardTitle>
              <CardDescription className="font-mono text-[11px] truncate">
                {audit.fileName}
              </CardDescription>
            </div>
            <StatusBadge status={audit.status} />
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">
            {audit.score !== null ? (
              <ScoreBadge score={audit.score} />
            ) : (
              "—"
            )}
          </span>
          <span>
            {formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function RuleCard({ rule }: { rule: RuleViolation }) {
  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader className="p-5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            [{rule.code}] {rule.title}
          </CardTitle>
          <SeverityBadge severity={rule.severity} />
        </div>
        <CardDescription className="text-xs leading-relaxed">
          {rule.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="rounded-lg bg-muted/40 border border-border/40 p-3 text-xs font-mono text-muted-foreground">
          Line {rule.line}: {rule.recommendation}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportCard({ report }: { report: AuditReport }) {
  return (
    <Link href={`/report/${report.id}`}>
      <Card className="border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200">
        <CardHeader className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-sm truncate">{report.strategyName}</CardTitle>
                <CardDescription className="font-mono text-[11px]">
                  {report.fileName}
                </CardDescription>
              </div>
            </div>
            <ScoreBadge score={report.score} />
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 text-xs text-muted-foreground flex justify-between">
          <span>{report.violations.length} violation{report.violations.length !== 1 ? "s" : ""}</span>
          <span className="font-mono">{report.durationSec}s</span>
        </CardContent>
      </Card>
    </Link>
  );
}
