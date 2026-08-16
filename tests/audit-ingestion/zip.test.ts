import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractZipStrategy } from "@/lib/audit-ingestion/zip";
import { IngestionError } from "@/lib/audit-ingestion/types";

function expectUserError(fn: () => unknown, regex: RegExp) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(IngestionError);
    expect((err as IngestionError).userMessage).toMatch(regex);
    return;
  }
  expect.unreachable('expected an IngestionError');
}

const Z = (files: Record<string, Uint8Array | string>) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, typeof v === "string" ? strToU8(v) : v]),
    ),
  );

const MAIN = `import pandas as pd

def run(close):
    signal = close.pct_change().shift(-1)
    return signal
`;

const RISK = `LEVERAGE = 20.0

def size_position(equity):
    return equity * LEVERAGE
`;

describe("extractZipStrategy — multi-file handling", () => {
  it("assembles multi-file projects with deterministic headers and segments", () => {
    const result = extractZipStrategy(Z({ "alpha/main.py": MAIN, "zeta/risk.py": RISK }));
    expect(result.fileCount).toBe(2);

    const lines = result.code.split("\n");
    // Ordered lexicographically: alpha/main.py first.
    expect(lines[0]).toBe("# ── file: alpha/main.py ──");
    // Content starts on the next line.
    expect(lines[1]).toBe("import pandas as pd");

    const first = result.segments[0];
    expect(first.path).toBe("alpha/main.py");
    expect(first.startLine).toBe(2);
    expect(first.lineCount).toBe(MAIN.split("\n").length);

    // A finding at the shift(-1) line (assembled line 5) maps to original
    // line 4 of alpha/main.py.
    const assembledShiftLine = lines.findIndex((l) => l.includes("shift(-1)")) + 1;
    expect(assembledShiftLine - first.startLine + 1).toBe(4);
  });

  it("is deterministic across repeated extractions", () => {
    const a = extractZipStrategy(Z({ "b.py": RISK, "a.py": MAIN }));
    const b = extractZipStrategy(Z({ "a.py": MAIN, "b.py": RISK }));
    expect(a.code).toBe(b.code);
    expect(a.segments).toEqual(b.segments);
  });

  it("returns single-file archives without headers (original line numbers)", () => {
    const result = extractZipStrategy(Z({ "solo.py": MAIN }));
    expect(result.fileCount).toBe(1);
    expect(result.segments).toEqual([]);
    expect(result.code).toBe(MAIN);
  });

  it("ignores non-Python files but counts them", () => {
    const result = extractZipStrategy(
      Z({ "main.py": MAIN, "README.md": "docs", "data.csv": "a,b" }),
    );
    expect(result.fileCount).toBe(1);
    expect(result.skippedNonPython).toBe(2);
    expect(result.code).not.toContain("docs");
  });
});

describe("extractZipStrategy — path safety (Zip Slip / traversal)", () => {
  it("rejects ../ traversal entries", () => {
    const zip = Z({ "../evil.py": "x = 1" });
    expect(() => extractZipStrategy(zip)).toThrow(IngestionError);
    expectUserError(() => extractZipStrategy(zip), /path traversal/i);
  });

  it("rejects nested traversal segments", () => {
    const zip = Z({ "safe/../../evil.py": "x = 1" });
    expectUserError(() => extractZipStrategy(zip), /path traversal|absolute/i);
  });

  it("rejects absolute paths", () => {
    const zip = Z({ "/etc/evil.py": "x = 1" });
    expectUserError(() => extractZipStrategy(zip), /absolute/i);
  });

  it("rejects Windows drive-letter paths", () => {
    const zip = Z({ "C:\\evil.py": "x = 1" });
    expect(() => extractZipStrategy(zip)).toThrow(IngestionError);
  });

  it("rejects backslash traversal", () => {
    const zip = Z({ "..\\evil.py": "x = 1" });
    expect(() => extractZipStrategy(zip)).toThrow(IngestionError);
  });

  it("rejects control characters in entry names", () => {
    const zip = Z({ "ev\x00il.py": "x = 1" });
    expectUserError(() => extractZipStrategy(zip), /unsafe file name/i);
  });

  it("rejects excessive nesting depth", () => {
    const deep = Array(12).fill("d").join("/") + "/x.py";
    const zip = Z({ [deep]: "x = 1" });
    expectUserError(() => extractZipStrategy(zip), /nest/i);
  });
});

describe("extractZipStrategy — archive limits (zip bombs)", () => {
  it("rejects a single entry over 5 MB uncompressed", () => {
    // 6 MB of zeros compresses tiny — the filter sees originalSize before
    // inflation and must refuse.
    const bomb = Z({ "bomb.py": new Uint8Array(6 * 1024 * 1024) });
    expectUserError(() => extractZipStrategy(bomb), /larger than 5 MB/i);
  });

  it("rejects archives expanding past 20 MB total", () => {
    // 5 entries × 4.5 MB each: individually legal, 22.5 MB combined.
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 5; i++) {
      files[`part${i}.py`] = new Uint8Array(4.5 * 1024 * 1024);
    }
    const zip = Z(files);
    expectUserError(() => extractZipStrategy(zip), /20 MB total/i);
  });

  it("rejects more than 200 entries", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 201; i++) files[`f${i}.py`] = "x = 1";
    const zip = Z(files);
    expectUserError(() => extractZipStrategy(zip), /too many files/i);
  });

  it("accepts archives at the limits", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 200; i++) files[`f${i}.py`] = "x = 1";
    expect(() => extractZipStrategy(Z(files))).not.toThrow();
  });
});

describe("extractZipStrategy — failure shapes", () => {
  it("rejects an empty archive (no entries)", () => {
    // zipSync of {} produces an empty-archive zip (PK\x05\x06).
    const empty = new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => extractZipStrategy(empty)).toThrow(IngestionError);
  });

  it("rejects archives with no Python files", () => {
    const zip = Z({ "README.md": "docs", "img.png": new Uint8Array([1, 2, 3]) });
    expectUserError(() => extractZipStrategy(zip), /no Python/i);
  });

  it("rejects malformed archives", () => {
    const garbage = new Uint8Array(64).map((_, i) => (i * 7 + 13) & 0xff);
    // Ensure it doesn't accidentally look like a zip.
    garbage[0] = 0x50; garbage[1] = 0x4b; garbage[2] = 0x03; garbage[3] = 0x04;
    expectUserError(() => extractZipStrategy(garbage), /malformed/i);
  });

  it("rejects a Python entry that is actually binary", () => {
    const zip = Z({ "binary.py": new Uint8Array([0x00, 0x01, 0x02, 0x03]) });
    expect(() => extractZipStrategy(zip)).toThrow(IngestionError);
  });
});
