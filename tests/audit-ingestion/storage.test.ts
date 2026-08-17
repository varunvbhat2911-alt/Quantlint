import { describe, it, expect } from "vitest";
import {
  strategyObjectPath,
  strategyPathForAudit,
  uploadStrategyFile,
  downloadStrategyFile,
  deleteStrategyFile,
  deleteUserStorage,
  type StrategyStorageClient,
} from "@/lib/audit-ingestion/storage";
import { IngestionError } from "@/lib/audit-ingestion/types";

const enc = (s: string) => new TextEncoder().encode(s);

/* In-memory fake matching the minimal storage surface — unit tests never
 * touch real Supabase Storage. `list(prefix)` mimics Supabase's shallow
 * listing: returns the immediate children of `prefix` (or root when omitted),
 * with `name` set to the next path segment. */
function fakeStorage(initial: Record<string, Uint8Array> = {}) {
  const objects = new Map(Object.entries(initial));
  const client: StrategyStorageClient = {
    storage: {
      from(bucket: string) {
        if (bucket !== "strategy-files") throw new Error("wrong bucket");
        return {
          async upload(path: string, body: Uint8Array) {
            if (objects.has(path)) {
              return { data: null, error: { message: "Duplicate" } };
            }
            objects.set(path, body);
            return { data: { path }, error: null };
          },
          async download(path: string) {
            const data = objects.get(path);
            if (!data) return { data: null, error: { message: "not found" } };
            return { data, error: null };
          },
          async remove(paths: string[]) {
            for (const p of paths) objects.delete(p);
            return { data: [], error: null };
          },
          async list(prefix?: string) {
            // Shallow list: immediate child segments under `prefix/`.
            const base = prefix ? prefix + "/" : "";
            const names = new Set<string>();
            for (const path of objects.keys()) {
              if (!path.startsWith(base)) continue;
              const rest = path.slice(base.length);
              if (!rest) continue;
              names.add(rest.split("/")[0]!);
            }
            return { data: [...names].map((name) => ({ name })), error: null };
          },
        };
      },
    },
  };
  return { client, objects };
}

describe("strategyObjectPath — server-controlled paths", () => {
  it("builds <user_id>/<audit_id>/<safe_filename>", () => {
    expect(
      strategyObjectPath("u-111", "a-222", "My Strategy.py"),
    ).toMatch(/^u-111\/a-222\//);
  });

  it("re-sanitizes hostile filenames", () => {
    const path = strategyObjectPath("u-1", "a-2", "../../etc/passwd.py");
    expect(path).toBe("u-1/a-2/passwd.py");
    expect(path).not.toContain("..");
  });

  it("never lets the filename influence the user directory", () => {
    for (const hostile of ["/../other-user/x.py", "..\\..\\other\\x.py", "/abs.py"]) {
      const path = strategyObjectPath("u-1", "a-2", hostile);
      expect(path.startsWith("u-1/a-2/")).toBe(true);
    }
  });

  it("is a pure function (derivation is stable)", () => {
    expect(strategyObjectPath("u", "a", "f.py")).toBe(
      strategyObjectPath("u", "a", "f.py"),
    );
  });
});

describe("strategyPathForAudit", () => {
  it("derives the path for upload audits", () => {
    expect(
      strategyPathForAudit({
        input_type: "upload",
        file_name: "strategy.py",
        user_id: "u-1",
        id: "a-2",
      }),
    ).toBe("u-1/a-2/strategy.py");
  });

  it("returns null for pasted audits (no uploaded file)", () => {
    expect(
      strategyPathForAudit({
        input_type: "paste",
        file_name: null,
        user_id: "u-1",
        id: "a-2",
      }),
    ).toBeNull();
  });

  it("returns null when the filename is missing", () => {
    expect(
      strategyPathForAudit({
        input_type: "upload",
        file_name: null,
        user_id: "u-1",
        id: "a-2",
      }),
    ).toBeNull();
  });
});

describe("upload / download / delete round-trip (mocked storage)", () => {
  it("uploads then downloads identical bytes", async () => {
    const { client } = fakeStorage();
    const bytes = enc("import pandas as pd\n");
    const path = await uploadStrategyFile(client, {
      userId: "u-1",
      auditId: "a-2",
      fileName: "s.py",
      bytes,
    });
    expect(path).toBe("u-1/a-2/s.py");
    const back = await downloadStrategyFile(client, path);
    expect(back).toEqual(bytes);
  });

  it("upload failures surface a user-safe IngestionError", async () => {
    const { client } = fakeStorage({ "u/a/s.py": enc("x") });
    await expect(
      uploadStrategyFile(client, {
        userId: "u",
        auditId: "a",
        fileName: "s.py",
        bytes: enc("y"),
      }),
    ).rejects.toThrow(IngestionError);
  });

  it("download of a missing object fails safely", async () => {
    const { client } = fakeStorage();
    await expect(downloadStrategyFile(client, "nope/missing.py")).rejects.toThrow(IngestionError);
  });

  it("delete removes the object and reports success", async () => {
    const { client, objects } = fakeStorage({ "u/a/s.py": enc("x") });
    const result = await deleteStrategyFile(client, "u/a/s.py");
    expect(result.ok).toBe(true);
    expect(objects.has("u/a/s.py")).toBe(false);
  });

  it("deleting a missing object is not an error (idempotent cleanup)", async () => {
    const { client } = fakeStorage();
    const result = await deleteStrategyFile(client, "nothing/here.py");
    expect(result.ok).toBe(true);
  });
});

describe("deleteUserStorage — account-deletion prefix sweep", () => {
  it("removes every object under <userId>/ and leaves other users intact", async () => {
    const { client, objects } = fakeStorage({
      "u-1/a-1/s.py": enc("a"),
      "u-1/a-2/lib.py": enc("b"),
      "u-2/a-9/s.py": enc("c"), // another user — must NOT be touched
    });
    const result = await deleteUserStorage(client, "u-1");
    expect(result.removed).toBe(2);
    expect(result.failed).toBe(0);
    expect(objects.has("u-1/a-1/s.py")).toBe(false);
    expect(objects.has("u-1/a-2/lib.py")).toBe(false);
    expect(objects.has("u-2/a-9/s.py")).toBe(true);
  });

  it("is idempotent — a second sweep finds nothing", async () => {
    const { client } = fakeStorage({ "u-1/a-1/s.py": enc("a") });
    await deleteUserStorage(client, "u-1");
    const second = await deleteUserStorage(client, "u-1");
    expect(second.removed).toBe(0);
    expect(second.failed).toBe(0);
  });

  it("succeeds with zero removals for a user with no files", async () => {
    const { client } = fakeStorage();
    const result = await deleteUserStorage(client, "u-empty");
    expect(result.removed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("never touches files outside the given prefix", async () => {
    const { client, objects } = fakeStorage({
      "u-1/a-1/s.py": enc("a"),
      "u-1X/a-1/s.py": enc("b"), // prefix-cousin, must not match "u-1"
    });
    await deleteUserStorage(client, "u-1");
    expect(objects.has("u-1/a-1/s.py")).toBe(false);
    expect(objects.has("u-1X/a-1/s.py")).toBe(true);
  });
});
