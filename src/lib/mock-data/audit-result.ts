/* ── Mock Audit Result Data ──────────────────────────────────
 *
 * All data here is MOCK / DEMONSTRATION ONLY.
 * No real analysis, financial calculations, or AI was used.
 *
 * When a real backend is connected, replace usage of this file
 * with data fetched from GET /audit/:id or equivalent endpoint.
 * ──────────────────────────────────────────────────────────── */

/* ── Types ───────────────────────────────────────────────── */

export type ViolationSeverity = "critical" | "warning" | "info";
export type ViolationStatus = "open" | "resolved" | "ignored";
export type FindingCategory =
  | "bias"
  | "risk"
  | "execution"
  | "data"
  | "performance"
  | "structure";

export type Violation = {
  id: string;
  ruleId: string;
  severity: ViolationSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  whyItMatters: string;
  file: string | null;
  line: number | null;
  detectedPattern: string | null;
  suggestedFix: string | null;
  codeSnippet: string | null;
  fixSnippet: string | null;
  status: ViolationStatus;
};

export type MetricGroup = {
  label: string;
  metrics: {
    key: string;
    label: string;
    value: string;
    tooltip: string;
  }[];
};

export type AIExplanation = {
  id: string;
  ruleId: string;
  finding: string;
  explanation: string;
  whyItMatters: string;
  suggestedFix: string;
  confidence: number;
  relatedViolationId: string;
};

export type Recommendation = {
  id: string;
  priority: number;
  title: string;
  severity: ViolationSeverity;
  why: string;
  suggestedAction: string;
  relatedRuleId: string;
  status: "open" | "resolved" | "ignored";
};

export type TimelineEntry = {
  label: string;
  timestamp: string;
};

export type AuditResultData = {
  auditId: string;
  strategyName: string;
  fileName: string;
  framework: string;
  frameworkLabel: string;
  analysisDepth: string;
  rulesVersion: string;
  createdAt: string;
  completedAt: string;
  inputType: string;
  score: number;
  grade: string;
  gradeStatus: string;
  summary: string;
  rulesChecked: number;
  rulesPassed: number;
  warnings: number;
  critical: number;
  violations: Violation[];
  metricGroups: MetricGroup[];
  aiExplanations: AIExplanation[];
  recommendations: Recommendation[];
  timeline: TimelineEntry[];
};

/* ── Violations ──────────────────────────────────────────── */

