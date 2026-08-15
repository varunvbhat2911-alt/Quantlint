/* Transaction-cost rules: missing or zero-cost assumptions. */

import type { AuditRule } from "./types";
import { findMatches, snippetForLine } from "../parsers/python";

export const costRules: AuditRule[] = [
  {
    ruleId: "QL-COST-001",
    title: "Missing transaction costs",
    category: "execution",
    userCategory: "Transaction Costs",
    severity: "critical",
    description:
      "A backtest simulation is constructed without commissions, fees, or market-impact modeling. Performance is computed as if trading were frictionless.",
    whyItMatters:
      "Transaction costs are one of the primary reasons backtested strategies fail in production; even small per-trade costs compound across hundreds of trades.",
    suggestedFix:
      "Add realistic commission and fee parameters to the portfolio simulation (e.g., fees=0.001, commission=0.001).",
    fixSnippet: "portfolio = vbt.Portfolio.from_signals(..., fees=0.001)",
    stage: "rules",
    run: (ctx) => {
      const constructions = findMatches(
        ctx.code,
        /Portfolio\.from_signals|Portfolio\.from_orders|addstrategy|run_algorithm|cerebro\.run|bt\.run/,
      );
      if (constructions.length === 0) return [];
      const costMentions = findMatches(
        ctx.code,
        /fees|commission|setcommission|set_commission|cost|fee_rate|commission_info/i,
      );
      if (costMentions.length > 0) return [];
      return [
        {
          ruleId: "QL-COST-001",
          line: constructions[0].line,
          detectedPattern: constructions[0].text.slice(0, 120),
          codeSnippet: snippetForLine(ctx.code, constructions[0].line),
        },
      ];
    },
  },
  {
    ruleId: "QL-COST-002",
    title: "Explicitly zero transaction costs",
    category: "execution",
    userCategory: "Transaction Costs",
    severity: "warning",
    description:
      "Costs are explicitly set to zero (fees=0 / commission=0), which disables friction modeling in the simulation.",
    whyItMatters:
      "Zero-cost assumptions guarantee overstated net performance and hide the strategy's sensitivity to trading frictions.",
    suggestedFix:
      "Set costs to a realistic estimate for the intended market and instrument (e.g., 10 bps commission plus slippage).",
    fixSnippet: "fees=0.001, slippage=0.002  # 10bps + 20bps",
    stage: "rules",
    run: (ctx) =>
      findMatches(ctx.code, /(?:fees|commission|fee)\s*=\s*0(?!\.\d)/).map((m) => ({
        ruleId: "QL-COST-002",
        line: m.line,
        detectedPattern: m.text.slice(0, 120),
        codeSnippet: snippetForLine(ctx.code, m.line),
      })),
  },
];
