"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Code2,
  ShieldCheck,
  Brain,
  LineChart,
  Activity,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowCardGrid } from "@/components/glow-card-grid";

const FEATURES: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Code2,
    title: "Static Analysis",
    description:
      "Deep AST analysis for Python and Pine Script. Detects syntax flaws, state leakage, and invalid order types before execution.",
  },
  {
    icon: ShieldCheck,
    title: "Rule Engine",
    description:
      "Deterministic policy enforcement against 317+ quantitative risk rules, leverage constraints, and position sizing guidelines.",
  },
  {
    icon: Brain,
    title: "AI Explanation",
    description:
      "Translates rule violations and mathematical metrics into plain-English summaries with actionable resolution steps.",
  },
  {
    icon: LineChart,
    title: "Backtesting Validation",
    description:
      "Scans for look-ahead bias, overfitting indicators, and unrealistic slippage assumptions that distort backtest results.",
  },
  {
    icon: Activity,
    title: "Risk Analytics",
    description:
      "Calculates reproducible Sharpe, Sortino, Max Drawdown, and VaR using verified deterministic algorithms.",
  },
  {
    icon: FileText,
    title: "Professional Reports",
    description:
      "Generates comprehensive audit documentation with executive summaries, violation breakdowns, and deployment readiness.",
  },
];

function FeatureGlowCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div
      data-slot="glow-card"
      className={cn(
        "relative h-full overflow-hidden rounded-xl border border-border/50 bg-card/40",
        "transition-[border-color,background-color,transform] duration-200",
        "hover:border-border hover:bg-card active:scale-[0.99]"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0",
          "translate-x-[calc(var(--pointer-x,-10)*30%)] translate-y-[calc(var(--pointer-y,-10)*30%)]",
          "blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        )}
        style={{ opacity: 0.08 }}
      >
        <Icon className="size-24 text-foreground" />
      </div>

      <div className="relative z-10 flex h-full flex-col gap-4 p-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 md:py-32 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Capabilities
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Complete quality control for trading code.
          </h2>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Deterministic math engines combined with AI explanations for total
            strategy clarity.
          </p>
        </div>

        <GlowCardGrid
          iconBlur={20}
          iconOpacity={0.12}
          iconScale={3}
          borderBlur={8}
          borderSaturate={1.2}
          borderBrightness={1.1}
        >
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
            >
              <FeatureGlowCard {...feature} />
            </motion.div>
          ))}
        </GlowCardGrid>
      </div>
    </section>
  );
}
