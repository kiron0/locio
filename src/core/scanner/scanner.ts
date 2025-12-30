import fastGlob from "fast-glob";
import * as fs from "fs";
import ignore from "ignore";
import * as os from "os";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { parseCommaSeparated } from "../../cli/utils.js";
import { isBinaryFile, parseSize } from "../../utils/files.js";
import { removeCommentsFromFile } from "../../utils/formatting/index.js";
import { ProgressBar, ThrottledProgressBar } from "../../utils/progress.js";
import { isPathSafe, shouldSkipFileDueToSize } from "../../utils/security.js";
import {
  FILE_CONSTANTS,
  GLOB_CONSTANTS,
  PERFORMANCE_CONSTANTS,
} from "../constants.js";
import { ErrorCode, LineCounterError, isError } from "../errors.js";
import {
  DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS,
  createFilterPatterns,
  shouldExcludeFile,
  type FilterPatterns,
} from "../filter/index.js";
import type { Summary } from "../types.js";
import { createSummary } from "../types.js";
import {
  checkMaxDepth,
  clearExtensionCache,
  createCommentStats,
  createFileDetail,
  normalizeExtension,
  processFileStatistics,
  processFileStatisticsWithContent,
  updateSummaryWithFile,
} from "./index.js";

class FileStatsCache {
  private cache = new Map<string, fs.Stats>();

  get(filePath: string): fs.Stats | null {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const stats = fs.statSync(filePath);
      this.cache.set(filePath, stats);
      return stats;
    } catch {
      return null;
    }
  }

  async getAsync(filePath: string): Promise<fs.Stats | null> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      this.cache.set(filePath, stats);
      return stats;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

class FileContentCache {
  private cache = new Map<string, { content: string; stats: fs.Stats }>();
  private maxCacheSize = FILE_CONSTANTS.MAX_MEMORY_FILES;

  async get(
    filePath: string,
  ): Promise<{ content: string; stats: fs.Stats } | null> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      const content = await fs.promises.readFile(filePath, "utf-8");
      const result = { content, stats };

      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }

      this.cache.set(filePath, result);
      return result;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

interface FileValidationResult {
  shouldSkip: boolean;
  stats?: fs.Stats;
  size?: number;
  ext?: string;
}

function filterFilesForProcessing(
  files: string[],
  args: Args,
  patterns: FilterPatterns,
  baseDir: string,
  statsCache: FileStatsCache,
  ignoreInstance: ignore.Ignore,
): string[] {
  const filesToProcess: string[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(baseDir, filePath);
    if (ignoreInstance.ignores(relativePath)) {
      continue;
    }

    const validation = validateFileForProcessing(
      filePath,
      args,
      patterns,
      baseDir,
      statsCache,
    );

    if (validation.shouldSkip) {
      continue;
    }

    const { stats, ext } = validation;
    if (!stats || ext === undefined) {
      continue;
    }

    if (patterns.include_extensions.length > 0) {
      if (!patterns.include_extensions.includes(ext)) {
        continue;
      }
    }

    if (args.max_size) {
      const maxSize = parseSize(args.max_size);
      if (!(maxSize instanceof LineCounterError) && stats.size > maxSize) {
        continue;
      }
    }

    if (args.min_size) {
      const minSize = parseSize(args.min_size);
      if (!(minSize instanceof LineCounterError) && stats.size < minSize) {
        continue;
      }
    }

    if (args.no_empty && stats.size === 0) {
      continue;
    }

    filesToProcess.push(filePath);
  }

  return filesToProcess;
}

