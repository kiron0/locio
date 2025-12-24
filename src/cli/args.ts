import { Command } from "commander";
import pkg from "../../package.json";

export enum OutputFormat {
  Human = "human",
  Json = "json",
  Csv = "csv",
  Tsv = "tsv",
}

export interface Args {
  directory: string;
  files_only: boolean;
  lines_only: boolean;
  exclude_patterns: string[];
  exclude_extensions: string[];
  include_extensions: string[];
  exclude_dirs: string[];
  include_dirs: string[];
  exclude_names: string[];
  include_names: string[];
  max_size?: string;
  min_size?: string;
  no_hidden: boolean;
  no_empty: boolean;
  follow_links: boolean;
  max_depth?: number;
  show_stats: boolean;
  show_progress: boolean;
  include_blank: boolean;
  no_binary: boolean;
  ignore_case: boolean;
  quiet: boolean;
  export?: OutputFormat;
  version: boolean;
}

export function createCommand(): Command {
  const program = new Command();

  program
    .name("LocIO")
    .description("A powerful CLI tool to count lines and files in directories")
    .version(pkg.version, "-v, --version", "Show version number")
    .argument("[directory]", "Directory to scan", ".")
    .option("-f, --files-only", "Count only files")
    .option("-l, --lines-only", "Count only lines")
    .option(
      "-e, --exclude <pattern>",
      "Exclude files matching pattern",
      (val, prev) => {
        return prev && Array.isArray(prev) ? [...prev, val] : [val];
      },
    )
    .option(
      "--exclude-ext <extensions>",
      "Exclude file extensions (comma-separated)",
    )
    .option(
      "--include-ext <extensions>",
      "Include only file extensions (comma-separated)",
    )
    .option(
      "--exclude-dir <pattern>",
      "Exclude directories matching pattern",
      (val, prev) => {
        return prev && Array.isArray(prev) ? [...prev, val] : [val];
      },
    )
    .option(
      "--include-dir <pattern>",
      "Include only directories matching pattern",
      (val, prev) => {
        return prev && Array.isArray(prev) ? [...prev, val] : [val];
      },
    )
    .option(
      "--exclude-name <pattern>",
      "Exclude files by name pattern",
      (val, prev) => {
        return prev && Array.isArray(prev) ? [...prev, val] : [val];
      },
    )
    .option(
      "--include-name <pattern>",
      "Include only files by name pattern",
      (val, prev) => {
        return prev && Array.isArray(prev) ? [...prev, val] : [val];
      },
    )
    .option("--max-size <size>", "Maximum file size (e.g., 5MB)")
    .option("--min-size <size>", "Minimum file size (e.g., 1KB)")
    .option("--no-hidden", "Exclude hidden files")
    .option("--no-empty", "Exclude empty files")
    .option("--follow-links", "Follow symbolic links")
    .option("--max-depth <depth>", "Maximum directory depth", parseInt)
    .option("--stats", "Show detailed statistics")
    .option("-p, --progress", "Show progress")
    .option("--include-blank", "Include blank lines in count")
    .option("--no-binary", "Exclude binary files")
    .option("-i, --ignore-case", "Case-insensitive pattern matching")
    .option("-q, --quiet", "Quiet mode (minimal output)")
    .option(
      "--export [format]",
      "Write report to LocIO-report.{ext} in the given format (human, json, csv, tsv)",
    );

  return program;
}

export function parseArgs(): Args {
  const program = createCommand();
  program.parse();

  const options = program.opts();
  const args = program.args;

  const excludeExt = options.excludeExt
    ? options.excludeExt.split(",").map((e: string) => e.trim())
    : [];
  const includeExt = options.includeExt
    ? options.includeExt.split(",").map((e: string) => e.trim())
    : [];

  return {
    directory: args[0] || ".",
    files_only: options.filesOnly || false,
    lines_only: options.linesOnly || false,
    exclude_patterns: options.exclude || [],
    exclude_extensions: excludeExt,
    include_extensions: includeExt,
    exclude_dirs: options.excludeDir || [],
    include_dirs: options.includeDir || [],
    exclude_names: options.excludeName || [],
    include_names: options.includeName || [],
    max_size: options.maxSize,
    min_size: options.minSize,
    no_hidden: options.noHidden || false,
    no_empty: options.noEmpty || false,
    follow_links: options.followLinks || false,
    max_depth: options.maxDepth,
    show_stats: options.stats || false,
    show_progress: options.progress || false,
    include_blank: options.includeBlank || false,
    no_binary: options.noBinary || false,
    ignore_case: options.ignoreCase || false,
    quiet: options.quiet || false,
    export:
      options.export !== undefined
        ? options.export === true
          ? OutputFormat.Human
          : (options.export as string).toLowerCase() === "json"
            ? OutputFormat.Json
            : (options.export as string).toLowerCase() === "csv"
              ? OutputFormat.Csv
              : (options.export as string).toLowerCase() === "tsv"
                ? OutputFormat.Tsv
                : OutputFormat.Human
        : undefined,
    version: false,
  };
}
