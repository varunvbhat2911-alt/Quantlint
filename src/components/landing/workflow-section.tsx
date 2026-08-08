"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Code2,
  ShieldCheck,
  Brain,
  Activity,
  FileText,
  type LucideIcon,
} from "lucide-react";
import {
  TimescaleRoot,
  TimescaleViewport,
  TimescaleHeader,
  TimescaleTrack,
  TimescaleRail,
  TimescaleItem,
  TimescaleTick,
  TimescaleAge,
  TimescaleContent,
  TimescaleIntroScroll,
} from "@/components/timescale";

const WORKFLOW_STEPS: {
  step: string;
  name: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    step: "01",
    name: "Upload Strategy",
    description: "Import Python or Pine Script into a sandboxed parser.",
    icon: Upload,
  },
  {
    step: "02",
    name: "Static Analysis",
    description: "AST traversal detects syntax flaws and data access patterns.",
    icon: Code2,
  },
  {
    step: "03",
    name: "Rule Engine",
    description: "317+ deterministic rules evaluate risk and compliance.",
    icon: ShieldCheck,
  },
  {
    step: "04",
    name: "AI Explanation",
    description: "Plain-English summaries for every flagged violation.",
    icon: Brain,
  },
  {
    step: "05",
    name: "Risk Metrics",
    description: "Sharpe, Sortino, drawdown, and VaR calculated deterministically.",
    icon: Activity,
  },
  {
    step: "06",
    name: "Audit Report",
    description: "Export PDF/Markdown certification for deployment readiness.",
    icon: FileText,
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-24 md:py-32 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Workflow
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            From raw script to deployment audit.
          </h2>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            A structured, repeatable quality assurance pipeline for quantitative
            strategy development.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-xl border border-border/40 bg-card/30 p-4 md:p-6"
        >
          <TimescaleIntroScroll>
            <TimescaleRoot>
              <TimescaleHeader>
                <TimescaleAge>Pipeline</TimescaleAge>
              </TimescaleHeader>

              <TimescaleViewport>
                <TimescaleTrack>
                  <TimescaleRail />

                  {WORKFLOW_STEPS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <TimescaleItem key={item.step}>
                        <TimescaleTick />
                        <TimescaleAge>{item.step}</TimescaleAge>
                        <TimescaleContent>
                          <div className="rounded-lg border border-border/50 bg-background/60 p-4 max-w-xs">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-secondary/40">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <h3 className="text-sm font-semibold text-foreground">
                                {item.name}
                              </h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </TimescaleContent>
                      </TimescaleItem>
                    );
                  })}
                </TimescaleTrack>
              </TimescaleViewport>
            </TimescaleRoot>
          </TimescaleIntroScroll>
        </motion.div>
      </div>
    </section>
  );
}
