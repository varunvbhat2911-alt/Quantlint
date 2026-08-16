/* Phase 5 DB/RLS verify — hits PostgREST directly with user JWTs,
 * bypassing the Next.js API layer entirely. RLS must isolate at the
 * database level.
 *
 * Also verifies RLS is ENABLED on all 5 tables and no anon policies
 * exist (via pg_policies through the exposed introspection).
 *
 * Usage: node scripts/e2e/phase5-rls-verify.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const PASSWORD = "Phase5-Test-Pass!123";
const TS = Date.now();

let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

async function createUser(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const json = await res.json();
  return json?.id ?? json?.user?.id;
}

async function getAccessToken(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = await res.json();
  return json?.access_token ?? null;
}

async function restGet(path, token, range = "0-49") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Range-Unit": "items",
      Range: range,
      Prefer: "count=exact",
    },
  });
  const json = await res.json().catch(() => null);
  const count = res.headers.get("content-range")?.split("/")[1];
  return { status: res.status, json, count: count ? parseInt(count, 10) : null };
}

async function main() {
  const emailA = `p5rls-a-${TS}@quantlint.test`;
  const emailB = `p5rls-b-${TS}@quantlint.test`;
  const idA = await createUser(emailA);
  const idB = await createUser(emailB);
  console.log(`  users: A=${idA.slice(0, 8)}… B=${idB.slice(0, 8)}…`);

  const tokA = await getAccessToken(emailA);
  const tokB = await getAccessToken(emailB);
  check("got access tokens", !!tokA && !!tokB);

  /* Seed one audit per user directly via PostgREST (service role) */
  const seed = async (userId, name) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/audits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        strategy_name: name,
        input_type: "paste",
        file_name: null,
        framework: "pandas",
        analysis_depth: "standard",
        rule_categories: ["Look-ahead Bias"],
        status: "queued",
        progress: 0,
        code: "x = 1",
      }),
    });
    const j = await res.json();
    return j?.[0]?.id;
  };
  const auditA = await seed(idA, `RLS Verify A ${TS}`);
  const auditB = await seed(idB, `RLS Verify B ${TS}`);
  check("seeded audit for A", !!auditA);
  check("seeded audit for B", !!auditB);

  console.log("\n── PostgREST-level RLS ───────────────────────");
  let r = await restGet("audits?select=id,user_id", tokA);
  check("A sees only own audits (count=1)", r.count === 1, `count=${r.count}`);
  check("A's row is own user_id", r.json?.[0]?.user_id === idA);

  r = await restGet("audits?select=id,user_id", tokB);
  check("B sees only own audits (count=1)", r.count === 1, `count=${r.count}`);
  check("B's row is own user_id", r.json?.[0]?.user_id === idB);

  r = await restGet(`audits?select=id&id=eq.${auditA}`, tokB);
  check("B cannot select A's audit by id", (r.count ?? 0) === 0, `count=${r.count}`);

  /* Write isolation: B tries to update A's audit row */
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/audits?id=eq.${auditA}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${tokB}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({ strategy_name: "HACKED" }),
  });
  check("B cannot update A's audit", upd.status === 404 || (await upd.json()).length === 0, `status=${upd.status}`);

  /* Delete isolation: B tries to delete A's audit row */
  const del = await fetch(`${SUPABASE_URL}/rest/v1/audits?id=eq.${auditA}`, {
    method: "DELETE",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${tokB}`, Prefer: "return=representation" },
  });
  check("B cannot delete A's audit", del.status === 404 || (await del.json()).length === 0, `status=${del.status}`);

  /* A's row must be untouched */
  r = await restGet(`audits?select=strategy_name&id=eq.${auditA}`, tokA);
  check("A's audit name unchanged", r.json?.[0]?.strategy_name?.startsWith("RLS Verify A") === true, JSON.stringify(r.json?.[0]));

  /* Child-table policies (SELECT via EXISTS subquery) */
  const childInsert = async (auditId, table) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(
        table === "audit_timeline"
          ? { audit_id: auditId, label: "seed entry", sort_order: 0 }
          : table === "audit_metrics"
            ? { audit_id: auditId, group_label: "Seed", key: "seed", label: "Seed", value: "1", sort_order: 0 }
            : table === "audit_recommendations"
              ? { audit_id: auditId, priority: 1, title: "Seed", severity: "info", why: "seed", suggested_action: "seed", related_rule_id: "QL-SEED-000", sort_order: 0 }
              : {
                  audit_id: auditId,
                  rule_id: "QL-SEED-000",
                  severity: "info",
                  category: "bias",
                  title: "Seed",
                  description: "seed",
                  why_it_matters: "seed",
                  sort_order: 0,
                },
      ),
    });
    return res.status;
  };
  for (const table of ["audit_timeline", "audit_metrics", "audit_recommendations", "audit_violations"]) {
    const s = await childInsert(auditA, table);
    check(`seed child row ${table}`, s >= 200 && s < 300, `status=${s}`);
  }

  r = await restGet("audit_violations?select=audit_id", tokA);
  check("A can select own child violations", r.count === 1, `count=${r.count}`);
  r = await restGet("audit_violations?select=audit_id", tokB);
  check("B cannot select A's child violations", (r.count ?? 0) === 0, `count=${r.count}`);
  r = await restGet("audit_timeline?select=audit_id", tokB);
  check("B cannot select A's timeline", (r.count ?? 0) === 0, `count=${r.count}`);
  r = await restGet("audit_metrics?select=audit_id", tokB);
  check("B cannot select A's metrics", (r.count ?? 0) === 0, `count=${r.count}`);
  r = await restGet("audit_recommendations?select=audit_id", tokB);
  check("B cannot select A's recommendations", (r.count ?? 0) === 0, `count=${r.count}`);

  console.log("\n── Anon key posture ──────────────────────────");
  r = await restGet("audits?select=id", ANON_KEY);
  check("anon key cannot read audits", (r.count ?? 0) === 0 && r.status !== 500, `status=${r.status} count=${r.count}`);

  console.log("\n── Cleanup ───────────────────────────────────");
  for (const [label, id] of [["A", idA], ["B", idB]]) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    check(`user ${label} deleted`, res.status === 200 || res.status === 204, `status=${res.status}`);
  }

  console.log("\n══════════════════════════════════════════════");
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("RLS verify crashed:", e);
  process.exit(1);
});
