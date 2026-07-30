import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { detectProjectType, ProjectType } from "../core/detection/index.js";
import { ErrorCode, isError, LineCounterError } from "../core/errors.js";
import { exportReport, formatProjectType } from "../core/export/index.js";
import { groupByLanguage } from "../core/language/index.js";
import {
  findDuplicates,
  mergeSummaries,
  scanDirectory,
  scanFile,
} from "../core/scanner/index.js";
import type { Summary } from "../core/types.js";
import { detectWorkspaces } from "../core/workspace/workspace.js";
import { createLogger } from "../utils/logger.js";
import { UsageStatsTracker } from "../utils/metrics.js";
import { getPackageVersion } from "../utils/version.js";
import type { Args } from "./args.js";
import { initializeConfig } from "./config.js";
import { validateDirectory } from "./utils.js";
import { startWatchMode } from "./watch.js";

interface RunResult {
  partialErrors: number;
}

async function run(args: Args): Promise<RunResult | LineCounterError> {
  const logger = createLogger(args);

  if (args.version) {
    logger.info(`LocIO ${getPackageVersion()}`);
    return { partialErrors: 0 };
  }

  if (args.init) {
    const validation = validateDirectory(args.directory);
    if (validation.error) return validation.error;
    const targetDirectory = fs.statSync(validation.path).isFile()
      ? path.dirname(validation.path)
      : validation.path;
    const initialized = initializeConfig(targetDirectory, args.force);
    if (isError(initialized)) return initialized;
    logger.success(`Created ${initialized.path}`);
    return { partialErrors: 0 };
  }

  if (args.watch) {
    await startWatchMode(args);
    return { partialErrors: 0 };
  }

  let targetDirs = args.directories || [args.directory];

  if (args.workspaces) {
    const rootDir = targetDirs[0] || ".";
    const rootValidation = validateDirectory(rootDir);
    if (rootValidation.error) return rootValidation.error;

    const workspaceDirs = detectWorkspaces(rootValidation.path);
    if (workspaceDirs.length > 0) {
      logger.info(
        `${chalk.cyan("Detected")} ${chalk.yellow(workspaceDirs.length)} ${chalk.cyan("workspace packages")}\n`,
      );
      targetDirs = workspaceDirs;
    } else {
      logger.warn("No workspace packages found, scanning root directory.\n");
      targetDirs = [rootValidation.path];
    }
  }

  if (targetDirs.length === 1) {
    return runSingleDirectory(args, targetDirs[0]!, logger);
  }

  const summaryMap = new Map<string, Summary>();
  const usageTracker = !args.quiet ? new UsageStatsTracker() : null;
  let partialErrors = 0;

  for (const dir of targetDirs) {
    const validation = validateDirectory(dir);
    if (validation.error) {
      logger.warn(`Skipping ${dir}: ${validation.error.message}\n`);
      partialErrors += 1;
      continue;
    }

    const targetPath = validation.path;
    const dirStats = fs.statSync(targetPath);

    if (dirStats.isDirectory()) {
      const projectType = detectProjectType(targetPath);
      if (projectType !== ProjectType.Unknown) {
        logger.info(
          `${chalk.cyan(targetPath)}: ${chalk.blue.bold(formatProjectType(projectType))}`,
        );
      }
    }

    const dirArgs = { ...args, directory: targetPath };
    const result = dirStats.isFile()
      ? await scanFile(dirArgs)
      : await scanDirectory(dirArgs);

    if (isError(result)) {
      logger.warn(`Error scanning ${dir}: ${result.message}\n`);
      partialErrors += 1;
      continue;
    }

    result.by_language = groupByLanguage(result);

    if (args.duplicates && result.details.length > 0) {
      result.duplicate_groups = findDuplicates(result.details, targetPath);
    }

    summaryMap.set(targetPath, result);

    if (usageTracker) {
      usageTracker.trackScan(dirArgs, result);
    }
  }

  if (summaryMap.size === 0) {
    return LineCounterError.directoryNotFound(targetDirs.join(", "));
  }

  const { combined } = mergeSummaries(summaryMap);
  combined._errors = (combined._errors || 0) + partialErrors;

  if (args.rm_comments) {
    const affected = combined._commentsRemoved || 0;
    if (affected > 0) {
      logger.success(
        args.dry_run
          ? `\n○ Dry run: comments would be removed from ${affected} file(s).\n`
          : `\n✓ Comments removed successfully from ${affected} file(s)!\n`,
      );
    } else {
      logger.warn("\nℹ No comments found in any files.\n");
    }
    return { partialErrors: combined._errors || 0 };
  }

  combined.by_language = groupByLanguage(combined);
  if (args.duplicates && combined.details.length > 0) {
    combined.duplicate_groups = findDuplicates(
      combined.details,
      targetDirs[0]!,
    );
  }

  args.directories = targetDirs;
  const exportErrors = exportReport(combined, args);

  return {
    partialErrors: (combined._errors || 0) + exportErrors,
  };
}

async function runSingleDirectory(
  args: Args,
  dir: string,
  logger: ReturnType<typeof createLogger>,
): Promise<RunResult | LineCounterError> {
  const validation = validateDirectory(dir);
  if (validation.error) {
    return validation.error;
  }

  const targetPath = validation.path;
  const stats = fs.statSync(targetPath);
  let summary:
    Awaited<ReturnType<typeof scanDirectory>> | ReturnType<typeof scanFile>;

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
        args.dry_run
          ? `\n○ Dry run: comments would be removed from ${commentsRemoved} file(s).\n`
          : `\n✓ Comments removed successfully from ${commentsRemoved} file(s)!\n`,
      );
    } else {
      logger.warn("\nℹ No comments found in any files.\n");
    }
    return { partialErrors: summary._errors || 0 };
  }

  if (stats.isFile()) {
    summary = await scanFile(args);
  } else {
    summary = await scanDirectory(args);
  }

  if (isError(summary)) {
    return summary;
  }

  if (!isError(summary)) {
    summary.by_language = groupByLanguage(summary);

    if (args.duplicates && summary.details.length > 0) {
      summary.duplicate_groups = findDuplicates(summary.details, targetPath);
    }
  }

  if (usageTracker && !isError(summary)) {
    usageTracker.trackScan(args, summary);
  }

  const exportErrors = exportReport(summary, args);

  return {
    partialErrors: (summary._errors || 0) + exportErrors,
  };
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
    CONFIG_EXISTS: [
      "locio . --init              # Create config if absent",
      "locio . --init --force      # Overwrite existing config",
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
    process.exit(result.partialErrors > 0 ? 2 : 0);
  }
}
