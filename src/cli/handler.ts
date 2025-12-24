import * as fs from "fs";
import * as path from "path";
import pkg from "../../package.json";
import { LineCounterError, isError } from "../core/errors.js";
import { exportReport } from "../core/export.js";
import { scanDirectory } from "../core/scanner.js";
import type { Args } from "./args.js";

function run(args: Args): void | LineCounterError {
  if (args.version) {
    console.log(`LocIO ${pkg.version}`);
    return;
  }

  const dirPath = path.resolve(args.directory);

  if (!fs.existsSync(dirPath)) {
    return LineCounterError.directoryNotFound(args.directory);
  }

  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    return LineCounterError.notADirectory(args.directory);
  }

  const summary = scanDirectory({ ...args, directory: dirPath });
  if (isError(summary)) {
    return summary;
  }

  exportReport(summary, { ...args, directory: dirPath });

  return;
}

export function runWithExit(args: Args): void {
  const result = run(args);
  if (isError(result)) {
    console.error(`Error: ${result.message}`);
    process.exit(1);
  }
  process.exit(0);
}
