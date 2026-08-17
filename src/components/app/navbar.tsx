"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { QuantLintLogo } from "@/components/common/quantlint-logo";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import { APP_NAV } from "@/lib/navigation";

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

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
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-1.5 rounded-full border border-border/80 px-3 py-1.5 text-xs font-medium font-mono text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/40 disabled:opacity-60 disabled:pointer-events-none"
            aria-label="Sign out"
          >
            {signingOut ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Sign out
          </button>
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
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              handleSignOut();
            }}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-60 disabled:pointer-events-none"
          >
            {signingOut ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
