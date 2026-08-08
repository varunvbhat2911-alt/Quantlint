/* ── QuantLint Documentation Registry ────────────────────────
 *
 * Single source of truth for all documentation pages.
 * Powers: sidebar navigation, search, prev/next pagination,
 * table of contents, and content rendering.
 *
 * To add a new doc page, add an entry to DOCS_REGISTRY.
 * ──────────────────────────────────────────────────────────── */

/* ── Types ───────────────────────────────────────────────── */

export type DocStatus = "available" | "planned" | "example" | "coming-soon";

export type DocSection = {
  id: string;
  heading: string;
  content: string; // Markdown-like plain text
  code?: { title?: string; language?: string; body: string };
  note?: string;
};

export type DocPage = {
  slug: string; // e.g. "getting-started" or "rules/bias-detection"
  title: string;
  description: string;
  keywords: string[];
  status: DocStatus;
  category: string; // Sidebar group label
  sections: DocSection[];
};

/* ── Navigation tree type ────────────────────────────────── */

export type DocNavGroup = {
  label: string;
  items: { slug: string; title: string; status: DocStatus }[];
};

/* ── Registry ────────────────────────────────────────────── */

export const DOCS_REGISTRY: DocPage[] = [
  /* ─── GETTING STARTED ──────────────────────────────────── */
  {
    slug: "getting-started",
    title: "Getting Started",
    description:
      "Learn what QuantLint does and how to run your first strategy audit.",
    keywords: ["introduction", "overview", "start", "setup", "workflow"],
    status: "available",
    category: "Getting Started",
    sections: [
      {
        id: "what-is-quantlint",
        heading: "What is QuantLint?",
        content:
          "QuantLint is a quality assurance platform for quantitative trading strategies. It performs static analysis on strategy source code, validates implementation against deterministic rules, calculates financial metrics, and generates actionable audit reports.\n\nQuantLint is designed for quant researchers, algorithmic traders, and portfolio managers who want to catch common implementation errors before backtesting or deploying a strategy.",
      },
      {
        id: "workflow",
        heading: "How It Works",
        content:
          "The QuantLint audit workflow follows a deterministic pipeline:\n\n1. **Strategy Input** — Upload or provide a Python strategy file\n2. **Static Analysis** — Parse the AST and analyze code structure\n3. **Rule Validation** — Evaluate 317+ validation rules across bias, risk, execution, data, and portfolio categories\n4. **Metrics Calculation** — Compute performance, risk, and trade statistics\n5. **AI Explanation** — Generate plain-language explanations for detected issues\n6. **Audit Report** — Produce a structured report with score, findings, and recommendations",
      },
      {
        id: "supported-frameworks",
        heading: "Supported Frameworks",
        content:
          "QuantLint currently supports analysis of strategies built with:\n\n- **vectorbt** — Vectorized backtesting\n- **Backtrader** — Event-driven framework\n- **Zipline** — Pipeline-based backtesting\n- **Pandas / Custom** — Custom implementations using pandas",
      },
      {
        id: "next-steps",
        heading: "Next Steps",
        content:
          "Continue to Installation to set up the QuantLint CLI, or explore the web dashboard to run audits interactively.",
      },
    ],
  },
  {
    slug: "installation",
    title: "Installation",
    description: "Install the QuantLint CLI and verify your setup.",
    keywords: ["install", "pip", "setup", "python", "cli"],
    status: "example",
    category: "Getting Started",
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        content:
          "- Python 3.9 or later\n- pip package manager\n- A quantitative strategy file (.py)",
      },
      {
        id: "install",
        heading: "Install via pip",
        content: "Install the QuantLint CLI from PyPI:",
        code: { title: "Terminal", language: "bash", body: "pip install quantlint" },
        note: "Planned CLI interface — the pip package is not yet published.",
      },
      {
        id: "verify",
        heading: "Verify Installation",
        content: "After installation, verify the CLI is available:",
        code: {
          title: "Terminal",
          language: "bash",
          body: "quantlint --version\n# quantlint v1.0.0",
        },
      },
    ],
  },
  {
    slug: "quick-start",
    title: "Quick Start",
    description:
      "Run your first QuantLint audit in under a minute.",
    keywords: ["quick", "start", "first", "audit", "example", "tutorial"],
    status: "example",
    category: "Getting Started",
    sections: [
      {
        id: "run-audit",
        heading: "Run Your First Audit",
        content:
          "Point QuantLint at any Python strategy file to run a full audit:",
        code: {
          title: "Terminal",
          language: "bash",
          body: "quantlint audit strategy.py",
        },
        note: "Example output — this command is part of the planned CLI interface.",
      },
      {
        id: "example-output",
        heading: "Example Output",
        content: "A successful audit produces a summary like this:",
        code: {
          title: "Output",
          language: "text",
          body: `QuantLint Audit — strategy.py

✓ Strategy parsed
✓ 317 rules evaluated
✓ Metrics calculated
✓ Audit completed

Score: 92/100  Grade: A-

5 critical findings
14 warnings
298 rules passed

Report saved to: quantlint-report-QL-AUD-0001.json`,
        },
      },
      {
        id: "next",
        heading: "What's Next",
        content:
          "Explore the CLI Reference for more options, or browse the Rules documentation to understand what QuantLint checks.",
      },
    ],
  },

  /* ─── CLI ──────────────────────────────────────────────── */
  {
    slug: "cli",
    title: "CLI Overview",
    description:
      "Run strategy audits, generate reports, and manage configuration from your terminal.",
    keywords: ["cli", "command", "terminal", "shell"],
    status: "planned",
    category: "CLI",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "The QuantLint CLI provides a command-line interface for running audits, viewing reports, and managing rules.\n\nAll CLI functionality described in this section is part of the planned command-line interface.",
        code: {
          title: "Usage",
          language: "bash",
          body: "quantlint [command] [options]",
        },
      },
      {
        id: "commands",
        heading: "Available Commands",
        content:
          "| Command | Description |\n|---|---|\n| `audit` | Run a strategy audit |\n| `report` | View or export audit reports |\n| `rules` | List and inspect validation rules |\n| `config` | Manage CLI configuration |\n| `version` | Show CLI version |",
      },
      {
        id: "global-options",
        heading: "Global Options",
        content:
          "| Flag | Description |\n|---|---|\n| `--help` | Show help for any command |\n| `--verbose` | Enable verbose output |\n| `--quiet` | Suppress non-essential output |\n| `--format` | Output format: `text`, `json`, `table` |",
      },
    ],
  },
  {
    slug: "cli/audit",
    title: "CLI: Audit",
    description: "Run a full strategy audit from the command line.",
    keywords: ["cli", "audit", "run", "command", "options"],
    status: "planned",
    category: "CLI",
    sections: [
      {
        id: "usage",
        heading: "Usage",
        content: "Run a strategy audit on a Python file:",
        code: {
          title: "Terminal",
          language: "bash",
          body: "quantlint audit <file> [options]",
        },
        note: "Planned CLI interface.",
      },
      {
        id: "options",
        heading: "Options",
        content:
          "| Flag | Default | Description |\n|---|---|---|\n| `--framework` | auto-detect | Framework: `vectorbt`, `backtrader`, `zipline`, `pandas` |\n| `--depth` | `standard` | Analysis depth: `quick`, `standard`, `deep` |\n| `--rules` | all | Comma-separated rule categories |\n| `--output` | `text` | Output format: `text`, `json`, `pdf` |\n| `--output-file` | stdout | Write report to file |",
      },
      {
        id: "examples",
        heading: "Examples",
        content: "",
        code: {
          title: "Examples",
          language: "bash",
          body: `# Basic audit
quantlint audit strategy.py

# Specify framework and depth
quantlint audit strategy.py --framework vectorbt --depth deep

# Filter to specific rule categories
quantlint audit strategy.py --rules bias,risk,execution

# Export JSON report
quantlint audit strategy.py --output json --output-file report.json`,
        },
      },
    ],
  },
  {
    slug: "cli/configuration",
    title: "CLI: Configuration",
    description: "Configure QuantLint defaults using a YAML configuration file.",
    keywords: ["cli", "config", "yaml", "configuration", "settings"],
    status: "planned",
    category: "CLI",
    sections: [
      {
        id: "config-file",
        heading: "Configuration File",
        content:
          "QuantLint looks for a `quantlint.yaml` file in the current directory or project root. This file defines default options for audits.",
        code: {
          title: "quantlint.yaml",
          language: "yaml",
          body: `framework: vectorbt

analysis:
  depth: standard
  timeout: 60

rules:
  bias_detection: true
  risk_management: true
  execution: true
  data_validation: true
  portfolio_logic: true
  metrics_validation: true

output:
  format: json
  directory: ./reports`,
        },
        note: "Planned configuration syntax.",
      },
      {
        id: "precedence",
        heading: "Option Precedence",
        content:
          "Options are applied in this order (last wins):\n\n1. Built-in defaults\n2. `quantlint.yaml` configuration file\n3. Command-line flags\n\nCommand-line flags always override configuration file values.",
      },
    ],
  },

  /* ─── RULES ────────────────────────────────────────────── */
  {
    slug: "rules",
    title: "Validation Rules",
    description:
      "Explore the deterministic validation rules QuantLint uses to identify strategy issues.",
    keywords: [
      "rules",
      "validation",
      "categories",
      "bias",
      "risk",
      "execution",
      "data",
    ],
    status: "available",
    category: "Rules",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "QuantLint evaluates strategies against 317+ deterministic validation rules organized into six categories. Each rule checks for a specific implementation pattern, risk factor, or data quality issue.\n\nRules are evaluated in order of severity: critical findings first, followed by warnings and informational notes.",
      },
      {
        id: "categories",
        heading: "Rule Categories",
        content:
          "| Category | Rules | Description |\n|---|---|---|\n| Bias Detection | ~45 | Look-ahead bias, survivorship bias, data leakage |\n| Risk Management | ~40 | Position sizing, exposure limits, stop-loss, leverage |\n| Execution Logic | ~55 | Slippage, transaction costs, fill assumptions, timing |\n| Data Validation | ~62 | Missing data, timestamps, timezone, data integrity |\n| Portfolio Logic | ~75 | Position limits, weights, rebalancing, cash handling |\n| Metrics Validation | ~40 | Sharpe calculation, benchmark comparison, out-of-sample |",
      },
      {
        id: "severity",
        heading: "Severity Levels",
        content:
          "Each rule violation is assigned a severity:\n\n- **Critical** — Issues that can invalidate backtest results (e.g., look-ahead bias)\n- **Warning** — Issues that may affect reliability but don't invalidate results\n- **Info** — Suggestions for improvement without immediate risk",
      },
    ],
  },
  {
    slug: "rules/bias-detection",
    title: "Bias Detection",
    description:
      "Rules for detecting look-ahead bias, survivorship bias, and data leakage.",
    keywords: [
      "bias",
      "look-ahead",
      "survivorship",
      "data leakage",
      "future",
      "shift",
    ],
    status: "available",
    category: "Rules",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "Bias detection rules identify cases where a strategy uses information that would not have been available at the time a trading decision was made. These are the most critical issues because they can completely invalidate backtest results.",
      },
      {
        id: "look-ahead",
        heading: "Look-ahead Bias (QL-BIAS-001)",
        content:
          "Detects future information leaking into historical signals. The most common pattern is using `shift(-1)` or similar operations that reference future data.\n\n**Why it matters:** A strategy that knows tomorrow's price today will always appear profitable in backtesting, but this performance is impossible to replicate in live trading.",
        code: {
          title: "Problem",
          language: "python",
          body: `# ❌ Look-ahead bias: shift(-1) uses the NEXT bar's value
signal = close.shift(-1) > rolling_mean`,
        },
      },
      {
        id: "look-ahead-fix",
        heading: "Suggested Fix",
        content: "Use only current and historical data for signal generation:",
        code: {
          title: "Solution",
          language: "python",
          body: `# ✓ Causal: uses current bar only
signal = close > rolling_mean`,
        },
      },
      {
        id: "survivorship",
        heading: "Survivorship Bias (QL-BIAS-003)",
        content:
          "Detects when a strategy is tested only on instruments that survived to the present day. Testing only on survivors inflates performance by excluding failed or delisted assets.\n\n**Detection pattern:** Single-instrument backtests on major indices (SPY, QQQ) or hard-coded ticker lists.",
      },
      {
        id: "data-leakage",
        heading: "Data Leakage",
        content:
          "Detects patterns where future information may contaminate training data or signal generation:\n\n- Fitting models on the full dataset before train/test splitting\n- Using future timestamps in feature engineering\n- Including forward-looking economic indicators",
      },
    ],
  },
  {
    slug: "rules/risk-management",
    title: "Risk Management",
    description:
      "Rules for position sizing, exposure limits, stop-loss logic, and leverage constraints.",
    keywords: [
      "risk",
      "position",
      "stop-loss",
      "drawdown",
      "leverage",
      "exposure",
    ],
    status: "available",
    category: "Rules",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "Risk management rules ensure strategies include adequate safeguards against catastrophic losses. These rules check for position size limits, drawdown protection, stop-loss mechanisms, and leverage constraints.",
      },
      {
        id: "position-sizing",
        heading: "Position Sizing (QL-RISK-004)",
        content:
          "Verifies that the strategy defines maximum position sizes and portfolio exposure limits. Strategies without position limits can allocate 100% of capital to a single trade.\n\n**Suggested approach:** Cap individual positions at 10–20% of portfolio value.",
      },
      {
        id: "drawdown-protection",
        heading: "Drawdown Protection (QL-RISK-003)",
        content:
          "Checks for maximum drawdown circuit breakers. Without drawdown protection, a strategy could continue trading through severe losses.\n\n**Suggested approach:** Implement a drawdown threshold (e.g., -15%) that pauses trading and requires manual review.",
      },
      {
        id: "stop-loss",
        heading: "Stop-Loss Logic (QL-RISK-001)",
        content:
          "Verifies that the strategy includes stop-loss orders or trailing stops. Without stop-losses, positions can experience unlimited adverse movement.\n\n**Suggested approach:** Add per-trade stop-losses at 2–5% depending on asset volatility.",
      },
      {
        id: "leverage",
        heading: "Leverage Constraints (QL-RISK-005)",
        content:
          "Checks that the strategy explicitly limits leverage. Excessive leverage amplifies both gains and losses.\n\n**Suggested approach:** Define maximum leverage (e.g., 1.0x for long-only, 2.0x for long-short).",
      },
    ],
  },
  {
    slug: "rules/execution",
    title: "Execution Rules",
    description:
      "Rules for slippage, transaction costs, fill assumptions, and order timing.",
    keywords: [
      "execution",
      "slippage",
      "transaction",
      "costs",
      "fill",
      "timing",
      "liquidity",
    ],
    status: "available",
    category: "Rules",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "Execution rules ensure that backtest assumptions about order execution are realistic. Unrealistic execution assumptions are one of the most common reasons strategies fail in live trading.",
      },
      {
        id: "slippage",
        heading: "Slippage (QL-EXEC-002)",
        content:
          "Verifies that slippage is modeled in the portfolio simulation. Slippage is the difference between the expected fill price and the actual fill price.\n\n**Typical values:** 5–20 basis points for liquid equities, higher for small caps or illiquid instruments.",
      },
      {
        id: "transaction-costs",
        heading: "Transaction Costs (QL-COST-001)",
        content:
          "Checks that commission and fee models are included. Every trade incurs costs that compound over hundreds of trades.\n\n**Typical values:** 1–10 basis points per trade depending on broker and instrument.",
        code: {
          title: "Example",
          language: "python",
          body: `# ✓ Include transaction costs in simulation
portfolio = vbt.Portfolio.from_signals(
    close=price,
    entries=entries,
    exits=exits,
    fees=0.001,       # 10bps commission
    slippage=0.002,   # 20bps slippage
)`,
        },
      },
      {
        id: "fill-assumptions",
        heading: "Fill Assumptions (QL-EXEC-001)",
        content:
          "Detects when orders are assumed to fill at prices unavailable at decision time (e.g., filling at the close price when the decision is made at close).\n\n**Suggested approach:** Use next-bar open pricing or add explicit execution delay.",
      },
      {
        id: "market-impact",
        heading: "Market Impact (QL-EXEC-003)",
        content:
          "Checks for market impact modeling. Large orders can move the market adversely, especially in illiquid conditions.\n\n**Suggested approach:** Add a market impact model proportional to order size and average daily volume.",
      },
    ],
  },
  {
    slug: "rules/data-validation",
    title: "Data Validation",
    description:
      "Rules for data quality, missing values, timestamps, and timezone consistency.",
    keywords: [
      "data",
      "validation",
      "missing",
      "timestamp",
      "timezone",
      "quality",
    ],
    status: "available",
    category: "Rules",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "Data validation rules ensure that the input data used by the strategy meets quality standards. Poor data quality can produce misleading backtest results.",
      },
      {
        id: "missing-data",
        heading: "Missing Data",
        content:
          "Detects strategies that don't handle missing values (NaN). Missing prices can cause signals to fire incorrectly or metrics to be miscalculated.\n\n**Suggested approach:** Drop or forward-fill missing values explicitly.",
      },
      {
        id: "timestamps",
        heading: "Duplicate Timestamps",
        content:
          "Checks for duplicate timestamps in the price series. Duplicates can cause the strategy to process the same bar twice.",
      },
      {
        id: "timezone",
        heading: "Timezone Consistency",
        content:
          "Verifies that all timestamps use a consistent timezone. Mixing timezones can cause signals to misalign with market hours.",
      },
      {
        id: "adjustments",
        heading: "Price Adjustments (QL-EXEC-004)",
        content:
          "Checks whether price data is split- and dividend-adjusted. Unadjusted prices create artificial signal spikes on corporate action dates.",
      },
      {
        id: "data-leakage",
        heading: "Data Leakage",
        content:
          "Identifies patterns where future information contaminates the training pipeline — e.g., normalizing features using the full dataset instead of a rolling window.",
      },
    ],
  },
  {
    slug: "rules/portfolio-logic",
    title: "Portfolio Logic",
    description:
      "Rules for position limits, portfolio weights, rebalancing, and multi-asset logic.",
    keywords: [
      "portfolio",
      "position",
      "weights",
      "rebalancing",
      "cash",
      "exposure",
    ],
    status: "available",
    category: "Rules",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "Portfolio logic rules validate how the strategy manages positions, allocates capital, and handles multi-asset portfolios.",
      },
      {
        id: "position-limits",
        heading: "Position Limits",
        content:
          "Verifies that maximum position sizes are defined and enforced. Without limits, a single signal could allocate the entire portfolio to one position.",
      },
      {
        id: "weights",
        heading: "Portfolio Weights",
        content:
          "Checks that portfolio weights sum to a valid total and that individual weights are bounded. Weights exceeding 1.0 imply leverage.",
      },
      {
        id: "rebalancing",
        heading: "Rebalancing Logic",
        content:
          "Validates rebalancing frequency and method. Strategies should define when and how the portfolio is rebalanced — calendar-based, threshold-based, or signal-driven.",
      },
      {
        id: "cash",
        heading: "Cash Handling",
        content:
          "Verifies that uninvested cash is tracked correctly. Some backtesting frameworks silently ignore cash, which can overstate returns.",
      },
      {
        id: "multi-asset",
        heading: "Multi-Asset Logic",
        content:
          "For strategies trading multiple instruments, validates that correlation, sector exposure, and cross-asset dependencies are considered.",
      },
    ],
  },

  /* ─── METRICS ──────────────────────────────────────────── */
  {
    slug: "metrics",
    title: "Financial Metrics",
    description:
      "Understand the performance, risk, and trade metrics used in QuantLint audit reports.",
    keywords: ["metrics", "performance", "risk", "statistics", "financial"],
    status: "available",
    category: "Metrics",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "QuantLint computes and reports quantitative performance and risk metrics for audited strategies. Metrics are grouped into four categories:\n\n- **Performance** — Return and risk-adjusted return measures\n- **Risk** — Drawdown, volatility, and tail risk measures\n- **Trade Statistics** — Win rate, profit factor, and per-trade analysis\n- **Execution** — Turnover, slippage, and cost estimates",
        note: "All metrics shown in reports are computed from mock demonstration data.",
      },
    ],
  },
  {
    slug: "metrics/performance",
    title: "Performance Metrics",
    description:
      "CAGR, Total Return, Sharpe Ratio, Sortino Ratio, and Calmar Ratio.",
    keywords: [
      "cagr",
      "return",
      "sharpe",
      "sortino",
      "calmar",
      "performance",
    ],
    status: "available",
    category: "Metrics",
    sections: [
      {
        id: "cagr",
        heading: "CAGR (Compound Annual Growth Rate)",
        content:
          "The annualized return of the strategy over the backtest period, accounting for compounding.\n\n**Interpretation:** Higher is better, but should be evaluated alongside risk metrics. A high CAGR with extreme drawdowns may not be desirable.\n\n**Caveat:** CAGR is sensitive to the backtest period. Short periods can produce misleading values.",
      },
      {
        id: "total-return",
        heading: "Total Return",
        content:
          "Cumulative percentage return from start to end of the backtest.\n\n**Interpretation:** Shows the overall growth of $1 invested at the start.\n\n**Caveat:** Does not account for time — a 100% return over 1 year is very different from 100% over 10 years.",
      },
      {
        id: "sharpe",
        heading: "Sharpe Ratio",
        content:
          "Measures risk-adjusted return relative to total portfolio volatility. Calculated as (Return − Risk-Free Rate) / Volatility.\n\n**Interpretation:** Values above 1.0 are acceptable, above 2.0 are strong. The industry benchmark for a good strategy is typically 1.5+.\n\n**Caveat:** Assumes normally distributed returns, which is often not the case for trading strategies.",
      },
      {
        id: "sortino",
        heading: "Sortino Ratio",
        content:
          "Similar to Sharpe but uses only downside volatility, ignoring upside variability.\n\n**Interpretation:** More appropriate for strategies with asymmetric return profiles. Higher is better.\n\n**Caveat:** Requires sufficient data points to estimate downside deviation reliably.",
      },
      {
        id: "calmar",
        heading: "Calmar Ratio",
        content:
          "Annualized return divided by the maximum drawdown. Measures return earned per unit of drawdown risk.\n\n**Interpretation:** Higher is better. A Calmar above 1.0 means the strategy's annual return exceeds its worst drawdown.\n\n**Caveat:** Highly sensitive to a single extreme drawdown event.",
      },
    ],
  },
  {
    slug: "metrics/risk",
    title: "Risk Metrics",
    description:
      "Maximum Drawdown, Volatility, VaR, CVaR, and exposure metrics.",
    keywords: [
      "risk",
      "drawdown",
      "volatility",
      "var",
      "cvar",
      "beta",
      "exposure",
    ],
    status: "available",
    category: "Metrics",
    sections: [
      {
        id: "max-drawdown",
        heading: "Maximum Drawdown",
        content:
          "The largest peak-to-trough decline during the backtest period, expressed as a percentage.\n\n**Interpretation:** A max drawdown of -12.4% means the portfolio lost 12.4% from its highest point before recovering.\n\n**Caveat:** Historical drawdowns are not predictive — future drawdowns may be worse.",
      },
      {
        id: "volatility",
        heading: "Volatility",
        content:
          "Annualized standard deviation of strategy returns. Measures the overall variability of returns.\n\n**Interpretation:** Lower volatility generally indicates a smoother equity curve. Typical range for equity strategies: 10–25%.",
      },
      {
        id: "var",
        heading: "Value at Risk (VaR)",
        content:
          "The estimated maximum daily loss at a given confidence level (typically 95%).\n\n**Interpretation:** A VaR of -2.1% at 95% means there is a 5% chance the daily loss will exceed 2.1%.\n\n**Caveat:** VaR does not describe the magnitude of losses beyond the threshold.",
      },
      {
        id: "cvar",
        heading: "Conditional VaR (CVaR)",
        content:
          "The expected loss given that the loss exceeds the VaR threshold. Also called Expected Shortfall.\n\n**Interpretation:** Provides a better picture of tail risk than VaR alone. A CVaR of -3.4% means that on the worst 5% of days, the average loss is 3.4%.",
      },
      {
        id: "beta",
        heading: "Beta",
        content:
          "Measures the strategy's sensitivity to benchmark (market) movements.\n\n**Interpretation:** Beta of 1.0 means the strategy moves with the market. Below 1.0 indicates lower market sensitivity.",
      },
      {
        id: "exposure",
        heading: "Net / Gross Exposure",
        content:
          "Net exposure is long minus short positions; gross exposure is the sum of absolute values. These metrics indicate the strategy's market directionality and overall leverage.\n\n**Interpretation:** A market-neutral strategy has near-zero net exposure.",
      },
    ],
  },
  {
    slug: "metrics/trade-statistics",
    title: "Trade Statistics",
    description:
      "Win Rate, Profit Factor, Average Win/Loss, Expectancy, and Turnover.",
    keywords: [
      "trade",
      "win rate",
      "profit factor",
      "expectancy",
      "turnover",
    ],
    status: "available",
    category: "Metrics",
    sections: [
      {
        id: "win-rate",
        heading: "Win Rate",
        content:
          "Percentage of closed trades that were profitable.\n\n**Interpretation:** A win rate above 50% is not required for profitability — it depends on the average win vs. average loss.\n\n**Caveat:** Win rate alone is meaningless without knowing the average win and loss sizes.",
      },
      {
        id: "profit-factor",
        heading: "Profit Factor",
        content:
          "Gross profits divided by gross losses. Values above 1.0 indicate net profitability.\n\n**Interpretation:** A profit factor of 1.74 means $1.74 is earned for every $1 lost. Values above 1.5 are generally considered robust.",
      },
      {
        id: "avg-win-loss",
        heading: "Average Win / Average Loss",
        content:
          "Mean return of winning trades and losing trades respectively.\n\n**Interpretation:** The ratio of average win to average loss (reward-to-risk ratio) should ideally exceed 1.0. A strategy can be profitable with a low win rate if the average win significantly exceeds the average loss.",
      },
      {
        id: "expectancy",
        heading: "Expectancy",
        content:
          "Expected return per trade, calculated as: (Win Rate × Average Win) − ((1 − Win Rate) × |Average Loss|).\n\n**Interpretation:** Positive expectancy means the strategy is expected to be profitable over a large number of trades.\n\n**Caveat:** Assumes trade outcomes are statistically independent, which may not hold for correlated markets.",
      },
      {
        id: "turnover",
        heading: "Turnover",
        content:
          "Average annual portfolio turnover, measuring how frequently the portfolio is traded.\n\n**Interpretation:** Higher turnover increases transaction costs and tax implications. A turnover of 2.8x means the portfolio is fully replaced 2.8 times per year.",
      },
    ],
  },

  /* ─── API ──────────────────────────────────────────────── */
  {
    slug: "api",
    title: "API Overview",
    description:
      "Integrate QuantLint into your own workflows with the REST API.",
    keywords: ["api", "rest", "integration", "endpoint"],
    status: "planned",
    category: "API",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "The QuantLint API provides programmatic access to strategy auditing. Use it to integrate QuantLint into CI/CD pipelines, research notebooks, or custom dashboards.",
        note: "The API is planned and not currently available. Endpoints described here are conceptual.",
      },
      {
        id: "base-url",
        heading: "Base URL",
        content: "",
        code: {
          title: "Base URL",
          language: "text",
          body: "https://api.quantlint.com/v1",
        },
      },
      {
        id: "endpoints",
        heading: "Endpoints",
        content:
          "| Method | Endpoint | Description |\n|---|---|---|\n| `POST` | `/audits` | Create a new audit |\n| `GET` | `/audits/:id` | Get audit status and result |\n| `GET` | `/audits/:id/report` | Get full audit report |\n| `GET` | `/rules` | List available validation rules |",
      },
      {
        id: "auth",
        heading: "Authentication",
        content:
          "All API requests require a Bearer token in the Authorization header.\n\nAPI keys will be available from the QuantLint dashboard when the API is launched.",
        code: {
          title: "Header",
          language: "text",
          body: 'Authorization: Bearer <your-api-key>',
        },
      },
    ],
  },
  {
    slug: "api/overview",
    title: "API: Getting Started",
    description: "Learn how to authenticate and make your first API request.",
    keywords: ["api", "auth", "getting started", "curl"],
    status: "planned",
    category: "API",
    sections: [
      {
        id: "first-request",
        heading: "Your First Request",
        content: "Create an audit by sending a POST request with your strategy file:",
        code: {
          title: "cURL",
          language: "bash",
          body: `curl -X POST https://api.quantlint.com/v1/audits \\
  -H "Authorization: Bearer $QUANTLINT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "strategy": "strategy.py",
    "framework": "vectorbt",
    "analysis_depth": "standard"
  }'`,
        },
        note: "Example API schema — not currently connected.",
      },
      {
        id: "response",
        heading: "Response",
        content: "The API returns a JSON object with the audit ID and status:",
        code: {
          title: "Response (201 Created)",
          language: "json",
          body: `{
  "id": "QL-AUD-0001",
  "status": "processing",
  "created_at": "2026-08-08T13:41:02Z"
}`,
        },
      },
      {
        id: "rate-limits",
        heading: "Rate Limits",
        content:
          "API rate limits will be announced when the API launches. Free tier plans are expected to allow 100 audits per month.",
      },
    ],
  },
  {
    slug: "api/audits",
    title: "API: Audits",
    description: "Create, retrieve, and manage audits via the API.",
    keywords: ["api", "audits", "create", "get", "status"],
    status: "planned",
    category: "API",
    sections: [
      {
        id: "create",
        heading: "Create Audit",
        content: "",
        code: {
          title: "POST /audits",
          language: "json",
          body: `// Request body
{
  "strategy": "strategy.py",
  "framework": "vectorbt",
  "analysis_depth": "standard"
}

// Response (201 Created)
{
  "id": "QL-AUD-0001",
  "status": "completed",
  "score": 92,
  "grade": "A-",
  "rules_checked": 317,
  "critical": 5,
  "warnings": 14,
  "created_at": "2026-08-08T13:41:02Z",
  "completed_at": "2026-08-08T13:41:13Z"
}`,
        },
        note: "Example API schema — not currently connected.",
      },
      {
        id: "get",
        heading: "Get Audit",
        content: "Retrieve an audit by ID:",
        code: {
          title: "GET /audits/:id",
          language: "json",
          body: `// Response (200 OK)
{
  "id": "QL-AUD-0001",
  "status": "completed",
  "score": 92,
  "grade": "A-",
  "strategy_name": "Mean Reversion Strategy",
  "file_name": "mean_reversion.py",
  "framework": "vectorbt",
  "rules_checked": 317,
  "passed": 298,
  "warnings": 14,
  "critical": 5
}`,
        },
      },
    ],
  },
  {
    slug: "api/reports",
    title: "API: Reports",
    description: "Retrieve full audit reports with findings, metrics, and recommendations.",
    keywords: ["api", "reports", "findings", "metrics", "download"],
    status: "planned",
    category: "API",
    sections: [
      {
        id: "get-report",
        heading: "Get Report",
        content: "Retrieve the full audit report:",
        code: {
          title: "GET /audits/:id/report",
          language: "json",
          body: `// Response (200 OK)
{
  "audit_id": "QL-AUD-0001",
  "score": 92,
  "grade": "A-",
  "findings": [
    {
      "rule_id": "QL-BIAS-001",
      "severity": "critical",
      "title": "Look-ahead bias detected",
      "file": "mean_reversion.py",
      "line": 42
    }
  ],
  "metrics": {
    "cagr": "18.7%",
    "sharpe": "1.84",
    "max_drawdown": "-12.4%"
  },
  "recommendations": [
    {
      "priority": 1,
      "title": "Remove look-ahead bias",
      "severity": "critical"
    }
  ]
}`,
        },
        note: "Planned API — this response schema is illustrative.",
      },
    ],
  },

  /* ─── EXAMPLES ─────────────────────────────────────────── */
  {
    slug: "examples",
    title: "Strategy Examples",
    description:
      "Explore example quantitative strategies and see how QuantLint analyzes them.",
    keywords: ["examples", "strategy", "mean reversion", "momentum", "pairs"],
    status: "example",
    category: "Examples",
    sections: [
      {
        id: "overview",
        heading: "Overview",
        content:
          "These example strategies demonstrate common quantitative trading patterns and the types of issues QuantLint can detect.\n\nAll examples are for demonstration purposes only. They are not investment advice and should not be used for live trading without significant additional research and risk management.",
      },
    ],
  },
  {
    slug: "examples/mean-reversion",
    title: "Mean Reversion",
    description:
      "Example mean reversion strategy using z-score signals with vectorbt.",
    keywords: [
      "mean reversion",
      "z-score",
      "vectorbt",
      "example",
      "strategy",
    ],
    status: "example",
    category: "Examples",
    sections: [
      {
        id: "concept",
        heading: "Strategy Concept",
        content:
          "Mean reversion strategies profit from the tendency of asset prices to revert to their historical average. When price deviates significantly from the mean (measured by z-score), the strategy enters a position betting on reversion.",
      },
      {
        id: "code",
        heading: "Example Code",
        content: "",
        code: {
          title: "mean_reversion.py",
          language: "python",
          body: `import vectorbt as vbt
import numpy as np

# Download price data
price = vbt.YFData.download("SPY", start="2020-01-01", end="2023-12-31").get("Close")

# Calculate rolling statistics
window = 20
rolling_mean = price.rolling(window).mean()
rolling_std = price.rolling(window).std()

# Z-score signal
z_score = (price - rolling_mean) / rolling_std

# Entry/exit signals
entries = z_score < -2.0  # Enter when price is 2 std below mean
exits = z_score > 0.0     # Exit when price reverts to mean

# Run backtest
portfolio = vbt.Portfolio.from_signals(
    close=price,
    entries=entries,
    exits=exits,
    init_cash=100_000,
    fees=0.001,
    slippage=0.002,
)

print(f"Total Return: {portfolio.total_return():.2%}")
print(f"Sharpe Ratio: {portfolio.sharpe_ratio():.2f}")`,
        },
        note: "Example strategy for demonstration purposes only. Not investment advice.",
      },
      {
        id: "risks",
        heading: "Potential Audit Findings",
        content:
          "QuantLint would detect the following issues in this strategy:\n\n- **QL-DATA-001** — Limited backtest period (4 years)\n- **QL-BIAS-003** — Single-instrument survivorship risk (SPY only)\n- **QL-RISK-001** — No stop-loss mechanism\n- **QL-RISK-003** — No drawdown protection\n- **QL-PERF-002** — Hard-coded parameters without sensitivity analysis",
      },
    ],
  },
  {
    slug: "examples/momentum",
    title: "Momentum Strategy",
    description:
      "Example cross-sectional momentum strategy using rolling returns.",
    keywords: ["momentum", "cross-sectional", "returns", "ranking", "example"],
    status: "example",
    category: "Examples",
    sections: [
      {
        id: "concept",
        heading: "Strategy Concept",
        content:
          "Momentum strategies buy assets that have performed well recently and sell assets that have performed poorly. This example uses a simple 12-month lookback to rank assets by past performance.",
      },
      {
        id: "code",
        heading: "Example Code",
        content: "",
        code: {
          title: "momentum.py",
          language: "python",
          body: `import pandas as pd
import numpy as np

# Load price data (example using multiple assets)
tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"]
prices = pd.DataFrame()
for ticker in tickers:
    prices[ticker] = load_prices(ticker)  # placeholder

# Calculate 12-month momentum (rolling return)
lookback = 252  # trading days
momentum = prices.pct_change(lookback)

# Rank assets by momentum each day
ranks = momentum.rank(axis=1, ascending=False)

# Go long top 2, short bottom 2
long_signals = ranks <= 2
short_signals = ranks >= len(tickers) - 1

# Equal-weight positions
weights = pd.DataFrame(0.0, index=prices.index, columns=tickers)
weights[long_signals] = 0.25
weights[short_signals] = -0.25

# Calculate strategy returns
strategy_returns = (weights.shift(1) * prices.pct_change()).sum(axis=1)`,
        },
        note: "Example strategy for demonstration purposes only.",
      },
      {
        id: "risks",
        heading: "Potential Audit Findings",
        content:
          "QuantLint would flag:\n\n- **QL-EXEC-001** — No execution delay modeled (weights applied same day)\n- **QL-COST-001** — Missing transaction costs on rebalancing\n- **QL-RISK-004** — Position sizes may exceed limits during transitions\n- **QL-BIAS-001** — Potential look-ahead if `pct_change` calculation includes the current bar",
      },
    ],
  },
  {
    slug: "examples/pairs-trading",
    title: "Pairs Trading",
    description:
      "Example statistical arbitrage pairs trading strategy.",
    keywords: ["pairs", "trading", "spread", "cointegration", "arbitrage"],
    status: "example",
    category: "Examples",
    sections: [
      {
        id: "concept",
        heading: "Strategy Concept",
        content:
          "Pairs trading exploits the relative mispricing between two correlated assets. When the spread between the pair deviates from its historical mean, the strategy enters a market-neutral position expecting the spread to revert.",
      },
      {
        id: "code",
        heading: "Example Code",
        content: "",
        code: {
          title: "pairs_trading.py",
          language: "python",
          body: `import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import coint

# Load price data for the pair
asset_a = load_prices("GLD")   # Gold ETF
asset_b = load_prices("GDX")   # Gold Miners ETF

# Test for cointegration
score, pvalue, _ = coint(asset_a, asset_b)
print(f"Cointegration p-value: {pvalue:.4f}")

# Calculate the spread
hedge_ratio = np.polyfit(asset_b, asset_a, 1)[0]
spread = asset_a - hedge_ratio * asset_b

# Normalize the spread (z-score)
spread_mean = spread.rolling(60).mean()
spread_std = spread.rolling(60).std()
z_spread = (spread - spread_mean) / spread_std

# Trading signals
long_entry = z_spread < -2.0   # Spread is cheap
short_entry = z_spread > 2.0   # Spread is expensive
exit_signal = abs(z_spread) < 0.5

# Position management
position = pd.Series(0.0, index=spread.index)
position[long_entry] = 1.0     # Long A, Short B
position[short_entry] = -1.0   # Short A, Long B
position[exit_signal] = 0.0`,
        },
        note: "Example strategy for demonstration purposes only.",
      },
      {
        id: "risks",
        heading: "Potential Audit Findings",
        content:
          "QuantLint would flag:\n\n- **QL-BIAS-003** — Pair selection using full-period cointegration (look-ahead risk)\n- **QL-RISK-005** — No leverage constraints on the market-neutral portfolio\n- **QL-DATA-001** — Hedge ratio estimated on full dataset, not rolling\n- **QL-EXEC-002** — Simultaneous execution of both legs assumed (unrealistic)",
      },
    ],
  },
];

