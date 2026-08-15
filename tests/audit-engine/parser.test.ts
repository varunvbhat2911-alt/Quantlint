import { describe, expect, it } from "vitest";
import { parsePythonSource } from "@/lib/audit-engine/parsers/python";

const VALID_STRATEGY = `import numpy as np
import pandas as pd
import vectorbt as vbt


def mean_reversion(close: pd.Series, window: int = 20):
    """Demo strategy."""
    rolling_mean = close.rolling(window=window).mean()
    z = (close - rolling_mean) / close.rolling(window=window).std()
    entries = z < -2
    exits = z > 2
    return entries, exits


class Runner:
    def __init__(self):
        self.cash = 100_000

    def run(self):
        price = vbt.YFData.download("SPY", start="2020-01-01", end="2023-12-31").get("Close")
        entries, exits = mean_reversion(price)
        return vbt.Portfolio.from_signals(close=price, entries=entries, exits=exits, init_cash=self.cash)


if __name__ == "__main__":
    print(Runner().run().stats())
`;

describe("parsePythonSource", () => {
  it("accepts valid Python without syntax issues", () => {
    const parsed = parsePythonSource(VALID_STRATEGY);
    expect(parsed.issues).toEqual([]);
  });

  it("detects an unclosed bracket with its line", () => {
    const parsed = parsePythonSource("def broken(:\n    x = (1 + 2\n    return x\n");
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(parsed.issues.some((i) => i.message.includes("Unclosed") || i.message.includes("Unbalanced"))).toBe(true);
  });

  it("detects a missing block colon", () => {
    const parsed = parsePythonSource("def broken()\n    return 1\n");
    expect(parsed.issues.some((i) => i.message.includes("trailing ':'"))).toBe(true);
  });

  it("extracts imports, functions, and classes with line numbers", () => {
    const parsed = parsePythonSource(VALID_STRATEGY);
    expect(parsed.imports.map((i) => i.module)).toEqual(
      expect.arrayContaining(["numpy", "pandas", "vectorbt"]),
    );
    const fn = parsed.functions.find((f) => f.name === "mean_reversion");
    expect(fn?.line).toBe(6);
    const cls = parsed.classes.find((c) => c.name === "Runner");
    expect(cls?.line).toBe(15);
    expect(cls?.methodCount).toBeGreaterThanOrEqual(2);
  });

  it("counts code, comment, and blank lines", () => {
    const parsed = parsePythonSource("# comment\n\nx = 1\n");
    expect(parsed.commentLineCount).toBe(1);
    expect(parsed.blankLineCount).toBe(1);
    expect(parsed.codeLineCount).toBeGreaterThanOrEqual(1);
  });

  it("does not treat comment markers inside strings as comments", () => {
    const parsed = parsePythonSource('url = "http://x/#not-a-comment"\n');
    expect(parsed.issues).toEqual([]);
  });
});
