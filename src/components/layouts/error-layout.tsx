import Link from "next/link";
import { ShieldCheck, ArrowLeft, LayoutDashboard, Plus } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";

export function ErrorLayout({
  title,
  description,
  code = "404",
}: {
  title: string;
  description: string;
  code?: string;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-24">
      {/* QuantLint branding */}
      <Link href="/" className="mb-10 flex items-center gap-2 group">
        <ShieldCheck className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
        <span className="text-sm font-semibold tracking-tight text-muted-foreground transition-colors group-hover:text-foreground">
          QuantLint
        </span>
      </Link>

      <div className="max-w-md text-center space-y-5">
        {/* Large error code */}
        <p className="text-7xl sm:text-8xl font-bold tabular-nums text-muted-foreground/20 font-mono leading-none select-none">
          {code}
        </p>

        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          {description}
        </p>

        {/* Separator */}
        <div className="mx-auto w-12 border-t border-border/60" />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <PrimaryButton asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </PrimaryButton>
          <SecondaryButton asChild>
            <Link href="/audit/new">
              <Plus className="h-4 w-4" />
              Start New Audit
            </Link>
          </SecondaryButton>
        </div>

        {/* Tertiary home link */}
        <div className="pt-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
