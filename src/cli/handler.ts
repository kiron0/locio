import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { isError, LineCounterError } from "../core/errors.js";
import { exportReport, formatProjectType } from "../core/export.js";
import { detectProjectType, ProjectType } from "../core/project-type.js";
import { scanDirectory, scanFile } from "../core/scanner.js";
import { getPackageVersion } from "../utils/version.js";
import type { Args } from "./args.js";
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

  const targetPath = path.resolve(args.directory);

  if (!fs.existsSync(targetPath)) {
    return LineCounterError.directoryNotFound(args.directory);
  }

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

  if (stats.isFile()) {
    summary = scanFile({ ...args, directory: targetPath });
  } else if (stats.isDirectory()) {
    summary = scanDirectory({ ...args, directory: targetPath });
  } else {
    return LineCounterError.notADirectory(args.directory);
  }

  if (isError(summary)) {
    return summary;
  }

  exportReport(summary, { ...args, directory: targetPath });

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