const MOCK_VIOLATIONS: Violation[] = [
  {
    id: "v-001",
    ruleId: "QL-BIAS-001",
    severity: "critical",
    category: "bias",
    title: "Look-ahead bias detected",
    description:
      "Future information may be influencing historical signals. The strategy accesses data via shift(-1) which references the next bar's close price before the current bar has completed.",
    whyItMatters:
      "Backtests must only use information available at the decision timestamp. Look-ahead bias can make backtest performance significantly more optimistic than what could be achieved in live trading.",
    file: "mean_reversion.py",
    line: 42,
    detectedPattern: "shift(-1)",
    suggestedFix:
      "Replace future-looking data access with a strictly causal calculation using shift(1) or .rolling() with the current index.",
    codeSnippet: `z_score = (close - rolling_mean) / rolling_std
signal = close.shift(-1) > rolling_mean  # ← look-ahead`,
    fixSnippet: `z_score = (close - rolling_mean) / rolling_std
signal = close > rolling_mean  # ← causal: uses current bar only`,
    status: "open",
  },
  {
    id: "v-002",
    ruleId: "QL-EXEC-001",
    severity: "critical",
    category: "execution",
    title: "Unrealistic fill assumptions",
    description:
      "Orders appear to execute at prices unavailable at decision time. The backtest assumes market orders are filled at the exact close price without any delay.",
    whyItMatters:
      "In live trading, orders experience slippage and may fill at worse prices. This can significantly overstate strategy profitability.",
    file: "mean_reversion.py",
    line: 67,
    detectedPattern: "fill_price=close",
    suggestedFix:
      "Use next-bar open pricing or add a realistic execution delay model.",
    codeSnippet: `portfolio = vbt.Portfolio.from_signals(
    close=price,
    entries=entries,
    exits=exits,
    init_cash=100_000,
)`,
    fixSnippet: `portfolio = vbt.Portfolio.from_signals(
    close=price,
    entries=entries,
    exits=exits,
    init_cash=100_000,
    fees=0.001,
    slippage=0.002,  # 20bps slippage estimate
)`,
    status: "open",
  },
  {
    id: "v-003",
    ruleId: "QL-COST-001",
    severity: "critical",
    category: "execution",
    title: "Missing transaction costs",
    description:
      "Backtest performance may be overstated because no trading costs are modeled. The strategy does not account for commissions, fees, or market impact.",
    whyItMatters:
      "Transaction costs are one of the primary reasons backtested strategies fail in production. Even small per-trade costs compound across hundreds of trades.",
    file: "mean_reversion.py",
    line: 98,
    detectedPattern: "fees=0",
    suggestedFix:
      "Add realistic commission and fee parameters to the portfolio simulation.",
    codeSnippet: `portfolio = vbt.Portfolio.from_signals(
    close=price, entries=entries, exits=exits,
    init_cash=100_000,
    fees=0,  # ← no transaction costs
)`,
    fixSnippet: `portfolio = vbt.Portfolio.from_signals(
    close=price, entries=entries, exits=exits,
    init_cash=100_000,
    fees=0.001,  # 10bps commission estimate
)`,
    status: "open",
  },
  {
    id: "v-004",
    ruleId: "QL-BIAS-003",
    severity: "critical",
    category: "bias",
    title: "Potential survivorship bias",
    description:
      "The strategy uses a single instrument (SPY) which is a survivor. Testing only on instruments that exist today ignores delisted or failed assets.",
    whyItMatters:
      "Survivorship bias inflates returns by only considering successful instruments and excluding those that failed during the test period.",
    file: "mean_reversion.py",
    line: 12,
    detectedPattern: 'YFData.download("SPY")',
    suggestedFix:
      "Test the strategy on a survivorship-bias-free dataset or use a point-in-time universe.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-005",
    ruleId: "QL-RISK-003",
    severity: "critical",
    category: "risk",
    title: "No maximum drawdown protection",
    description:
      "The strategy does not implement any drawdown circuit breaker or maximum loss threshold. There is no mechanism to halt trading after large losses.",
    whyItMatters:
      "Without drawdown protection, the strategy could continue trading through severe losses, potentially depleting the entire account.",
    file: "mean_reversion.py",
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Implement a maximum drawdown threshold that pauses or stops trading when reached.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-006",
    ruleId: "QL-RISK-004",
    severity: "warning",
    category: "risk",
    title: "Position sizing lacks exposure limits",
    description:
      "No maximum position size or portfolio exposure constraint is defined. The strategy may allocate the entire portfolio to a single position.",
    whyItMatters:
      "Unbounded position sizing increases concentration risk and can lead to catastrophic losses from a single adverse move.",
    file: "mean_reversion.py",
    line: 78,
    detectedPattern: null,
    suggestedFix:
      "Add a maximum position size cap (e.g., 20% of portfolio) and enforce portfolio-level exposure limits.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-007",
    ruleId: "QL-EXEC-002",
    severity: "warning",
    category: "execution",
    title: "Slippage not configured",
    description:
      "Slippage assumptions are not configured in the portfolio simulation. Orders are assumed to fill at exact quoted prices.",
    whyItMatters:
      "Slippage is unavoidable in real markets and can erode returns, especially for strategies with high turnover or large position sizes.",
    file: "mean_reversion.py",
    line: 91,
    detectedPattern: "slippage=0",
    suggestedFix:
      "Add a slippage parameter (e.g., 5–20 bps for liquid equities) to the portfolio simulation.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-008",
    ruleId: "QL-PERF-001",
    severity: "warning",
    category: "performance",
    title: "Sharpe ratio should use risk-free rate",
    description:
      "The Sharpe ratio calculation does not subtract a risk-free rate. This can make the risk-adjusted return appear higher than it actually is.",
    whyItMatters:
      "Without accounting for the risk-free rate, the Sharpe ratio overstates the strategy's excess return per unit of risk.",
    file: "mean_reversion.py",
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Subtract the current risk-free rate (e.g., 3-month T-bill yield) from the strategy returns before computing the Sharpe ratio.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-009",
    ruleId: "QL-DATA-001",
    severity: "warning",
    category: "data",
    title: "Limited backtest period",
    description:
      "The strategy is tested on only 4 years of data (2020–2023), which includes an unusually strong bull market period and the COVID recovery.",
    whyItMatters:
      "Short backtest periods may not capture diverse market regimes, leading to overfit strategies that fail in different conditions.",
    file: "mean_reversion.py",
    line: 12,
    detectedPattern: 'start="2020-01-01"',
    suggestedFix:
      "Extend the backtest period to at least 10 years or include multiple market regimes (bear, sideways, bull).",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-010",
    ruleId: "QL-RISK-001",
    severity: "warning",
    category: "risk",
    title: "No stop-loss mechanism",
    description:
      "The strategy does not implement stop-loss orders or trailing stops. Positions are only closed based on the z-score signal.",
    whyItMatters:
      "Without stop-losses, a position can experience unlimited adverse movement before the exit signal triggers.",
    file: "mean_reversion.py",
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Add a per-trade stop-loss (e.g., 2–5% maximum loss) to limit downside on individual positions.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-011",
    ruleId: "QL-PERF-003",
    severity: "warning",
    category: "performance",
    title: "Insufficient out-of-sample testing",
    description:
      "No train/test split or walk-forward analysis is performed. The strategy is optimized on the full dataset.",
    whyItMatters:
      "Without out-of-sample testing, parameter optimization may overfit to historical noise.",
    file: null,
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Split data into train/test sets or implement walk-forward optimization.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-012",
    ruleId: "QL-EXEC-003",
    severity: "warning",
    category: "execution",
    title: "Market impact not modeled",
    description:
      "No market impact model is used. Large orders in illiquid conditions could move the market adversely.",
    whyItMatters:
      "Market impact increases execution costs for larger strategies and can make a profitable backtest unprofitable in practice.",
    file: null,
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Add a simple market impact model proportional to order size and average daily volume.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-013",
    ruleId: "QL-RISK-005",
    severity: "warning",
    category: "risk",
    title: "No leverage constraints",
    description:
      "The strategy does not explicitly limit leverage. With 100% allocation and margin, effective leverage could exceed safe levels.",
    whyItMatters:
      "Excessive leverage amplifies both gains and losses. Without constraints, margin calls become a significant risk.",
    file: null,
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Define and enforce a maximum leverage ratio (e.g., 1.0x for long-only, 2.0x for long-short).",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-014",
    ruleId: "QL-PERF-002",
    severity: "warning",
    category: "performance",
    title: "Parameter sensitivity not tested",
    description:
      "The window=20 and threshold=2.0 parameters appear hard-coded without sensitivity analysis.",
    whyItMatters:
      "Hard-coded parameters may produce fragile strategies that break under slight parameter changes.",
    file: "mean_reversion.py",
    line: 15,
    detectedPattern: "window=20, threshold=2.0",
    suggestedFix:
      "Run a parameter sweep across reasonable ranges and verify robustness.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-015",
    ruleId: "QL-EXEC-004",
    severity: "warning",
    category: "execution",
    title: "Dividend adjustments not verified",
    description:
      "It is unclear whether the price data is split- and dividend-adjusted. Unadjusted data can distort signal calculations.",
    whyItMatters:
      "Using non-adjusted prices creates artificial signal spikes on dividend dates.",
    file: "mean_reversion.py",
    line: 12,
    detectedPattern: null,
    suggestedFix:
      "Verify that the data source provides fully adjusted prices, or apply adjustments explicitly.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-016",
    ruleId: "QL-EXEC-005",
    severity: "warning",
    category: "execution",
    title: "No partial fill handling",
    description:
      "All orders are assumed to be fully filled. Partial fills are not modeled.",
    whyItMatters:
      "In real markets, especially for larger orders, partial fills are common and affect position management.",
    file: null,
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Add a fill rate model or acknowledge partial fill risk in the execution assumptions.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-017",
    ruleId: "QL-RISK-006",
    severity: "warning",
    category: "risk",
    title: "Tail risk not assessed",
    description:
      "No tail risk measures (VaR, CVaR) are calculated for the strategy returns.",
    whyItMatters:
      "Strategies can appear safe on average but carry significant tail risk during extreme market events.",
    file: null,
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Calculate and report Value-at-Risk (VaR) and Conditional VaR (CVaR) at the 95% and 99% confidence levels.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-018",
    ruleId: "QL-PERF-004",
    severity: "warning",
    category: "performance",
    title: "Benchmark comparison missing",
    description:
      "The strategy is not compared against a relevant benchmark (e.g., buy-and-hold SPY).",
    whyItMatters:
      "Without a benchmark, it is impossible to determine whether the strategy adds value over passive investing.",
    file: null,
    line: null,
    detectedPattern: null,
    suggestedFix:
      "Add a benchmark comparison to the performance metrics section.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
  {
    id: "v-019",
    ruleId: "QL-DATA-002",
    severity: "warning",
    category: "data",
    title: "Single-asset test universe",
    description:
      "The strategy is tested on a single instrument (SPY). Cross-asset validation is not performed.",
    whyItMatters:
      "Strategies that work on one instrument may fail on others. Cross-asset validation improves confidence.",
    file: "mean_reversion.py",
    line: 12,
    detectedPattern: null,
    suggestedFix:
      "Test the strategy across multiple instruments or asset classes.",
    codeSnippet: null,
    fixSnippet: null,
    status: "open",
  },
];

/* ── Metric Groups ───────────────────────────────────────── */

const MOCK_METRIC_GROUPS: MetricGroup[] = [
  {
    label: "Performance",
    metrics: [
      {
        key: "cagr",
        label: "CAGR",
        value: "18.7%",
        tooltip:
          "Compound Annual Growth Rate — the annualized return of the strategy over the backtest period.",
      },
      {
        key: "total_return",
        label: "Total Return",
        value: "142.6%",
        tooltip:
          "Cumulative percentage return from the start to the end of the backtest.",
      },
      {
        key: "sharpe",
        label: "Sharpe Ratio",
        value: "1.84",
        tooltip:
          "Measures risk-adjusted return relative to total portfolio volatility.",
      },
      {
        key: "sortino",
        label: "Sortino Ratio",
        value: "2.31",
        tooltip:
          "Measures risk-adjusted return using only downside volatility, ignoring upside variability.",
      },
      {
        key: "calmar",
        label: "Calmar Ratio",
        value: "1.51",
        tooltip:
          "Annualized return divided by the maximum drawdown, measuring return per unit of drawdown risk.",
      },
    ],
  },
  {
    label: "Risk",
    metrics: [
      {
        key: "max_drawdown",
        label: "Max Drawdown",
        value: "-12.4%",
        tooltip:
          "Largest peak-to-trough decline during the tested period.",
      },
      {
        key: "volatility",
        label: "Volatility",
        value: "14.8%",
        tooltip:
          "Annualized standard deviation of strategy returns.",
      },
      {
        key: "var_95",
        label: "VaR 95%",
        value: "-2.1%",
        tooltip:
          "Estimated maximum daily loss at the 95% confidence level.",
      },
      {
        key: "cvar_95",
        label: "CVaR 95%",
        value: "-3.4%",
        tooltip:
          "Expected loss exceeding the 95% VaR threshold (tail risk).",
      },
    ],
  },
  {
    label: "Trade Statistics",
    metrics: [
      {
        key: "win_rate",
        label: "Win Rate",
        value: "57.2%",
        tooltip:
          "Percentage of closed trades that were profitable.",
      },
      {
        key: "profit_factor",
        label: "Profit Factor",
        value: "1.74",
        tooltip:
          "Gross profits divided by gross losses. Values above 1.0 indicate net profitability.",
      },
      {
        key: "avg_win",
        label: "Average Win",
        value: "2.4%",
        tooltip:
          "Mean return of winning trades.",
      },
      {
        key: "avg_loss",
        label: "Average Loss",
        value: "-1.6%",
        tooltip:
          "Mean return of losing trades.",
      },
      {
        key: "expectancy",
        label: "Expectancy",
        value: "0.68%",
        tooltip:
          "Expected return per trade based on win rate, average win, and average loss.",
      },
    ],
  },
  {
    label: "Execution",
    metrics: [
      {
        key: "avg_turnover",
        label: "Avg. Turnover",
        value: "2.8x",
        tooltip:
          "Average annual portfolio turnover, measuring trading frequency.",
      },
      {
        key: "est_slippage",
        label: "Est. Slippage",
        value: "0.08%",
        tooltip:
          "Estimated average slippage per trade based on order size and liquidity.",
      },
      {
        key: "transaction_costs",
        label: "Transaction Costs",
        value: "0.12%",
        tooltip:
          "Total estimated commission and fee impact per trade.",
      },
    ],
  },
];

/* ── AI Explanations ─────────────────────────────────────── */

const MOCK_AI_EXPLANATIONS: AIExplanation[] = [
  {
    id: "ai-001",
    ruleId: "QL-BIAS-001",
    finding: "Look-ahead Bias",
    explanation:
      "The strategy appears to access information that would not have been available at the time the trading decision was made. Specifically, the use of shift(-1) on the close price series retrieves the next bar's value before the current bar has completed. This can inflate historical performance and produce misleading backtest results.",
    whyItMatters:
      "Backtests must only use information available at the decision timestamp. Any future data leakage makes the strategy appear more profitable than it would be in real-time trading.",
    suggestedFix:
      "Ensure rolling calculations and signal generation use only current and historical observations. Replace shift(-1) with shift(1) or use .rolling() windows that end at the current index.",
    confidence: 94,
    relatedViolationId: "v-001",
  },
  {
    id: "ai-002",
    ruleId: "QL-EXEC-001",
    finding: "Unrealistic Execution Model",
    explanation:
      "The portfolio simulation uses close prices for trade execution without modeling any execution delay. In practice, orders placed at the close would be filled at the next available price (typically the next bar's open), which can differ significantly from the close.",
    whyItMatters:
      "Execution timing assumptions directly impact reported returns. Even small differences between assumed and actual fill prices compound over hundreds of trades.",
    suggestedFix:
      "Use next-bar open pricing for trade execution, or add explicit slippage and delay parameters to model realistic order fills.",
    confidence: 91,
    relatedViolationId: "v-002",
  },
  {
    id: "ai-003",
    ruleId: "QL-COST-001",
    finding: "Missing Cost Model",
    explanation:
      "The strategy backtest does not include any transaction cost model. Every trade is assumed to be cost-free, which is never the case in real markets. Even at-scale institutional trading incurs costs from commissions, exchange fees, and market impact.",
    whyItMatters:
      "Transaction costs are one of the most common reasons profitable backtests fail in production. A strategy with a 1% annual edge may be entirely consumed by costs.",
    suggestedFix:
      "Add a commission model (e.g., 10bps for retail, 2–5bps for institutional) and include exchange fee estimates. Consider adding a market impact model for larger order sizes.",
    confidence: 97,
    relatedViolationId: "v-003",
  },
  {
    id: "ai-004",
    ruleId: "QL-RISK-004",
    finding: "Unbounded Position Sizing",
    explanation:
      "The strategy does not define maximum position size limits. This means a single signal could allocate the entire portfolio to one trade, creating extreme concentration risk.",
    whyItMatters:
      "Concentrated positions are the leading cause of catastrophic portfolio losses. Even a high-conviction strategy should enforce position limits.",
    suggestedFix:
      "Implement a maximum position size (e.g., 10–20% of portfolio per position) and add portfolio-level gross and net exposure limits.",
    confidence: 88,
    relatedViolationId: "v-006",
  },
  {
    id: "ai-005",
    ruleId: "QL-RISK-003",
    finding: "Missing Drawdown Protection",
    explanation:
      "No mechanism exists to reduce exposure or halt trading after significant losses. The strategy will continue executing signals regardless of cumulative drawdown, which could lead to total capital loss in adverse conditions.",
    whyItMatters:
      "Professional risk management always includes circuit breakers. A maximum drawdown threshold protects capital and provides time to reassess the strategy.",
    suggestedFix:
      "Add a drawdown circuit breaker that pauses trading when the portfolio drawdown exceeds a threshold (e.g., -15% from peak). Require manual review before resuming.",
    confidence: 92,
    relatedViolationId: "v-005",
  },
];

/* ── Recommendations ─────────────────────────────────────── */

const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-001",
    priority: 1,
    title: "Remove look-ahead bias",
    severity: "critical",
    why: "Future data leakage is the most impactful issue. It invalidates all backtest results until fixed.",
    suggestedAction:
      "Replace shift(-1) with shift(1) in signal generation. Verify that all data access is strictly causal.",
    relatedRuleId: "QL-BIAS-001",
    status: "open",
  },
  {
    id: "rec-002",
    priority: 2,
    title: "Add realistic transaction costs",
    severity: "critical",
    why: "Without transaction costs, the strategy's profitability is uncertain. This must be fixed before any performance conclusions.",
    suggestedAction:
      "Add fees=0.001 and slippage=0.002 (or appropriate estimates) to the portfolio simulation.",
    relatedRuleId: "QL-COST-001",
    status: "open",
  },
  {
    id: "rec-003",
    priority: 3,
    title: "Fix execution timing assumptions",
    severity: "critical",
    why: "Unrealistic fill prices inflate reported returns and Sharpe ratio.",
    suggestedAction:
      "Model execution at next-bar open prices or add explicit slippage parameters.",
    relatedRuleId: "QL-EXEC-001",
    status: "open",
  },
  {
    id: "rec-004",
    priority: 4,
    title: "Add drawdown protection",
    severity: "critical",
    why: "Without circuit breakers, the strategy could lose all capital in an adverse market regime.",
    suggestedAction:
      "Implement a maximum drawdown threshold (e.g., -15%) that pauses trading.",
    relatedRuleId: "QL-RISK-003",
    status: "open",
  },
  {
    id: "rec-005",
    priority: 5,
    title: "Configure slippage assumptions",
    severity: "warning",
    why: "Slippage directly affects realized P&L and is unavoidable in live trading.",
    suggestedAction:
      "Add slippage=0.001 to 0.005 depending on instrument liquidity.",
    relatedRuleId: "QL-EXEC-002",
    status: "open",
  },
  {
    id: "rec-006",
    priority: 6,
    title: "Add position exposure limits",
    severity: "warning",
    why: "Unbounded position sizing creates concentration risk that could lead to catastrophic losses.",
    suggestedAction:
      "Cap individual positions at 20% of portfolio and enforce gross exposure limits.",
    relatedRuleId: "QL-RISK-004",
    status: "open",
  },
  {
    id: "rec-007",
    priority: 7,
    title: "Extend backtest period",
    severity: "warning",
    why: "4 years may not capture enough market regimes to validate the strategy.",
    suggestedAction:
      "Extend to 10+ years including at least one bear market and one sideways market.",
    relatedRuleId: "QL-DATA-001",
    status: "open",
  },
  {
    id: "rec-008",
    priority: 8,
    title: "Add out-of-sample validation",
    severity: "warning",
    why: "Without train/test splitting, the strategy may be overfit to in-sample data.",
    suggestedAction:
      "Implement walk-forward optimization or a simple 70/30 train/test split.",
    relatedRuleId: "QL-PERF-003",
    status: "open",
  },
];

