"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, UserPlus, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrimaryButton } from "@/components/app/buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address.";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }
    if (password !== confirm) {
      return "Passwords do not match.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setNeedsConfirmation(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload: unknown = await res.json().catch(() => null);
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : null;

      if (!res.ok) {
        setError(message ?? "Sign up failed. Please try again.");
        return;
      }
      const confirmed =
        typeof payload === "object" &&
        payload !== null &&
        "needsConfirmation" in payload &&
        (payload as { needsConfirmation?: unknown }).needsConfirmation === true;
      if (confirmed) {
        setNeedsConfirmation(true);
      } else {
        // Session created — go straight to the app
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-8 space-y-4 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <MailCheck className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground">
              Confirm your email
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Click it to activate your account, then sign in.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="inline-block text-xs font-medium text-foreground hover:underline"
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="p-6 pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Create your QuantLint account
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Start auditing your quantitative strategies.
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-2 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cn(
                "w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                error && "border-red-500/40",
              )}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className={cn(
                "w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                error && "border-red-500/40",
              )}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-xs font-medium text-foreground">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              className={cn(
                "w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                error && "border-red-500/40",
              )}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <PrimaryButton className="w-full" disabled={loading} type="submit">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {loading ? "Creating account…" : "Create Account"}
          </PrimaryButton>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-foreground hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
