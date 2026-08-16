/* Phase 7 E2E — trustworthiness of the audit output.
 *
 * TEST A — deterministic + AI success (server :3000, real Fireworks)
 * TEST B — AI failure via unreachable endpoint (server :3001,
 *          FIREWORKS_BASE_URL=http://127.0.0.1:9 — env-only override)
 * TEST C — no-statistics strategy: AI must not fabricate numeric claims
 * TEST D — multi-file ZIP attribution
 *
 * One temporary user; all data removed afterward.
 *
 * Usage: node scripts/e2e/phase7-e2e.mjs
 * Requires: dev server on :3000 (normal env) and :3001 (broken AI env).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { zipSync, strToU8 } from "fflate";

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

const MAIN = "http://localhost:3000";
const BROKEN_AI = "http://localhost:3001";
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "Phase7-Test-Pass!1";
const TS = Date.now();

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(`${name}${extra ? ` — ${extra}` : ""}`); console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`); }
}

function makeClient() {
  const jar = new Map();
  return {
    async req(base, path, { method = "GET", body } = {}) {
      const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(body !== undefined && !(body instanceof FormData)
            ? { "Content-Type": "application/json" }
            : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body:
          body !== undefined && !(body instanceof FormData)
            ? JSON.stringify(body)
            : body,
        redirect: "manual",
      });
      for (const sc of res.headers.getSetCookie?.() ?? []) {
        const [pair] = sc.split(";");
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
      }
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* non-JSON */ }
      return { status: res.status, json, text };
    },
  };
}

async function adminCreateUser(email) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  return (await r.json())?.id;
}

async function dbCount(table) {
  const r = await fetch(`${SUPA}/rest/v1/${table}?select=*`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" },
  });
  await r.arrayBuffer();
  return parseInt((r.headers.get("content-range") || "*/0").split("/")[1], 10);
}

