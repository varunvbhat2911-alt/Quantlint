/* Data-leakage rules: full-dataset fitting and time-series shuffling. */

import type { AuditRule } from "./types";
import { findMatches, snippetForLine } from "../parsers/python";

export const dataRules: AuditRule[] = [
  {
    ruleId: "QL-DATA-001",
    title: "Indicator fitted on the full dataset",
    category: "data",
    userCategory: "Data Leakage",
    severity: "warning",
    description:
      "A fit/transform step (e.g., scaler or normalization) is applied to the whole series before any train/test split, leaking test-set statistics into training.",
    whyItMatters:
      "Fitting on the full dataset lets future information influence the transformation, so out-of-sample results are no longer honest.",
    suggestedFix:
      "Fit transformations on the training segment only, then apply them to the test segment.",
    fixSnippet:
      "scaler.fit(train[['feature']])\ntest[['feature']] = scaler.transform(test[['feature']])",
    stage: "bias",
    run: (ctx) =>
      findMatches(
        ctx.code,
        /\.(fit_transform|fit)\s*\(/,
      )
        .filter((m) => {
          const before = ctx.code.split(/\r?\n/).slice(0, m.line).join("\n");
          return !/train_test_split|\.iloc\[.*train|split/i.test(before);
        })
        .map((m) => ({
          ruleId: "QL-DATA-001",
          line: m.line,
          detectedPattern: m.text.slice(0, 120),
          codeSnippet: snippetForLine(ctx.code, m.line),
        })),
  },
  {
    ruleId: "QL-DATA-002",
    title: "Time-series row shuffling",
    category: "data",
    userCategory: "Data Leakage",
    severity: "warning",
    description:
      "Rows of an ordered time series are shuffled (shuffle=True or df.sample(frac=...)), which destroys temporal ordering and lets future rows leak into training.",
    whyItMatters:
      "Shuffling time-ordered data breaks the causal structure; any validation performed this way leaks future information.",
    suggestedFix:
      "Keep temporal order: use walk-forward or chronological splits instead of shuffling.",
    fixSnippet: null,
    stage: "bias",
    run: (ctx) =>
      [
        ...findMatches(ctx.code, /shuffle\s*=\s*True/),
        ...findMatches(ctx.code, /\.sample\(\s*frac\s*=\s*1/),
      ].map((m) => ({
        ruleId: "QL-DATA-002",
        line: m.line,
        detectedPattern: m.text.slice(0, 120),
        codeSnippet: snippetForLine(ctx.code, m.line),
      })),
  },
];
