import * as fs from "fs";
import ignore from "ignore";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { isPathSafe } from "../../utils/security.js";
import { FILE_CONSTANTS } from "../constants.js";
import {
  getFileExclusionReason,
  type FilterPatterns,
} from "../filter/index.js";
import type { ExclusionReason, Summary } from "../types.js";
import type { FileStatsCache } from "./scanner-cache.js";
import { checkMaxDepth, normalizeExtension } from "./scanner-utils.js";

export interface FileValidationResult {
  shouldSkip: boolean;
  stats?: fs.Stats;
  size?: number;
  ext?: string;
  reason?: ExclusionReason;
}

const MAX_EXCLUSION_EXAMPLES = 100;

export function recordFileExclusion(
  summary: Summary | undefined,
  args: Args,
  filePath: string,
  baseDir: string,
  reason: ExclusionReason,
): void {
  if (!args.explain || !summary) return;

  summary.exclusions ??= {
    total: 0,
    by_reason: {},
    examples: [],
    omitted: 0,
  };
  summary.exclusions.total += 1;
  summary.exclusions.by_reason[reason] =
    (summary.exclusions.by_reason[reason] || 0) + 1;

  if (summary.exclusions.examples.length < MAX_EXCLUSION_EXAMPLES) {
    summary.exclusions.examples.push({
      path: path.relative(baseDir, filePath) || path.basename(filePath),
      reason,
    });
  } else {
    summary.exclusions.omitted += 1;
  }
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
      return { shouldSkip: true, reason: "max-depth" };
    }
  }

  if (!isPathSafe(filePath, baseDir)) {
    return { shouldSkip: true, reason: "unsafe-path" };
  }

  const stats = statsCache.get(filePath);
  if (!stats || !stats.isFile()) {
    return { shouldSkip: true, reason: "unreadable-or-not-file" };
  }

  if (stats.size > FILE_CONSTANTS.MAX_SAFE_FILE_SIZE) {
    return { shouldSkip: true, reason: "too-large" };
  }

  const size = stats.size;
  const ext = normalizeExtension(filePath);

  const reason = getFileExclusionReason(filePath, args, patterns, stats);
  if (reason) {
    return { shouldSkip: true, reason };
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
  summary?: Summary,
): string[] {
  const filesToProcess: string[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, "/");
    if (ignoreInstance.ignores(relativePath)) {
      recordFileExclusion(summary, args, filePath, baseDir, "gitignore");
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
      if (validation.reason) {
        recordFileExclusion(
          summary,
          args,
          filePath,
          baseDir,
          validation.reason,
        );
      }
      continue;
    }

    const { stats } = validation;
    if (!stats) {
      continue;
    }

    filesToProcess.push(filePath);
  }

  return filesToProcess;
}
