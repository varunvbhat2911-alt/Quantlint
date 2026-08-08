/* ── Audit Draft Types & Example Strategies ─────────────── */

export type InputMethod = "upload" | "paste";

export type AnalysisDepth = "standard" | "deep" | "fast";

export type Framework =
  | "auto"
  | "vectorbt"
  | "backtrader"
  | "zipline"
  | "pandas";

export const FRAMEWORK_OPTIONS: { value: Framework; label: string }[] = [
  { value: "auto", label: "Auto Detect" },
  { value: "vectorbt", label: "vectorbt" },
  { value: "backtrader", label: "Backtrader" },
  { value: "zipline", label: "Zipline" },
  { value: "pandas", label: "Pandas / Custom" },
];

export const ANALYSIS_DEPTH_OPTIONS: {
  value: AnalysisDepth;
  label: string;
  description: string;
}[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Balanced speed and coverage",
  },
  { value: "deep", label: "Deep", description: "Maximum rule coverage" },
  { value: "fast", label: "Fast", description: "Quick surface-level checks" },
];

export const RULE_CATEGORIES = [
  "Look-ahead Bias",
  "Data Leakage",
  "Survivorship Bias",
  "Risk Management",
  "Position Sizing",
  "Performance Metrics",
  "Execution Logic",
  "Transaction Costs",
  "Portfolio Logic",
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export type AuditDraft = {
  id: string;
  strategyName: string;
  inputType: InputMethod;
  fileName: string | null;
  framework: Framework;
  analysisDepth: AnalysisDepth;
  ruleCategories: RuleCategory[];
  code: string;
  createdAt: string;
};

/* ── Example strategies ──────────────────────────────────── */

export type ExampleStrategy = {
  id: string;
  name: string;
  description: string;
  framework: Framework;
  code: string;
};

export const EXAMPLE_STRATEGIES: ExampleStrategy[] = [
  {
    id: "ex-mean-reversion",
    name: "Mean Reversion",
    description: "A simple moving-average mean reversion strategy.",
    framework: "vectorbt",
    code: `import numpy as np
import pandas as pd
import vectorbt as vbt

# Mean Reversion Strategy (Demo)
# NOTE: This is a fictional example for demonstration purposes only.
# It does not represent a profitable trading strategy.

def mean_reversion_signal(close: pd.Series, window: int = 20, threshold: float = 2.0):
    """Generate mean reversion signals based on z-score."""
    rolling_mean = close.rolling(window=window).mean()
    rolling_std = close.rolling(window=window).std()
    z_score = (close - rolling_mean) / rolling_std

    entries = z_score < -threshold   # Buy when price is below mean
    exits = z_score > threshold      # Sell when price is above mean
    return entries, exits

# Fetch sample data
price = vbt.YFData.download("SPY", start="2020-01-01", end="2023-12-31").get("Close")

entries, exits = mean_reversion_signal(price)

portfolio = vbt.Portfolio.from_signals(
    close=price,
    entries=entries,
    exits=exits,
    init_cash=100_000,
    fees=0.001,
    slippage=0.001,
)

print(portfolio.stats())`,
  },
  {
    id: "ex-momentum",
    name: "Momentum Strategy",
    description: "A dual moving average crossover momentum strategy.",
    framework: "backtrader",
    code: `import backtrader as bt

# Momentum Strategy (Demo)
# NOTE: This is a fictional example for demonstration purposes only.
# It does not represent a profitable trading strategy.

class MomentumCrossover(bt.Strategy):
    params = (
        ("fast_period", 10),
        ("slow_period", 30),
        ("position_pct", 0.95),
    )

    def __init__(self):
        self.fast_ma = bt.indicators.SMA(self.data.close, period=self.p.fast_period)
        self.slow_ma = bt.indicators.SMA(self.data.close, period=self.p.slow_period)
        self.crossover = bt.indicators.CrossOver(self.fast_ma, self.slow_ma)

    def next(self):
        if not self.position:
            if self.crossover > 0:
                size = int((self.broker.getcash() * self.p.position_pct) / self.data.close[0])
                self.buy(size=size)
        elif self.crossover < 0:
            self.close()

cerebro = bt.Cerebro()
cerebro.addstrategy(MomentumCrossover)
cerebro.broker.setcash(100_000)
cerebro.broker.setcommission(commission=0.001)

data = bt.feeds.YahooFinanceCSVData(dataname="data/SPY.csv")
cerebro.adddata(data)
cerebro.run()`,
  },
  {
    id: "ex-pairs",
    name: "Pairs Trading",
    description: "A statistical arbitrage pairs trading strategy.",
    framework: "pandas",
    code: `import numpy as np
import pandas as pd
from scipy import stats

# Pairs Trading Strategy (Demo)
# NOTE: This is a fictional example for demonstration purposes only.
# It does not represent a profitable trading strategy.

def calculate_spread(asset_a: pd.Series, asset_b: pd.Series):
    """Calculate the log spread between two cointegrated assets."""
    log_a = np.log(asset_a)
    log_b = np.log(asset_b)
    spread = log_a - log_b
    return spread

def generate_signals(spread: pd.Series, window: int = 30, entry_z: float = 2.0, exit_z: float = 0.5):
    """Generate entry/exit signals based on z-score of the spread."""
    rolling_mean = spread.rolling(window=window).mean()
    rolling_std = spread.rolling(window=window).std()
    z_score = (spread - rolling_mean) / rolling_std

    signals = pd.DataFrame(index=spread.index)
    signals["z_score"] = z_score
    signals["long_entry"] = z_score < -entry_z
    signals["short_entry"] = z_score > entry_z
    signals["exit"] = z_score.abs() < exit_z
    return signals

# Load sample data
eth = pd.read_csv("data/ETH_USD.csv", index_col="Date", parse_dates=True)["Close"]
btc = pd.read_csv("data/BTC_USD.csv", index_col="Date", parse_dates=True)["Close"]

spread = calculate_spread(eth, btc)
signals = generate_signals(spread)

print(f"Total long entries: {signals['long_entry'].sum()}")
print(f"Total short entries: {signals['short_entry'].sum()}")`,
  },
  {
    id: "ex-trend",
    name: "Trend Following",
    description: "A Donchian channel breakout trend following strategy.",
    framework: "backtrader",
    code: `import backtrader as bt

# Trend Following Strategy (Demo)
# NOTE: This is a fictional example for demonstration purposes only.
# It does not represent a profitable trading strategy.

class DonchianBreakout(bt.Strategy):
    params = (
        ("entry_period", 20),
        ("exit_period", 10),
        ("risk_pct", 0.02),
    )

    def __init__(self):
        self.highest = bt.indicators.Highest(self.data.high, period=self.p.entry_period)
        self.lowest = bt.indicators.Lowest(self.data.low, period=self.p.exit_period)
        self.atr = bt.indicators.ATR(self.data, period=14)

    def next(self):
        if not self.position:
            if self.data.close[0] > self.highest[-1]:
                risk_amount = self.broker.getvalue() * self.p.risk_pct
                stop_distance = self.atr[0] * 2
                if stop_distance > 0:
                    size = int(risk_amount / stop_distance)
                    self.buy(size=size)
        else:
            if self.data.close[0] < self.lowest[-1]:
                self.close()

cerebro = bt.Cerebro()
cerebro.addstrategy(DonchianBreakout)
cerebro.broker.setcash(100_000)
cerebro.broker.setcommission(commission=0.001)
cerebro.run()`,
  },
  {
    id: "ex-vol-breakout",
    name: "Volatility Breakout",
    description:
      "An ATR-based volatility breakout strategy with dynamic sizing.",
    framework: "vectorbt",
    code: `import numpy as np
import pandas as pd
import vectorbt as vbt

# Volatility Breakout Strategy (Demo)
# NOTE: This is a fictional example for demonstration purposes only.
# It does not represent a profitable trading strategy.

def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14):
    """Calculate Average True Range."""
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def volatility_breakout_signals(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    atr_period: int = 14,
    atr_multiplier: float = 1.5,
):
    """Generate entries on volatility expansion breakouts."""
    atr_val = atr(high, low, close, period=atr_period)
    prev_close = close.shift(1)

    upper_band = prev_close + atr_val * atr_multiplier
    entries = close > upper_band

    lower_band = prev_close - atr_val * atr_multiplier
    exits = close < lower_band

    return entries, exits

price = vbt.YFData.download("QQQ", start="2020-01-01", end="2023-12-31")
entries, exits = volatility_breakout_signals(
    price.get("High"), price.get("Low"), price.get("Close")
)

portfolio = vbt.Portfolio.from_signals(
    close=price.get("Close"),
    entries=entries,
    exits=exits,
    init_cash=100_000,
    fees=0.001,
)

print(portfolio.stats())`,
  },
];

/* ── Helpers ─────────────────────────────────────────────── */

const ACCEPTED_EXTENSIONS = [".py", ".zip"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFile(file: File): string | null {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return "Only .py and .zip files are supported.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Strategy file exceeds the 10 MB limit.";
  }
  return null;
}

export function fileNameWithoutExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createAuditDraftId(): string {
  return `draft_${Date.now().toString(36)}`;
}
