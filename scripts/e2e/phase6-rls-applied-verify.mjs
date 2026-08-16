/* Phase 6 follow-up: verify the APPLIED storage RLS policies behaviorally.
 * Minimal footprint: 2 throwaway users + 1 object, all removed afterward.
 * Verifies: bucket private, authenticated-only, uid-prefix scoping for
 * select+delete+insert(list/upload path), anon denied, cross-user denied.
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

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BUCKET = "strategy-files";
const PW = "P6Followup-Pass!1";
const TS = Date.now();

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(`${name}${extra ? ` — ${extra}` : ""}`); console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`); }
}

async function mkUser(email) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
    body: JSON.stringify({ email, password: PW, email_confirm: true }),
  });
  return (await r.json())?.id;
}
async function tok(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: PUB },
    body: JSON.stringify({ email, password: PW }),
  });
  return (await r.json())?.access_token;
}

const H = (token) => ({ apikey: PUB, Authorization: `Bearer ${token}` });

async function main() {
  const emailA = `p6fu-a-${TS}@quantlint.test`;
  const emailB = `p6fu-b-${TS}@quantlint.test`;
  const idA = await mkUser(emailA);
  const idB = await mkUser(emailB);
  check("users A/B created", !!idA && !!idB);

  /* One object under A's prefix, uploaded as the app does (service role). */
  const objPath = `${idA}/audit-000/strategy.py`;
  const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${objPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "x-upsert": "false" },
    body: "x = 1\n",
  });
  check("fixture object uploaded under A's prefix", up.status === 200, `status=${up.status}`);

  /* Bucket privacy (authoritative flag). */
  const bucket = await (await fetch(`${SUPA}/storage/v1/bucket/${BUCKET}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).json();
  check("bucket strategy-files is private (public=false)", bucket?.public === false, JSON.stringify({ public: bucket?.public }));

  const tA = await tok(emailA);
  const tB = await tok(emailB);
  check("tokens issued", !!tA && !!tB);

  /* SELECT matrix */
  const aRead = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${objPath}`, { headers: H(tA) });
  check("A can read own object (select policy)", aRead.status === 200, `status=${aRead.status}`);

  const bRead = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${objPath}`, { headers: H(tB) });
  check("B cannot read A's object", bRead.status !== 200, `status=${bRead.status}`);

  const anonRead = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${objPath}`, { headers: { apikey: PUB } });
  check("anon cannot read the object", anonRead.status !== 200, `status=${anonRead.status}`);

  /* LIST scoping (select policy on list endpoint) */
  const aList = await fetch(`${SUPA}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...H(tA) },
    body: JSON.stringify({ prefix: "", limit: 100 }),
  });
  const aListJson = aList.status === 200 ? await aList.json() : [];
  check("A's list shows only A's prefix", aList.status === 200 && aListJson.length === 1 && aListJson[0].name === idA, JSON.stringify(aListJson.map((i) => i.name)));

  const bList = await fetch(`${SUPA}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...H(tB) },
    body: JSON.stringify({ prefix: idA + "/", limit: 100 }),
  });
  const bListJson = bList.status === 200 ? await bList.json() : [];
  check("B cannot list A's prefix", bListJson.length === 0, JSON.stringify(bListJson));

  /* INSERT scoping */
  const aPut = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${idA}/audit-001/own.py`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", ...H(tA) },
    body: "y = 2\n",
  });
  check("A can upload into own prefix (insert policy)", aPut.status === 200, `status=${aPut.status}`);

  const bPut = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${idB}/../../${idA}/hijack.py`.replace(/\/\.\.\//g, "/x/"), {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", ...H(tB) },
    body: "z = 3\n",
  });
  check("B can upload into B's own prefix (insert policy)", bPut.status === 200, `status=${bPut.status}`);

  const bCross = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${idA}/hijack.py`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", ...H(tB) },
    body: "z = 3\n",
  });
  check("B cannot upload into A's prefix", bCross.status !== 200, `status=${bCross.status}`);

  /* DELETE matrix */
  const bDel = await fetch(`${SUPA}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...H(tB) },
    body: JSON.stringify({ prefixes: [objPath] }),
  });
  check("B cannot delete A's object", bDel.status !== 200 || (await bDel.json()).length === 0, `status=${bDel.status}`);
  const aStill = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${objPath}`, { headers: H(tA) });
  check("A's object intact after B's delete attempt", aStill.status === 200);

  const aDel = await fetch(`${SUPA}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...H(tA) },
    body: JSON.stringify({ prefixes: [objPath] }),
  });
  check("A can delete own object (delete policy)", aDel.status === 200, `status=${aDel.status}`);

  /* Cleanup: remove B's object + both users. */
  await fetch(`${SUPA}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    body: JSON.stringify({ prefixes: [`${idB}/audit-001/own.py`.replace(idB, idB)] }),
  });
  for (const [label, id] of [["A", idA], ["B", idB]]) {
    const r = await fetch(`${SUPA}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    check(`user ${label} cleaned up`, r.status === 200 || r.status === 204, `status=${r.status}`);
  }
  /* Final sweep: bucket must be empty. */
  const sweep = await (await fetch(`${SUPA}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    body: JSON.stringify({ prefix: "", limit: 100 }),
  })).json();
  let leftovers = (sweep ?? []).filter((i) => i.id).map((i) => i.name);
  for (const folder of (sweep ?? []).filter((i) => !i.id)) {
    const sub = await (await fetch(`${SUPA}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      body: JSON.stringify({ prefix: folder.name + "/", limit: 100 }),
    })).json();
    leftovers.push(...(sub ?? []).filter((i) => i.id).map((i) => folder.name + "/" + i.name));
  }
  check("bucket empty after cleanup", leftovers.length === 0, JSON.stringify(leftovers));

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) { failures.forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1); }
  process.exit(0);
}

main().catch((e) => { console.error("verify crashed:", e); process.exit(1); });
