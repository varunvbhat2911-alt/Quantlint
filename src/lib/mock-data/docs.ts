import type { DocSection } from "@/lib/types";

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "intro",
    title: "Introduction",
    slug: "introduction",
    description:
      "QuantLint is a quality assurance platform for quantitative trading strategies. It performs static AST analysis, deterministic risk calculations, and AI-powered explanations.",
  },
  {
    id: "cli",
    title: "CLI Reference",
    slug: "cli",
    description:
      "Install QuantLint via pip and run audits directly from your terminal.",
  },
  {
    id: "rules",
    title: "Rule Library",
    slug: "rules",
    description:
      "Browse 317+ deterministic validation rules covering look-ahead bias, data leakage, risk constraints, and more.",
  },
  {
    id: "api",
    title: "API Reference",
    slug: "api",
    description:
      "Integrate QuantLint into your CI/CD pipeline with the REST API.",
  },
];

export const CLI_EXAMPLES = [
  { command: "pip install quantlint", description: "Install the CLI" },
  { command: "quantlint audit strategy.py", description: "Run a full audit" },
  {
    command: "quantlint audit strategy.py --format json",
    description: "Export JSON report",
  },
  {
    command: "quantlint rules list --severity high",
    description: "List high-severity rules",
  },
];
