import chalk from "chalk";
import * as fs from "fs";
import { LineCounterError, isError } from "../core/errors.js";
import { exportReport } from "../core/export/index.js";
import { scanDirectory } from "../core/scanner/index.js";
import type { Args } from "./args.js";
import { validateDirectory } from "./utils.js";

let watchTimeout: NodeJS.Timeout | null = null;
let isScanning = false;
let watcher: fs.FSWatcher | null = null;

function performScan(args: Args): void | LineCounterError {
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
  const summary = scanDirectory(args);
  if (isError(summary)) {
    return summary;
  }

  exportReport(summary, args);
  return;
}

function clearScreen(): void {
  if (process.stdout.isTTY) {
    console.log("\x1b[2J\x1b[H");
  }
}

function debouncedScan(args: Args, debounceMs: number = 500): void {
  if (watchTimeout) {
    clearTimeout(watchTimeout);
  }

  watchTimeout = setTimeout(() => {
    if (isScanning) {
      return;
    }

    isScanning = true;

    if (!args.quiet) {
      clearScreen();
      console.log(chalk.cyan("🔄 Changes detected. Rescanning...\n"));
    }

    const result = performScan(args);
    if (isError(result)) {
      if (!args.quiet) {
        console.error(chalk.red(`\n❌ Error: ${result.message}`));
        if (result.suggestion) {
          console.error(chalk.yellow(`\n💡 Suggestion: ${result.suggestion}`));
        }
      }
    } else {
      if (!args.quiet) {
        console.log(chalk.gray("\n" + "─".repeat(60)));
        console.log(
          chalk.gray(
            `👀 Watching for changes... (Press ${chalk.yellow("Ctrl+C")} to stop)`,
          ),
        );
      }
    }

    isScanning = false;
  }, debounceMs);
}

export function startWatchMode(args: Args): void {
  const validation = validateDirectory(args.directory);
  if (validation.error) {
    console.error(`Error: ${validation.error.message}`);
    process.exit(1);
  }

  const dirPath = validation.path;
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    console.error(`Error: Not a directory: ${args.directory}`);
    process.exit(1);
  }

  if (!args.quiet) {
    console.log(chalk.cyan("🚀 Starting watch mode...\n"));
  }

  const initialResult = performScan(args);
  if (isError(initialResult)) {
    console.error(`Error: ${initialResult.message}`);
    process.exit(1);
  }

  if (!args.quiet) {
    console.log(chalk.gray("\n" + "─".repeat(60)));
    console.log(
      chalk.gray(
        `👀 Watching for changes... (Press ${chalk.yellow("Ctrl+C")} to stop)`,
      ),
    );
  }

  try {
    watcher = fs.watch(
      dirPath,
      { recursive: true },
      (eventType: string, filename: string | null) => {
        if (!filename) {
          return;
        }

        if (args.export && filename.startsWith("LocIO-report.")) {
          return;
        }

        debouncedScan(args, 500);
      },
    );

    watcher.on("error", (error: Error) => {
      if (!args.quiet) {
        console.error(chalk.red(`\nWatch error: ${error.message}`));
      }
    });
  } catch (error) {
    console.error(
      chalk.red(
        `Failed to start watch mode: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    console.error(
      chalk.yellow(
        "Note: Recursive watching may not be supported on all systems.",
      ),
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
    if (!args.quiet) {
      console.log(chalk.gray("\n\n👋 Watch mode stopped."));
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
