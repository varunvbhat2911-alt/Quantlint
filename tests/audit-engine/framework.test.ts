import { describe, expect, it } from "vitest";
import { detectFramework } from "@/lib/audit-engine/parsers/framework";
import { parsePythonSource } from "@/lib/audit-engine/parsers/python";

function detect(code: string) {
  return detectFramework(code, parsePythonSource(code));
}

describe("detectFramework", () => {
  it("detects vectorbt from imports", () => {
    expect(detect("import vectorbt as vbt\nportfolio = vbt.Portfolio.from_signals()\n")).toBe("vectorbt");
  });

  it("detects backtrader from imports", () => {
    expect(detect("import backtrader as bt\nclass S(bt.Strategy):\n    pass\n")).toBe("backtrader");
  });

  it("detects zipline from run_algorithm", () => {
    expect(detect("from zipline.api import symbol\nresult = run_algorithm()\n")).toBe("zipline");
  });

  it("falls back to pandas for plain pandas code", () => {
    expect(detect("import pandas as pd\ndf = pd.DataFrame()\n")).toBe("pandas");
  });

  it("returns unknown for unrelated code", () => {
    expect(detect("x = 1\n")).toBe("unknown");
  });
});
