"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastProps = {
  message: string;
  visible: boolean;
  onClose: () => void;
  variant?: "default" | "success" | "error";
  duration?: number;
  className?: string;
};

export function Toast({
  message,
  visible,
  onClose,
  variant = "default",
  duration = 3000,
  className,
}: ToastProps) {
  React.useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [visible, onClose, duration]);

  if (!visible || !message) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
        variant === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        variant === "default" && "border-border/60 bg-card text-foreground",
        className
      )}
    >
      <p className="flex-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(duration = 3000) {
  const [toast, setToast] = React.useState({ message: "", visible: false });

  const showToast = React.useCallback((message: string) => {
    setToast({ message, visible: true });
  }, []);

  const hideToast = React.useCallback(() => {
    setToast((current) => ({ ...current, visible: false }));
  }, []);

  const toastElement = (
    <Toast
      message={toast.message}
      visible={toast.visible}
      onClose={hideToast}
      duration={duration}
    />
  );

  return { showToast, hideToast, toastElement };
}
