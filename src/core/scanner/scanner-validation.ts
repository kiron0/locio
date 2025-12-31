import * as fs from "fs";
import ignore from "ignore";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { isBinaryFile, parseSize } from "../../utils/files.js";
import { isPathSafe, shouldSkipFileDueToSize } from "../../utils/security.js";
import { FILE_CONSTANTS } from "../constants.js";
import { LineCounterError } from "../errors.js";
import { shouldExcludeFile, type FilterPatterns } from "../filter/index.js";
import type { FileStatsCache } from "./scanner-cache.js";
import { checkMaxDepth, normalizeExtension } from "./scanner-utils.js";

export interface FileValidationResult {
  shouldSkip: boolean;
  stats?: fs.Stats;
  size?: number;
  ext?: string;
}

export function normalizeGlobEntries(entries: (string | object)[]): string[] {
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

export function validateFileForProcessing(
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

export function filterFilesForProcessing(
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
