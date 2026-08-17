"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { QuantLintLogo } from "@/components/common/quantlint-logo";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import { ProfileDropdown } from "@/components/app/profile-dropdown";
import { APP_NAV } from "@/lib/navigation";

export function AppNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 group shrink-0">
            <QuantLintLogo showWordmark className="transition-opacity group-hover:opacity-80" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {APP_NAV.slice(0, 4).map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium font-mono transition-colors",
                    active
                      ? "text-foreground bg-secondary/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <ThemeToggle />
          <SecondaryButton size="sm" className="text-xs px-4" asChild>
            <Link href="/docs">Docs</Link>
          </SecondaryButton>
          <PrimaryButton size="sm" className="text-xs px-4" asChild>
            <Link href="/audit/new">New Audit</Link>
          </PrimaryButton>
          <ProfileDropdown />
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border/40 px-4 py-3 sm:hidden space-y-1">
          <div className="px-3 py-2 mb-2">
            <ProfileDropdown />
          </div>
          {APP_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
