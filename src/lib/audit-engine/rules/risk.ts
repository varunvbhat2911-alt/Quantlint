/* Risk rules: stop-loss handling, drawdown protection, exposure limits. */

import type { AuditRule } from "./types";
import { findMatches, snippetForLine } from "../parsers/python";

export const riskRules: AuditRule[] = [
  {
    ruleId: "QL-RISK-001",
    title: "No stop-loss handling",
    category: "risk",
    userCategory: "Risk Management",
    severity: "warning",
    description:
      "Orders are placed without any stop-loss or trailing-stop logic. Positions are only exited by the primary signal.",
    whyItMatters:
      "Without stop-losses, a single adverse move can produce outsized losses; exit logic based solely on signals provides no catastrophic-loss protection.",
    suggestedFix:
      "Attach stop-loss (and optionally take-profit) orders to entries, sized to the instrument's volatility.",
    fixSnippet: "vbt.Portfolio.from_signals(..., sl_stop=0.05, tp_stop=0.10)",
    stage: "risk",
    run: (ctx) => {
      const hasEntries = findMatches(
        ctx.code,
        /self\.buy\s*\(|self\.sell\s*\(|\.buy\(|\.sell\(|entries\s*=|long_entry|short_entry/,
      );
      if (hasEntries.length === 0) return [];
      const stopMentions = findMatches(
        ctx.code,
        /\bstop|take_profit|trailing/i,
      );
      return stopMentions.length === 0
        ? [
            {
              ruleId: "QL-RISK-001",
              line: null,
              detectedPattern: "order placement without stop-loss logic",
              codeSnippet: null,
            },
          ]
        : [];
    },
  },
  {
    ruleId: "QL-RISK-003",
    title: "No maximum drawdown protection",
    category: "risk",
    userCategory: "Risk Management",
    severity: "warning",
    description:
      "No drawdown circuit breaker or maximum-loss threshold exists; there is no mechanism to halt trading after severe losses.",
    whyItMatters:
      "Without drawdown protection the strategy can keep trading through severe losses, potentially depleting the account.",
    suggestedFix:
      "Implement a maximum drawdown threshold that pauses or halts trading when breached.",
    fixSnippet:
      "if equity_peak - equity > MAX_DRAWDOWN_PCT * equity_peak:\n    flatten_all_positions()",
    stage: "risk",
    run: (ctx) => {
      const hasTrading = findMatches(
        ctx.code,
        /self\.buy\s*\(|\.buy\(|entries\s*=|cerebro\.run|Portfolio\./,
      );
      if (hasTrading.length === 0) return [];
      const ddMentions = findMatches(ctx.code, /drawdown|circuit.?breaker|max_loss|kill.?switch/i);
      return ddMentions.length === 0
        ? [
            {
              ruleId: "QL-RISK-003",
              line: null,
              detectedPattern: "trading logic without drawdown protection",
              codeSnippet: null,
            },
          ]
        : [];
    },
  },
  {
    ruleId: "QL-RISK-004",
    title: "Position sizing lacks exposure limits",
    category: "risk",
    userCategory: "Position Sizing",
    severity: "warning",
    description:
      "Order size is derived from (nearly) all available cash with no maximum position or portfolio exposure cap.",
    whyItMatters:
      "Unbounded position sizing concentrates the portfolio in a single instrument and can produce catastrophic losses from one adverse move.",
    suggestedFix:
      "Cap position size (e.g., max 20% of portfolio) and enforce portfolio-level exposure limits.",
    fixSnippet: "size = min(size, int(0.20 * portfolio_value / price))",
    stage: "risk",
    run: (ctx) =>
      findMatches(
        ctx.code,
        /(?:getcash\(\)\s*\*\s*(?:0\.\d{2,}|1)|position_pct\s*=\s*(?:0\.\d{2,}|1)|cash\s*\*\s*0\.9\d?|all[-_]?in)/,
      ).map((m) => ({
        ruleId: "QL-RISK-004",
        line: m.line,
        detectedPattern: m.text.slice(0, 120),
        codeSnippet: snippetForLine(ctx.code, m.line),
      })),
  },
  {
    ruleId: "QL-SIZE-001",
    title: "Fixed position size ignores volatility",
    category: "risk",
    userCategory: "Position Sizing",
    severity: "info",
    description:
      "A constant order size is used regardless of instrument volatility or account equity.",
    whyItMatters:
      "Fixed sizing produces inconsistent risk exposure across instruments and regimes; volatility-scaled sizing keeps per-trade risk comparable.",
    suggestedFix:
      "Scale order size by volatility (e.g., ATR-based) or target a fixed fractional risk per trade.",
    fixSnippet: "size = int(risk_budget / (atr_multiple * atr_value))",
    stage: "risk",
    run: (ctx) =>
      findMatches(ctx.code, /(?:self\.)?(?:buy|sell|order)\s*\(\s*size\s*=\s*\d{2,}\s*\)/).map(
        (m) => ({
          ruleId: "QL-SIZE-001",
          line: m.line,
          detectedPattern: m.text.slice(0, 120),
          codeSnippet: snippetForLine(ctx.code, m.line),
        }),
      ),
  },
];
