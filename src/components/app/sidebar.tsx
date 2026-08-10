"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAV, DOC_NAV_SECTIONS } from "@/lib/navigation";
import { getDocBySlug, type DocStatus } from "@/lib/docs/registry";
import { QuantLintLogo } from "@/components/common/quantlint-logo";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border/40 bg-background">
      <div className="border-b border-border/40 px-4 py-3">
        <Link href="/dashboard" className="flex items-center group">
          <QuantLintLogo showWordmark className="transition-opacity group-hover:opacity-80" />
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {APP_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/docs" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium font-mono transition-colors",
                active
                  ? "bg-secondary/60 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/* ── Status Badge for Sidebar Items ─────────────────────── */

function StatusBadge({ status }: { status?: DocStatus }) {
  if (!status || status === "available") return null;

  const config: Record<
    Exclude<DocStatus, "available">,
    { label: string; className: string }
  > = {
    planned: {
      label: "PLANNED",
      className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
    example: {
      label: "EXAMPLE",
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    "coming-soon": {
      label: "SOON",
      className: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    },
  };

  const item = config[status as keyof typeof config];
  if (!item) return null;

  return (
    <span
      className={cn(
        "ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border leading-none font-semibold",
        item.className
      )}
    >
      {item.label}
    </span>
  );
}

/* ── Hierarchical Docs Sidebar ────────────────────────────── */

export function DocsSidebar({
  onSelect,
}: {
  onSelect?: () => void;
}) {
  const pathname = usePathname();

  // Track collapsed state per group label (default open)
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="w-64 shrink-0 flex-col border-r border-border/40 bg-background/50 flex">
      <nav className="flex flex-col gap-6 p-4 text-xs overflow-y-auto">
        {DOC_NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsed[section.label];
          const Icon = section.icon;

          return (
            <div key={section.label} className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggleGroup(section.label)}
                className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{section.label}</span>
                </div>
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 transition-transform duration-200",
                    !isCollapsed && "rotate-90"
                  )}
                />
              </button>

              {!isCollapsed && (
                <div className="flex flex-col gap-0.5 pl-2 border-l border-border/40 ml-3">
                  {section.items.map((item) => {
                    const href = item.slug ? `/docs/${item.slug}` : "/docs";
                    const isHome = item.slug === "getting-started" && (pathname === "/docs" || pathname === "/docs/");
                    const isActive = pathname === href || isHome;
                    const pageMeta = getDocBySlug(item.slug);

                    return (
                      <Link
                        key={item.slug}
                        href={href}
                        onClick={onSelect}
                        className={cn(
                          "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-mono transition-colors",
                          isActive
                            ? "bg-secondary text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                        <StatusBadge status={pageMeta?.status} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
