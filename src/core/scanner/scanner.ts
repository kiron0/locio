import fastGlob from "fast-glob";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { ProgressBar, ThrottledProgressBar } from "../../utils/progress.js";
import { isPathSafe } from "../../utils/security.js";
import {
  FILE_CONSTANTS,
  GLOB_CONSTANTS,
  PERFORMANCE_CONSTANTS,
} from "../constants.js";
import { LineCounterError, isError } from "../errors.js";
import { createFilterPatterns } from "../filter/index.js";
import type { Summary } from "../types.js";
import { createSummary } from "../types.js";
import { FileContentCache, FileStatsCache } from "./scanner-cache.js";
import { buildIgnoreInstance, clearGitignoreCache } from "./scanner-ignore.js";
import {
  processCommentRemovalForFiles,
  processFile,
  processFileWithErrorHandling,
  showProgressReport,
} from "./scanner-processing.js";
import {
  clearExtensionCache,
  createCommentStats,
  createFileDetail,
  normalizeExtension,
  processFileStatistics,
  updateSummaryWithFile,
} from "./scanner-utils.js";
import {
  filterFilesForProcessing,
  normalizeGlobEntries,
  validateFileForProcessing,
} from "./scanner-validation.js";

function hasVerboseFlag(args: Args): args is Args & { verbose?: boolean } {
  return true;
}

function getVerboseFlag(args: Args): boolean {
  return false;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function scanFile(
  args: Args,
): Promise<Summary | LineCounterError> {
  const startTime = Date.now();
  const summary = createSummary();

  const patterns = createFilterPatterns(args);
  if (isError(patterns)) {
    return patterns;
  }

  const filePath = path.resolve(args.directory);
  const baseDir = path.dirname(filePath);

  if (!isPathSafe(filePath, baseDir)) {
    return LineCounterError.io(
      "Path traversal detected: file path is not safe",
      undefined,
      filePath,
    );
  }

  try {
    const fileStats = fs.statSync(filePath);
    if (!fileStats.isFile()) {
      return LineCounterError.notADirectory(filePath);
    }

    if (fileStats.size > FILE_CONSTANTS.MAX_SAFE_FILE_SIZE) {
      return LineCounterError.io(
        `File too large: exceeds maximum safe size (${FILE_CONSTANTS.MAX_SAFE_FILE_SIZE / (1024 * 1024)}MB)`,
        undefined,
        filePath,
      );
    }
  } catch (e) {
    return LineCounterError.fileNotFound(filePath);
  }

  const statsCache = new FileStatsCache();
  const contentCache = new FileContentCache();

  statsCache.get(filePath);

  const { processed, errors } = await processFile(
    filePath,
    args,
    summary,
    patterns,
    baseDir,
    statsCache,
    contentCache,
  );

  showProgressReport(args, startTime, processed, errors);

  if (processed === 0 && summary.total_files === 0) {
    const revalidation = validateFileForProcessing(
      filePath,
      args,
      patterns,
      baseDir,
      statsCache,
      true,
    );

    if (!revalidation.shouldSkip) {
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          const ext = normalizeExtension(filePath);
          const size = stats.size;

          if (!args.files_only) {
            const statsResult = processFileStatistics(filePath, args);
            if (!statsResult.error) {
              const commentStats = createCommentStats(statsResult);
              updateSummaryWithFile(
                summary,
                ext,
                size,
                statsResult.lines,
                commentStats,
              );

              if (args.collect_details !== false) {
                summary.details.push(
                  createFileDetail(
                    filePath,
                    size,
                    ext,
                    statsResult.lines,
                    statsResult.commentLines,
                    statsResult.codeLines,
                    statsResult.fullLineComments,
                    statsResult.inlineComments,
                    statsResult.blankLines,
                  ),
                );
              }
            }
          } else {
            updateSummaryWithFile(summary, ext, size, null, null);
            if (args.collect_details !== false) {
              summary.details.push(
                createFileDetail(
                  filePath,
                  size,
                  ext,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                ),
              );
            }
          }
        }
      } catch (e) {}
    }
  }

  if (args.rm_comments) {
    return { ...summary, _commentsRemoved: processed };
  }

  return summary;
}

