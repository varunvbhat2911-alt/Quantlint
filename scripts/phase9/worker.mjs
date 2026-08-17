/* Node dev worker — drains audit_job_queue locally or on a long-running host.
 *
 * This is the non-serverless counterpart to the Supabase Edge Function. It
 * imports the SAME bundled worker core (produced by
 * scripts/phase9/build-worker.mjs) the Edge Function uses, so behavior is
 * identical. Use it for:
 *   - local development (no Deno / Edge Function deploy needed)
 *   - a long-running Node server / container deployment (the other valid Phase
 *     9 hosting model), where this script is started as a sidecar process.
 *
 * It loops with an idle backoff: when the queue is empty it sleeps briefly and
 * polls again; when jobs are present it processes them in bounded batches.
 * Ctrl-C exits cleanly.
 *
 * Usage:
 *   node scripts/phase9/build-worker.mjs   # build the bundle first
 *   node scripts/phase9/worker.mjs          # then run the worker
 * Requires: .env.local with SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 *   (and optionally FIREWORKS_API_KEY for AI enrichment).
 *
 * No secrets are logged. Queue payloads contain only audit ids.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Load .env.local so the Node worker has the same env as `next dev`.
try {
  const text = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.error("[worker] no .env.local found — set env vars manually");
}

const { processQueueBatch, createAuditQueueClient, createSupabaseAuditRepository } =
  await import("./_worker.node.bundle.js");

const IDLE_MS = Number(process.env.QUEUE_IDLE_MS ?? 2000);
const MAX_JOBS = Number(process.env.QUEUE_MAX_JOBS_PER_BATCH ?? 10);
// dequeue_audit(p_worker_id uuid) requires a valid UUID — a pid-derived
// string like "node-1234" is rejected by Postgres. crypto.randomUUID is
// available in Node 19+ (global) and matches the Edge Function's workerId.
const workerId = crypto.randomUUID();

const queue = createAuditQueueClient();
const repository = createSupabaseAuditRepository();

let stopping = false;
const onSignal = () => {
  if (stopping) process.exit(0);
  stopping = true;
  console.log(`[worker ${workerId}] stopping after current batch…`);
};
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

console.log(`[worker ${workerId}] polling queue (idle ${IDLE_MS}ms, batch ${MAX_JOBS})`);

// Loop until stopped. Each iteration is a bounded batch.
while (!stopping) {
  try {
    const result = await processQueueBatch({
      workerId,
      queue,
      repository,
      aiDeps: undefined, // Fireworks resolved lazily inside runAudit
      maxJobsPerBatch: MAX_JOBS,
    });
    if (result.emptied && result.processed === 0) {
      await sleep(IDLE_MS);
    }
  } catch (err) {
    console.error(
      `[worker ${workerId}] batch crashed:`,
      err instanceof Error ? err.message : err,
    );
    await sleep(IDLE_MS);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
