import * as fs from "fs";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import {
  countLines,
  countLinesFromContent,
  countLinesWithBlank,
  countLinesWithBlankFromContent,
} from "../../utils/files.js";
import { countLinesWithComments } from "../../utils/formatting/index.js";
import { LineCounterError, isError } from "../errors.js";
import { DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS } from "../filter/index.js";
import type { Summary } from "../types.js";

const COMMON_EXTENSIONS = new Map<string, string>([
  [".ts", "ts"],
  [".js", "js"],
  [".tsx", "tsx"],
  [".jsx", "jsx"],
  [".json", "json"],
  [".md", "md"],
  [".css", "css"],
  [".html", "html"],
  [".xml", "xml"],
  [".yaml", "yaml"],
  [".yml", "yml"],
  [".py", "py"],
  [".java", "java"],
  [".cpp", "cpp"],
  [".c", "c"],
  [".h", "h"],
  [".hpp", "hpp"],
  [".cs", "cs"],
  [".php", "php"],
  [".rb", "rb"],
  [".go", "go"],
  [".rs", "rs"],
  [".swift", "swift"],
  [".kt", "kt"],
  [".scala", "scala"],
  [".sh", "sh"],
  [".bash", "bash"],
  [".zsh", "zsh"],
  [".fish", "fish"],
  [".ps1", "ps1"],
  [".bat", "bat"],
  [".cmd", "cmd"],
]);

class ExtensionCache {
  private cache = new Map<string, string>();

  normalize(filePath: string): string {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    const extWithDot = path.extname(filePath).toLowerCase();
    const cached = COMMON_EXTENSIONS.get(extWithDot);
    if (cached) {
      this.cache.set(filePath, cached);
      return cached;
    }

    const ext = extWithDot.replace(/^\./, "") || "no-ext";
    this.cache.set(filePath, ext);
    return ext;
  }

  normalizeFast(filePath: string): string {
    const extWithDot = path.extname(filePath).toLowerCase();
    const cached = COMMON_EXTENSIONS.get(extWithDot);
    if (cached) {
      return cached;
    }

    return this.normalize(filePath);
  }

  clear(): void {
    this.cache.clear();
  }
}

const extensionCache = new ExtensionCache();
const COMMENT_IGNORED_EXTENSIONS = new Set(
  DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS.map((ext) => ext.toLowerCase()),
);

export function normalizeExtension(filePath: string): string {
  return extensionCache.normalize(filePath);
}

export function clearExtensionCache(): void {
  extensionCache.clear();
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

export async function processFileStatisticsWithContent(
  filePath: string,
  args: Args,
  content: string,
): Promise<{
  lines: number | null;
  commentLines: number | null;
  codeLines: number | null;
  fullLineComments: number | null;
  inlineComments: number | null;
  blankLines: number | null;
  error: LineCounterError | null;
}> {
  if (!args.comments && !args.code_vs_comments) {
    const lineCount = countLinesFromContent(content);
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

  const ext = normalizeExtension(filePath);
  const shouldSkipComments = COMMENT_IGNORED_EXTENSIONS.has(ext);

  if (args.comments || args.code_vs_comments) {
    if (!shouldSkipComments) {
      try {
        const commentStats = countLinesWithComments(filePath, content);
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
      } catch (error) {
        const lineCount = countLinesWithBlankFromContent(content);
        return {
          lines: lineCount.total,
          commentLines: 0,
          codeLines: lineCount.code,
          fullLineComments: 0,
          inlineComments: 0,
          blankLines: lineCount.blank,
          error:
            error instanceof Error
              ? LineCounterError.commentParsingError(
                  filePath,
                  error.message,
                  error,
                )
              : null,
        };
      }
    }

    const lineCount = countLinesWithBlankFromContent(content);
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

  const lineCount = countLinesFromContent(content);
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
  if (!args.comments && !args.code_vs_comments) {
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

  const ext = normalizeExtension(filePath);
  const shouldSkipComments = COMMENT_IGNORED_EXTENSIONS.has(ext);

  if (args.comments || args.code_vs_comments) {
    if (!shouldSkipComments) {
      try {
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
      } catch (error) {
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
          error:
            error instanceof Error
              ? LineCounterError.commentParsingError(
                  filePath,
                  error.message,
                  error,
                )
              : null,
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