/* ── Timeline ────────────────────────────────────────────── */

const MOCK_TIMELINE: TimelineEntry[] = [
  { label: "Audit Started", timestamp: "13:41:02" },
  { label: "Strategy Parsed", timestamp: "13:41:03" },
  { label: "317 Rules Checked", timestamp: "13:41:08" },
  { label: "Bias Detection Complete", timestamp: "13:41:10" },
  { label: "Metrics Calculated", timestamp: "13:41:11" },
  { label: "AI Explanations Generated", timestamp: "13:41:12" },
  { label: "Audit Completed", timestamp: "13:41:13" },
];

/* ── Assembled Result ────────────────────────────────────── */

export const MOCK_AUDIT_RESULT: AuditResultData = {
  auditId: "QL-AUD-2026-0001",
  strategyName: "Mean Reversion Strategy",
  fileName: "mean_reversion.py",
  framework: "vectorbt",
  frameworkLabel: "vectorbt",
  analysisDepth: "Standard",
  rulesVersion: "v1.0.0",
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  inputType: "Python file",
  score: 92,
  grade: "A-",
  gradeStatus: "Good — minor issues detected",
  summary:
    "Your strategy passed most validation checks, but several issues require review before production use.",
  rulesChecked: 317,
  rulesPassed: 298,
  warnings: 14,
  critical: 5,
  violations: MOCK_VIOLATIONS,
  metricGroups: MOCK_METRIC_GROUPS,
  aiExplanations: MOCK_AI_EXPLANATIONS,
  recommendations: MOCK_RECOMMENDATIONS,
  timeline: MOCK_TIMELINE,
};

/* ── Export JSON helper ──────────────────────────────────── */

export function buildExportJson(result: AuditResultData): string {
  return JSON.stringify(
    {
      auditId: result.auditId,
      strategy: result.strategyName,
      fileName: result.fileName,
      framework: result.framework,
      analysisDepth: result.analysisDepth,
      rulesVersion: result.rulesVersion,
      createdAt: result.createdAt,
      completedAt: result.completedAt,
      score: result.score,
      grade: result.grade,
      rulesChecked: result.rulesChecked,
      passed: result.rulesPassed,
      warnings: result.warnings,
      critical: result.critical,
      violations: result.violations.map((v) => ({
        ruleId: v.ruleId,
        severity: v.severity,
        title: v.title,
        description: v.description,
        file: v.file,
        line: v.line,
        status: v.status,
      })),
      metrics: Object.fromEntries(
        result.metricGroups.flatMap((g) =>
          g.metrics.map((m) => [m.key, m.value])
        )
      ),
      recommendations: result.recommendations.map((r) => ({
        priority: r.priority,
        title: r.title,
        severity: r.severity,
        status: r.status,
      })),
    },
    null,
    2
  );
}
