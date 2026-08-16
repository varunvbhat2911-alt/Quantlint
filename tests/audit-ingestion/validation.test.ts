import { describe, it, expect } from "vitest";
import {
  sanitizeFileName,
  extensionOf,
  validateUploadFile,
  validateContentMatches,
  isZipMagic,
  looksLikeText,
} from "@/lib/audit-ingestion/validation";
import { IngestionError } from "@/lib/audit-ingestion/types";

const enc = (s: string) => new TextEncoder().encode(s);

/* IngestionError carries the user-safe text in userMessage; err.message is
 * internal logging detail. Assert the user-facing contract. */
function expectUserError(fn: () => unknown, regex: RegExp) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(IngestionError);
    expect((err as IngestionError).userMessage).toMatch(regex);
    return;
  }
  expect.unreachable("expected an IngestionError");
}

describe("sanitizeFileName", () => {
  it("strips directory components (forward slash)", () => {
    expect(sanitizeFileName("../../etc/passwd.py")).toBe("passwd.py");
  });
  it("strips directory components (backslash)", () => {
    expect(sanitizeFileName("C:\\Users\\evil\\strategy.py")).toBe("strategy.py");
  });
  it("removes control characters", () => {
    expect(sanitizeFileName("stra\x00te\x07gy.py")).toBe("strategy.py");
  });
  it("collapses whitespace and trims", () => {
    expect(sanitizeFileName("  my   strategy .py ")).toBe("my strategy .py");
  });
  it("returns a fallback for empty names", () => {
    expect(sanitizeFileName("")).toBe("strategy");
    expect(sanitizeFileName("///")).toBe("strategy");
  });
  it("caps length while preserving the extension", () => {
    const long = "a".repeat(250) + ".py";
    const sanitized = sanitizeFileName(long);
    expect(sanitized.length).toBeLessThanOrEqual(200);
    expect(sanitized.endsWith(".py")).toBe(true);
  });
  it("is deterministic (same input, same output)", () => {
    expect(sanitizeFileName("./x/../My Strategy.PY")).toBe(
      sanitizeFileName("./x/../My Strategy.PY"),
    );
  });
});

describe("extensionOf", () => {
  it("extracts lowercase extensions", () => {
    expect(extensionOf("Strategy.PY")).toBe(".py");
    expect(extensionOf("archive.Zip")).toBe(".zip");
  });
  it("returns empty for no extension", () => {
    expect(extensionOf("strategy")).toBe("");
  });
});

describe("validateUploadFile", () => {
  it("accepts a .py file", () => {
    const v = validateUploadFile({ name: "strategy.py", size: 100 });
    expect(v.safeName).toBe("strategy.py");
    expect(v.ext).toBe(".py");
  });
  it("accepts a .zip file", () => {
    const v = validateUploadFile({ name: "project.zip", size: 100 });
    expect(v.ext).toBe(".zip");
  });
  it("rejects unsupported extensions", () => {
    expect(() => validateUploadFile({ name: "a.exe", size: 10 })).toThrow(
      IngestionError,
    );
    expectUserError(
      () => validateUploadFile({ name: "a", size: 10 }),
      /Only \.py and \.zip/,
    );
  });
  it("rejects extension spoofing through directories", () => {
    expect(() =>
      validateUploadFile({ name: "../evil.sh", size: 10 }),
    ).toThrow(IngestionError);
  });
  it("rejects empty files", () => {
    expect(() => validateUploadFile({ name: "a.py", size: 0 })).toThrow(
      /empty/i,
    );
  });
  it("rejects files over 10 MB", () => {
    expect(() =>
      validateUploadFile({ name: "a.py", size: 10 * 1024 * 1024 + 1 }),
    ).toThrow(/10 MB/);
  });
  it("accepts 10 MB exactly", () => {
    expect(() =>
      validateUploadFile({ name: "a.py", size: 10 * 1024 * 1024 }),
    ).not.toThrow();
  });
  it("rejects mismatched MIME types", () => {
    expectUserError(
      () => validateUploadFile({ name: "a.py", size: 5, mimeType: "image/png" }),
      /do not match a supported/i,
    );
  });
  it("accepts common benign MIME values", () => {
    for (const mime of ["", "text/x-python", "application/octet-stream"]) {
      expect(() =>
        validateUploadFile({ name: "a.py", size: 5, mimeType: mime }),
      ).not.toThrow();
    }
    for (const mime of ["", "application/zip", "application/x-zip-compressed"]) {
      expect(() =>
        validateUploadFile({ name: "a.zip", size: 5, mimeType: mime }),
      ).not.toThrow();
    }
  });
});

describe("isZipMagic", () => {
  it("detects local file header magic", () => {
    expect(isZipMagic(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(
      true,
    );
  });
  it("detects empty-archive magic", () => {
    expect(isZipMagic(new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0x00]))).toBe(
      true,
    );
  });
  it("rejects text content", () => {
    expect(isZipMagic(enc("import pandas"))).toBe(false);
  });
  it("rejects short inputs", () => {
    expect(isZipMagic(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
});

describe("looksLikeText", () => {
  it("accepts Python source bytes", () => {
    expect(looksLikeText(enc("import pandas as pd\nx = 1\n"))).toBe(true);
  });
  it("rejects content containing NUL bytes", () => {
    expect(looksLikeText(new Uint8Array([0x61, 0x00, 0x62]))).toBe(false);
  });
  it("rejects binary-heavy content", () => {
    const binary = new Uint8Array(1024).map((_, i) => (i % 3 === 0 ? 0x01 : 0xff));
    expect(looksLikeText(binary)).toBe(false);
  });
});

describe("validateContentMatches", () => {
  it("accepts text bytes for .py", () => {
    expect(() => validateContentMatches(".py", enc("x = 1"))).not.toThrow();
  });
  it("rejects zip bytes labeled .py", () => {
    expectUserError(
      () => validateContentMatches(".py", new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
      /do not match a Python/i,
    );
  });
  it("rejects binary bytes labeled .py", () => {
    expectUserError(
      () => validateContentMatches(".py", new Uint8Array([0x00, 0x01, 0x02, 0x03])),
      /readable Python/i,
    );
  });
  it("rejects non-zip bytes labeled .zip", () => {
    expectUserError(
      () => validateContentMatches(".zip", enc("not a zip")),
      /not a valid ZIP/i,
    );
  });
});
