import fastGlob from "fast-glob";
import * as fs from "fs";
import ignore from "ignore";
import * as path from "path";
import type { Args } from "../cli/args.js";
import { countLines } from "../utils/files.js";
import { LineCounterError, isError } from "./errors.js";
import { createFilterPatterns, shouldExcludeFile } from "./filter.js";
import type { Summary } from "./types.js";
import { createSummary } from "./types.js";

function buildIgnoreInstance(dirPath: string): ignore.Ignore {
  const ig = ignore();
  ig.add(".git");
  ig.add(".gitignore");
  ig.add(".lcignore");

  function readGitignoreFiles(currentDir: string, baseDir: string) {
    const gitignorePath = path.join(currentDir, ".gitignore");
    try {
      if (fs.existsSync(gitignorePath) && fs.statSync(gitignorePath).isFile()) {
        const content = fs.readFileSync(gitignorePath, "utf-8");
        const relativeDir = path.relative(baseDir, currentDir) || ".";
        const rules = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"));
        for (const rule of rules) {
          if (relativeDir === ".") {
            ig.add(rule);
          } else {
            ig.add(path.join(relativeDir, rule));
          }
        }
      }
    } catch {}

    try {
      const entries = fs.readdirSync(currentDir);
      for (const entry of entries) {
        const entryPath = path.join(currentDir, entry);
        try {
          if (fs.statSync(entryPath).isDirectory() && entry !== ".git") {
            readGitignoreFiles(entryPath, baseDir);
          }
        } catch {}
      }
    } catch {}
  }

  readGitignoreFiles(dirPath, dirPath);
  return ig;
}

export function scanDirectory(args: Args): Summary | LineCounterError {
  const startTime = Date.now();
  const summary = createSummary();

  const patterns = createFilterPatterns(args);
  if (isError(patterns)) {
    return patterns;
  }

  const ig = buildIgnoreInstance(args.directory);

  const globPattern = path.join(args.directory, "**/*");
  const options: any = {
    cwd: args.directory,
    absolute: true,
    onlyFiles: true,
    ignore: [],
    dot: !args.no_hidden,
    followSymbolicLinks: args.follow_links,
  };

  let processed = 0;
  let errors = 0;

  try {
    const entries = fastGlob.sync(globPattern, options);
    const files: string[] = entries.map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      return (entry as any).path || String(entry);
    });

    for (const filePath of files) {
      if (args.max_depth !== undefined) {
        const relativePath = path.relative(args.directory, filePath);
        const depth = relativePath.split(path.sep).length - 1;
        if (depth > args.max_depth) {
          continue;
        }
      }

      const relativePath = path.relative(args.directory, filePath);
      if (ig.ignores(relativePath)) {
        continue;
      }

      try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
          continue;
        }
      } catch {
        continue;
      }

      if (shouldExcludeFile(filePath, args, patterns)) {
        continue;
      }

      processed += 1;

      if (args.show_progress && processed % 100 === 0 && !args.quiet) {
        process.stderr.write(`\rProcessed: ${processed} files...`);
      }

      let metadata: fs.Stats;
      try {
        metadata = fs.statSync(filePath);
      } catch (e) {
        if (!args.quiet) {
          console.error(
            `Warning: Could not read metadata for ${filePath}: ${e}`,
          );
        }
        errors += 1;
        continue;
      }

      const size = metadata.size;
      const ext =
        path.extname(filePath).replace(/^\./, "").toLowerCase() || "no-ext";

      summary.total_files += 1;
      summary.total_size += size;

      summary.files_by_extension[ext] =
        (summary.files_by_extension[ext] || 0) + 1;
      summary.size_by_extension[ext] =
        (summary.size_by_extension[ext] || 0) + size;

      let linesOpt: number | null = null;

      if (!args.files_only) {
        const lines = countLines(filePath, args.include_blank);
        if (isError(lines)) {
          if (!args.quiet) {
            console.error(
              `Warning: Could not count lines in ${filePath}: ${lines.message}`,
            );
          }
          errors += 1;
        } else {
          linesOpt = lines;
          summary.total_lines += lines;
          summary.lines_by_extension[ext] =
            (summary.lines_by_extension[ext] || 0) + lines;
        }
      }

      const directory = path.dirname(filePath);
      const name = path.basename(filePath);

      summary.details.push({
        directory,
        name,
        extension: ext,
        size,
        lines: linesOpt,
      });
    }
  } catch (e) {
    return LineCounterError.io(
      `Failed to scan directory: ${e instanceof Error ? e.message : String(e)}`,
      e instanceof Error ? e : undefined,
    );
  }

  if (args.show_progress && !args.quiet) {
    const elapsed = Date.now() - startTime;
    const elapsedStr = `${elapsed}ms`;
    process.stderr.write(
      `\rProcessed: ${processed} files (${errors} errors) in ${elapsedStr}\n`,
    );
  }

  return summary;
}
