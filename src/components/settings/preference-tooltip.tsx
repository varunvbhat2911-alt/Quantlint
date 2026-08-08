"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShowTooltips } from "@/hooks/use-preferences";

export type PreferenceTooltipProps = {
  content: string;
  children?: React.ReactNode;
  className?: string;
};

export function PreferenceTooltip({
  content,
  children,
  className,
}: PreferenceTooltipProps) {
  const showTooltips = useShowTooltips();

  if (!showTooltips) {
    return children ? <>{children}</> : null;
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      <span
        title={content}
        aria-label={content}
        className="inline-flex text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </span>
  );
}
