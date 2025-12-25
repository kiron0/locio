import { Command } from "commander";
import { getPackageVersion } from "../utils/version.js";

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
    export: (() => {
      if (options.export === undefined) {
        return undefined;
      }
      if (options.export === true) {
        return OutputFormat.Human;
      }
      const exportStr = options.export as string;
      if (exportStr.includes(",")) {
        const formats = exportStr
          .split(",")
          .map((f) => f.trim().toLowerCase())
          .map((f) => {
            if (f === "json") return OutputFormat.Json;
            if (f === "csv") return OutputFormat.Csv;
            if (f === "tsv") return OutputFormat.Tsv;
            if (f === "markdown" || f === "md") return OutputFormat.Markdown;
            if (f === "html") return OutputFormat.Html;
            if (f === "human" || f === "txt") return OutputFormat.Human;
            return null;
          })
          .filter((f): f is OutputFormat => f !== null);
        return formats.length > 0 ? formats : undefined;
      }
      const lower = exportStr.toLowerCase();
      if (lower === "json") return OutputFormat.Json;
      if (lower === "csv") return OutputFormat.Csv;
      if (lower === "tsv") return OutputFormat.Tsv;
      if (lower === "markdown" || lower === "md") return OutputFormat.Markdown;
      if (lower === "html") return OutputFormat.Html;
      return OutputFormat.Human;
    })(),
    export_path: options.exportPath,
    version: false,
    watch: options.watch || false,
    comments:
      options.comments || options.codeVsComments || options.stats || false,
    code_vs_comments: options.codeVsComments || false,
    top_files: options.topFiles,
    top_dirs: options.topDirs,
  };
}
