import { describe, it, expect } from "vitest";
import { decodePythonSource } from "@/lib/audit-ingestion/python";
import { IngestionError } from "@/lib/audit-ingestion/types";

const enc = (s: string) => new TextEncoder().encode(s);

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

describe("decodePythonSource", () => {
  it("decodes strict UTF-8", () => {
    const result = decodePythonSource(enc("x = 'héllo'\n"));
    expect(result.code).toBe("x = 'héllo'\n");
    expect(result.encoding).toBe("utf-8");
  });

  it("strips a UTF-8 BOM", () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc("x = 1")]);
    const result = decodePythonSource(bom);
    expect(result.code).toBe("x = 1");
    expect(result.encoding).toBe("utf-8");
  });

  it("falls back to latin-1 with a documented encoding note (no silent corruption)", () => {
    // 0xE9 is invalid standalone UTF-8 but a valid latin-1 é.
    const latin = new Uint8Array([0x78, 0x20, 0x3d, 0x20, 0xe9, 0x0a]);
    const result = decodePythonSource(latin);
    expect(result.encoding).toBe("latin-1");
    expect(result.code).toBe("x = é\n");
  });

  it("normalizes CRLF and CR line endings to LF", () => {
    const result = decodePythonSource(enc("a = 1\r\nb = 2\rc = 3\n"));
    expect(result.code).toBe("a = 1\nb = 2\nc = 3\n");
  });

  it("rejects empty input", () => {
    expect(() => decodePythonSource(new Uint8Array(0))).toThrow(IngestionError);
  });

  it("rejects whitespace-only input", () => {
    expectUserError(
      () => decodePythonSource(enc("  \n\n\t \n")),
      /contains no code/i,
    );
  });

  it("rejects binary content", () => {
    const binary = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
    expect(() => decodePythonSource(binary, "blob.py")).toThrow(
      IngestionError,
    );
  });

  it("includes the file label in user-safe errors", () => {
    try {
      decodePythonSource(new Uint8Array(0), "alpha/signals.py");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(IngestionError);
      expect((err as IngestionError).userMessage).toContain("alpha/signals.py");
    }
  });

  it("never executes or imports the source — output equals input text", () => {
    const dangerous = "import os\nos.system('echo pwned')\nx = __import__('sys')\n";
    const result = decodePythonSource(enc(dangerous));
    expect(result.code).toBe(dangerous);
  });
});
