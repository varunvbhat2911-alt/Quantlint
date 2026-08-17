import type { NextConfig } from "next";

/* Production security headers. The CSP is the non-nonce, static-rendering-safe
 * variant from the Next.js CSP guide: it allows 'self' plus 'unsafe-inline'
 * for scripts/styles (Tailwind/framer-motion inject inline styles) and locks
 * down frames, objects, and base/form actions. It does NOT force dynamic
 * rendering (a nonce-based policy would), so it is compatible with the app's
 * statically-rendered marketing/docs pages. */
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ]
      .join("; ")
      .replace(/\s{2,}/g, " ")
      .trim(),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  // Type errors MUST fail the production build. The Phase 8 config disabled
  // this, which let regressions ship silently.
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
