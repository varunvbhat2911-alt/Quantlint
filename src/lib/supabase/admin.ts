/* Server-only Supabase client using the service-role key.
 *
 * The audit tables are default-deny under RLS until the authentication phase
 * adds user-scoped policies, so server-side writes/reads for the audit API go
 * through this client. The key is NEVER referenced from client code and must
 * only be set as a server environment variable (SUPABASE_SERVICE_ROLE_KEY in
 * .env.local — do not commit). If the key is absent, callers receive a clear
 * configuration error instead of silent RLS failures.
 *
 * `import "server-only"` makes Next fail the BUILD if any client component
 * ever imports this module — a build-time barrier against bundling the
 * service-role key into the browser. */

import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export class AdminClientNotConfiguredError extends Error {
  constructor() {
    super(
      "SUPABASE_SERVICE_ROLE_KEY is not configured; the server cannot access the audit tables while RLS has no policies.",
    );
    this.name = "AdminClientNotConfiguredError";
  }
}

export function createAdminClient(config?: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
}) {
  const url = config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new AdminClientNotConfiguredError();
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isAdminClientConfigured(config?: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
}): boolean {
  return Boolean(
    (config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (config?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}