async function rawViolationRows(auditId) {
  const r = await fetch(`${SUPA}/rest/v1/audit_violations?audit_id=eq.${auditId}&select=rule_id,severity,file_name,line,code_snippet,ai_explanation,detected_pattern&order=sort_order`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  return r.json();
}

async function rawTimeline(auditId) {
  const r = await fetch(`${SUPA}/rest/v1/audit_timeline?audit_id=eq.${auditId}&select=label&order=sort_order`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  return (await r.json()).map((t) => t.label);
}

/* Same numeric-claim detector as src/lib/ai/service.ts (ported for live
 * verification of persisted AI text). Two classes: ratio metrics flag
 * decimals and %/x; performance terms flag only %/x markers. */
const RATIO_TERMS = ["sharpe","sortino","cagr","drawdown","volatility","\\balpha\\b","\\bbeta\\b","expectancy"];
const PERF_TERMS = ["\\breturn\\b","\\breturns\\b","\\bprofit\\b","profitability","win rate","win-rate","winrate","hit rate","annualized","annualised","trades per","trade count"];
const RATIO_NUM = "(\\d+\\.\\d+|\\d+\\s*[%x×])";
const PERF_NUM = "(\\d+\\s*[%x×]|\\d+(?:\\.\\d+)?\\s*%)";
const PATTERNS = [];
for (const t of RATIO_TERMS) {
  PATTERNS.push(new RegExp(`${t}[^\\d\\n]{0,30}${RATIO_NUM}`, "i"));
  PATTERNS.push(new RegExp(`${RATIO_NUM}[^\\n]{0,20}${t}`, "i"));
}
for (const t of PERF_TERMS) {
  PATTERNS.push(new RegExp(`${t}[^\\d\\n]{0,30}${PERF_NUM}`, "i"));
  PATTERNS.push(new RegExp(`${PERF_NUM}[^\\n]{0,20}${t}`, "i"));
}
function hasFabricatedClaim(...texts) {
  const joined = texts.filter(Boolean).join(" \n ");
  return PATTERNS.filter((re) => re.test(joined));
}

/* Strategy with a deterministic look-ahead at line 5 (QL-BIAS-001). */
const PY_SOURCE = `import pandas as pd


def run(close):
    signal = close.pct_change().shift(-1)
    return signal * 20.0
`;

/* No statistics anywhere — plain structural strategy. */
const NO_STATS_SOURCE = `import pandas as pd


def generate_signals(close):
    fast = close.rolling(window=10).mean()
    slow = close.rolling(window=30).mean()
    long_entry = fast > slow
    long_exit = fast <= slow
    return long_entry, long_exit
`;

const ZIP_MAIN = PY_SOURCE;
const ZIP_RISK = `LEVERAGE = 20.0


def size_position(equity, close):
    future = close.shift(-1)
    return equity * LEVERAGE * future
`;
const MULTI_ZIP = zipSync({ "alpha/main.py": strToU8(ZIP_MAIN), "zeta/risk.py": strToU8(ZIP_RISK) });

const CATEGORIES = JSON.stringify([
  "Look-ahead Bias","Data Leakage","Survivorship Bias","Risk Management",
  "Position Sizing","Performance Metrics","Execution Logic","Transaction Costs","Portfolio Logic",
]);

async function createAndRun(client, base, source, name, { zip = false } = {}) {
  let r;
  if (zip) {
    const form = new FormData();
    form.set("strategyName", name);
    form.set("framework", "pandas");
    form.set("analysisDepth", "standard");
    form.set("ruleCategories", CATEGORIES);
    form.set("file", new Blob([MULTI_ZIP], { type: "application/zip" }), "project.zip");
    r = await client.req(base, "/api/audits", { method: "POST", body: form });
  } else {
    r = await client.req(base, "/api/audits", {
      method: "POST",
      body: { strategyName: name, inputType: "paste", fileName: null, framework: "pandas", analysisDepth: "standard", ruleCategories: JSON.parse(CATEGORIES), code: source },
    });
  }
  if (r.status !== 201) return { error: r };
  const id = r.json?.audit?.id;
  await client.req(base, `/api/audits/${id}/run`, { method: "POST" });

  const deadline = Date.now() + 240_000;
  let audit = null;
  while (Date.now() < deadline) {
    const p = await client.req(base, `/api/audits/${id}`);
    if (p.status === 200 && p.json?.audit) {
      audit = p.json.audit;
      if (audit.status === "completed" || audit.status === "failed") break;
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  return { id, audit };
}

async function main() {
  console.log("\n── Setup ──────────────────────────────────────");
  const email = `p7-${TS}@quantlint.test`;
  const userId = await adminCreateUser(email);
  check("temp user created", !!userId);
  const a = makeClient();
  let r = await a.req(MAIN, "/api/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  check("login on :3000", r.status === 200);
  const b = makeClient();
  r = await b.req(BROKEN_AI, "/api/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  check("login on :3001 (broken-AI server)", r.status === 200, `status=${r.status}`);

  /* ── TEST A — deterministic + AI success ───────────────── */
  console.log("\n── TEST A: deterministic + AI success ──────────");
  const A = await createAndRun(a, MAIN, PY_SOURCE, `P7 A ${TS}`);
  check("A: audit completed", A.audit?.status === "completed", JSON.stringify(A.audit?.status ?? A.error?.status));
  const rowsA = await rawViolationRows(A.id);
  const biasA = rowsA.find((v) => v.rule_id === "QL-BIAS-001");
  check("A: exact rule id persisted", biasA?.rule_id === "QL-BIAS-001");
  check("A: pasted audit file column is null (no fabricated file)", biasA?.file_name === null, JSON.stringify(biasA?.file_name));
  check("A: exact line persisted (5)", biasA?.line === 5, JSON.stringify(biasA?.line));
  check("A: exact snippet persisted", (biasA?.code_snippet ?? "").includes("shift(-1)"), JSON.stringify(biasA?.code_snippet));
  check("A: AI explanation persisted", !!biasA?.ai_explanation?.explanation);
  const aiA = biasA?.ai_explanation ?? {};
  check("A: AI confidence present", typeof aiA.confidence === "number");
  const recsA = await (await fetch(`${SUPA}/rest/v1/audit_recommendations?audit_id=eq.${A.id}&select=related_rule_id&order=priority`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).json();
  check("A: recommendations linked to real rule ids", recsA.length > 0 && recsA.every((x) => /^QL-[A-Z]+-\d+$/.test(x.related_rule_id)), JSON.stringify(recsA.slice(0, 3)));
  const resultA = (await a.req(MAIN, `/api/audits/${A.id}/results`)).json?.result;
  check("A: score persisted in result", typeof resultA?.score === "number");
  check("A: grade persisted in result", typeof resultA?.grade === "string" && /^[A-F]$/.test(resultA.grade));
  check("A: result API violation carries evidence kind", ["direct", "inferred", "absence"].includes(resultA?.violations?.[0]?.evidence), JSON.stringify(resultA?.violations?.[0]?.evidence));
  const inline = resultA?.violations?.find((v) => v.aiExplanation);
  check("A: AI explanation linked onto its finding", !!inline?.aiExplanation?.relatedViolationId);
  console.log(`    score=${resultA?.score} grade=${resultA?.grade} findings=${rowsA.length}`);

  /* ── TEST B — AI failure (env-only broken endpoint) ────── */
  console.log("\n── TEST B: AI failure (unreachable endpoint) ───");
  const B = await createAndRun(b, BROKEN_AI, PY_SOURCE, `P7 B ${TS}`);
  check("B: audit reaches terminal state", B.audit?.status === "completed" || B.audit?.status === "failed", JSON.stringify(B.audit?.status));
  check("B: audit COMPLETED despite AI outage", B.audit?.status === "completed", JSON.stringify(B.audit?.status));
  const rowsB = await rawViolationRows(B.id);
  const biasB = rowsB.find((v) => v.rule_id === "QL-BIAS-001");
  check("B: deterministic findings persisted", !!biasB);
  check("B: same rule id as AI-success run", biasB?.rule_id === biasA?.rule_id);
  check("B: same line as AI-success run", biasB?.line === biasA?.line);
  check("B: same snippet as AI-success run", biasB?.code_snippet === biasA?.code_snippet);
  check("B: no AI explanation persisted", !biasB?.ai_explanation);
  const resultB = (await b.req(BROKEN_AI, `/api/audits/${B.id}/results`)).json?.result;
  check("B: score identical to AI-success run", resultB?.score === resultA?.score, `${resultB?.score} vs ${resultA?.score}`);
  check("B: grade identical to AI-success run", resultB?.grade === resultA?.grade, `${resultB?.grade} vs ${resultA?.grade}`);
  const timelineB = await rawTimeline(B.id);
  check("B: timeline records AI failure safely", timelineB.some((l) => /AI enrichment/i.test(l)), JSON.stringify(timelineB.filter((l) => /AI/i.test(l))));
  const responseTextB = JSON.stringify(resultB);
  check("B: no secrets in response", !/SUPABASE_SERVICE_ROLE|FIREWORKS|eyJ|sbp_|api[_-]?key/i.test(responseTextB));
  check("B: no stack traces in response", !/at\s+\S+\s+\(.*\.(ts|js):\d+|Trace|Error: ECONN/i.test(responseTextB));

  /* ── TEST C — no-statistics strategy ───────────────────── */
  console.log("\n── TEST C: no-statistics strategy ───────────────");
  const C = await createAndRun(a, MAIN, NO_STATS_SOURCE, `P7 C ${TS}`);
  check("C: audit completed", C.audit?.status === "completed", JSON.stringify(C.audit?.status ?? C.error?.status));
  const rowsC = await rawViolationRows(C.id);
  const withAi = rowsC.filter((v) => v.ai_explanation);
  console.log(`    findings=${rowsC.length} withAI=${withAi.length}`);
  let fabricated = [];
  for (const v of withAi) {
    const ai = v.ai_explanation;
    fabricated.push(...hasFabricatedClaim(ai.explanation, ai.why_it_matters, ai.suggested_fix, ai.summary, (ai.caveats ?? []).join(" "), (ai.corrected_example ?? "")));
  }
  check("C: zero fabricated numeric performance claims in AI text", fabricated.length === 0, fabricated.slice(0, 3).map((m) => m.source).join(" | "));

  /* ── TEST D — multi-file ZIP attribution ────────────────── */
  console.log("\n── TEST D: multi-file ZIP attribution ────────────");
  const D = await createAndRun(a, MAIN, null, `P7 D ${TS}`, { zip: true });
  if (D.error) {
    check("D: audit created", false, `status=${D.error.status} ${D.error.text?.slice(0, 150)}`);
  } else {
  check("D: audit completed", D.audit?.status === "completed", JSON.stringify(D.audit?.status));
  const rowsD = await rawViolationRows(D.id);
  const biasMain = rowsD.find((v) => v.file_name === "alpha/main.py" && v.rule_id === "QL-BIAS-001");
  const biasRisk = rowsD.find((v) => v.file_name === "zeta/risk.py" && v.rule_id === "QL-BIAS-001");
  check("D: finding attributed to alpha/main.py", !!biasMain);
  check("D: main file line attribution (5)", biasMain?.line === 5, JSON.stringify(biasMain?.line));
  check("D: finding attributed to zeta/risk.py", !!biasRisk);
  check("D: risk file line attribution (5)", biasRisk?.line === 5, JSON.stringify(biasRisk?.line));
  check("D: evidence correct in both files", (biasMain?.code_snippet ?? "").includes("shift(-1)") && (biasRisk?.code_snippet ?? "").includes("shift(-1)"));
  }

  /* ── Cleanup ───────────────────────────────────────────── */
  console.log("\n── Cleanup ──────────────────────────────────────");
  for (const id of [A.id, B.id, C.id, D.id]) {
    if (id) await a.req(MAIN, `/api/audits/${id}`, { method: "DELETE" }).catch(() => {});
  }
  const del = await fetch(`${SUPA}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  check("temp user deleted", del.status === 200 || del.status === 204);
  for (const t of ["audits", "audit_violations", "audit_metrics", "audit_recommendations", "audit_timeline"]) {
    const n = await dbCount(t);
    check(`${t} = 0 rows`, n === 0, `count=${n}`);
  }
  const storageList = await (await fetch(`${SUPA}/storage/v1/object/list/strategy-files`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }, body: JSON.stringify({ prefix: "", limit: 100 }) })).json();
  check("no test storage objects", (storageList ?? []).length === 0, JSON.stringify(storageList));

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) { failures.forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1); }
  process.exit(0);
}

main().catch((e) => { console.error("E2E crashed:", e); process.exit(1); });
