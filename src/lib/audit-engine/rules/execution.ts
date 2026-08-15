/* Execution-logic rules: same-bar fills, slippage assumptions. */

import type { AuditRule } from "./types";
import { findMatches, snippetForLine } from "../parsers/python";

export const executionRules: AuditRule[] = [
  {
    ruleId: "QL-EXEC-001",
    title: "Same-bar close execution enabled",
    category: "execution",
    userCategory: "Execution Logic",
    severity: "critical",
    description:
      "The backtest is configured to fill orders on the same bar's close (cheat-on-close / coc), which is generally unachievable in live trading.",
    whyItMatters:
      "Signals computed from a completed bar cannot be executed at that same bar's close in live markets; assuming so systematically overstates performance.",
    suggestedFix:
      "Fill orders on the next bar's open, or model an explicit execution delay.",
    fixSnippet: "cerebro.broker.set_coc(False)  # fill at next bar",
    stage: "rules",
    run: (ctx) =>
      [
        ...findMatches(ctx.code, /\bcoc\s*=\s*True|set_coc\s*\(\s*True|cheat_on_close|cheat_on_open/),
        ...findMatches(ctx.code, /execute_at_close|fill_at_close|same_bar/),
      ].map((m) => ({
        ruleId: "QL-EXEC-001",
        line: m.line,
        detectedPattern: m.text.slice(0, 120),
        codeSnippet: snippetForLine(ctx.code, m.line),
      })),
  },
  {
    ruleId: "QL-EXEC-002",
    title: "Slippage not configured",
    category: "execution",
    userCategory: "Execution Logic",
    severity: "warning",
    description:
      "A portfolio/backtest simulation is constructed without any slippage model, so orders are assumed to fill at exact quoted prices.",
    whyItMatters:
      "Slippage is unavoidable in real markets and erodes returns, especially for high-turnover strategies or large position sizes.",
    suggestedFix:
      "Add an explicit slippage assumption (e.g., slippage=0.002 or a per-order slippage model).",
    fixSnippet: "portfolio = vbt.Portfolio.from_signals(..., slippage=0.002)",
    stage: "rules",
    run: (ctx) => {
      const hasBacktest =
        findMatches(ctx.code, /Portfolio\.from_signals|from_orders|from_holding|addstrategy|run_algorithm|cerebro\.run/).length > 0;
      if (!hasBacktest) return [];
      const slippageMentions = findMatches(
        ctx.code,
        /slippage|slip_pct|set_slippage|SlippageModel|FixedSlippage/i,
      );
      return slippageMentions.length === 0
        ? [
            {
              ruleId: "QL-EXEC-002",
              line: null,
              detectedPattern: "backtest construction without slippage configuration",
              codeSnippet: null,
            },
          ]
        : [];
    },
  },
];
