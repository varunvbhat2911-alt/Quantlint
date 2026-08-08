/* ── Audit History Mock Data ─────────────────────────────── */

export type HistoryStatus = "passed" | "needs-review" | "critical" | "running";

export type HistoryFramework =
  | "vectorbt"
  | "Backtrader"
  | "Zipline"
  | "Pandas / Custom";

export type AuditHistoryRecord = {
  id: string;
  strategyName: string;
  fileName: string;
  framework: HistoryFramework;
  score: number | null;
  issues: number;
  criticalIssues: number;
  warnings: number;
  status: HistoryStatus;
  createdAt: string;
  completedAt: string | null;
  analysisDepth: "standard" | "deep" | "quick";
};

/* ── Helper: produce dates relative to "now" ──────────── */

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function hoursAgo(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

/* ── Dataset ──────────────────────────────────────────── */

export const MOCK_AUDIT_HISTORY: AuditHistoryRecord[] = [
  {
    id: "QL-AUD-0001",
    strategyName: "Mean Reversion Strategy",
    fileName: "mean_reversion.py",
    framework: "vectorbt",
    score: 92,
    issues: 3,
    criticalIssues: 0,
    warnings: 3,
    status: "passed",
    createdAt: hoursAgo(2),
    completedAt: hoursAgo(2),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0002",
    strategyName: "Momentum Alpha",
    fileName: "momentum_alpha.py",
    framework: "Backtrader",
    score: 78,
    issues: 8,
    criticalIssues: 2,
    warnings: 6,
    status: "needs-review",
    createdAt: daysAgo(1),
    completedAt: daysAgo(1),
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0003",
    strategyName: "Pairs Trading",
    fileName: "pairs_trading_eth_btc.py",
    framework: "Pandas / Custom",
    score: 96,
    issues: 1,
    criticalIssues: 0,
    warnings: 1,
    status: "passed",
    createdAt: daysAgo(2),
    completedAt: daysAgo(2),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0004",
    strategyName: "Volatility Breakout",
    fileName: "vol_breakout.py",
    framework: "vectorbt",
    score: 64,
    issues: 14,
    criticalIssues: 5,
    warnings: 9,
    status: "critical",
    createdAt: daysAgo(3),
    completedAt: daysAgo(3),
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0005",
    strategyName: "Trend Following",
    fileName: "trend_following.py",
    framework: "Backtrader",
    score: 88,
    issues: 5,
    criticalIssues: 1,
    warnings: 4,
    status: "needs-review",
    createdAt: daysAgo(4),
    completedAt: daysAgo(4),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0006",
    strategyName: "Crypto Momentum",
    fileName: "crypto_momentum.py",
    framework: "vectorbt",
    score: 71,
    issues: 11,
    criticalIssues: 3,
    warnings: 8,
    status: "needs-review",
    createdAt: daysAgo(6),
    completedAt: daysAgo(6),
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0007",
    strategyName: "Factor Strategy",
    fileName: "factor_strategy.py",
    framework: "Pandas / Custom",
    score: 94,
    issues: 2,
    criticalIssues: 0,
    warnings: 2,
    status: "passed",
    createdAt: daysAgo(8),
    completedAt: daysAgo(8),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0008",
    strategyName: "Statistical Arbitrage",
    fileName: "stat_arb.py",
    framework: "Zipline",
    score: 89,
    issues: 4,
    criticalIssues: 0,
    warnings: 4,
    status: "passed",
    createdAt: daysAgo(10),
    completedAt: daysAgo(10),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0009",
    strategyName: "MACD Crossover",
    fileName: "macd_crossover.py",
    framework: "Backtrader",
    score: 85,
    issues: 6,
    criticalIssues: 1,
    warnings: 5,
    status: "needs-review",
    createdAt: daysAgo(12),
    completedAt: daysAgo(12),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0010",
    strategyName: "Bollinger Bands Squeeze",
    fileName: "bb_squeeze.py",
    framework: "vectorbt",
    score: 97,
    issues: 1,
    criticalIssues: 0,
    warnings: 1,
    status: "passed",
    createdAt: daysAgo(14),
    completedAt: daysAgo(14),
    analysisDepth: "quick",
  },
  {
    id: "QL-AUD-0011",
    strategyName: "Options Gamma Scalping",
    fileName: "gamma_scalp.py",
    framework: "Pandas / Custom",
    score: 58,
    issues: 18,
    criticalIssues: 7,
    warnings: 11,
    status: "critical",
    createdAt: daysAgo(15),
    completedAt: daysAgo(15),
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0012",
    strategyName: "Ichimoku Cloud",
    fileName: "ichimoku_cloud.py",
    framework: "Backtrader",
    score: 91,
    issues: 3,
    criticalIssues: 0,
    warnings: 3,
    status: "passed",
    createdAt: daysAgo(16),
    completedAt: daysAgo(16),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0013",
    strategyName: "Dollar Cost Averaging",
    fileName: "dca_strategy.py",
    framework: "Zipline",
    score: 99,
    issues: 0,
    criticalIssues: 0,
    warnings: 0,
    status: "passed",
    createdAt: daysAgo(18),
    completedAt: daysAgo(18),
    analysisDepth: "quick",
  },
  {
    id: "QL-AUD-0014",
    strategyName: "RSI Divergence",
    fileName: "rsi_divergence.py",
    framework: "vectorbt",
    score: 76,
    issues: 9,
    criticalIssues: 2,
    warnings: 7,
    status: "needs-review",
    createdAt: daysAgo(20),
    completedAt: daysAgo(20),
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0015",
    strategyName: "Sector Rotation",
    fileName: "sector_rotation.py",
    framework: "Zipline",
    score: 87,
    issues: 5,
    criticalIssues: 0,
    warnings: 5,
    status: "passed",
    createdAt: daysAgo(22),
    completedAt: daysAgo(22),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0016",
    strategyName: "Turtle Trading",
    fileName: "turtle_trading.py",
    framework: "Backtrader",
    score: 83,
    issues: 7,
    criticalIssues: 1,
    warnings: 6,
    status: "needs-review",
    createdAt: daysAgo(24),
    completedAt: daysAgo(24),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0017",
    strategyName: "Adaptive Moving Average",
    fileName: "adaptive_ma.py",
    framework: "vectorbt",
    score: 90,
    issues: 4,
    criticalIssues: 0,
    warnings: 4,
    status: "passed",
    createdAt: daysAgo(26),
    completedAt: daysAgo(26),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0018",
    strategyName: "Grid Trading Bot",
    fileName: "grid_bot.py",
    framework: "Pandas / Custom",
    score: 62,
    issues: 16,
    criticalIssues: 6,
    warnings: 10,
    status: "critical",
    createdAt: daysAgo(28),
    completedAt: daysAgo(28),
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0019",
    strategyName: "Kalman Filter Strategy",
    fileName: "kalman_filter.py",
    framework: "Zipline",
    score: 93,
    issues: 2,
    criticalIssues: 0,
    warnings: 2,
    status: "passed",
    createdAt: daysAgo(30),
    completedAt: daysAgo(30),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0020",
    strategyName: "Swing Trading Pro",
    fileName: "swing_pro.py",
    framework: "Backtrader",
    score: null,
    issues: 0,
    criticalIssues: 0,
    warnings: 0,
    status: "running",
    createdAt: hoursAgo(1),
    completedAt: null,
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0021",
    strategyName: "Vix Term Structure",
    fileName: "vix_term.py",
    framework: "vectorbt",
    score: 81,
    issues: 6,
    criticalIssues: 1,
    warnings: 5,
    status: "needs-review",
    createdAt: daysAgo(5),
    completedAt: daysAgo(5),
    analysisDepth: "standard",
  },
  {
    id: "QL-AUD-0022",
    strategyName: "Carry Trade FX",
    fileName: "carry_trade.py",
    framework: "Pandas / Custom",
    score: 95,
    issues: 1,
    criticalIssues: 0,
    warnings: 1,
    status: "passed",
    createdAt: daysAgo(9),
    completedAt: daysAgo(9),
    analysisDepth: "quick",
  },
  {
    id: "QL-AUD-0023",
    strategyName: "Stochastic Oscillator",
    fileName: "stochastic_osc.py",
    framework: "Backtrader",
    score: 74,
    issues: 10,
    criticalIssues: 2,
    warnings: 8,
    status: "needs-review",
    createdAt: daysAgo(11),
    completedAt: daysAgo(11),
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0024",
    strategyName: "Market Making",
    fileName: "market_maker.py",
    framework: "Zipline",
    score: 68,
    issues: 12,
    criticalIssues: 4,
    warnings: 8,
    status: "critical",
    createdAt: daysAgo(13),
    completedAt: daysAgo(13),
    analysisDepth: "deep",
  },
  {
    id: "QL-AUD-0025",
    strategyName: "Neural Network Alpha",
    fileName: "nn_alpha.py",
    framework: "vectorbt",
    score: 86,
    issues: 5,
    criticalIssues: 0,
    warnings: 5,
    status: "passed",
    createdAt: daysAgo(7),
    completedAt: daysAgo(7),
    analysisDepth: "standard",
  },
];

/* ── Derived metrics (computed from dataset) ──────────── */

export type HistorySummaryMetrics = {
  totalAudits: number;
  averageScore: number;
  totalIssues: number;
  criticalFindings: number;
};

export function computeHistoryMetrics(
  records: AuditHistoryRecord[]
): HistorySummaryMetrics {
  const completed = records.filter((r) => r.score !== null);
  const avgScore =
    completed.length > 0
      ? Math.round(
          (completed.reduce((s, r) => s + (r.score ?? 0), 0) /
            completed.length) *
            10
        ) / 10
      : 0;

  return {
    totalAudits: records.length,
    averageScore: avgScore,
    totalIssues: records.reduce((s, r) => s + r.issues, 0),
    criticalFindings: records.reduce((s, r) => s + r.criticalIssues, 0),
  };
}
