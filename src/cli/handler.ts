import chalk from "chalk";
import * as fs from "fs";
import { detectProjectType, ProjectType } from "../core/detection/index.js";
import { isError, LineCounterError } from "../core/errors.js";
import { exportReport, formatProjectType } from "../core/export/index.js";
import { scanDirectory, scanFile } from "../core/scanner/index.js";
import { getPackageVersion } from "../utils/version.js";
import type { Args } from "./args.js";
import { validateDirectory } from "./utils.js";
import { startWatchMode } from "./watch.js";

function run(args: Args): void | LineCounterError {
  if (args.version) {
    console.log(`LocIO ${getPackageVersion()}`);
    return;
  }

  if (args.watch) {
    startWatchMode(args);
    return;
  }

  const validation = validateDirectory(args.directory);
  if (validation.error) {
    return validation.error;
  }

  const targetPath = validation.path;
  const stats = fs.statSync(targetPath);
  let summary: ReturnType<typeof scanDirectory>;

  if (stats.isDirectory() && !args.quiet) {
    const projectType = detectProjectType(targetPath);
    if (projectType !== ProjectType.Unknown) {
      console.log(
        `${chalk.cyan("Detected project type:")} ${chalk.blue.bold(formatProjectType(projectType))}\n`,
      );
    }
  }

  args.directory = targetPath;

  if (args.rm_comments) {
    if (!args.quiet) {
      console.log(chalk.cyan("Removing comments from files...\n"));
    }
    if (stats.isFile()) {
      summary = scanFile(args);
    } else {
      summary = scanDirectory(args);
    }

    if (isError(summary)) {
      return summary;
    }

    const commentsRemoved = (summary as any)._commentsRemoved || 0;
    if (!args.quiet) {
      if (commentsRemoved > 0) {
        console.log(
          chalk.green(
            `\n✓ Comments removed successfully from ${commentsRemoved} file(s)!\n`,
          ),
        );
      } else {
        console.log(chalk.yellow("\nℹ No comments found in any files.\n"));
      }
    }
    return;
  }

  if (stats.isFile()) {
    summary = scanFile(args);
  } else {
    summary = scanDirectory(args);
  }

  if (isError(summary)) {
    return summary;
  }

  exportReport(summary, args);

  return;
}

function formatError(error: LineCounterError): string {
  let message = `\n❌ Error: ${error.message}\n`;
  if (error.suggestion) {
    message += `\n💡 Suggestion:\n${error.suggestion}\n`;
  }
  if (error.cause) {
    message += `\n📋 Details: ${error.cause.message}\n`;
  }
  return message;
}

export function runWithExit(args: Args): void {
  const result = run(args);
  if (isError(result)) {
    console.error(formatError(result));
    process.exit(1);
  }
  if (!args.watch) {
    process.exit(0);
  }
}
