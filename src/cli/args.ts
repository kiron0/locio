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

function similarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

function findSimilarOptions(
  unknownOption: string,
  availableOptions: string[],
  maxSuggestions: number = 3,
): string[] {
  const similarities = availableOptions.map((opt) => ({
    option: opt,
    score: similarity(unknownOption, opt),
  }));

  return similarities
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0.3)
    .slice(0, maxSuggestions)
    .map((item) => item.option);
}

export function createCommand(): Command {
  const program = new Command();

  const availableOptions = [
    "files-only",
    "lines-only",
    "exclude",
    "exclude-ext",
    "include-ext",
    "exclude-dir",
    "include-dir",
    "exclude-name",
    "include-name",
    "max-size",
    "min-size",
    "no-hidden",
    "no-empty",
    "follow-links",
    "max-depth",
    "stats",
    "no-progress",
    "no-binary",
    "ignore-case",
    "quiet",
    "export",
    "export-path",
    "watch",
    "no-comments",
    "code-vs-comments",
    "rm-comments",
    "top-files",
    "top-dirs",
    "version",
  ];

  program.configureOutput({
    writeErr: (str) => {
      if (str.includes("unknown option")) {
        const match = str.match(/unknown option ['"]--?([^'"]+)['"]/);
        if (match) {
          const unknownOption = match[1];

          const similarOptions = findSimilarOptions(
            unknownOption,
            availableOptions,
          );

          if (similarOptions.length > 0) {
            const suggestionsText =
              similarOptions.length === 1
                ? "Did you mean this?"
                : "Did you mean one of these?";
            process.stderr.write(
              `\n❌ Unknown option: '--${unknownOption}'\n\n` +
                `💡 ${suggestionsText}\n` +
                similarOptions.map((opt) => `   • --${opt}`).join("\n") +
                `\n\n` +
                `Run 'locio --help' to see all available options.\n\n`,
            );
            process.exit(1);
          }

          process.stderr.write(
            `\n❌ Unknown option: '--${unknownOption}'\n\n` +
              `💡 This option doesn't exist. Run 'locio --help' to see all available options.\n\n`,
          );
          process.exit(1);
        }
      }
      process.stderr.write(str);
    },
  });

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
    .option("--no-progress", "Disable progress indicator (enabled by default)")
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
    .option("--no-comments", "Disable comment counting (enabled by default)")
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
    show_progress: options.noProgress !== true,
    no_binary: options.noBinary || false,
    ignore_case: options.ignoreCase || false,
    quiet: options.quiet || false,
    export: parseOutputFormat(options.export),
    export_path: options.exportPath,
    version: false,
    watch: options.watch || false,
    comments: options.noComments !== true,
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
