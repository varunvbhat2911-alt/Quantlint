/* Strategy file ingestion — see individual modules. */

export * from "./types";
export {
  sanitizeFileName,
  extensionOf,
  validateUploadFile,
  validateContentMatches,
  isZipMagic,
  looksLikeText,
} from "./validation";
export { decodePythonSource } from "./python";
export { extractZipStrategy } from "./zip";
export {
  createStrategyStorageClient,
  strategyObjectPath,
  strategyPathForAudit,
  uploadStrategyFile,
  downloadStrategyFile,
  deleteStrategyFile,
  type StrategyStorageClient,
} from "./storage";
export { ingestUploadedStrategy, type IngestedStrategy } from "./service";
