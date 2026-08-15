/* Bias rules: look-ahead bias, centered windows, survivorship assumptions. */

import type { AuditRule } from "./types";
import { findMatches, snippetForLine } from "../parsers/python";

export const biasRules: AuditRule[] = [
  {
    ruleId: "QL-BIAS-001",
    title: "Look-ahead bias detected",
    category: "bias",
    userCategory: "Look-ahead Bias",
    severity: "critical",
    description:
      "The strategy references future data via a negative shift or future index offset. Signals derived this way use information that would not be available at decision time.",
    whyItMatters:
      "Backtests must only use information available at the decision timestamp. Look-ahead bias makes backtest performance significantly more optimistic than live trading could achieve.",
    suggestedFix:
      "Replace future-looking access with strictly causal operations: use shift(1) (past bars), rolling windows on current data, or t-1 features.",
    fixSnippet: "signal = close.shift(1) > rolling_mean  # causal: past bar only",
    stage: "bias",
    run: (ctx) => {
      const matches = [
        ...findMatches(ctx.code, /\.shift\(\s*-\s*\d+/),
        ...findMatches(ctx.code, /\.iloc\[i\s*\+/),
        ...findMatches(ctx.code, /\.iat\[\w+\s*,\s*i\s*\+/),
      ];
      return matches.map((m) => ({
        ruleId: "QL-BIAS-001",
        line: m.line,
        detectedPattern: m.text.slice(0, 120),
        codeSnippet: snippetForLine(ctx.code, m.line),
      }));
    },
  },
  {
    ruleId: "QL-BIAS-002",
    title: "Centered rolling window uses future data",
    category: "bias",
    userCategory: "Look-ahead Bias",
    severity: "critical",
    description:
      "A rolling calculation uses center=True, which incorporates observations after the current bar, leaking future information into the signal.",
    whyItMatters:
      "Centered windows include future bars; any indicator built this way cannot be computed in real time and inflates backtest results.",
    suggestedFix:
      "Remove center=True so the window only spans past and current bars (trailing window).",
    fixSnippet: "rolling_mean = close.rolling(window=20).mean()  # trailing window",
    stage: "bias",
    run: (ctx) =>
      findMatches(ctx.code, /rolling\([^)]*center\s*=\s*True/).map((m) => ({
        ruleId: "QL-BIAS-002",
        line: m.line,
        detectedPattern: m.text.slice(0, 120),
        codeSnippet: snippetForLine(ctx.code, m.line),
      })),
  },
  {
    ruleId: "QL-BIAS-003",
    title: "Potential survivorship bias",
    category: "bias",
    userCategory: "Survivorship Bias",
    severity: "warning",
    description:
      "The strategy tests against currently-listed instruments only (hard-coded ticker download or a static CSV of current constituents). Delisted or failed assets are excluded by construction.",
    whyItMatters:
      "Survivorship bias inflates returns by only considering instruments that survived to today, ignoring those that failed during the test period.",
    suggestedFix:
      "Test against a survivorship-bias-free (point-in-time) dataset that includes delisted assets.",
    fixSnippet: null,
    stage: "bias",
    run: (ctx) =>
      findMatches(
        ctx.code,
        /YFData\.download|yf\.download|yfinance\.download|download\(?\s*["'](?:SPY|QQQ|AAPL|MSFT|GOOGL|AMZN|NVDA|TSLA)["']/i,
      ).map((m) => ({
        ruleId: "QL-BIAS-003",
        line: m.line,
        detectedPattern: m.text.slice(0, 120),
        codeSnippet: snippetForLine(ctx.code, m.line),
      })),
  },
];
