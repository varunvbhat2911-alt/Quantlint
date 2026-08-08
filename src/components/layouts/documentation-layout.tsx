import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { DocsSidebar } from "@/components/app/sidebar";
import { SecondaryButton } from "@/components/app/buttons";

export function DocumentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <ShieldCheck className="h-5 w-5 text-foreground" />
            <span className="text-sm font-semibold tracking-tight">QuantLint</span>
            <span className="text-xs text-muted-foreground font-mono">/ docs</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SecondaryButton size="sm" className="text-xs px-4 hidden sm:inline-flex" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-3.5 w-3.5" />
                Dashboard
              </Link>
            </SecondaryButton>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <DocsSidebar />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
