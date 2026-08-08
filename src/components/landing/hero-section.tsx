"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function AuditPreview() {
  return (
    <div className="relative w-full max-w-lg mx-auto rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-border" />
            <span className="h-2 w-2 rounded-full bg-border" />
            <span className="h-2 w-2 rounded-full bg-border" />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            audit-report.pdf
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          v1.0
        </span>
      </div>

      <div className="border-b border-border/40 bg-background/60 px-4 py-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-foreground/70">$</span>
          <span>quantlint audit mean_reversion.py</span>
        </div>
      </div>

      <div className="space-y-3 p-4 font-mono text-xs">
        {[
          "AST Parsed",
          "317 Rules Checked",
          "Look-ahead Bias Detected",
          "Risk Metrics Calculated",
          "PDF Report Generated",
        ].map((step) => (
          <div key={step} className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
            <span>{step}</span>
          </div>
        ))}

        <div className="mt-4 rounded-lg border border-border/50 bg-secondary/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Overall Score</span>
            <span className="text-lg font-semibold text-foreground tabular-nums">
              92<span className="text-muted-foreground font-normal"> /100</span>
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-card p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
              [QL-104] Look-Ahead Bias
            </span>
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
              HIGH
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
            Signal references future prices via{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              shift(-1)
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="screen-line-top screen-line-bottom border-x border-line">
          <div
            className={cn(
              "relative grid gap-8 p-6 md:p-8 lg:p-10",
              "md:grid-cols-[1.2fr_1fr] md:items-center md:gap-12"
            )}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col justify-center"
            >
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-secondary/40 px-3 py-1 text-xs font-mono text-muted-foreground mb-6">
                <ShieldCheck className="h-3 w-3" />
                <span>Deterministic QA Engine</span>
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.08]">
                Quality assurance for quantitative trading.
              </h1>

              <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Verify strategy logic, eliminate look-ahead bias, detect data
                leakage, validate financial metrics, and generate deterministic
                audit reports before committing capital.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  size="lg"
                  className="rounded-full px-7 text-sm font-medium"
                  asChild
                >
                  <Link href="#audit-demo">
                    Start Free Audit
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-7 text-sm font-medium border-border/80"
                  asChild
                >
                  <Link href="#documentation">Documentation</Link>
                </Button>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-muted-foreground/80">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  Sandboxed AST Analysis
                </span>
                <span>Deterministic Math</span>
                <span>Python &amp; Pine Script</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="flex items-center justify-center"
            >
              <AuditPreview />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
