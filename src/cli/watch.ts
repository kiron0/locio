import chalk from "chalk";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { WATCH_CONSTANTS } from "../core/constants.js";
import { LineCounterError, isError } from "../core/errors.js";
import { exportReport } from "../core/export/index.js";
import { scanDirectory } from "../core/scanner/index.js";
import { createLogger } from "../utils/logger.js";
import {
  FileSystemEventRateLimiter,
  isDirectorySafeToWatch,
} from "../utils/security.js";
import type { Args } from "./args.js";
import { validateDirectory } from "./utils.js";

let watchTimeout: NodeJS.Timeout | null = null;
let isScanning = false;
let watcher: fs.FSWatcher | null = null;
let fallbackPoller: NodeJS.Timeout | null = null;
let changedFiles: Set<string> = new Set();
let rateLimiter: FileSystemEventRateLimiter | null = null;
let usingFallbackWatchers = false;

interface FileHash {
  path: string;
  hash: string;
  mtime: number;
}

export class WatchCache {
  private cache = new Map<string, FileHash>();

  getFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return crypto.createHash("sha256").update(content).digest("hex");
    } catch {
      return "";
    }
  }

  isFileChanged(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      const cached = this.cache.get(filePath);

      if (!cached) {
        return true;
      }

      if (stats.mtimeMs !== cached.mtime) {
        return true;
      }

      const currentHash = this.getFileHash(filePath);
      return currentHash !== cached.hash;
    } catch {
      return true;
    }
  }

  updateFile(filePath: string): void {
    try {
      const stats = fs.statSync(filePath);
      const hash = this.getFileHash(filePath);
      this.cache.set(filePath, { path: filePath, hash, mtime: stats.mtimeMs });
    } catch {}
  }

  removeFile(filePath: string): void {
    this.cache.delete(filePath);
  }

  clear(): void {
    this.cache.clear();
  }
}

let watchCache: WatchCache | null = null;

function closeActiveWatchers(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  if (fallbackPoller) {
    clearInterval(fallbackPoller);
    fallbackPoller = null;
  }
}

export function collectWatchDirectories(rootDir: string): string[] {
  const directories: string[] = [];
  const visited = new Set<string>();

  function walk(dirPath: string): void {
    const resolvedPath = path.resolve(dirPath);
    if (visited.has(resolvedPath)) {
      return;
    }
    visited.add(resolvedPath);
    directories.push(resolvedPath);

    let entries: string[];
    try {
      entries = fs.readdirSync(resolvedPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry === ".git") {
        continue;
      }

      const entryPath = path.join(resolvedPath, entry);
      try {
        if (fs.lstatSync(entryPath).isDirectory()) {
          walk(entryPath);
        }
      } catch {}
    }
  }

  walk(rootDir);
  return directories;
}

export function collectWatchSnapshot(rootDir: string): Map<string, number> {
  const snapshot = new Map<string, number>();

  function walk(entryPath: string): void {
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(entryPath);
    } catch {
      return;
    }

    const resolvedPath = path.resolve(entryPath);
    snapshot.set(resolvedPath, stats.mtimeMs);

    if (!stats.isDirectory() || path.basename(resolvedPath) === ".git") {
      return;
    }

    let entries: string[];
    try {
      entries = fs.readdirSync(resolvedPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      walk(path.join(resolvedPath, entry));
    }
  }

  walk(rootDir);
  return snapshot;
}

export function detectSnapshotChanges(
  previous: Map<string, number>,
  current: Map<string, number>,
): string[] {
  const changed = new Set<string>();

  for (const [entryPath, mtime] of current) {
    if (!previous.has(entryPath) || previous.get(entryPath) !== mtime) {
      changed.add(entryPath);
    }
  }

  for (const entryPath of previous.keys()) {
    if (!current.has(entryPath)) {
      changed.add(entryPath);
    }
  }

  return Array.from(changed);
}

async function performScan(
  args: Args,
  incremental: boolean = false,
  logger: ReturnType<typeof createLogger>,
): Promise<void | LineCounterError> {
  const pendingChanges = incremental
    ? new Set(changedFiles)
    : new Set<string>();
  const validation = validateDirectory(args.directory);
  if (validation.error) {
    return validation.error;
  }

  const dirPath = validation.path;
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    return LineCounterError.notADirectory(args.directory);
  }

  args.directory = dirPath;

  if (!watchCache) {
    watchCache = new WatchCache();
  }

  if (incremental && pendingChanges.size > 0) {
    const changedFilesArray = Array.from(pendingChanges).slice(0, 10);
    logger.info(
      chalk.cyan(
        `📝 Changed files: ${pendingChanges.size > 10 ? `${pendingChanges.size} files` : changedFilesArray.length + " file(s)"}`,
      ),
    );
    if (changedFilesArray.length > 0) {
      changedFilesArray.forEach((file) => {
        logger.verbose(`   ${chalk.gray("•")} ${file}`);
      });
      if (pendingChanges.size > 10) {
        logger.verbose(
          chalk.gray(`   ... and ${pendingChanges.size - 10} more`),
        );
      }
    }
    logger.info("");
  }

  const summary = await scanDirectory(args);
  if (isError(summary)) {
    return summary;
  }

  for (const changedFile of pendingChanges) {
    changedFiles.delete(changedFile);
  }

  exportReport(summary, args);
  return;
}

function clearScreen(): void {
  if (process.stdout.isTTY) {
    console.log("\x1b[2J\x1b[H");
  }
}

export function getDebounceMs(args: Args): number {
  if (args.watch_debounce !== undefined) {
    return Math.max(
      WATCH_CONSTANTS.MIN_DEBOUNCE_MS,
      Math.min(WATCH_CONSTANTS.MAX_DEBOUNCE_MS, args.watch_debounce),
    );
  }
  return WATCH_CONSTANTS.DEFAULT_DEBOUNCE_MS;
}

