"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences, changeThemeWithTransition } from "@/hooks/use-preferences";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { preferences } = usePreferences();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground"
        aria-label="Toggle theme"
      />
    );
  }

  const isDark = (resolvedTheme ?? theme) === "dark";
  const nextTheme = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() =>
        changeThemeWithTransition(
          nextTheme,
          setTheme,
          preferences.reduceMotion
        )
      }
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg",
        "border border-border bg-background text-muted-foreground",
        "transition-colors hover:text-foreground hover:bg-accent/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

