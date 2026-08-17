"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type UserProfile = {
  id: string;
  email: string | null;
  name?: string | null;
  avatarUrl?: string | null;
};

export function ProfileDropdown() {
  const router = useRouter();
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  // Fetch authenticated user from server-validated session
  React.useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled && data.success && data.user) {
          setUser(data.user);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // Keyboard navigation within menu
  React.useEffect(() => {
    if (!open || !menuRef.current) return;

    const menuItems = menuRef.current.querySelectorAll(
      'a[role="menuitem"], button[role="menuitem"]'
    );

    function handleKeyDown(event: KeyboardEvent) {
      if (!menuRef.current) return;

      const items = menuRef.current.querySelectorAll(
        'a[role="menuitem"], button[role="menuitem"]'
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex = (focusedIndex + 1) % items.length;
        setFocusedIndex(nextIndex);
        (items[nextIndex] as HTMLElement)?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex = focusedIndex <= 0 ? items.length - 1 : focusedIndex - 1;
        setFocusedIndex(prevIndex);
        (items[prevIndex] as HTMLElement)?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        setFocusedIndex(0);
        (items[0] as HTMLElement)?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        setFocusedIndex(items.length - 1);
        (items[items.length - 1] as HTMLElement)?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, focusedIndex]);

  // Reset focus index when menu closes
  React.useEffect(() => {
    if (!open) {
      setFocusedIndex(-1);
    }
  }, [open]);

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

  if (loading || !user) {
    return null;
  }

  const displayName = user.name || user.email || "User";
  const initials = getInitials(displayName);
  const avatarUrl = user.avatarUrl;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
        className="flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-medium font-mono text-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </div>
        )}
        <span className="hidden sm:inline max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
          className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border/60 bg-card shadow-lg focus:outline-none z-50"
        >
          {/* User info header */}
          <div className="border-b border-border/40 px-4 py-3">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {displayName}
                </p>
                {user.email && user.email !== displayName && (
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Settings className="h-4 w-4" />
              Account / Settings
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-border/40 p-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:pointer-events-none"
            >
              {signingOut ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  if (!name) return "U";

  // Handle email addresses
  if (name.includes("@")) {
    const localPart = name.split("@")[0];
    return localPart.slice(0, 2).toUpperCase();
  }

  // Handle names with spaces
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  // Take first letter of first two words
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
