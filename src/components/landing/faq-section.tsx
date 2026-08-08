"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Accordion, AccordionItem } from "@/components/ui/accordion";

const FAQS = [
  {
    question: "What is QuantLint and what problem does it solve?",
    answer:
      "QuantLint is an AI-powered Quality Assurance platform for quantitative trading strategies. It performs static code analysis, deterministic risk engine calculations, and AI explainability on strategy code (Python, Pine Script) to catch logic bugs, look-ahead bias, and unrealistic risk metrics before backtesting or deployment.",
  },
  {
    question: "Does QuantLint execute live trades or connect to exchanges?",
    answer:
      "No. QuantLint is strictly a research and quality assurance platform. It does not act as a brokerage, exchange, live trading bot, or signal service. Your strategy code runs in a sandboxed, zero-execution environment strictly for analysis.",
  },
  {
    question: "How does AI explanation work without inventing financial metrics?",
    answer:
      "QuantLint follows a strict rule: deterministic code calculates, LLMs explain. All mathematical metrics (Sharpe ratio, Sortino, Drawdown, VaR) are computed by deterministic Python algorithms. Large Language Models are only used to synthesize plain-English explanations and actionable fix recommendations based on verified rule output.",
  },
  {
    question: "What languages and frameworks are supported?",
    answer:
      "QuantLint supports Python strategy scripts (using Pandas, NumPy, Backtrader, Zipline, QTPy) and TradingView Pine Script (v4 & v5). Support for C# (QuantConnect LEAN) is planned for upcoming releases.",
  },
  {
    question: "How does QuantLint detect Look-Ahead Bias?",
    answer:
      "QuantLint analyzes the Abstract Syntax Tree (AST) of your code to track signal generation timestamps relative to historical candle boundaries. It flags operations that query future prices (e.g. shift(-1) or un-shifted future close candles) prior to bar closure.",
  },
  {
    question: "Is my proprietary strategy code safe and private?",
    answer:
      "Yes. All uploaded files are sanitized and processed in isolated environments. We do not store raw code for training AI models or share intellectual property with third parties.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-24 md:py-32 bg-background border-t border-border/40">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mx-auto max-w-3xl text-center mb-20">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
            FAQ
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Frequently asked questions.
          </h2>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Everything you need to know about the QuantLint quality assurance engine.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto rounded-xl border border-border/40 bg-card/40 p-6 sm:p-8"
        >
          <Accordion allowMultiple={false} defaultOpenIndex={0}>
            {FAQS.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`} title={faq.question}>
                <p className="text-muted-foreground leading-relaxed text-xs pt-1 font-normal">
                  {faq.answer}
                </p>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
