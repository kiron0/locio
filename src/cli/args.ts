import { Command } from "commander";
import { getPackageVersion } from "../utils/version.js";
import {
  arrayAccumulator,
  parseCommaSeparated,
  parseOutputFormat,
} from "./utils.js";

export enum OutputFormat {
  Human = "human",
  Json = "json",
  Csv = "csv",
  Tsv = "tsv",
  Markdown = "markdown",
  Html = "html",
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
  export?: OutputFormat | OutputFormat[];
  export_path?: string;
  version: boolean;
  watch: boolean;
  comments: boolean;
  code_vs_comments: boolean;
  rm_comments: boolean | string;
  top_files?: number;
  top_dirs?: number;
}

export function createCommand(): Command {
  const program = new Command();

  program
    .name("LocIO")
    .description("A powerful CLI tool to count lines and files in directories")
    .version(getPackageVersion(), "-v, --version", "Show version number")
    .argument("[directory]", "Directory to scan", ".")
    .option("-f, --files-only", "Count only files")
    .option("-l, --lines-only", "Count only lines")
    .option(
      "-e, --exclude <pattern>",
      "Exclude files matching pattern",
      arrayAccumulator,
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
      arrayAccumulator,
    )
    .option(
      "--include-dir <pattern>",
      "Include only directories matching pattern",
      arrayAccumulator,
    )
    .option(
      "--exclude-name <pattern>",
      "Exclude files by name pattern",
      arrayAccumulator,
    )
    .option(
      "--include-name <pattern>",
      "Include only files by name pattern",
      arrayAccumulator,
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
      "Write report to LocIO-report.{ext} in the given format (human, json, csv, tsv, markdown, html). Multiple formats can be specified comma-separated (e.g., json,html,markdown)",
    )
    .option(
      "--export-path <dir>",
      "Specify output directory for exported reports. Files will use default naming (LocIO-report.{ext}). Directories will be created automatically if they don't exist",
    )
    .option("-w, --watch", "Watch directory for changes and auto-rescan")
    .option("--comments", "Count comment lines separately")
    .option(
      "--code-vs-comments",
      "Show code vs comments ratio (automatically enables --comments)",
    )
    .option(
      "--rm-comments [extensions]",
      "Remove comments from files (modifies files in place). Optionally specify file extensions (comma-separated, e.g., js,ts,py). If no extensions specified, all files are processed.",
    )
    .option("--top-files <n>", "Show top N largest files by size", parseInt)
    .option(
      "--top-dirs <n>",
      "Show top N directories with most files",
      parseInt,
    );

  return program;
}

export function parseArgs(): Args {
  const program = createCommand();
  program.parse();

  const options = program.opts();
  const args = program.args;

  const excludeExt = options.excludeExt
    ? parseCommaSeparated(options.excludeExt)
    : [];
  const includeExt = options.includeExt
    ? parseCommaSeparated(options.includeExt)
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
    export: parseOutputFormat(options.export),
    export_path: options.exportPath,
    version: false,
    watch: options.watch || false,
    comments:
      options.comments || options.codeVsComments || options.stats || false,
    code_vs_comments: options.codeVsComments || false,
    rm_comments: (() => {
      if (!options.rmComments) return false;
      if (options.rmComments === true) return true;
      return options.rmComments as string;
    })(),
    top_files: options.topFiles,
    top_dirs: options.topDirs,
  };
}
