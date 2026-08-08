import type { Audit, AuditReport } from "@/lib/types";

export const MOCK_AUDITS: Audit[] = [
  {
    id: "aud_001",
    strategyName: "Mean Reversion v2",
    fileName: "mean_reversion.py",
    language: "python",
    status: "completed",
    score: 92,
    rulesChecked: 317,
    violations: 1,
    createdAt: "2026-08-07T14:32:00Z",
    durationSec: 2.1,
  },
  {
    id: "aud_002",
    strategyName: "Momentum Breakout",
    fileName: "momentum_breakout.py",
    language: "python",
    status: "completed",
    score: 78,
    rulesChecked: 317,
    violations: 4,
    createdAt: "2026-08-06T09:15:00Z",
    durationSec: 2.4,
  },
  {
    id: "aud_003",
    strategyName: "Pairs Trading ETH/BTC",
    fileName: "pairs_eth_btc.py",
    language: "python",
    status: "completed",
    score: 85,
    rulesChecked: 317,
    violations: 2,
    createdAt: "2026-08-05T16:48:00Z",
    durationSec: 1.9,
  },
  {
    id: "aud_004",
    strategyName: "RSI Divergence Pine",
    fileName: "rsi_divergence.pine",
    language: "pine",
    status: "failed",
    score: null,
    rulesChecked: 214,
    violations: 0,
    createdAt: "2026-08-04T11:22:00Z",
    durationSec: null,
  },
  {
    id: "aud_005",
    strategyName: "Volatility Target",
    fileName: "vol_target.py",
    language: "python",
    status: "completed",
    score: 96,
    rulesChecked: 317,
    violations: 0,
    createdAt: "2026-08-03T08:05:00Z",
    durationSec: 1.8,
  },
];

export const MOCK_REPORTS: Record<string, AuditReport> = {
  rpt_001: {
    id: "rpt_001",
    auditId: "aud_001",
    strategyName: "Mean Reversion v2",
    fileName: "mean_reversion.py",
    score: 92,
    status: "completed",
    createdAt: "2026-08-07T14:32:00Z",
    durationSec: 2.1,
    rulesChecked: 317,
    violations: [
      {
        id: "v_001",
        code: "QL-104",
        title: "Look-Ahead Bias Detected",
        severity: "high",
        description:
          "Signal computation references future candle close prices via shift(-1) prior to bar closure.",
        recommendation:
          "Use historical shifted window shift(1) to avoid data leakage.",
        line: 42,
      },
    ],
    metrics: {
      sharpe: 2.14,
      sortino: 3.08,
      maxDrawdown: -11.4,
      winRate: 58.2,
    },
  },
  rpt_002: {
    id: "rpt_002",
    auditId: "aud_002",
    strategyName: "Momentum Breakout",
    fileName: "momentum_breakout.py",
    score: 78,
    status: "completed",
    createdAt: "2026-08-06T09:15:00Z",
    durationSec: 2.4,
    rulesChecked: 317,
    violations: [
      {
        id: "v_002",
        code: "QL-087",
        title: "Unrealistic Slippage Assumption",
        severity: "medium",
        description: "Backtest assumes zero slippage on market orders.",
        recommendation: "Apply minimum 2–5 bps slippage for liquid equities.",
        line: 118,
      },
      {
        id: "v_003",
        code: "QL-112",
        title: "Position Size Exceeds Limit",
        severity: "high",
        description: "Max position exceeds 25% portfolio allocation rule.",
        recommendation: "Cap position size at 20% of portfolio value.",
        line: 67,
      },
    ],
    metrics: {
      sharpe: 1.42,
      sortino: 1.89,
      maxDrawdown: -18.7,
      winRate: 52.1,
    },
  },
};

export const DASHBOARD_METRICS = {
  totalAudits: 1247,
  avgScore: 86.4,
  avgDurationSec: 2.1,
  activeRules: 317,
};

export function getAuditById(id: string): Audit | undefined {
  return MOCK_AUDITS.find((a) => a.id === id);
}

export function getReportById(id: string): AuditReport | undefined {
  return MOCK_REPORTS[id];
}

export function getReportByAuditId(auditId: string): AuditReport | undefined {
  return Object.values(MOCK_REPORTS).find((r) => r.auditId === auditId);
}

export function getReportIdForAudit(auditId: string): string | null {
  const report = getReportByAuditId(auditId);
  return report?.id ?? null;
}
