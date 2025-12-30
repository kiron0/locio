import chalk from "chalk";
import * as crypto from "crypto";
import * as fs from "fs";
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
let changedFiles: Set<string> = new Set();
let rateLimiter: FileSystemEventRateLimiter | null = null;

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

async function performScan(
  args: Args,
  incremental: boolean = false,
  logger: ReturnType<typeof createLogger>,
): Promise<void | LineCounterError> {
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

  if (incremental && changedFiles.size > 0) {
    const changedFilesArray = Array.from(changedFiles).slice(0, 10);
    logger.info(
      chalk.cyan(
        `📝 Changed files: ${changedFiles.size > 10 ? `${changedFiles.size} files` : changedFilesArray.length + " file(s)"}`,
      ),
    );
    if (changedFilesArray.length > 0) {
      changedFilesArray.forEach((file) => {
        logger.verbose(`   ${chalk.gray("•")} ${file}`);
      });
      if (changedFiles.size > 10) {
        logger.verbose(chalk.gray(`   ... and ${changedFiles.size - 10} more`));
      }
    }
    logger.info("");
  }

  const summary = await scanDirectory(args);
  if (isError(summary)) {
    return summary;
  }

  changedFiles.clear();

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
      return;
    }

    isScanning = true;

    logger.info(chalk.cyan("🔄 Changes detected. Rescanning...\n"));

    const result = await performScan(args, true, logger);
    if (isError(result)) {
      logger.error(`\n❌ Error: ${result.message}`);
      if (result.suggestion) {
        logger.warn(`\n💡 Suggestion: ${result.suggestion}`);
      }
    } else {
      logger.info(chalk.gray("\n" + "─".repeat(60)));
      logger.info(
        chalk.gray(
          `👀 Watching for changes... (Press ${chalk.yellow("Ctrl+C")} to stop)`,
        ),
      );
    }

    isScanning = false;
  }, debounceMs);
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

        if (args.export && filename.startsWith("LocIO-report.")) {
          return;
        }

        debouncedScan(args, filename, logger);
      },
    );

    watcher.on("error", (error: Error) => {
      logger.error(`\nWatch error: ${error.message}`);
      logger.warn(
        "Note: Recursive watching may not be supported on all systems.",
      );
    });
  } catch (error) {
    logger.error(
      `Failed to start watch mode: ${error instanceof Error ? error.message : String(error)}`,
    );
    logger.warn(
      "Note: Recursive watching may not be supported on all systems.",
    );
    process.exit(1);
  }

  const cleanup = () => {
    if (watchTimeout) {
      clearTimeout(watchTimeout);
    }
    if (watcher) {
      watcher.close();
    }
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
