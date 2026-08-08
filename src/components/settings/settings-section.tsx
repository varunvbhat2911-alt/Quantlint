"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SettingsSectionProps = {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SettingsSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export type SettingsRowProps = {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: SettingsRowProps) {
  const labelId = htmlFor ? `${htmlFor}-label` : undefined;
  const descriptionId = description ? `${htmlFor ?? label}-description` : undefined;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        "border-b border-border/40 last:border-b-0 last:pb-0 first:pt-0",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <label
          id={labelId}
          htmlFor={htmlFor}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
        {description && (
          <p
            id={descriptionId}
            className="text-xs text-muted-foreground leading-relaxed"
          >
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
