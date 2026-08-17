/* Bundles the shared audit-worker core (src/lib/audit-queue/worker.ts and its
 * dependency graph) into a single Deno-loadable artifact for the Supabase Edge
 * Function at supabase/functions/audit-worker/_worker.bundle.js.
 *
 * Why: the Edge Function runs on Deno, but the worker core imports Node-only
 * modules (`server-only`, `node:async_hooks`, `process`). esbuild resolves the
 * graph and we shim the Node-only bits at bundle time so the SAME source that
 * the Node dev worker uses is shared with the Edge Function — no second
 * execution architecture.
 *
 * Shims applied:
 *   - "server-only"  → empty (the import is a build-time guard, not runtime).
 *   - "./logger" (server logger) → a Deno-safe logger that writes JSON to
 *     console (Deno has no process.stdout/stderr in the same shape). This is
 *     injected by aliasing the logger module to a tiny inline shim.
 *
 * Usage: node scripts/phase9/build-worker.mjs
 * Produces: supabase/functions/audit-worker/_worker.bundle.js
 *
 * No secrets are read or bundled. The bundle contains only code; all credential
 * access stays at runtime via Deno.env in the Edge Function entry.
 */

import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "supabase", "functions", "audit-worker");
const outFile = join(outDir, "_worker.bundle.js");

// Deno-safe logger shim source, written as an ES module string. Mirrors the
// public surface of src/lib/server/logger.ts (log, withRequestId,
// currentRequestId, newRequestId) so the worker core imports unchanged.
const loggerShim = `
let _rid = undefined;
export function newRequestId() {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  let s = ""; for (const b of a) s += String.fromCharCode(b);
  return "req_" + btoa(s).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
}
export function withRequestId(rid, fn) { const prev = _rid; _rid = rid; try { return fn(); } finally { _rid = prev; } }
export function currentRequestId() { return _rid; }
function emit(level, event, fields) {
  const p = { ts: new Date().toISOString(), level, event };
  if (_rid) p.requestId = _rid;
  if (fields) for (const [k, v] of Object.entries(fields)) { if (k === "requestId") continue; if (v === undefined || v === null) continue; p[k] = v; }
  const line = JSON.stringify(p);
  if (level === "error" || level === "warn") console.error(line); else console.log(line);
}
export const log = { debug: (e, f) => emit("debug", e, f), info: (e, f) => emit("info", e, f), warn: (e, f) => emit("warn", e, f), error: (e, f) => emit("error", e, f) };
`;

// Write the shim to a temp module the bundler can resolve.
const shimDir = join(root, "node_modules", ".phase9-shims");
mkdirSync(shimDir, { recursive: true });
const loggerShimFile = join(shimDir, "logger-deno.js");
writeFileSync(loggerShimFile, loggerShim, "utf8");

// Entry: a tiny module that re-exports exactly what the Edge Function imports.
const entry = `
export { processQueueBatch } from "${join(root, "src/lib/audit-queue/worker.ts").replace(/\\/g, "/")}";
export { createAuditQueueClient } from "${join(root, "src/lib/audit-queue/index.ts").replace(/\\/g, "/")}";
export { createSupabaseAuditRepository } from "${join(root, "src/lib/audit-engine/repository.ts").replace(/\\/g, "/")}";
`;
const entryFile = join(shimDir, "worker-entry.js");
writeFileSync(entryFile, entry, "utf8");

// A plugin to redirect the server logger import to the Deno shim, and to
// neutralize `server-only`. Matches on the importer path so only the worker
// graph gets the shim — app code is unaffected.
const denoShimPlugin = {
  name: "deno-shims",
  setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({
      path: join(shimDir, "empty.js"),
      sideEffects: false,
    }));
    b.onResolve({ filter: /\/lib\/server\/logger$/ }, (args) => {
      // Only redirect when resolving from within the worker bundle graph.
      if (args.importer.includes("audit-queue") || args.importer.includes(".phase9-shims")) {
        return { path: loggerShimFile };
      }
      return null;
    });
    b.onLoad({ filter: /empty\.js$/ }, () => ({ contents: "", loader: "js" }));
  },
};

mkdirSync(outDir, { recursive: true });
const nodeOutDir = join(root, "scripts", "phase9");
mkdirSync(nodeOutDir, { recursive: true });

// A no-shim plugin for Node: keep the real logger (it uses Node APIs).
const nodePlugin = {
  name: "node-server-only",
  setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({
      path: join(shimDir, "empty.js"),
      sideEffects: false,
    }));
    b.onLoad({ filter: /empty\.js$/ }, () => ({ contents: "", loader: "js" }));
  },
};

// @supabase/supabase-js pulls in optional peer packages (functions-js,
// realtime-js, auth-js) that are not installed and not used by our worker
// (we only use the DB + storage + auth.admin surface). Mark them external so
// esbuild does not try to resolve them; the runtime bundle only references the
// code paths we actually call.
const supabaseExternals = ["@supabase/functions-js", "@supabase/realtime-js", "@supabase/auth-js"];

// 1. Deno bundle for the Supabase Edge Function.
await build({
  entryPoints: [entryFile],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: outFile,
  plugins: [denoShimPlugin],
  logLevel: "info",
  external: supabaseExternals,
  banner: {
    js: "// GENERATED by scripts/phase9/build-worker.mjs — do not edit.\n// Deno-loadable bundle of the shared audit-worker core.\n",
  },
});

// 2. Node bundle for the dev/long-running-host worker.
const nodeOutFile = join(nodeOutDir, "_worker.node.bundle.js");
await build({
  entryPoints: [entryFile],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  outfile: nodeOutFile,
  plugins: [nodePlugin],
  logLevel: "info",
  external: supabaseExternals,
  banner: {
    js: "// GENERATED by scripts/phase9/build-worker.mjs — do not edit.\n// Node-loadable bundle of the shared audit-worker core.\n",
  },
});

console.log(`\n✓ Wrote ${outFile.replace(root + "/", "")}`);
console.log(`✓ Wrote ${nodeOutFile.replace(root + "/", "")}`);
console.log("  Deploy with: supabase functions deploy audit-worker");
console.log("  Run locally: node scripts/phase9/worker.mjs");
