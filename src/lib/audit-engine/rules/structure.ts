/* Structure rules: silent exception handling, debug leftovers. */

import type { AuditRule } from "./types";
import { snippetForLine } from "../parsers/python";

export const structureRules: AuditRule[] = [
  {
    ruleId: "QL-STRUCT-002",
    title: "Bare or silenced exception handler",
    category: "structure",
    userCategory: "Execution Logic",
    severity: "info",
    description:
      "An `except:` (or `except Exception: pass`) block swallows errors silently, hiding data or execution problems during a backtest.",
    whyItMatters:
      "Silenced exceptions can mask partial data loads, failed orders, or calculation errors, quietly corrupting results.",
    suggestedFix:
      "Catch specific exception types and at minimum log the failure; never leave a bare except.",
    fixSnippet: "except ValueError as e:\n    logger.warning('calc failed: %s', e)",
    stage: "structure",
    run: (ctx) =>
      ctx.source.bareExceptLines.map((line) => ({
        ruleId: "QL-STRUCT-002",
        line,
        detectedPattern: "except:",
        codeSnippet: snippetForLine(ctx.code, line),
      })),
  },
  {
    ruleId: "QL-STRUCT-003",
    title: "Debugger or breakpoint left in source",
    category: "structure",
    userCategory: "Execution Logic",
    severity: "info",
    description:
      "A debugging statement (breakpoint()/pdb.set_trace()) is present in the submitted strategy.",
    whyItMatters:
      "Leftover debug statements halt or alter execution and indicate the code is not in a finished state.",
    suggestedFix: "Remove debugger statements before running or sharing the strategy.",
    fixSnippet: null,
    stage: "structure",
    run: (ctx) => {
      const hits: { ruleId: string; line: number; detectedPattern: string; codeSnippet: string | null }[] = [];
      const lines = ctx.code.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (/\bbreakpoint\s*\(|pdb\.set_trace\s*\(/.test(line)) {
          hits.push({
            ruleId: "QL-STRUCT-003",
            line: idx + 1,
            detectedPattern: line.trim().slice(0, 120),
            codeSnippet: snippetForLine(ctx.code, idx + 1),
          });
        }
      });
      return hits;
    },
  },
];