function debouncedScan(
  args: Args,
  filename: string,
  logger: ReturnType<typeof createLogger>,
): void {
  if (watchTimeout) {
    clearTimeout(watchTimeout);
  }

  if (filename) {
    changedFiles.add(filename);
  }

  const debounceMs = getDebounceMs(args);

  watchTimeout = setTimeout(async () => {
    if (isScanning) {
      debouncedScan(args, "", logger);
      return;
    }

    isScanning = true;
    let shouldRescan = false;

    try {
      logger.info(chalk.cyan("🔄 Changes detected. Rescanning...\n"));

      const result = await performScan(args, true, logger);
      if (isError(result)) {
        logger.error(`\n❌ Error: ${result.message}`);
        if (result.suggestion) {
          logger.warn(`\n💡 Suggestion: ${result.suggestion}`);
        }
      } else {
        shouldRescan = true;
        logger.info(chalk.gray("\n" + "─".repeat(60)));
        logger.info(
          chalk.gray(
            `👀 Watching for changes... (Press ${chalk.yellow("Ctrl+C")} to stop)`,
          ),
        );
      }
    } finally {
      isScanning = false;
      if (shouldRescan && changedFiles.size > 0) {
        debouncedScan(args, "", logger);
      }
    }
  }, debounceMs);
}

function startFallbackWatching(
  dirPath: string,
  args: Args,
  logger: ReturnType<typeof createLogger>,
): void {
  closeActiveWatchers();
  let previousSnapshot = collectWatchSnapshot(dirPath);
  const pollInterval = Math.max(250, getDebounceMs(args));

  fallbackPoller = setInterval(() => {
    const currentSnapshot = collectWatchSnapshot(dirPath);
    const changed = detectSnapshotChanges(previousSnapshot, currentSnapshot);
    if (changed.length === 0) {
      return;
    }
    previousSnapshot = currentSnapshot;

    if (rateLimiter && !rateLimiter.shouldAllow()) {
      return;
    }

    const interestingPath = changed.find(
      (entryPath) => !entryPath.includes("LocIO-report."),
    );

    if (!interestingPath) {
      return;
    }

    const relativePath = path.relative(dirPath, interestingPath);
    debouncedScan(args, relativePath || path.basename(interestingPath), logger);
  }, pollInterval);

  usingFallbackWatchers = true;
  logger.warn("Recursive watch is unavailable here. Falling back to polling.");
}

export async function startWatchMode(args: Args): Promise<void> {
  const logger = createLogger(args);
  const validation = validateDirectory(args.directory);
  if (validation.error) {
    logger.error(`Error: ${validation.error.message}`);
    process.exit(1);
  }

  const dirPath = validation.path;
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    logger.error(`Error: Not a directory: ${args.directory}`);
    process.exit(1);
  }

  if (!isDirectorySafeToWatch(dirPath)) {
    logger.error(
      `Error: Cannot watch sensitive directory: ${dirPath}\n` +
        "  - System directories and root directories are not allowed\n" +
        "  - Please specify a project directory instead",
    );
    process.exit(1);
  }

  logger.info(chalk.cyan("🚀 Starting watch mode...\n"));

  const debounceMs = getDebounceMs(args);
  if (args.watch_debounce !== undefined) {
    logger.verbose(chalk.gray(`⏱️  Watch debounce: ${debounceMs}ms\n`));
  }

  watchCache = new WatchCache();
  changedFiles.clear();
  rateLimiter = new FileSystemEventRateLimiter(100, 1000);
  usingFallbackWatchers = false;
  closeActiveWatchers();

  const initialResult = await performScan(args, false, logger);
  if (isError(initialResult)) {
    logger.error(`Error: ${initialResult.message}`);
    process.exit(1);
  }

  logger.info(chalk.gray("\n" + "─".repeat(60)));
  logger.info(
    chalk.gray(
      `👀 Watching for changes... (Press ${chalk.yellow("Ctrl+C")} to stop)`,
    ),
  );

  try {
    watcher = fs.watch(
      dirPath,
      { recursive: true },
      (_eventType: string, filename: string | null) => {
        if (!filename) {
          return;
        }

        if (rateLimiter && !rateLimiter.shouldAllow()) {
          return;
        }

        if (
          args.export &&
          path.basename(filename).startsWith("LocIO-report.")
        ) {
          return;
        }

        debouncedScan(args, filename, logger);
      },
    );

    watcher.on("error", (error: Error) => {
      try {
        startFallbackWatching(dirPath, args, logger);
      } catch (fallbackError) {
        logger.error(`\nWatch error: ${error.message}`);
        logger.warn(
          "Note: Recursive watching may not be supported on all systems.",
        );
        logger.error(
          `Fallback watch failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        );
        process.exitCode = 1;
        closeActiveWatchers();
      }
    });
  } catch (error) {
    try {
      startFallbackWatching(dirPath, args, logger);
    } catch (fallbackError) {
      logger.error(
        `Failed to start watch mode: ${error instanceof Error ? error.message : String(error)}`,
      );
      logger.warn(
        "Note: Recursive watching may not be supported on all systems.",
      );
      logger.error(
        `Fallback watch failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
      process.exit(1);
    }
  }

  const cleanup = () => {
    if (watchTimeout) {
      clearTimeout(watchTimeout);
    }
    closeActiveWatchers();
    if (watchCache) {
      watchCache.clear();
      watchCache = null;
    }
    changedFiles.clear();
    logger.info(chalk.gray("\n\n👋 Watch mode stopped."));
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
