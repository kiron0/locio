import * as path from "path";
import type { Args } from "../../cli/args.js";
import { parseCommaSeparated } from "../../cli/utils.js";
import { removeCommentsFromFile } from "../../utils/formatting/index.js";
import { ErrorCode, LineCounterError } from "../errors.js";
import type { FilterPatterns } from "../filter/index.js";
import { DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS } from "../filter/index.js";
import type { Summary } from "../types.js";
import type { FileContentCache, FileStatsCache } from "./scanner-cache.js";
import {
  createCommentStats,
  createFileDetail,
  normalizeExtension,
  processFileStatistics,
  processFileStatisticsWithContent,
  updateSummaryWithFile,
} from "./scanner-utils.js";
import { validateFileForProcessing } from "./scanner-validation.js";

function hasVerboseFlag(args: Args): args is Args & { verbose?: boolean } {
  return true;
}

function getVerboseFlag(args: Args): boolean {
  return false;
}

export function processCommentRemovalForFiles(
  files: string[],
  args: Args,
  baseDir: string,
): { processed: number; errors: number } {
  let processed = 0;
  let errors = 0;

  for (const filePath of files) {
    const ext = normalizeExtension(filePath);
    const fileExt = ext.toLowerCase().replace(/^\./, "");

    const ignoredExts = DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS.map((e) =>
      e.toLowerCase(),
    );
    if (ignoredExts.includes(fileExt)) {
      continue;
    }

    const shouldProcess = (() => {
      if (args.rm_comments === true) return true;
      if (typeof args.rm_comments === "string") {
        const allowedExts = parseCommaSeparated(args.rm_comments).map((e) =>
          e.toLowerCase().replace(/^\./, ""),
        );
        return (
          allowedExts.includes(fileExt) || allowedExts.includes(`.${fileExt}`)
        );
      }
      return false;
    })();

    if (shouldProcess) {
      const result = removeCommentsFromFile(filePath);
      if (result.success) {
        if (result.commentsFound) {
          if (!args.quiet) {
            const relativePath = path.relative(baseDir, filePath);
            console.log(`✓ Removed comments from ${relativePath}`);
          }
          processed += 1;
        }
      } else {
        if (!args.quiet) {
          const relativePath = path.relative(baseDir, filePath);
          console.error(`✗ Failed to remove comments from ${relativePath}`);
        }
        errors += 1;
      }
    }
  }

  return { processed, errors };
}

export async function processFileWithErrorHandling(
  filePath: string,
  args: Args,
  summary: Summary,
  patterns: FilterPatterns,
  baseDir: string,
  statsCache: FileStatsCache,
  contentCache: FileContentCache,
): Promise<{ processed: number; errors: number }> {
  try {
    return await processFile(
      filePath,
      args,
      summary,
      patterns,
      baseDir,
      statsCache,
      contentCache,
    );
  } catch (error) {
    if (error instanceof Error) {
      const processingError =
        error instanceof LineCounterError
          ? error
          : LineCounterError.fileProcessingError(
              filePath,
              error.message,
              error,
            );

      if (getVerboseFlag(args) && !args.quiet) {
        console.warn(`⚠️  Error processing ${filePath}: ${error.message}`);
      }
    }
    return { processed: 0, errors: 1 };
  }
}

