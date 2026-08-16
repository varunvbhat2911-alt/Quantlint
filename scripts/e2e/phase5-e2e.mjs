/* Phase 5 E2E — two-user isolation, real list/stats/delete APIs.
 *
 * Flow:
 *   1. Create users A and B via GoTrue admin API (known UUIDs for DB checks)
 *   2. Login both through the real /api/auth/login (session cookies)
 *   3. A: create + run a real audit; poll to completion
 *   4. A: GET /api/audits (DTO, summary, pagination), filters, stats,
 *      validation errors
 *   5. B: empty list; foreign DELETE 404; foreign results 404
 *   6. A: DELETE own audit; list/stats empty; DB cascade verified
 *   7. Cleanup: delete both users (admin API)
 *
 * Usage: node scripts/e2e/phase5-e2e.mjs
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

const BASE = "http://localhost:3000";
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "Phase5-Test-Pass!123";
const TS = Date.now();
const USER_A = { email: `p5a-${TS}@quantlint.test`, id: null };
const USER_B = { email: `p5b-${TS}@quantlint.test`, id: null };

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name + (extra ? ` — ${extra}` : ""));
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* Cookie-jar HTTP client */
function makeClient() {
  const jar = new Map();
  return {
    async req(path, { method = "GET", body, headers = {} } = {}) {
      const cookie = [...jar.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });
      for (const sc of res.headers.getSetCookie?.() ?? []) {
        const [pair] = sc.split(";");
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON */
      }
      return { status: res.status, json, text };
    },
  };
}

async function adminCreateUser(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const json = await res.json().catch(() => null);
  const id = json?.id ?? json?.user?.id ?? null;
  if (!id) throw new Error(`admin create failed for ${email}: ${JSON.stringify(json)}`);
  return id;
}

async function adminDeleteUser(id) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  });
  return res.status;
}

async function dbCount(table, params) {
  const qs = new URLSearchParams(params);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&${qs}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "count=exact",
        "Range-Unit": "items",
      },
    },
  );
  // Read the body, then use content-range for count
  await res.arrayBuffer();
  const range = res.headers.get("content-range") ?? "*/0";
  return parseInt(range.split("/")[1] ?? "0", 10);
}

/* Strategy with deterministic violations (look-ahead + leverage + no stop) */
const STRATEGY_CODE = `
import pandas as pd
import numpy as np

def run_strategy(prices):
    signals = prices["close"].pct_change().shift(-1)
    position = np.sign(signals)
    leverage = 20.0
    returns = position * returns * leverage
    return returns.cumsum()
`.trim();

const AUDIT_BODY = {
  strategyName: `Phase5 E2E Momentum ${TS}`,
  inputType: "paste",
  framework: "pandas",
  analysisDepth: "standard",
  ruleCategories: [
    "Look-ahead Bias",
    "Data Leakage",
    "Risk Management",
    "Position Sizing",
    "Performance Metrics",
    "Execution Logic",
    "Transaction Costs",
  ],
  code: STRATEGY_CODE,
};

