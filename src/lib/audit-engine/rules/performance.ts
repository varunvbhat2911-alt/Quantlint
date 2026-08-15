/* Performance-methodology rules: in-sample evaluation, short test windows. */

import type { AuditRule } from "./types";
import { findMatches, snippetForLine } from "../parsers/python";

export const performanceRules: AuditRule[] = [
  {
    ruleId: "QL-PERF-001",
    title: "Evaluation appears in-sample only",
    category: "performance",
    userCategory: "Performance Metrics",
    severity: "info",
    description:
      "A backtest is computed without any out-of-sample split or walk-forward evaluation; results reflect the same data used to develop the strategy.",
    whyItMatters:
      "In-sample results overstate live performance because the strategy was effectively chosen to fit this data.",
    suggestedFix:
      "Reserve a hold-out period or use walk-forward analysis to evaluate out-of-sample performance.",
    fixSnippet: null,
    stage: "performance",
    run: (ctx) => {
      const hasBacktest = findMatches(
        ctx.code,
        /cerebro\.run|run_algorithm|Portfolio\.from_|portfolio\.stats|backtest/i,
      );
      if (hasBacktest.length === 0) return [];
      const oosMentions = findMatches(
        ctx.code,
        /train_test_split|out.?of.?sample|walk.?forward|hold.?out|\.iloc\[:\s*\d|\.iloc\[\s*\d+\s*:/i,
      );
      return oosMentions.length === 0
        ? [
            {
              ruleId: "QL-PERF-001",
              line: null,
              detectedPattern: "backtest without out-of-sample split",
              codeSnippet: null,
            },
          ]
        : [];
    },
  },
  {
    ruleId: "QL-PERF-002",
    title: "Short backtest window",
    category: "performance",
    userCategory: "Performance Metrics",
    severity: "info",
    description:
      "The configured backtest date range spans under one year, which is generally too little history to assess a strategy across regimes.",
    whyItMatters:
      "Short windows cover few market regimes and cannot demonstrate robustness; results are dominated by the specific period chosen.",
    suggestedFix:
      "Extend the test window to multiple years covering varied market conditions (bull, bear, high volatility).",
    fixSnippet: null,
    stage: "performance",
    run: (ctx) => {
      const ranges = findMatches(
        ctx.code,
        /(?:start|from)\s*=\s*["'](\d{4})-\d{2}-\d{2}["'].*(?:end|to)\s*=\s*["'](\d{4})-\d{2}-\d{2}["']/,
      );
      const findings = [];
      for (const m of ranges) {
        const years = m.text.match(/(\d{4})-\d{2}-\d{2}/g) ?? [];
        if (years.length === 2) {
          const startYear = parseInt(years[0].slice(0, 4), 10);
          const endYear = parseInt(years[1].slice(0, 4), 10);
          if (endYear - startYear < 1) {
            findings.push({
              ruleId: "QL-PERF-002",
              line: m.line,
              detectedPattern: m.text.slice(0, 120),
              codeSnippet: snippetForLine(ctx.code, m.line),
            });
          }
        }
      }
      return findings;
    },
  },
];
