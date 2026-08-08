"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  "Parsing AST",
  "Running 317 validation rules",
  "Detecting look-ahead bias",
  "Calculating risk metrics",
  "Generating audit report",
];

export default function AuditRunningPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = React.useState(0);

  React.useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setActiveStep(i + 1), (i + 1) * 1200)
    );

    const redirect = setTimeout(() => {
      router.push("/audit/result");
    }, (STEPS.length + 1) * 1200);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(redirect);
    };
  }, [router]);

  return (
    <div className="space-y-10 max-w-xl mx-auto">
      <PageHeader
        title="Audit Running"
        subtitle="Analyzing mean_reversion.py — this usually takes about 2 seconds."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "New Audit", href: "/audit/new" },
          { label: "Running" },
        ]}
      />

      <Card className="border-border/40 bg-card/40">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-border/40">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground font-mono">
                quantlint audit mean_reversion.py
              </p>
              <p className="text-xs text-muted-foreground">Processing...</p>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {STEPS.map((step, i) => {
              const done = activeStep > i;
              const current = activeStep === i;

              return (
                <div
                  key={step}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-foreground/70 shrink-0" />
                  ) : current ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" />
                  )}
                  <span className={done ? "text-foreground" : undefined}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Cancel and return to dashboard
        </Link>
      </p>
    </div>
  );
}
