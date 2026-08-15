import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/audit-engine/engine";
import type { EngineInput } from "@/lib/audit-engine/types";
import { ALL_RULES } from "@/lib/audit-engine/rules/registry";

const ALL_CATEGORIES = [
  "Look-ahead Bias",
  "Data Leakage",
  "Survivorship Bias",
  "Risk Management",
  "Position Sizing",
  "Performance Metrics",
  "Execution Logic",
  "Transaction Costs",
  "Portfolio Logic",
] as const;

function audit(code: string, categories: readonly string[] = ALL_CATEGORIES) {
  const input: EngineInput = {
    code,
    fileName: "strategy.py",
    declaredFramework: "auto",
    analysisDepth: "standard",
    ruleCategories: categories as EngineInput["ruleCategories"],
  };
  return runEngine(input);
}

function findingsFor(result: ReturnType<typeof audit>, ruleId: string) {
  return result.findings.filter((f) => f.ruleId === ruleId);
}

describe("QL-BIAS-001 look-ahead bias", () => {
  it("flags negative shift (positive case)", () => {
    const result = audit("import pandas as pd\nsignal = close.shift(-1) > mean\n");
    const hits = findingsFor(result, "QL-BIAS-001");
    expect(hits.length).toBe(1);
    expect(hits[0].line).toBe(2);
    expect(hits[0].severity).toBe("critical");
    expect(hits[0].codeSnippet).toContain("shift(-1)");
  });

  it("does not flag causal shift(1) (negative case)", () => {
    const result = audit("import pandas as pd\nsignal = close.shift(1) > mean\n");
    expect(findingsFor(result, "QL-BIAS-001")).toHaveLength(0);
  });

  it("flags future-indexed iloc access", () => {
    const result = audit("import pandas as pd\nfor i in range(n):\n    x = df.iloc[i + 1]\n");
    expect(findingsFor(result, "QL-BIAS-001").length).toBe(1);
  });
});

describe("QL-BIAS-002 centered window", () => {
  it("flags center=True rolling windows", () => {
    const result = audit("import pandas as pd\nm = close.rolling(window=20, center=True).mean()\n");
    const hits = findingsFor(result, "QL-BIAS-002");
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe("critical");
  });

  it("does not flag trailing windows", () => {
    const result = audit("import pandas as pd\nm = close.rolling(window=20).mean()\n");
    expect(findingsFor(result, "QL-BIAS-002")).toHaveLength(0);
  });
});

describe("QL-COST-001 / QL-COST-002 transaction costs", () => {
  it("flags a backtest constructed without any cost modeling", () => {
    const result = audit(
      "import vectorbt as vbt\nportfolio = vbt.Portfolio.from_signals(close=price, entries=e, exits=x)\n",
    );
    const hits = findingsFor(result, "QL-COST-001");
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe("critical");
  });

  it("does not flag when fees are configured", () => {
    const result = audit(
      "import vectorbt as vbt\nportfolio = vbt.Portfolio.from_signals(close=price, entries=e, exits=x, fees=0.001)\n",
    );
    expect(findingsFor(result, "QL-COST-001")).toHaveLength(0);
  });

  it("flags explicitly zero fees", () => {
    const result = audit(
      "import vectorbt as vbt\nportfolio = vbt.Portfolio.from_signals(close=price, fees=0)\n",
    );
    expect(findingsFor(result, "QL-COST-002")).toHaveLength(1);
  });
});

describe("QL-RISK rules", () => {
  it("QL-RISK-001 flags order placement without stop-loss logic", () => {
    const result = audit(
      "import backtrader as bt\nclass S(bt.Strategy):\n    def next(self):\n        if not self.position:\n            self.buy(size=10)\n",
    );
    expect(findingsFor(result, "QL-RISK-001")).toHaveLength(1);
  });

  it("QL-RISK-001 passes when stop handling exists", () => {
    const result = audit(
      "import backtrader as bt\nclass S(bt.Strategy):\n    def next(self):\n        self.buy(size=10)\n        self.sell(exectype=bt.Order.Stop, price=self.data.close[0] * 0.95)\n",
    );
    expect(findingsFor(result, "QL-RISK-001")).toHaveLength(0);
  });

  it("QL-RISK-004 flags near-full-cash position sizing", () => {
    const result = audit(
      "import backtrader as bt\nclass S(bt.Strategy):\n    def next(self):\n        size = int((self.broker.getcash() * 0.95) / self.data.close[0])\n        self.buy(size=size)\n",
    );
    expect(findingsFor(result, "QL-RISK-004")).toHaveLength(1);
  });
});

describe("QL-STRUCT-002 bare except", () => {
  it("flags bare except handlers", () => {
    const result = audit("try:\n    run()\nexcept:\n    pass\n");
    const hits = findingsFor(result, "QL-STRUCT-002");
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(3);
  });
});

describe("category selection contract", () => {
  it("runs no rules when no categories are selected", () => {
    const result = audit("import pandas as pd\nsignal = close.shift(-1) > mean\n", []);
    expect(result.ok).toBe(true);
    expect(result.stats.rulesExecuted).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("only runs rules from the selected categories", () => {
    const result = audit("import pandas as pd\nsignal = close.shift(-1) > mean\n", [
      "Risk Management",
    ]);
    expect(findingsFor(result, "QL-BIAS-001")).toHaveLength(0);
    expect(result.findings.every((f) => f.ruleId.startsWith("QL-RISK"))).toBe(true);
  });

  it("registry metadata is complete for every rule", () => {
    for (const rule of ALL_RULES) {
      expect(rule.ruleId).toMatch(/^QL-[A-Z]+-\d{3}$/);
      expect(rule.title.length).toBeGreaterThan(5);
      expect(rule.whyItMatters.length).toBeGreaterThan(20);
      expect(rule.suggestedFix.length).toBeGreaterThan(10);
      expect(ALL_CATEGORIES).toContain(rule.userCategory);
      expect(typeof rule.run).toBe("function");
    }
  });
});
