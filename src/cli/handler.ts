import chalk from "chalk";
import * as fs from "fs";
import { detectProjectType, ProjectType } from "../core/detection/index.js";
import { ErrorCode, isError, LineCounterError } from "../core/errors.js";
import { exportReport, formatProjectType } from "../core/export/index.js";
import { scanDirectory, scanFile } from "../core/scanner/index.js";
import { createLogger } from "../utils/logger.js";
import { UsageStatsTracker } from "../utils/metrics.js";
import { getPackageVersion } from "../utils/version.js";
import type { Args } from "./args.js";
import { validateDirectory } from "./utils.js";
import { startWatchMode } from "./watch.js";

async function run(args: Args): Promise<void | LineCounterError> {
  const logger = createLogger(args);

  if (args.version) {
    logger.info(`LocIO ${getPackageVersion()}`);
    return;
  }

  if (args.watch) {
    await startWatchMode(args);
    return;
  }

  const validation = validateDirectory(args.directory);
  if (validation.error) {
    return validation.error;
  }

  const targetPath = validation.path;
  const stats = fs.statSync(targetPath);
  let summary:
    | Awaited<ReturnType<typeof scanDirectory>>
    | ReturnType<typeof scanFile>;

  if (stats.isDirectory()) {
    const projectType = detectProjectType(targetPath);
    if (projectType !== ProjectType.Unknown) {
      logger.info(
        `${chalk.cyan("Detected project type:")} ${chalk.blue.bold(formatProjectType(projectType))}\n`,
      );
    }
  }

  args.directory = targetPath;

  const usageTracker = !args.quiet ? new UsageStatsTracker() : null;

  if (args.rm_comments) {
    logger.info(chalk.cyan("Removing comments from files...\n"));
    if (stats.isFile()) {
      summary = await scanFile(args);
    } else {
      summary = await scanDirectory(args);
    }

    if (isError(summary)) {
      return summary;
    }

    const commentsRemoved = summary._commentsRemoved || 0;
    if (commentsRemoved > 0) {
      logger.success(
        `\n✓ Comments removed successfully from ${commentsRemoved} file(s)!\n`,
      );
    } else {
      logger.warn("\nℹ No comments found in any files.\n");
    }
    return;
  }

  if (stats.isFile()) {
    summary = await scanFile(args);
  } else {
    summary = await scanDirectory(args);
  }

  if (isError(summary)) {
    return summary;
  }

  if (usageTracker && !isError(summary)) {
    usageTracker.trackScan(args, summary);
  }

  exportReport(summary, args);

  return;
}

function formatError(error: LineCounterError): string {
  let message = `\n${chalk.red.bold("❌ Error:")} ${chalk.white(error.message)}\n`;

  if (error.filePath) {
    message += `${chalk.gray("📍 File:")} ${chalk.white(error.filePath)}\n`;
  }

  if (error.suggestion) {
    message += `\n${chalk.yellow.bold("💡 Suggestion:")}\n${chalk.yellow(error.suggestion)}\n`;
  }

  const examples = getErrorExamples(error.code);
  if (examples.length > 0) {
    message += `\n${chalk.cyan.bold("📝 Example Commands:")}\n`;
    examples.forEach((example) => {
      message += `  ${chalk.gray("$")} ${chalk.white(example)}\n`;
    });
  }

  message += `\n${chalk.blue("📖 Documentation:")} ${chalk.underline("https://locio.js.org")}\n`;

  if (
    error.cause &&
    typeof error.cause === "object" &&
    "message" in error.cause
  ) {
    message += `\n${chalk.gray("📋 Details:")} ${chalk.gray(String(error.cause.message))}\n`;
  }

  return message;
}

function getErrorExamples(code: ErrorCode): string[] {
  const examples: Record<string, string[]> = {
    DIRECTORY_NOT_FOUND: [
      "locio .                    # Scan current directory",
      "locio ./src                # Scan specific directory",
      "locio /path/to/directory   # Scan absolute path",
    ],
    FILE_NOT_FOUND: [
      "locio ./file.ts            # Scan a specific file",
      "locio src/index.ts         # Scan file with relative path",
    ],
    NOT_A_DIRECTORY: [
      "locio ./file.ts            # Use file path directly",
      "locio .                    # Use current directory instead",
    ],
    INVALID_SIZE_FORMAT: [
      "locio . --max-size 5MB     # Valid: number + unit",
      "locio . --min-size 1KB     # Valid: KB, MB, GB, TB",
    ],
    INVALID_REGEX: [
      "locio . --exclude 'node_modules'  # Simple pattern",
      "locio . --exclude '.*\\.log$'     # Escaped regex",
    ],
    EXPORT_PATH_ERROR: [
      "locio . --export json                    # Export to default location",
      "locio . --export json --export-path ./reports  # Custom path",
    ],
  };

  return examples[code] || [];
}

export async function runWithExit(args: Args): Promise<void> {
  const result = await run(args);
  if (isError(result)) {
    console.error(formatError(result));
    process.exit(1);
  }
  if (!args.watch) {
    process.exit(0);
  }
}