function validateFileForProcessing(
  filePath: string,
  args: Args,
  patterns: FilterPatterns,
  baseDir: string,
  statsCache: FileStatsCache,
  isSingleFile: boolean = false,
): FileValidationResult {
  if (!isSingleFile && args.max_depth !== undefined) {
    if (checkMaxDepth(filePath, baseDir, args.max_depth)) {
      return { shouldSkip: true };
    }
  }

  if (!isPathSafe(filePath, baseDir)) {
    return { shouldSkip: true };
  }

  const stats = statsCache.get(filePath);
  if (!stats || !stats.isFile()) {
    return { shouldSkip: true };
  }

  if (shouldSkipFileDueToSize(filePath, FILE_CONSTANTS.MAX_SAFE_FILE_SIZE)) {
    return { shouldSkip: true };
  }

  const size = stats.size;
  const ext = normalizeExtension(filePath);

  if (isSingleFile) {
    if (args.no_empty && size === 0) {
      return { shouldSkip: true };
    }
    if (args.no_binary && isBinaryFile(filePath)) {
      return { shouldSkip: true };
    }

    const extLower = ext.toLowerCase().replace(/^\./, "");

    if (patterns.exclude_extensions.length > 0) {
      if (patterns.exclude_extensions.includes(extLower)) {
        return { shouldSkip: true };
      }
    }

    if (patterns.include_extensions.length > 0) {
      if (!patterns.include_extensions.includes(extLower)) {
        return { shouldSkip: true };
      }
    }

    if (args.max_size) {
      const maxSize = parseSize(args.max_size);
      if (!(maxSize instanceof LineCounterError) && size > maxSize) {
        return { shouldSkip: true };
      }
    }

    if (args.min_size) {
      const minSize = parseSize(args.min_size);
      if (!(minSize instanceof LineCounterError) && size < minSize) {
        return { shouldSkip: true };
      }
    }

    for (const pattern of patterns.exclude_patterns) {
      if (pattern.test(filePath)) {
        return { shouldSkip: true };
      }
    }

    const fileName = path.basename(filePath);
    for (const pattern of patterns.exclude_names) {
      if (pattern.test(fileName)) {
        return { shouldSkip: true };
      }
    }

    if (patterns.include_names.length > 0) {
      let matches = false;
      for (const pattern of patterns.include_names) {
        if (pattern.test(fileName)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        return { shouldSkip: true };
      }
    }

    if (args.no_hidden && fileName.startsWith(".")) {
      return { shouldSkip: true };
    }
  } else {
    if (shouldExcludeFile(filePath, args, patterns)) {
      return { shouldSkip: true };
    }
  }

  return {
    shouldSkip: false,
    stats,
    size,
    ext,
  };
}

function processCommentRemovalForFiles(
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

function normalizeGlobEntries(entries: (string | object)[]): string[] {
  return entries.map((entry) => {
    if (typeof entry === "string") {
      return entry;
    }

    if (typeof entry === "object" && entry !== null && "path" in entry) {
      return String((entry as { path: string }).path);
    }
    return String(entry);
  });
}

class GitignoreCache {
  private cache = new Map<
    string,
    {
      instance: ignore.Ignore;
      gitignorePaths: Array<{ path: string; mtime: number }>;
    }
  >();

  private getGitignorePaths(
    dirPath: string,
    baseDir: string,
  ): Array<{ path: string; mtime: number }> {
    const gitignorePaths: Array<{ path: string; mtime: number }> = [];

    function collectGitignoreFiles(currentDir: string, baseDir: string) {
      const gitignorePath = path.join(currentDir, ".gitignore");
      try {
        if (
          fs.existsSync(gitignorePath) &&
          fs.statSync(gitignorePath).isFile()
        ) {
          const stats = fs.statSync(gitignorePath);
          gitignorePaths.push({ path: gitignorePath, mtime: stats.mtimeMs });
        }
      } catch {}

      try {
        const entries = fs.readdirSync(currentDir);
        for (const entry of entries) {
          const entryPath = path.join(currentDir, entry);
          try {
            if (fs.statSync(entryPath).isDirectory() && entry !== ".git") {
              collectGitignoreFiles(entryPath, baseDir);
            }
          } catch {}
        }
      } catch {}
    }

    collectGitignoreFiles(dirPath, baseDir);
    return gitignorePaths;
  }

  private isCacheValid(
    dirPath: string,
    cached: {
      instance: ignore.Ignore;
      gitignorePaths: Array<{ path: string; mtime: number }>;
    },
  ): boolean {
    const currentPaths = this.getGitignorePaths(dirPath, dirPath);

    if (currentPaths.length !== cached.gitignorePaths.length) {
      return false;
    }

    for (const currentPath of currentPaths) {
      const cachedPath = cached.gitignorePaths.find(
        (p) => p.path === currentPath.path,
      );
      if (!cachedPath) {
        return false;
      }

      if (currentPath.mtime !== cachedPath.mtime) {
        return false;
      }
    }

    return true;
  }

  buildIgnoreInstance(dirPath: string): ignore.Ignore {
    const cached = this.cache.get(dirPath);
    if (cached && this.isCacheValid(dirPath, cached)) {
      return cached.instance;
    }

    const ig = ignore();
    ig.add(".git");
    ig.add(".gitignore");
    ig.add(".lcignore");

    const gitignorePaths: Array<{ path: string; mtime: number }> = [];

    function addGitignorePatterns(
      gitignoreDir: string,
      baseDir: string,
      content: string,
    ): void {
      const relativeDir = path.relative(baseDir, gitignoreDir) || ".";
      const relativeDirNormalized =
        relativeDir === "." ? "" : relativeDir.replace(/\\/g, "/") + "/";

      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const normalizedRule = trimmed.replace(/\\/g, "/");

        if (relativeDir === ".") {
          ig.add(normalizedRule);
        } else {
          if (normalizedRule.startsWith("!")) {
            const negatedRule = normalizedRule.slice(1);
            if (negatedRule.startsWith("/")) {
              ig.add(
                "!" +
                  (relativeDirNormalized + negatedRule.slice(1)).replace(
                    /\/+/g,
                    "/",
                  ),
              );
            } else {
              ig.add(
                "!" +
                  (relativeDirNormalized + negatedRule).replace(/\/+/g, "/"),
              );
            }
          } else if (normalizedRule.startsWith("/")) {
            const rootRelativePattern = normalizedRule.slice(1);
            ig.add(
              (relativeDirNormalized + rootRelativePattern).replace(
                /\/+/g,
                "/",
              ),
            );
          } else if (normalizedRule.includes("**")) {
            ig.add(normalizedRule);
            if (relativeDirNormalized) {
              ig.add(
                (relativeDirNormalized + normalizedRule).replace(/\/+/g, "/"),
              );
            }
          } else {
            const scopedPattern = (
              relativeDirNormalized + normalizedRule
            ).replace(/\/+/g, "/");
            ig.add(scopedPattern);
          }
        }
      }
    }

    function readGitignoreFiles(currentDir: string, baseDir: string): void {
      const gitignorePath = path.join(currentDir, ".gitignore");
      try {
        if (
          fs.existsSync(gitignorePath) &&
          fs.statSync(gitignorePath).isFile()
        ) {
          const stats = fs.statSync(gitignorePath);
          gitignorePaths.push({ path: gitignorePath, mtime: stats.mtimeMs });
          const content = fs.readFileSync(gitignorePath, "utf-8");
          addGitignorePatterns(currentDir, baseDir, content);
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

    this.cache.set(dirPath, {
      instance: ig,
      gitignorePaths: gitignorePaths,
    });

    return ig;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

const gitignoreCache = new GitignoreCache();

function buildIgnoreInstance(dirPath: string): ignore.Ignore {
  return gitignoreCache.buildIgnoreInstance(dirPath);
}

function hasVerboseFlag(args: Args): args is Args & { verbose?: boolean } {
  return true;
}

function getVerboseFlag(args: Args): boolean {
  return false;
}

async function processFileWithErrorHandling(
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

async function processFile(
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

    if (shouldSkipFileDueToSize(filePath, FILE_CONSTANTS.MAX_SAFE_FILE_SIZE)) {
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

export async function scanDirectory(
  args: Args,
): Promise<Summary | LineCounterError> {
  const startTime = Date.now();
  const { MemoryTracker } = await import("../../utils/metrics.js");
  const memoryTracker = new MemoryTracker();
  memoryTracker.checkpoint();
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

    const filesToProcess: string[] = [];
    for (const filePath of files) {
      if (!isPathSafe(filePath, args.directory)) {
        continue;
      }

      const relativePath = path.relative(args.directory, filePath);
      if (ig.ignores(relativePath)) {
        continue;
      }

      const validation = validateFileForProcessing(
        filePath,
        args,
        patterns,
        args.directory,
        statsCache,
      );

      if (validation.shouldSkip) {
        continue;
      }

      const { stats, ext } = validation;
      if (!stats || ext === undefined) {
        continue;
      }

      if (patterns.include_extensions.length > 0) {
        if (!patterns.include_extensions.includes(ext)) {
          continue;
        }
      }

      if (args.max_size) {
        const maxSize = parseSize(args.max_size);
        if (!(maxSize instanceof LineCounterError) && stats.size > maxSize) {
          continue;
        }
      }

      if (args.min_size) {
        const minSize = parseSize(args.min_size);
        if (!(minSize instanceof LineCounterError) && stats.size < minSize) {
          continue;
        }
      }

      if (args.no_empty && stats.size === 0) {
        continue;
      }

      filesToProcess.push(filePath);
    }

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

      memoryTracker.checkpoint();

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
    gitignoreCache.clearCache();

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

  const endTime = Date.now();
  memoryTracker.checkpoint();
  const memoryMetrics = memoryTracker.getMetrics();

  (
    summary as Summary & { _memoryMetrics?: typeof memoryMetrics }
  )._memoryMetrics = memoryMetrics;

  showProgressReport(args, startTime, processed, errors);

  if (args.rm_comments) {
    return { ...summary, _commentsRemoved: processed };
  }

  return summary;
}