export async function processFile(
  filePath: string,
  args: Args,
  summary: Summary,
  patterns: FilterPatterns,
  baseDir: string,
  statsCache: FileStatsCache,
  contentCache: FileContentCache,
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  const validation = validateFileForProcessing(
    filePath,
    args,
    patterns,
    baseDir,
    statsCache,
    true,
  );

  if (validation.shouldSkip) {
    return { processed, errors };
  }

  const { stats, size, ext } = validation;
  if (!stats || size === undefined || ext === undefined) {
    return { processed, errors };
  }

  if (args.rm_comments) {
    const fileExt = ext.toLowerCase().replace(/^\./, "");

    const ignoredExts = DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS.map((e) =>
      e.toLowerCase(),
    );
    if (ignoredExts.includes(fileExt)) {
      return { processed, errors };
    }

    const shouldProcess = (() => {
      if (args.rm_comments === true) return true;
      if (typeof args.rm_comments === "string") {
        const allowedExts = parseCommaSeparated(args.rm_comments).map((e) =>
          e.toLowerCase().replace(/^\./, ""),
        );
        return (
          allowedExts.includes(fileExt) || allowedExts.includes(`.${fileExt}`)
        );
      }
      return false;
    })();

    if (shouldProcess) {
      const result = removeCommentsFromFile(filePath);
      if (result.success) {
        if (result.commentsFound) {
          if (!args.quiet) {
            const relativePath = path.relative(baseDir, filePath);
            console.log(`✓ Removed comments from ${relativePath}`);
          }
          processed += 1;
        }
      } else {
        if (!args.quiet) {
          const relativePath = path.relative(baseDir, filePath);
          console.error(`✗ Failed to remove comments from ${relativePath}`);
        }
        errors += 1;
      }
    }
    return { processed, errors };
  }

  processed += 1;

  let linesOpt: number | null = null;
  let commentLinesOpt: number | null = null;
  let codeLinesOpt: number | null = null;
  let fullLineCommentsOpt: number | null = null;
  let inlineCommentsOpt: number | null = null;
  let blankLinesOpt: number | null = null;
  let commentStats: {
    totalLines: number;
    commentLines: number;
    codeLines: number;
    fullLineComments: number;
    inlineComments: number;
    blankLines: number;
  } | null = null;

  if (!args.files_only) {
    const fileData = await contentCache.get(filePath);
    let statsResult;

    if (fileData) {
      statsResult = await processFileStatisticsWithContent(
        filePath,
        args,
        fileData.content,
      );
    } else {
      statsResult = processFileStatistics(filePath, args);
    }

    if (statsResult.error) {
      if (
        statsResult.error.code === ErrorCode.COMMENT_PARSING_ERROR &&
        statsResult.lines !== null
      ) {
        if (!args.quiet && getVerboseFlag(args)) {
          console.warn(
            `⚠️  Comment parsing failed for ${path.relative(baseDir, filePath)}, using basic line count`,
          );
        }

        linesOpt = statsResult.lines;
        commentLinesOpt = null;
        codeLinesOpt = null;
        fullLineCommentsOpt = null;
        inlineCommentsOpt = null;
        blankLinesOpt = null;
        commentStats = null;
      } else {
        if (!args.quiet) {
          console.error(
            `Warning: Could not count lines in ${filePath}: ${statsResult.error.message}`,
          );
        }
        errors += 1;
        return { processed, errors };
      }
    } else {
      linesOpt = statsResult.lines;
      commentLinesOpt = statsResult.commentLines;
      codeLinesOpt = statsResult.codeLines;
      fullLineCommentsOpt = statsResult.fullLineComments;
      inlineCommentsOpt = statsResult.inlineComments;
      blankLinesOpt = statsResult.blankLines;

      commentStats = createCommentStats(statsResult);
    }
  }

  updateSummaryWithFile(summary, ext, size, linesOpt, commentStats);

  const shouldCollectDetails =
    args.collect_details !== false &&
    (!args.max_details || summary.details.length < args.max_details);

  if (shouldCollectDetails) {
    summary.details.push(
      createFileDetail(
        filePath,
        size,
        ext,
        linesOpt,
        commentLinesOpt,
        codeLinesOpt,
        fullLineCommentsOpt,
        inlineCommentsOpt,
        blankLinesOpt,
      ),
    );
  }

  return { processed, errors };
}

export function showProgressReport(
  args: Args,
  startTime: number,
  processed: number,
  errors: number,
): void {
  if (args.show_progress && !args.quiet) {
    const elapsed = Date.now() - startTime;
    const elapsedStr = `${elapsed}ms`;
    process.stderr.write(
      `\rProcessed: ${processed} files (${errors} errors) in ${elapsedStr}\n`,
    );
  }
}
