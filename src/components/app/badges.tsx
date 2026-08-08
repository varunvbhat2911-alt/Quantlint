import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { AuditStatus, RuleSeverity } from "@/lib/types";

const STATUS_CONFIG: Record<
  AuditStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  completed: { label: "Completed", variant: "success" },
  running: { label: "Running", variant: "indigo" },
  failed: { label: "Failed", variant: "destructive" },
  queued: { label: "Queued", variant: "secondary" },
};

const SEVERITY_CONFIG: Record<
  RuleSeverity,
  { label: string; variant: BadgeProps["variant"] }
> = {
  critical: { label: "Critical", variant: "destructive" },
  high: { label: "High", variant: "warning" },
  medium: { label: "Medium", variant: "secondary" },
  low: { label: "Low", variant: "outline" },
  info: { label: "Info", variant: "indigo" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: AuditStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={cn("font-mono text-[10px]", className)}>
      {config.label}
    </Badge>
  );
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: RuleSeverity;
  className?: string;
}) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge variant={config.variant} className={cn("font-mono text-[10px]", className)}>
      {config.label}
    </Badge>
  );
}

export function ScoreBadge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const variant: BadgeProps["variant"] =
    score >= 90 ? "success" : score >= 75 ? "secondary" : "warning";

  return (
    <Badge variant={variant} className={cn("font-mono tabular-nums", className)}>
      {score}/100
    </Badge>
  );
}