/* ── Navigation Tree ─────────────────────────────────────── */

export function getDocNavGroups(): DocNavGroup[] {
  const groups: DocNavGroup[] = [];
  const seen = new Set<string>();

  for (const page of DOCS_REGISTRY) {
    if (!seen.has(page.category)) {
      seen.add(page.category);
      groups.push({
        label: page.category,
        items: DOCS_REGISTRY.filter((p) => p.category === page.category).map(
          (p) => ({ slug: p.slug, title: p.title, status: p.status })
        ),
      });
    }
  }
  return groups;
}

/* ── Lookup helpers ──────────────────────────────────────── */

export function getDocBySlug(slug: string): DocPage | undefined {
  return DOCS_REGISTRY.find((p) => p.slug === slug);
}

export function getDocPagination(slug: string): {
  prev?: { slug: string; title: string };
  next?: { slug: string; title: string };
} {
  const idx = DOCS_REGISTRY.findIndex((p) => p.slug === slug);
  return {
    prev:
      idx > 0
        ? { slug: DOCS_REGISTRY[idx - 1].slug, title: DOCS_REGISTRY[idx - 1].title }
        : undefined,
    next:
      idx < DOCS_REGISTRY.length - 1
        ? { slug: DOCS_REGISTRY[idx + 1].slug, title: DOCS_REGISTRY[idx + 1].title }
        : undefined,
  };
}

export function searchDocs(query: string): DocPage[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return DOCS_REGISTRY.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.keywords.some((k) => k.includes(q)) ||
      p.sections.some(
        (s) =>
          s.heading.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q)
      )
  );
}
