"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "quantlint_pwa_dismissed";
const DISMISS_DAYS = 7;

/**
 * Subtle PWA install prompt.
 *
 * - Only appears when the browser supports installation (beforeinstallprompt)
 * - Dismissible with a close button
 * - Remembers dismissal for 7 days via localStorage
 * - Does not appear if the app is already installed (display-mode: standalone)
 * - Does not obstruct the application
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /* Don't show if already installed */
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    /* Don't show if recently dismissed */
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const dismissedAt = parseInt(dismissed, 10);
        const daysSinceDismissed =
          (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < DISMISS_DAYS) return;
      }
    } catch {
      /* localStorage unavailable */
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      /* Show after a short delay so it doesn't compete with page load */
      setTimeout(() => setVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome === "accepted") {
        setVisible(false);
      }
      setDeferredPrompt(null);
    });
  }

  function handleDismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* localStorage unavailable */
    }
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40",
        "animate-in fade-in slide-in-from-bottom-4 duration-300",
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-lg shadow-black/8">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/50">
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">
              Install QuantLint
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add to your home screen for quick access.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary/60"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 transition-opacity"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 rounded-lg border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
