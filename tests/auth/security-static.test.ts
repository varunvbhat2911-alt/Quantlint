/* Static security checks (Phase 4T) — fail the suite if secrets or
 * server-only modules leak into client-reachable code. */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const srcFiles = walk(SRC).map((f) => path.relative(ROOT, f).replace(/\\/g, "/"));

/* Modules allowed to touch (or name, in server-only error strings) the
 * server-only credential env vars. All are imported exclusively by
 * Route Handlers / server code — never from client components. */
const SERVER_ONLY_ALLOWLIST = [
  "src/lib/supabase/admin.ts",
  "src/lib/ai/provider.ts",
  "src/lib/ai/fireworks.ts",
  "src/lib/ai/service.ts",
  "src/lib/audit-engine/execution.ts",
  "src/lib/audit-engine/repository.ts",
];

describe("static security", () => {
  it("never references server-only secret env vars outside the allowlist", () => {
    const offenders: string[] = [];
    for (const file of srcFiles) {
      if (SERVER_ONLY_ALLOWLIST.includes(file)) continue;
      const content = fs.readFileSync(path.join(ROOT, file), "utf8");
      if (/SUPABASE_SERVICE_ROLE_KEY|FIREWORKS_API_KEY/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no NEXT_PUBLIC secret variables", () => {
    const offenders: string[] = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(path.join(ROOT, file), "utf8");
      if (/NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|FIREWORKS|TOKEN)/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not import the admin client from client components", () => {
    const offenders: string[] = [];
    for (const file of srcFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = fs.readFileSync(path.join(ROOT, file), "utf8");
      if (/supabase\/admin|audit-engine\/(repository|execution)/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("stores no literal credentials in source", () => {
    const offenders: string[] = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(path.join(ROOT, file), "utf8");
      if (/fw_[A-Za-z0-9]{20,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it(".env.example contains placeholders only", () => {
    const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    for (const [, name, value] of example.matchAll(/^([A-Z_]+)=(.+)$/gm)) {
      if (!/KEY|TOKEN|SECRET/.test(String(name))) continue;
      expect(String(value)).toMatch(/^REPLACE_WITH_/);
    }
  });

  it(".env.local is gitignored", () => {
    const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(/^\.env\*$/m.test(gitignore)).toBe(true);
  });
});
