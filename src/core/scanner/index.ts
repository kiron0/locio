export {
  checkMaxDepth,
  clearExtensionCache,
  createCommentStats,
  createFileDetail,
  getFileMetadata,
  normalizeExtension,
  processFileStatistics,
  processFileStatisticsWithContent,
  updateSummaryWithFile,
} from "./scanner-utils.js";
export { findDuplicates } from "./duplicates.js";
export { mergeSummaries } from "./merge.js";
export { scanDirectory, scanFile } from "./scanner.js";
