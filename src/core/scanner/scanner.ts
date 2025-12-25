import fastGlob from "fast-glob";
import * as fs from "fs";
import ignore from "ignore";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { parseCommaSeparated } from "../../cli/utils.js";
import { removeCommentsFromFile } from "../../utils/formatting/index.js";
import { ProgressBar } from "../../utils/progress.js";
import { isError, LineCounterError } from "../errors.js";
import {
  createFilterPatterns,
  DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS,
  shouldExcludeFile,
} from "../filter/index.js";
import type { Summary } from "../types.js";
import { createSummary } from "../types.js";
import {
  checkMaxDepth,
  createFileDetail,
  getFileMetadata,
  normalizeExtension,
  processFileStatistics,
  updateSummaryWithFile,
} from "./scanner-utils.js";

function buildIgnoreInstance(dirPath: string): ignore.Ignore {
  const ig = ignore();
  ig.add(".git");
  ig.add(".gitignore");
  ig.add(".lcignore");

  function readGitignoreFiles(currentDir: string, baseDir: string) {
    const gitignorePath = path.join(currentDir, ".gitignore");
    try {
      if (fs.existsSync(gitignorePath) && fs.statSync(gitignorePath).isFile()) {
        const content = fs.readFileSync(gitignorePath, "utf-8");
        const relativeDir = path.relative(baseDir, currentDir) || ".";
        const rules = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"));
        for (const rule of rules) {
          if (relativeDir === ".") {
            ig.add(rule);
          } else {
            ig.add(path.join(relativeDir, rule));
          }
        }
      }
    } catch {}

    try {
      const entries = fs.readdirSync(currentDir);
      for (const entry of entries) {
        const entryPath = path.join(currentDir, entry);
        try {
          if (fs.statSync(entryPath).isDirectory() && entry !== ".git") {
            readGitignoreFiles(entryPath, baseDir);
          }
        } catch {}
      }
    } catch {}
  }

  readGitignoreFiles(dirPath, dirPath);
  return ig;
}

function processFile(
  filePath: string,
  args: Args,
  summary: Summary,
  patterns: any,
  baseDir: string,
): { processed: number; errors: number } {
  let processed = 0;
  let errors = 0;

  if (args.max_depth !== undefined) {
    if (checkMaxDepth(filePath, baseDir, args.max_depth)) {
      return { processed, errors };
    }
  }

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return { processed, errors };
    }
  } catch {
    return { processed, errors };
  }

  if (shouldExcludeFile(filePath, args, patterns)) {
    return { processed, errors };
  }

  const metadataResult = getFileMetadata(filePath);
  if (metadataResult.error) {
    if (!args.quiet) {
      console.error(
        `Warning: Could not read metadata for ${filePath}: ${metadataResult.error}`,
      );
    }
    errors += 1;
    return { processed, errors };
  }

  const size = metadataResult.metadata.size;
  const ext = normalizeExtension(filePath);

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
  let commentStats: {
    totalLines: number;
    commentLines: number;
    codeLines: number;
    fullLineComments: number;
    inlineComments: number;
  } | null = null;

  if (!args.files_only) {
    const statsResult = processFileStatistics(filePath, args);
    if (statsResult.error) {
      if (!args.quiet) {
        console.error(
          `Warning: Could not count lines in ${filePath}: ${statsResult.error.message}`,
        );
      }
      errors += 1;
    } else {
      linesOpt = statsResult.lines;
      commentLinesOpt = statsResult.commentLines;
      codeLinesOpt = statsResult.codeLines;
      fullLineCommentsOpt = statsResult.fullLineComments;
      inlineCommentsOpt = statsResult.inlineComments;

      if (statsResult.commentLines !== null) {
        commentStats = {
          totalLines: statsResult.lines || 0,
          commentLines: statsResult.commentLines,
          codeLines: statsResult.codeLines || 0,
          fullLineComments: statsResult.fullLineComments || 0,
          inlineComments: statsResult.inlineComments || 0,
        };
      }
    }
  }

  updateSummaryWithFile(summary, ext, size, linesOpt, commentStats);

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
    ),
  );

  return { processed, errors };
}

