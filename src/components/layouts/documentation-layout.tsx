"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ArrowLeft,
  Search,
  Menu,
  X,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { DocsSidebar } from "@/components/app/sidebar";
import { SecondaryButton } from "@/components/app/buttons";
import { searchDocs, type DocPage, type DocStatus } from "@/lib/docs/registry";
import { cn } from "@/lib/utils";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

/* ── Status Badge ────────────────────────────────────────── */

function StatusBadge({ status }: { status: DocStatus }) {
  if (status === "available") return null;

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
        "text-[9px] font-mono px-1.5 py-0.5 rounded border leading-none font-semibold shrink-0",
        item.className
      )}
    >
      {item.label}
    </span>
  );
}

/* ── Docs Search Modal ────────────────────────────────────── */

function DocsSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const router = useRouter();

  const results = React.useMemo(() => searchDocs(query), [query]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden z-10 space-y-0">
        <div className="flex items-center px-4 border-b border-border/40">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation... (e.g. look-ahead, cli, metrics)"
            className="flex h-12 w-full bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() === "" ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Type a search query or category keyword to filter docs.
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No documentation pages found for &quot;{query}&quot;.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((doc) => (
                <button
                  key={doc.slug}
                  type="button"
                  onClick={() => {
                    router.push(`/docs/${doc.slug}`);
                    onClose();
                  }}
                  className="flex w-full items-start justify-between rounded-lg p-2.5 text-left text-xs hover:bg-secondary/60 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {doc.title}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {doc.category}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-1">
                      {doc.description}
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/40 px-4 py-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground bg-muted/20">
          <span>Search QuantLint Docs</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Documentation Layout ───────────────────────────── */

export function DocumentationLayout({
  children,
  toc,
}: {
  children: React.ReactNode;
  toc?: React.ReactNode;
}) {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-muted-foreground hover:text-foreground p-1"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            <Link href="/" className="flex items-center gap-2 group">
              <ShieldCheck className="h-5 w-5 text-foreground" />
              <span className="text-sm font-semibold tracking-tight font-mono">
                QuantLint
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / docs
              </span>
            </Link>
          </div>

          {/* Center search trigger button */}
          <div className="flex-1 max-w-md mx-4 hidden sm:block">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center justify-between w-full h-8 px-3 rounded-lg border border-border/60 bg-muted/30 text-xs text-muted-foreground hover:border-border transition-colors font-mono"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span>Search docs...</span>
              </div>
              <kbd className="font-mono text-[10px] bg-background border border-border/60 rounded px-1.5 py-0.5">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden text-muted-foreground hover:text-foreground p-1.5"
              aria-label="Search documentation"
            >
              <Search className="h-4 w-4" />
            </button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-secondary/40 transition-colors"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>

            <ThemeToggle />

            <SecondaryButton
              size="sm"
              className="text-xs px-3 hidden sm:inline-flex"
              asChild
            >
              <Link href="/dashboard">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
            </SecondaryButton>
          </div>
        </div>
      </header>

      {/* Body Area */}
      <div className="flex flex-1 items-start">
        {/* Desktop Left Sidebar */}
        <div className="hidden md:block sticky top-14 h-[calc(100vh-3.5rem)]">
          <DocsSidebar />
        </div>

        {/* Mobile Left Sidebar Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 top-14 z-30 flex md:hidden bg-background">
            <div className="w-full max-w-xs h-full border-r border-border/40 overflow-y-auto">
              <DocsSidebar onSelect={() => setIsMobileMenuOpen(false)} />
            </div>
            <div
              className="flex-1 bg-background/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 px-4 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-3xl space-y-8">{children}</div>
        </main>

        {/* Desktop Right Table of Contents Sidebar */}
        {toc && (
          <div className="hidden xl:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] border-l border-border/40 p-4 overflow-y-auto text-xs">
            {toc}
          </div>
        )}
      </div>

      <DocsSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
