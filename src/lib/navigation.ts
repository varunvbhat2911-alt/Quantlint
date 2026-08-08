import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Settings,
  BookOpen,
  FileText,
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

export const DOC_NAV: NavItem[] = [
  { label: "Introduction", href: "/docs", icon: BookOpen },
  { label: "CLI Reference", href: "/docs#cli", icon: FileText },
  { label: "Rule Library", href: "/docs#rules", icon: FileText },
  { label: "API Reference", href: "/docs#api", icon: FileText },
];
