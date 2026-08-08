import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row">
        <Link href="/" className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-foreground" />
          <span className="text-xs font-semibold tracking-tight text-foreground">
            QuantLint
          </span>
        </Link>
        <p className="text-[11px] font-mono text-muted-foreground">
          Research &amp; QA Platform. Not financial advice.
        </p>
      </div>
    </footer>
  );
}
