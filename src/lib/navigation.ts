import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Settings,
  BookOpen,
  FileText,
  Terminal,
  Shield,
  BarChart3,
  Code2,
  Blocks,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const APP_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Audit", href: "/audit/new", icon: PlusCircle },
  { label: "History", href: "/history", icon: History },
  { label: "Documentation", href: "/docs", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings },
];

/* ── Docs sidebar navigation (hierarchical) ─────────────── */

export type DocNavItem = {
  slug: string;
  label: string;
};

export type DocNavSection = {
  label: string;
  icon: LucideIcon;
  items: DocNavItem[];
};

export const DOC_NAV_SECTIONS: DocNavSection[] = [
  {
    label: "Getting Started",
    icon: BookOpen,
    items: [
      { slug: "getting-started", label: "Introduction" },
      { slug: "installation", label: "Installation" },
      { slug: "quick-start", label: "Quick Start" },
    ],
  },
  {
    label: "CLI",
    icon: Terminal,
    items: [
      { slug: "cli", label: "Overview" },
      { slug: "cli/audit", label: "Audit" },
      { slug: "cli/configuration", label: "Configuration" },
    ],
  },
  {
    label: "Rules",
    icon: Shield,
    items: [
      { slug: "rules", label: "Overview" },
      { slug: "rules/bias-detection", label: "Bias Detection" },
      { slug: "rules/risk-management", label: "Risk Management" },
      { slug: "rules/execution", label: "Execution" },
      { slug: "rules/data-validation", label: "Data Validation" },
      { slug: "rules/portfolio-logic", label: "Portfolio Logic" },
    ],
  },
  {
    label: "Metrics",
    icon: BarChart3,
    items: [
      { slug: "metrics", label: "Overview" },
      { slug: "metrics/performance", label: "Performance" },
      { slug: "metrics/risk", label: "Risk" },
      { slug: "metrics/trade-statistics", label: "Trade Statistics" },
    ],
  },
  {
    label: "API",
    icon: Code2,
    items: [
      { slug: "api", label: "Overview" },
      { slug: "api/overview", label: "Getting Started" },
      { slug: "api/audits", label: "Audits" },
      { slug: "api/reports", label: "Reports" },
    ],
  },
  {
    label: "Examples",
    icon: Blocks,
    items: [
      { slug: "examples", label: "Overview" },
      { slug: "examples/mean-reversion", label: "Mean Reversion" },
      { slug: "examples/momentum", label: "Momentum" },
      { slug: "examples/pairs-trading", label: "Pairs Trading" },
    ],
  },
];

/* ── Backward-compatible flat DOC_NAV (used by old DocsSidebar) */

export const DOC_NAV: NavItem[] = [
  { label: "Introduction", href: "/docs", icon: BookOpen },
  { label: "CLI Reference", href: "/docs#cli", icon: FileText },
  { label: "Rule Library", href: "/docs#rules", icon: FileText },
  { label: "API Reference", href: "/docs#api", icon: FileText },
];
