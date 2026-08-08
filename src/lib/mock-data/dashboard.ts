/* ── Dashboard KPI stats ─────────────────────────────────── */

export type DashboardStat = {
  label: string;
  value: string;
  trend: string;
  trendDirection: "up" | "down" | "neutral";
  supporting: string;
};

export const DASHBOARD_STATS: DashboardStat[] = [
  {
    label: "Total Audits",
    value: "128",
    trend: "+12.4%",
    trendDirection: "up",
    supporting: "this month",
  },
  {
    label: "Average Score",
    value: "91.8",
    trend: "+3.2%",
    trendDirection: "up",
    supporting: "vs last month",
  },
  {
    label: "Issues Detected",
    value: "347",
    trend: "23 critical",
    trendDirection: "neutral",
    supporting: "across all audits",
  },
  {
    label: "Avg Audit Time",
    value: "2.4s",
    trend: "−18%",
    trendDirection: "down",
    supporting: "faster",
  },
];

/* ── Recent audits (table rows) ─────────────────────────── */

export type DashboardAudit = {
  id: string;
  strategy: string;
  framework: string;
  score: number;
  issues: number;
  status: "Passed" | "Needs Review" | "Critical";
  date: string;
  reportId: string;
};

export const RECENT_AUDITS: DashboardAudit[] = [
  {
    id: "aud-dash-001",
    strategy: "Mean Reversion Strategy",
    framework: "vectorbt",
    score: 92,
    issues: 3,
    status: "Passed",
    date: "Today",
    reportId: "rpt_001",
  },
  {
    id: "aud-dash-002",
    strategy: "Momentum Alpha",
    framework: "Backtrader",
    score: 78,
    issues: 8,
    status: "Needs Review",
    date: "Yesterday",
    reportId: "rpt_002",
  },
  {
    id: "aud-dash-003",
    strategy: "Pairs Trading",
    framework: "Pandas",
    score: 96,
    issues: 1,
    status: "Passed",
    date: "2 days ago",
    reportId: "rpt_003",
  },
  {
    id: "aud-dash-004",
    strategy: "Volatility Breakout",
    framework: "vectorbt",
    score: 64,
    issues: 14,
    status: "Critical",
    date: "3 days ago",
    reportId: "rpt_004",
  },
  {
    id: "aud-dash-005",
    strategy: "Trend Following",
    framework: "Backtrader",
    score: 88,
    issues: 5,
    status: "Needs Review",
    date: "4 days ago",
    reportId: "rpt_005",
  },
];

/* ── Recent reports ──────────────────────────────────────── */

export type DashboardReport = {
  id: string;
  title: string;
  strategy: string;
  score: number;
  date: string;
  reportId: string;
};

export const RECENT_REPORTS: DashboardReport[] = [
  {
    id: "dr-001",
    title: "Strategy Validation Report",
    strategy: "Mean Reversion Strategy",
    score: 92,
    date: "Generated today",
    reportId: "rpt_001",
  },
  {
    id: "dr-002",
    title: "Risk Analysis Report",
    strategy: "Momentum Alpha",
    score: 78,
    date: "Generated yesterday",
    reportId: "rpt_002",
  },
  {
    id: "dr-003",
    title: "Compliance Summary",
    strategy: "Pairs Trading",
    score: 96,
    date: "Generated 2 days ago",
    reportId: "rpt_003",
  },
];

/* ── Activity feed ───────────────────────────────────────── */

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "audit" | "report" | "flag";
};

export const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: "act-001",
    title: "Audit completed",
    description: "Mean Reversion Strategy scored 92/100",
    time: "10 minutes ago",
    type: "audit",
  },
  {
    id: "act-002",
    title: "New report generated",
    description: "Risk Analysis Report",
    time: "42 minutes ago",
    type: "report",
  },
  {
    id: "act-003",
    title: "Audit completed",
    description: "Pairs Trading scored 96/100",
    time: "2 hours ago",
    type: "audit",
  },
  {
    id: "act-004",
    title: "Strategy audit flagged",
    description: "Momentum Alpha — 8 issues detected",
    time: "Yesterday",
    type: "flag",
  },
];

/* ── Quick actions ───────────────────────────────────────── */

export type QuickAction = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa-new-audit",
    title: "New Audit",
    description: "Upload or paste a strategy for validation.",
    href: "/audit/new",
  },
  {
    id: "qa-history",
    title: "View History",
    description: "Review previous strategy audits.",
    href: "/history",
  },
  {
    id: "qa-docs",
    title: "Documentation",
    description: "Learn about QuantLint rules and validation.",
    href: "/docs",
  },
];
