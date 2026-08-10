"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type QuantLintLogoProps = {
  /** Height of the QL mark in pixels (default: 20) */
  size?: number;
  /** Show "QuantLint" text beside the mark */
  showWordmark?: boolean;
  /** Additional class names on the wrapper */
  className?: string;
};

/**
 * Shared QuantLint branding component.
 *
 * Renders the QL SVG mark, optionally followed by the "QuantLint" wordmark.
 * Used throughout the application for consistent product identity.
 */
export function QuantLintLogo({
  size = 20,
  showWordmark = false,
  className,
}: QuantLintLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 shrink-0", className)}>
      <Image
        src="/branding/quantlint-ql.svg"
        alt="QuantLint"
        width={size}
        height={size}
        className="shrink-0"
        priority
      />
      {showWordmark && (
        <span className="text-sm font-semibold tracking-tight text-foreground font-mono">
          QuantLint
        </span>
      )}
    </span>
  );
}
