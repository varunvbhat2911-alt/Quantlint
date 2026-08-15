/* Deterministic framework detection from imports and idiomatic patterns. */

import type { FrameworkId } from "../types";
import { findMatches, hasImport, type PythonStructure } from "./python";

export function detectFramework(
  code: string,
  source: PythonStructure,
): FrameworkId {
  if (hasImport(source, "vectorbt") || /\bvbt\./.test(code)) return "vectorbt";
  if (hasImport(source, "backtrader") || /\bbt\.(Cerebro|Strategy|indicators)\b/.test(code))
    return "backtrader";
  if (hasImport(source, "zipline") || /\brun_algorithm\b/.test(code)) return "zipline";
  if (hasImport(source, "pandas") || /\bpd\.|\.rolling\(|\.shift\(/.test(code)) return "pandas";

  // Weak signals via usage patterns even without the import visible
  if (findMatches(code, /Portfolio\.from_signals|YFData\.download/).length > 0)
    return "vectorbt";
  if (findMatches(code, /cerebro\.|bt\.feeds\./).length > 0) return "backtrader";

  return "unknown";
}
