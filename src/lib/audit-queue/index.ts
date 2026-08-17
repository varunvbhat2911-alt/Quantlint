/* Durable audit execution queue — public surface (server-only). */

import "server-only";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { completeJob, dequeueAudit, enqueueAudit, failJob, recoverStaleJobs } from "./queue";
import { processQueueBatch } from "./worker";

export type {
  AuditJobStatus,
  AuditJobRow,
  DequeuedJob,
  EnqueueResult,
  DequeueResult,
  QueueClient,
  RetryPolicy,
  Uuid,
} from "./types";
export { DEFAULT_RETRY_POLICY, DEFAULT_STALE_JOB_SECONDS, asUuid } from "./types";
export { enqueueAudit, dequeueAudit, completeJob, failJob, recoverStaleJobs };
export { processQueueBatch };
export type { WorkerOptions, BatchResult } from "./worker";

export type AdminConfig = { supabaseUrl?: string; serviceRoleKey?: string };

/* Build a queue client over the service-role admin client. Throws
 * AdminClientNotConfiguredError when the service-role key is absent so the
 * caller fails fast instead of issuing RLS-denied RPCs. Accepts an explicit
 * config so the Deno Edge Function worker can pass its env values without
 * relying on Node's process.env. */
export function createAuditQueueClient(config?: AdminConfig) {
  if (!isAdminClientConfigured(config)) {
    // Delegate to the admin module's explicit error for a clear message.
    createAdminClient(config);
  }
  return createAdminClient(config) as unknown as import("./types").QueueClient;
}
