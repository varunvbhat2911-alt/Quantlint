import Link from "next/link";
import { QuantLintLogo } from "@/components/common/quantlint-logo";

export function AppFooter() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row">
        <Link href="/" className="flex items-center gap-2">
          <QuantLintLogo showWordmark />
        </Link>
        <p className="text-[11px] font-mono text-muted-foreground">
          Research &amp; QA Platform. Not financial advice.
        </p>
      </div>
    </footer>
  );
}