export async function scanDirectory(
  args: Args,
): Promise<Summary | LineCounterError> {
  const startTime = Date.now();
  const summary = createSummary();

  const patterns = createFilterPatterns(args);
  if (isError(patterns)) {
    return patterns;
  }

  const ig = buildIgnoreInstance(args.directory);
  const statsCache = new FileStatsCache();
  const contentCache = new FileContentCache();

  const globPattern = GLOB_CONSTANTS.DEFAULT_PATTERN;
  const options: {
    cwd: string;
    absolute: boolean;
    onlyFiles: boolean;
    ignore: string[];
    dot: boolean;
    followSymbolicLinks: boolean;
  } = {
    cwd: args.directory,
    absolute: true,
    onlyFiles: true,
    ignore: [],
    dot: !args.no_hidden,
    followSymbolicLinks: args.follow_links,
  };

  let processed = 0;
  let errors = 0;
  let progressBar: ProgressBar | null = null;
  let throttledProgressBar: ThrottledProgressBar | null = null;
  let filesChecked = 0;

  try {
    const entries = await fastGlob(globPattern, options);
    const files = normalizeGlobEntries(entries);

    if (args.show_progress && !args.quiet) {
      progressBar = new ProgressBar(files.length);

      throttledProgressBar = new ThrottledProgressBar(progressBar);
    }

    const filesToProcess = filterFilesForProcessing(
      files,
      args,
      patterns,
      args.directory,
      statsCache,
      ig,
    );

    const concurrency = Math.min(
      os.cpus().length,
      PERFORMANCE_CONSTANTS.MAX_CONCURRENT_FILE_OPERATIONS,
    );
    const batches = chunkArray(filesToProcess, concurrency);

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((filePath) =>
          processFileWithErrorHandling(
            filePath,
            args,
            summary,
            patterns,
            args.directory,
            statsCache,
            contentCache,
          ),
        ),
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const filePath = batch[i];
        filesChecked++;

        const relativePath = path.relative(args.directory, filePath);

        if (throttledProgressBar) {
          throttledProgressBar.update(filesChecked, errors, relativePath);
        } else if (progressBar) {
          if (
            filesChecked % PERFORMANCE_CONSTANTS.PROGRESS_UPDATE_INTERVAL ===
              0 ||
            filesChecked === filesToProcess.length
          ) {
            progressBar.update(filesChecked, errors, relativePath);
          }
        }

        if (result.status === "fulfilled") {
          const fileResult = result.value;
          processed += fileResult.processed;
          errors += fileResult.errors;
        } else {
          errors++;
          if (!args.quiet && getVerboseFlag(args)) {
            console.error(`Failed to process ${filePath}: ${result.reason}`);
          }
        }
      }
    }

    if (args.rm_comments) {
      const commentRemovalResult = processCommentRemovalForFiles(
        filesToProcess,
        args,
        patterns,
        args.directory,
      );
      processed += commentRemovalResult.processed;
      errors += commentRemovalResult.errors;
    }

    if (throttledProgressBar) {
      throttledProgressBar.finish();
    } else if (progressBar) {
      progressBar.finish();
    }

    statsCache.clear();
    contentCache.clear();
    clearExtensionCache();
    clearGitignoreCache();

    if (args.export && summary.details.length > 10000) {
    }
  } catch (e) {
    if (throttledProgressBar) {
      throttledProgressBar.finish();
    } else if (progressBar) {
      progressBar.finish();
    }
    return LineCounterError.io(
      `Failed to scan directory: ${e instanceof Error ? e.message : String(e)}`,
      e instanceof Error ? e : undefined,
      args.directory,
    );
  }

  showProgressReport(args, startTime, processed, errors);

  if (args.rm_comments) {
    return { ...summary, _commentsRemoved: processed };
  }

  return summary;
}
