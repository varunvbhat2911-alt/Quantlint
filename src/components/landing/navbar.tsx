"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ShieldCheck, Menu, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { LineNav } from "@/components/line-nav";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { title: "Features", href: "#features" },
  { title: "Workflow", href: "#workflow" },
  { title: "Documentation", href: "/docs" },
  { title: "FAQ", href: "#faq" },
];

const lineVariants = {
  normal: { width: 16 },
  hover: { width: 28 },
};

function HorizontalNavLink({
  href,
  title,
}: {
  href: string;
  title: string;
}) {
  return (
    <motion.a
      href={href}
      className="group relative flex items-center gap-2 py-1 text-xs font-medium"
      initial={false}
      whileHover="hover"
    >
      <motion.span
        className="block h-px shrink-0 bg-foreground/20 transition-colors group-hover:bg-foreground"
        variants={lineVariants}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      />
      <span className="whitespace-nowrap text-muted-foreground transition-colors group-hover:text-foreground">
        {title}
      </span>
    </motion.a>
  );
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-border/40 bg-background/80 backdrop-blur-md"
          : "border-b border-transparent bg-background/40"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <ShieldCheck className="h-5 w-5 text-foreground transition-opacity group-hover:opacity-80" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            QuantLint
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <HorizontalNavLink
              key={item.href}
              href={item.href}
              title={item.title}
            />
          ))}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <GithubIcon className="h-4 w-4" />
            GitHub
          </a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/dashboard">Login</Link>
          </Button>
          <Button size="sm" className="text-xs gap-1.5 rounded-full px-4" asChild>
            <Link href="/audit/new">
              Start Free Audit
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border/40 bg-background/95 backdrop-blur-md px-6 pb-6">
          <LineNav
            className="py-4"
            items={NAV_ITEMS}
            scrollActiveIntoView={false}
            onItemClick={() => setMobileMenuOpen(false)}
          />
          <div className="flex flex-col gap-2 pt-4 border-t border-border/40">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground py-1"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub
            </a>
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                <Link href="/dashboard">Login</Link>
              </Button>
              <Button size="sm" className="flex-1 gap-1.5 text-xs rounded-full" asChild>
                <Link href="/audit/new" onClick={() => setMobileMenuOpen(false)}>
                  Start Free Audit
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
