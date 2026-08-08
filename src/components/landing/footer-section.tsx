"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function FooterSection() {
  return (
    <footer className="border-t border-border/40 bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
          {/* Column 1: Brand */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-foreground" />
              <span className="text-sm font-semibold tracking-tight text-foreground">
                QuantLint
              </span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed font-normal">
              Quality assurance platform for quantitative trading strategies. Verify logic, calculate risk, and eliminate statistical bias.
            </p>
            <div className="flex items-center gap-4 text-muted-foreground pt-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <GithubIcon className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="Twitter"
              >
                <XIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Platform
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground font-normal">
              <li>
                <Link href="#libraries" className="hover:text-foreground transition-colors">
                  Supported Libraries
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-foreground transition-colors">
                  Static Analysis
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-foreground transition-colors">
                  Rule Engine
                </Link>
              </li>
              <li>
                <Link href="#metrics" className="hover:text-foreground transition-colors">
                  Platform Metrics
                </Link>
              </li>
              <li>
                <Link href="#workflow" className="hover:text-foreground transition-colors">
                  Workflow Pipeline
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Resources
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground font-normal">
              <li>
                <Link href="/docs" className="hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/docs#rules" className="hover:text-foreground transition-colors">
                  Rule Library
                </Link>
              </li>
              <li>
                <Link href="/docs#api" className="hover:text-foreground transition-colors">
                  API Reference
                </Link>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Legal & Security
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground font-normal">
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Terms of Service
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Security Model
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border/40 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} QuantLint Inc. All rights reserved.</p>
          <p className="text-[11px] text-center sm:text-right">
            Research &amp; QA Platform. Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
