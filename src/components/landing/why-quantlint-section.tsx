"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const WHY_POINTS = [
  {
    title: "Deterministic Financial Math",
    description:
      "Sharpe ratio, Sortino ratio, and Drawdowns are calculated using verified algorithmic math — never invented or estimated by generative LLMs.",
  },
  {
    title: "Zero Execution Risk",
    description:
      "QuantLint is purely a research and quality assurance platform. Code runs safely in a sandboxed parser without live execution or exchange keys.",
  },
  {
    title: "Statistical Error Detection",
    description:
      "Automatically flags look-ahead bias, data leakage, over-fitting on historical noise, and zero-commission backtest assumptions.",
  },
  {
    title: "Developer-First Interface",
    description:
      "Built for quantitative engineers with clean typography, Monaco syntax views, structured JSON audit logs, and immediate feedback.",
  },
];

const COMPARISON = [
  {
    feature: "Look-Ahead Bias Detection",
    quantlint: true,
    traditional: false,
  },
  {
    feature: "Deterministic Risk Engine",
    quantlint: true,
    traditional: true,
  },
  {
    feature: "Plain-English AI Explanations",
    quantlint: true,
    traditional: false,
  },
  {
    feature: "AST Static Syntax & State Checking",
    quantlint: true,
    traditional: false,
  },
  {
    feature: "Zero-Brokerage Security Model",
    quantlint: true,
    traditional: false,
  },
];

export function WhyQuantLintSection() {
  return (
    <section id="why-quantlint" className="py-24 md:py-32 bg-background border-t border-border/40">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mx-auto max-w-3xl text-center mb-20">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Comparison
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Built specifically for quantitative QA.
          </h2>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Most strategy failures stem from statistical leakage and code flaws — not market randomness.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {WHY_POINTS.map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Card className="h-full border-border/40 bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-200">
                <CardHeader className="p-6 pb-2">
                  <CardTitle className="text-base font-semibold text-foreground">
                    {point.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                  <p className="text-xs text-muted-foreground leading-relaxed font-normal">
                    {point.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quiet Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-xl border border-border/40 bg-card/40 p-6 md:p-8 max-w-4xl mx-auto"
        >
          <h3 className="text-base font-semibold text-foreground mb-8 text-center">
            QuantLint vs Generic Backtesters
          </h3>
          <div className="divide-y divide-border/40 font-mono text-xs">
            <div className="grid grid-cols-12 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <div className="col-span-7 sm:col-span-8 font-sans font-medium">Capability</div>
              <div className="col-span-3 sm:col-span-2 text-center text-foreground font-semibold">
                QuantLint
              </div>
              <div className="col-span-2 text-center">Generic</div>
            </div>

            {COMPARISON.map((row) => (
              <div
                key={row.feature}
                className="grid grid-cols-12 py-4 items-center"
              >
                <div className="col-span-7 sm:col-span-8 font-sans text-xs font-medium text-foreground">
                  {row.feature}
                </div>
                <div className="col-span-3 sm:col-span-2 flex justify-center text-foreground">
                  <Check className="h-4 w-4" />
                </div>
                <div className="col-span-2 flex justify-center text-muted-foreground/40">
                  {row.traditional ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
