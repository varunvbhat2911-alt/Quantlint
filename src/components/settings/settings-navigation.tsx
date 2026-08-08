"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SettingsNavItem = {
  id: string;
  label: string;
};

export type SettingsNavigationProps = {
  items: SettingsNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
};

export function SettingsNavigation({
  items,
  activeId,
  onSelect,
  className,
}: SettingsNavigationProps) {
  return (
    <>
      {/* Mobile: dropdown */}
      <div className={cn("lg:hidden", className)}>
        <label htmlFor="settings-nav-select" className="sr-only">
          Settings section
        </label>
        <select
          id="settings-nav-select"
          value={activeId}
          onChange={(event) => onSelect(event.target.value)}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: vertical nav */}
      <nav
        aria-label="Settings sections"
        className={cn("hidden lg:block", className)}
      >
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function scrollToSettingsSection(id: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
