import * as fs from "fs";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { countLines, countLinesWithBlank } from "../../utils/files.js";
import { countLinesWithComments } from "../../utils/formatting/index.js";
import { LineCounterError, isError } from "../errors.js";
import { DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS } from "../filter/index.js";
import type { Summary } from "../types.js";

export function normalizeExtension(filePath: string): string {
  return path.extname(filePath).replace(/^\./, "").toLowerCase() || "no-ext";
}

export function createCommentStats(statsResult: {
  lines: number | null;
  commentLines: number | null;
  codeLines: number | null;
  fullLineComments: number | null;
  inlineComments: number | null;
  blankLines: number | null;
}): {
  totalLines: number;
  commentLines: number;
  codeLines: number;
  fullLineComments: number;
  inlineComments: number;
  blankLines: number;
} | null {
  const hasCommentData = statsResult.commentLines !== null;
  const hasBreakdownData =
    statsResult.codeLines !== null && statsResult.blankLines !== null;

  if (hasCommentData || hasBreakdownData) {
    return {
      totalLines: statsResult.lines || 0,
      commentLines: statsResult.commentLines || 0,
      codeLines: statsResult.codeLines || 0,
      fullLineComments: statsResult.fullLineComments || 0,
      inlineComments: statsResult.inlineComments || 0,
      blankLines: statsResult.blankLines || 0,
    };
  }

  return null;
}

export function updateSummaryWithFile(
  summary: Summary,
  ext: string,
  size: number,
  lines: number | null,
  commentStats: {
    totalLines: number;
    commentLines: number;
    codeLines: number;
    fullLineComments: number;
    inlineComments: number;
    blankLines: number;
  } | null,
): void {
  summary.total_files += 1;
  summary.total_size += size;

  summary.files_by_extension[ext] = (summary.files_by_extension[ext] || 0) + 1;
  summary.size_by_extension[ext] = (summary.size_by_extension[ext] || 0) + size;

  if (lines !== null) {
    summary.total_lines += lines;
    summary.lines_by_extension[ext] =
      (summary.lines_by_extension[ext] || 0) + lines;
  }

  if (commentStats) {
    const expectedTotal =
      commentStats.codeLines +
      commentStats.commentLines +
      commentStats.blankLines;
    if (commentStats.totalLines !== expectedTotal) {
      commentStats.totalLines = expectedTotal;
    }

    summary.total_comment_lines =
      (summary.total_comment_lines || 0) + commentStats.commentLines;
    summary.total_code_lines =
      (summary.total_code_lines || 0) + commentStats.codeLines;
    summary.total_blank_lines =
      (summary.total_blank_lines || 0) + commentStats.blankLines;
    summary.total_full_line_comments =
      (summary.total_full_line_comments || 0) + commentStats.fullLineComments;
    summary.total_inline_comments =
      (summary.total_inline_comments || 0) + commentStats.inlineComments;

    summary.comment_lines_by_extension![ext] =
      (summary.comment_lines_by_extension![ext] || 0) +
      commentStats.commentLines;
    summary.code_lines_by_extension![ext] =
      (summary.code_lines_by_extension![ext] || 0) + commentStats.codeLines;
    if (!summary.blank_lines_by_extension) {
      summary.blank_lines_by_extension = {};
    }
    summary.blank_lines_by_extension[ext] =
      (summary.blank_lines_by_extension[ext] || 0) + commentStats.blankLines;
    summary.full_line_comments_by_extension![ext] =
      (summary.full_line_comments_by_extension![ext] || 0) +
      commentStats.fullLineComments;
    summary.inline_comments_by_extension![ext] =
      (summary.inline_comments_by_extension![ext] || 0) +
      commentStats.inlineComments;
  }
}

export function processFileStatistics(
  filePath: string,
  args: Args,
): {
  lines: number | null;
  commentLines: number | null;
  codeLines: number | null;
  fullLineComments: number | null;
  inlineComments: number | null;
  blankLines: number | null;
  error: LineCounterError | null;
} {
  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  const ignoredExts = DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS.map((e) =>
    e.toLowerCase(),
  );
  const shouldSkipComments = ignoredExts.includes(ext);

  if (args.comments) {
    if (!shouldSkipComments) {
      const commentStats = countLinesWithComments(filePath);
      if (commentStats) {
        return {
          lines: commentStats.totalLines,
          commentLines: commentStats.commentLines,
          codeLines: commentStats.codeLines,
          fullLineComments: commentStats.fullLineComments,
          inlineComments: commentStats.inlineComments,
          blankLines: commentStats.blankLines,
          error: null,
        };
      }
    }

    const lineCount = countLinesWithBlank(filePath);
    if (isError(lineCount)) {
      return {
        lines: null,
        commentLines: null,
        codeLines: null,
        fullLineComments: null,
        inlineComments: null,
        blankLines: null,
        error: lineCount,
      };
    }

    return {
      lines: lineCount.total,
      commentLines: 0,
      codeLines: lineCount.code,
      fullLineComments: 0,
      inlineComments: 0,
      blankLines: lineCount.blank,
      error: null,
    };
  }

  const lineCount = countLines(filePath);
  if (isError(lineCount)) {
    return {
      lines: null,
      commentLines: null,
      codeLines: null,
      fullLineComments: null,
      inlineComments: null,
      blankLines: null,
      error: lineCount,
    };
  }

  return {
    lines: lineCount,
    commentLines: null,
    codeLines: null,
    fullLineComments: null,
    inlineComments: null,
    blankLines: null,
    error: null,
  };
}

export function createFileDetail(
  filePath: string,
  size: number,
  ext: string,
  lines: number | null,
  commentLines: number | null,
  codeLines: number | null,
  fullLineComments: number | null,
  inlineComments: number | null,
  blankLines: number | null,
): {
  directory: string;
  name: string;
  extension: string;
  size: number;
  lines: number | null;
  comment_lines?: number | null;
  code_lines?: number | null;
  blank_lines?: number | null;
  full_line_comments?: number | null;
  inline_comments?: number | null;
} {
  return {
    directory: path.dirname(filePath),
    name: path.basename(filePath),
    extension: ext,
    size,
    lines,
    comment_lines: commentLines,
    code_lines: codeLines,
    blank_lines: blankLines,
    full_line_comments: fullLineComments,
    inline_comments: inlineComments,
  };
}

export function getFileMetadata(
  filePath: string,
): { metadata: fs.Stats; error: null } | { metadata: null; error: Error } {
  try {
    const metadata = fs.statSync(filePath);
    return { metadata, error: null };
  } catch (e) {
    return {
      metadata: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export function checkMaxDepth(
  filePath: string,
  baseDir: string,
  maxDepth: number,
): boolean {
  const relativePath = path.relative(baseDir, filePath);
  const depth = relativePath.split(path.sep).length - 1;
  return depth > maxDepth;
}
