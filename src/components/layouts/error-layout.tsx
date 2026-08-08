import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
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
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-24">
      <Link href="/" className="mb-12 flex items-center gap-2 group">
        <ShieldCheck className="h-5 w-5 text-foreground" />
        <span className="text-sm font-semibold tracking-tight">QuantLint</span>
      </Link>

      <div className="max-w-md text-center space-y-4">
        <p className="text-6xl font-semibold tabular-nums text-muted-foreground/30 font-mono">
          {code}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <PrimaryButton asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </PrimaryButton>
          <SecondaryButton asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