export function scanFile(args: Args): Summary | LineCounterError {
  const startTime = Date.now();
  const summary = createSummary();

  const patterns = createFilterPatterns(args);
  if (isError(patterns)) {
    return patterns;
  }

  const filePath = path.resolve(args.directory);
  const baseDir = path.dirname(filePath);

  const { processed, errors } = processFile(
    filePath,
    args,
    summary,
    patterns,
    baseDir,
  );

  showProgressReport(args, startTime, processed, errors);

  if (args.rm_comments) {
    return { ...summary, _commentsRemoved: processed } as any;
  }

  return summary;
}

function showProgressReport(
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

export function scanDirectory(args: Args): Summary | LineCounterError {
  const startTime = Date.now();
  const summary = createSummary();

  const patterns = createFilterPatterns(args);
  if (isError(patterns)) {
    return patterns;
  }

  const ig = buildIgnoreInstance(args.directory);

  const globPattern = path.join(args.directory, "**/*");
  const options: any = {
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
  let filesChecked = 0;

  try {
    const entries = fastGlob.sync(globPattern, options);
    const files: string[] = entries.map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      return (entry as any).path || String(entry);
    });

    if (args.show_progress && !args.quiet) {
      progressBar = new ProgressBar(files.length);
    }

    for (const filePath of files) {
      filesChecked += 1;

      if (progressBar) {
        progressBar.update(filesChecked, errors);
      }
      if (args.max_depth !== undefined) {
        if (checkMaxDepth(filePath, args.directory, args.max_depth)) {
          continue;
        }
      }

      const relativePath = path.relative(args.directory, filePath);
      if (ig.ignores(relativePath)) {
        continue;
      }

      try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
          continue;
        }
      } catch {
        continue;
      }

      if (shouldExcludeFile(filePath, args, patterns)) {
        continue;
      }

      const metadataResult = getFileMetadata(filePath);
      if (metadataResult.error) {
        if (!args.quiet) {
          console.error(
            `Warning: Could not read metadata for ${filePath}: ${metadataResult.error}`,
          );
        }
        errors += 1;
        continue;
      }

      const size = metadataResult.metadata.size;
      const ext = normalizeExtension(filePath);

      if (args.rm_comments) {
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
              allowedExts.includes(fileExt) ||
              allowedExts.includes(`.${fileExt}`)
            );
          }
          return false;
        })();

        if (shouldProcess) {
          const result = removeCommentsFromFile(filePath);
          if (result.success) {
            if (result.commentsFound) {
              if (!args.quiet) {
                const relativePath = path.relative(args.directory, filePath);
                console.log(`✓ Removed comments from ${relativePath}`);
              }
              processed += 1;
            }
          } else {
            if (!args.quiet) {
              const relativePath = path.relative(args.directory, filePath);
              console.error(`✗ Failed to remove comments from ${relativePath}`);
            }
            errors += 1;
          }
        }
        continue;
      }

      processed += 1;

      let linesOpt: number | null = null;
      let commentLinesOpt: number | null = null;
      let codeLinesOpt: number | null = null;
      let fullLineCommentsOpt: number | null = null;
      let inlineCommentsOpt: number | null = null;
      let commentStats: {
        totalLines: number;
        commentLines: number;
        codeLines: number;
        fullLineComments: number;
        inlineComments: number;
      } | null = null;

      if (!args.files_only) {
        const statsResult = processFileStatistics(filePath, args);
        if (statsResult.error) {
          if (!args.quiet) {
            console.error(
              `Warning: Could not count lines in ${filePath}: ${statsResult.error.message}`,
            );
          }
          errors += 1;
        } else {
          linesOpt = statsResult.lines;
          commentLinesOpt = statsResult.commentLines;
          codeLinesOpt = statsResult.codeLines;
          fullLineCommentsOpt = statsResult.fullLineComments;
          inlineCommentsOpt = statsResult.inlineComments;

          if (statsResult.commentLines !== null) {
            commentStats = {
              totalLines: statsResult.lines || 0,
              commentLines: statsResult.commentLines,
              codeLines: statsResult.codeLines || 0,
              fullLineComments: statsResult.fullLineComments || 0,
              inlineComments: statsResult.inlineComments || 0,
            };
          }
        }
      }

      updateSummaryWithFile(summary, ext, size, linesOpt, commentStats);

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
        ),
      );
    }
  } catch (e) {
    return LineCounterError.io(
      `Failed to scan directory: ${e instanceof Error ? e.message : String(e)}`,
      e instanceof Error ? e : undefined,
    );
  }

  showProgressReport(args, startTime, processed, errors);

  if (args.rm_comments) {
    return { ...summary, _commentsRemoved: processed } as any;
  }

  return summary;
}
