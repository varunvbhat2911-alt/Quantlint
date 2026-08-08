"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { CodeBlockCommand } from "@/components/code-block-command";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

const AUDIT_OUTPUT = [
  "AST Parsed",
  "317 Rules Checked",
  "Look-ahead Bias Detected",
  "Risk Metrics Calculated",
  "PDF Report Generated",
];

export function AuditDemoSection() {
  return (
    <section
      id="audit-demo"
      className="py-24 md:py-32 border-t border-border/40"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
            CLI
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Interactive audit demo
          </h2>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Run audits from your terminal. Deterministic output, every time.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Installation
              </p>
              <div className="relative overflow-hidden rounded-xl border border-border/60 bg-code">
                <CodeBlockCommand
                  npm="pip install quantlint"
                  pnpm="pip install quantlint"
                  yarn="pip install quantlint"
                  bun="pip install quantlint"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Run audit
              </p>
              <div className="relative rounded-xl border border-border/60 bg-code">
                <pre className="overflow-x-auto p-4 font-mono text-sm text-code-foreground">
                  <code>quantlint audit strategy.py</code>
                </pre>
                <CopyButton
                  className="absolute top-2 right-2 size-8 rounded-md"
                  variant="ghost"
                  size="icon"
                  text="quantlint audit strategy.py"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
                API key
              </p>
              <div className="relative rounded-xl border border-border/60 bg-code">
                <pre className="overflow-x-auto p-4 font-mono text-sm text-code-foreground">
                  <code>export QUANTLINT_API_KEY=ql_live_••••••••••••</code>
                </pre>
                <CopyButton
                  className="absolute top-2 right-2 size-8 rounded-md"
                  variant="ghost"
                  size="icon"
                  text="export QUANTLINT_API_KEY=ql_live_your_key_here"
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border/60 bg-card overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-border" />
                <span className="h-2 w-2 rounded-full bg-border" />
                <span className="h-2 w-2 rounded-full bg-border" />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                terminal
              </span>
            </div>

            <div className="p-4 font-mono text-xs space-y-4">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">$</span>
                <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                  <code className="text-foreground truncate">
                    quantlint audit mean_reversion.py
                  </code>
                  <CopyButton
                    className="size-7 shrink-0 rounded-md"
                    variant="ghost"
                    size="icon"
                    text="quantlint audit mean_reversion.py"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-border/30 pt-4">
                {AUDIT_OUTPUT.map((line, i) => (
                  <motion.div
                    key={line}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    className="flex items-center gap-2 text-muted-foreground"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-foreground/70 shrink-0" />
                    <span>{line}</span>
                  </motion.div>
                ))}
              </div>

              <div
                className={cn(
                  "rounded-lg border border-border/50 bg-secondary/30 p-4",
                  "flex items-center justify-between"
                )}
              >
                <span className="text-muted-foreground">Overall Score</span>
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  92
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    /100
                  </span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