async function main() {
  console.log("\n── Setup ──────────────────────────────────────");
  USER_A.id = await adminCreateUser(USER_A.email);
  USER_B.id = await adminCreateUser(USER_B.email);
  console.log(`  user A: ${USER_A.email} (${USER_A.id.slice(0, 8)}…)`);
  console.log(`  user B: ${USER_B.email} (${USER_B.id.slice(0, 8)}…)`);

  const a = makeClient();
  const b = makeClient();

  let r = await a.req("/api/auth/login", {
    method: "POST",
    body: { email: USER_A.email, password: PASSWORD },
  });
  check("A login 200", r.status === 200, `status=${r.status}`);
  r = await b.req("/api/auth/login", {
    method: "POST",
    body: { email: USER_B.email, password: PASSWORD },
  });
  check("B login 200", r.status === 200, `status=${r.status}`);

  console.log("\n── 1. Unauthenticated access ──────────────────");
  const anon = makeClient();
  r = await anon.req("/api/audits");
  check("GET /api/audits unauthenticated → 401", r.status === 401, `status=${r.status}`);
  r = await anon.req("/api/audits/stats");
  check("GET /api/audits/stats unauthenticated → 401", r.status === 401, `status=${r.status}`);

  console.log("\n── 2. B starts empty ──────────────────────────");
  r = await b.req("/api/audits");
  check("B initial list ok", r.status === 200 && Array.isArray(r.json?.audits), `status=${r.status}`);
  check("B initial list empty", r.json?.audits?.length === 0, JSON.stringify(r.json?.audits?.length));
  check("B summary zeros", r.json?.summary?.totalAudits === 0, JSON.stringify(r.json?.summary));

  console.log("\n── 3. A creates + runs a real audit ───────────");
  r = await a.req("/api/audits", { method: "POST", body: AUDIT_BODY });
  check("A create audit 201", r.status === 201, `status=${r.status} ${r.text?.slice(0, 200)}`);
  const auditId = r.json?.audit?.id;
  check("audit id returned", typeof auditId === "string" && auditId.length > 30, JSON.stringify(auditId));

  r = await a.req(`/api/audits/${auditId}/run`, { method: "POST" });
  check("A run audit accepted", r.status >= 200 && r.status < 300, `status=${r.status} ${r.text?.slice(0, 200)}`);

  let finalAudit = null;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    r = await a.req(`/api/audits/${auditId}`);
    if (r.status === 200 && r.json?.audit) {
      finalAudit = r.json.audit;
      if (finalAudit.status === "completed" || finalAudit.status === "failed") break;
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  check("audit reached terminal status", finalAudit?.status === "completed" || finalAudit?.status === "failed", JSON.stringify(finalAudit?.status));
  console.log(`    status=${finalAudit?.status} progress=${finalAudit?.progress}%`);

  console.log("\n── 4. A: list DTO, filters, stats, validation ──");
  r = await a.req("/api/audits");
  check("A list 200", r.status === 200, `status=${r.status}`);
  const item = r.json?.audits?.[0];
  check("A list has 1 audit", r.json?.audits?.length === 1, JSON.stringify(r.json?.audits?.length));
  if (item) {
    check("DTO: id matches", item.id === auditId);
    check("DTO: strategyName real", item.strategyName === AUDIT_BODY.strategyName, JSON.stringify(item.strategyName));
    check("DTO: framework", item.framework === "pandas", JSON.stringify(item.framework));
    check("DTO: has violations counts", typeof item.violations?.total === "number", JSON.stringify(item.violations));
    check("DTO: no source code leaked", !("code" in item) && !("sourceCode" in item), Object.keys(item).join(","));
    check("DTO: no full findings leaked", !("violations_detail" in item) && !("findings" in item));
  }
  const sum = r.json?.summary;
  if (sum) {
    check("summary.totalAudits = 1", sum.totalAudits === 1, JSON.stringify(sum));
    check("summary.totalIssues is number", typeof sum.totalIssues === "number");
    check("summary.averageScore is number or null", sum.averageScore === null || typeof sum.averageScore === "number");
  }
  check("pagination.total = 1", r.json?.pagination?.total === 1, JSON.stringify(r.json?.pagination));
  check("pagination.page = 1", r.json?.pagination?.page === 1);

  r = await a.req(`/api/audits?search=${encodeURIComponent("Momentum")}`);
  check("search filter finds audit", r.json?.audits?.length === 1, JSON.stringify(r.json?.audits?.length));
  r = await a.req(`/api/audits?search=${encodeURIComponent("zzz-no-match")}`);
  check("search filter excludes", r.json?.audits?.length === 0);
  r = await a.req(`/api/audits?status=${finalAudit?.status === "completed" ? "failed" : "completed"}`);
  check("status filter excludes other status", r.json?.audits?.length === 0);
  r = await a.req(`/api/audits?status=${finalAudit?.status}`);
  check("status filter includes own status", r.json?.audits?.length === 1);
  r = await a.req("/api/audits?sort=name-az");
  check("sort=name-az ok", r.status === 200);
  r = await a.req("/api/audits?page=abc");
  check("page=abc → 400", r.status === 400, `status=${r.status}`);
  r = await a.req("/api/audits?pageSize=500");
  check("pageSize=500 → 400", r.status === 400, `status=${r.status}`);
  r = await a.req("/api/audits?status=bogus");
  check("status=bogus → 400", r.status === 400, `status=${r.status}`);

  r = await a.req("/api/audits/stats");
  check("A stats 200", r.status === 200, `status=${r.status}`);
  const st = r.json?.stats;
  if (st) {
    check("stats.total = 1", st.total === 1, JSON.stringify(st));
    check("stats has all status keys", ["queued", "running", "completed", "failed"].every((k) => k in st), JSON.stringify(st));
    const statusKey = finalAudit?.status;
    if (statusKey && statusKey !== "total") {
      check(`stats.${statusKey} = 1`, st[statusKey] === 1, JSON.stringify(st));
    }
  }

  console.log("\n── 5. Cross-user isolation ────────────────────");
  r = await b.req("/api/audits");
  check("B cannot see A's audit in list", r.json?.audits?.length === 0);
  r = await b.req(`/api/audits/${auditId}`);
  check("B GET A's audit → 404", r.status === 404, `status=${r.status}`);
  r = await b.req(`/api/audits/${auditId}/results`);
  check("B GET A's results → 404", r.status === 404, `status=${r.status}`);
  r = await b.req(`/api/audits/${auditId}`, { method: "DELETE" });
  check("B DELETE A's audit → 404", r.status === 404, `status=${r.status}`);
  r = await a.req(`/api/audits/${auditId}`);
  check("A's audit still exists after B's delete attempt", r.status === 200);

  console.log("\n── 6. A deletes own audit ─────────────────────");
  r = await a.req(`/api/audits/${auditId}`, { method: "DELETE" });
  check("A DELETE own audit → 200", r.status === 200, `status=${r.status}`);
  r = await a.req(`/api/audits/${auditId}`);
  check("A GET deleted audit → 404", r.status === 404, `status=${r.status}`);
  r = await a.req("/api/audits");
  check("A list empty after delete", r.json?.audits?.length === 0);
  r = await a.req("/api/audits/stats");
  check("A stats total = 0 after delete", r.json?.stats?.total === 0, JSON.stringify(r.json?.stats));

  console.log("\n── 7. DB cascade verification ─────────────────");
  const tables = [
    ["audits", { id: `eq.${auditId}` }],
    ["audit_violations", { audit_id: `eq.${auditId}` }],
    ["audit_metrics", { audit_id: `eq.${auditId}` }],
    ["audit_recommendations", { audit_id: `eq.${auditId}` }],
    ["audit_timeline", { audit_id: `eq.${auditId}` }],
  ];
  for (const [table, params] of tables) {
    const n = await dbCount(table, params);
    check(`${table} rows for deleted audit = 0`, n === 0, `count=${n}`);
  }

  console.log("\n── 8. Cleanup ────────────────────────────────");
  const delA = await adminDeleteUser(USER_A.id);
  const delB = await adminDeleteUser(USER_B.id);
  check("user A deleted", delA === 200 || delA === 204, `status=${delA}`);
  check("user B deleted", delB === 200 || delB === 204, `status=${delB}`);
  const remaining = await dbCount("audits", { user_id: `eq.${USER_A.id}` });
  check("A's audits purged after user delete", remaining === 0, `count=${remaining}`);

  console.log("\n══════════════════════════════════════════════");
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
