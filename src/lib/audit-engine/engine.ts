/* Public engine API: validates input and runs the deterministic pipeline.
 * Pure and server-safe; persistence lives in execution.ts. */

import type { EngineInput, EngineResult } from "./types";
import { runPipeline, type AIDeps, type PipelineHooks } from "./pipeline";

export { AUDIT_STAGES, STAGE_META, RULES_VERSION } from "./types";
export { FatalAuditError } from "./pipeline";
export type { AIDeps, PipelineHooks } from "./pipeline";

export async function runEngine(
  input: EngineInput,
  hooks?: PipelineHooks,
  aiDeps?: AIDeps | null,
): Promise<EngineResult> {
  if (typeof input.code !== "string") {
    throw new TypeError("EngineInput.code must be a string.");
  }
  if (input.code.length > 10 * 1024 * 1024) {
    throw new RangeError("Strategy source exceeds the 10 MB limit.");
  }
  return runPipeline(input, hooks, aiDeps);
}
