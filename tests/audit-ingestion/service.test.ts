import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { ingestUploadedStrategy } from "@/lib/audit-ingestion/service";
import { IngestionError } from "@/lib/audit-ingestion/types";
import type { StrategyStorageClient } from "@/lib/audit-ingestion/storage";

const enc = (s: string) => new TextEncoder().encode(s);

async function expectUserErrorAsync(fn: () => Promise<unknown>, regex: RegExp) {
  try {
    await fn();
  } catch (err) {
    expect(err).toBeInstanceOf(IngestionError);
    expect((err as IngestionError).userMessage).toMatch(regex);
    return;
  }
  expect.unreachable('expected an IngestionError');
}

const PY_SOURCE = `import pandas as pd

def run(close):
    signal = close.pct_change().shift(-1)
    return signal
`;

const MAIN = PY_SOURCE;
const RISK = `LEVERAGE = 20.0
`;

function fakeStorage(initial: Record<string, Uint8Array> = {}) {
  const objects = new Map(Object.entries(initial));
  const client: StrategyStorageClient = {
    storage: {
      from() {
        return {
          async upload() {
            return { data: null, error: { message: "unused" } };
          },
          async download(path: string) {
            const data = objects.get(path);
            if (!data) return { data: null, error: { message: "not found" } };
            return { data, error: null };
          },
          async remove() {
            return { data: [], error: null };
          },
          async list() {
            return { data: [], error: null };
          },
        };
      },
    },
  };
  return client;
}

const auditBase = {
  user_id: "u-1",
  id: "a-2",
  code: "",
};

describe("ingestUploadedStrategy", () => {
  it("ingests a stored .py file into engine-ready source", async () => {
    const client = fakeStorage({ "u-1/a-2/strategy.py": enc(PY_SOURCE) });
    const result = await ingestUploadedStrategy(
      { ...auditBase, input_type: "upload", file_name: "strategy.py" },
      client,
    );
    expect(result.code).toBe(PY_SOURCE);
    expect(result.segments).toEqual([]);
    expect(result.fileCount).toBe(1);
  });

  it("ingests a multi-file .zip with a segment table", async () => {
    const zip = zipSync({
      "alpha/main.py": strToU8(MAIN),
      "zeta/risk.py": strToU8(RISK),
    });
    const client = fakeStorage({ "u-1/a-2/project.zip": zip });
    const result = await ingestUploadedStrategy(
      { ...auditBase, input_type: "upload", file_name: "project.zip" },
      client,
    );
    expect(result.fileCount).toBe(2);
    expect(result.segments.map((s) => s.path)).toEqual([
      "alpha/main.py",
      "zeta/risk.py",
    ]);
    expect(result.code).toContain("# ── file: alpha/main.py ──");
  });

  it("reuses already-persisted normalized source (retry path)", async () => {
    let downloads = 0;
    const client: StrategyStorageClient = {
      storage: {
        from() {
          return {
            async upload() {
              return { data: null, error: null };
            },
            async download() {
              downloads++;
              return { data: null, error: { message: "should not download" } };
            },
            async remove() {
              return { data: [], error: null };
            },
            async list() {
              return { data: [], error: null };
            },
          };
        },
      },
    };
    const result = await ingestUploadedStrategy(
      { ...auditBase, input_type: "upload", file_name: "s.py", code: "x = 1" },
      client,
    );
    expect(result.code).toBe("x = 1");
    expect(downloads).toBe(0);
  });

  it("fails safely when the storage object is missing", async () => {
    const client = fakeStorage();
    await expectUserErrorAsync(
      () =>
        ingestUploadedStrategy(
          { ...auditBase, input_type: "upload", file_name: "s.py" },
          client,
        ),
      /could not be read/i,
    );
  });

  it("fails safely when stored content contradicts the extension", async () => {
    const zipBytes = zipSync({ "a.py": strToU8("x = 1") });
    const client = fakeStorage({ "u-1/a-2/fake.py": zipBytes });
    await expectUserErrorAsync(
      () =>
        ingestUploadedStrategy(
          { ...auditBase, input_type: "upload", file_name: "fake.py" },
          client,
        ),
      /do not match a Python/i,
    );
  });

  it("fails safely for malformed zip payloads", async () => {
    const garbage = new Uint8Array(32).map((_, i) => (i * 5 + 1) & 0xff);
    garbage[0] = 0x50; garbage[1] = 0x4b; garbage[2] = 0x03; garbage[3] = 0x04;
    const client = fakeStorage({ "u-1/a-2/broken.zip": garbage });
    await expect(
      ingestUploadedStrategy(
        { ...auditBase, input_type: "upload", file_name: "broken.zip" },
        client,
      ),
    ).rejects.toThrow(IngestionError);
  });

  it("rejects ingestion on non-upload audits (guards misuse)", async () => {
    const client = fakeStorage();
    await expectUserErrorAsync(
      () =>
        ingestUploadedStrategy(
          { ...auditBase, input_type: "paste", file_name: null },
          client,
        ),
      /no uploaded strategy file/i,
    );
  });

  it("reports the latin-1 fallback in the encoding note", async () => {
    const latin = new Uint8Array([0x78, 0x20, 0x3d, 0x20, 0xe9, 0x0a]);
    const client = fakeStorage({ "u-1/a-2/legacy.py": latin });
    const result = await ingestUploadedStrategy(
      { ...auditBase, input_type: "upload", file_name: "legacy.py" },
      client,
    );
    expect(result.encodingNote).toBe("decoded as latin-1");
  });
});
