"use client";

/* Global error boundary — catches errors in the ROOT layout itself, where
 * (app)/error.tsx cannot reach. Per Next.js, this component must render its
 * own <html> and <body> and cannot rely on the app's global styles/theme, so
 * it uses minimal inline styling to remain usable even when the app shell is
 * broken. Never exposes stack traces; logs only the digest client-side. */

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        event: "client.global_error",
        digest: error.digest ?? null,
        message: error.message ?? "unknown",
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fafafa" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: "28rem" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.75rem" }}>
              Something Went Wrong
            </h1>
            <p style={{ color: "#a1a1aa", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              An unexpected error occurred. Your data is safe. Try again, or
              return home.
            </p>
            {error.digest ? (
              <p style={{ color: "#71717a", fontSize: "0.75rem", fontFamily: "monospace", marginBottom: "1.5rem" }}>
                Reference: {error.digest}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={retry}
                style={{
                  background: "#fafafa",
                  color: "#0a0a0a",
                  border: "none",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <a
                href="/"
                style={{
                  background: "transparent",
                  color: "#fafafa",
                  border: "1px solid #27272a",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 1rem",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Back to Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
