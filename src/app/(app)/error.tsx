"use client";

/* App-level error boundary — catches unexpected runtime errors in any
 * (app) page and shows a branded, recoverable state instead of the default
 * production error page. Never exposes stack traces: in production Next
 * surfaces only a generic message + a digest the user can quote to support.
 * The digest (and requestId where available) is logged client-side for triage. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Safe client-side log: no stack trace, just the digest for correlation.
    console.error(
      JSON.stringify({
        event: "client.app_error",
        digest: error.digest ?? null,
        message: error.message ?? "unknown",
      }),
    );
  }, [error]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Something Went Wrong"
        subtitle="An unexpected error occurred while loading this page."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Error" },
        ]}
      />
      <div className="mx-auto max-w-md text-center space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          We couldn&apos;t complete this request. Your data is safe. Try again, or
          return to the dashboard.
        </p>
        {error.digest ? (
          <p className="text-xs font-mono text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <PrimaryButton onClick={retry}>Try Again</PrimaryButton>
          <SecondaryButton onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
