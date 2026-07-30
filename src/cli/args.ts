import { Command, InvalidArgumentError } from "commander";
import { getPackageVersion } from "../utils/version.js";
import { loadConfig, mergeConfigIntoArgs } from "./config.js";
import {
  arrayAccumulator,
  parseCommaSeparated,
  parseNonNegativeIntegerStrict,
  parseOutputFormatStrict,
  parseSingleOutputFormatStrict,
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
  collect_details?: boolean;
  max_details?: number;
  watch_debounce?: number;
  duplicates?: boolean;
  workspaces?: boolean;
  directories?: string[];
  dry_run?: boolean;
  stdout?: OutputFormat;
  explain?: boolean;
  init?: boolean;
  force?: boolean;
  use_gitignore?: boolean;
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
    const row = matrix[0];
    if (row) {
      row[j] = j;
    }
  }
  for (let i = 1; i <= str2.length; i++) {
    const currentRow = matrix[i];
    if (!currentRow) continue;
    for (let j = 1; j <= str1.length; j++) {
      const prevRow = matrix[i - 1];
      if (!prevRow) continue;
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        currentRow[j] = prevRow[j - 1] ?? 0;
      } else {
        currentRow[j] = Math.min(
          (prevRow[j - 1] ?? 0) + 1,
          (currentRow[j - 1] ?? 0) + 1,
          (prevRow[j] ?? 0) + 1,
        );
      }
    }
  }
  const finalRow = matrix[str2.length];
  return finalRow?.[str1.length] ?? 0;
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
    "stdout",
    "explain",
    "init",
    "force",
    "no-gitignore",
    "dry-run",
    "watch",
    "no-comments",
    "code-vs-comments",
    "rm-comments",
    "top-files",
    "top-dirs",
    "duplicates",
    "workspaces",
    "version",
  ];

  program.configureOutput({
    writeErr: (str: string) => {
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
    .argument(
      "[directories...]",
      "Directories to scan (default: current directory)",
    )
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
    .option(
      "--max-depth <depth>",
      "Maximum directory depth",
      parseNonNegativeIntegerStrict,
    )
    .option("--stats", "Show detailed statistics")
    .option("--no-progress", "Disable progress indicator (enabled by default)")
    .option("--no-binary", "Exclude binary files")
    .option("-i, --ignore-case", "Case-insensitive pattern matching")
    .option("-q, --quiet", "Quiet mode (minimal output)")
    .option(
      "--export [format]",
      "Write report to LocIO-report.{ext} in the given format (human, json, csv, tsv, markdown, html). Multiple formats can be specified comma-separated (e.g., json,html,markdown)",
      parseOutputFormatStrict,
    )
    .option(
      "--export-path <dir>",
      "Specify output directory for exported reports. Files will use default naming (LocIO-report.{ext}). Directories will be created automatically if they don't exist",
    )
    .option(
      "--stdout <format>",
      "Print one report format to stdout (human, json, csv, tsv, markdown, html)",
      parseSingleOutputFormatStrict,
    )
    .option("--explain", "Show why files were excluded")
    .option("--init", "Create a .lociorc.json configuration file")
    .option("--force", "Overwrite an existing file when used with --init")
    .option("--no-gitignore", "Do not apply .gitignore rules")
    .option("-w, --watch", "Watch directory for changes and auto-rescan")
    .option(
      "--watch-debounce <ms>",
      "Debounce delay for watch mode in milliseconds (default: 500, min: 100, max: 5000)",
      parseNonNegativeIntegerStrict,
    )
    .option("--no-comments", "Disable comment counting (enabled by default)")
    .option(
      "--code-vs-comments",
      "Show code vs comments ratio (automatically enables --comments)",
    )
    .option(
      "--rm-comments [extensions]",
      "Remove comments from files (modifies files in place). Optionally specify file extensions (comma-separated, e.g., js,ts,py). If no extensions specified, all files are processed.",
    )
    .option("--dry-run", "Preview --rm-comments changes without writing files")
    .option(
      "--top-files <n>",
      "Show top N largest files by size",
      parseNonNegativeIntegerStrict,
    )
    .option(
      "--top-dirs <n>",
      "Show top N directories with most files",
      parseNonNegativeIntegerStrict,
    )
    .option("--duplicates", "Detect duplicate files by content hash")
    .option(
      "--workspaces",
      "Auto-detect and scan workspace packages (npm/yarn/pnpm)",
    );

  return program;
}

export function parseArgs(argv?: string[]): Args {
  const program = createCommand();
  if (argv) {
    program.parse(argv, { from: "user" });
  } else {
    program.parse();
  }

  const options = program.opts();
  const positionalArgs = program.args;

  const excludeExt = options["excludeExt"]
    ? parseCommaSeparated(options["excludeExt"] as string)
    : [];
  const includeExt = options["includeExt"]
    ? parseCommaSeparated(options["includeExt"] as string)
    : [];

  const directories = positionalArgs.length > 0 ? positionalArgs : ["."];
  const primaryDirectory = directories[0] || ".";

  const cliArgs: Args = {
    directory: primaryDirectory,
    directories,
    files_only: (options["filesOnly"] as boolean) || false,
    lines_only: (options["linesOnly"] as boolean) || false,
    exclude_patterns: (options["exclude"] as string[]) || [],
    exclude_extensions: excludeExt,
    include_extensions: includeExt,
    exclude_dirs: (options["excludeDir"] as string[]) || [],
    include_dirs: (options["includeDir"] as string[]) || [],
    exclude_names: (options["excludeName"] as string[]) || [],
    include_names: (options["includeName"] as string[]) || [],
    max_size: options["maxSize"] as string | undefined,
    min_size: options["minSize"] as string | undefined,
    no_hidden: options["hidden"] === false,
    no_empty: options["empty"] === false,
    follow_links: (options["followLinks"] as boolean) || false,
    max_depth: options["maxDepth"] as number | undefined,
    show_stats: (options["stats"] as boolean) || false,
    show_progress: options["progress"] !== false,
    no_binary: options["binary"] === false,
    ignore_case: (options["ignoreCase"] as boolean) || false,
    quiet: (options["quiet"] as boolean) || false,
    export: options["export"] as OutputFormat | OutputFormat[] | undefined,
    export_path: options["exportPath"] as string | undefined,
    stdout: options["stdout"] as OutputFormat | undefined,
    explain: (options["explain"] as boolean) || false,
    init: (options["init"] as boolean) || false,
    force: (options["force"] as boolean) || false,
    use_gitignore: options["gitignore"] !== false,
    version: false,
    watch: (options["watch"] as boolean) || false,
    watch_debounce: options["watchDebounce"] as number | undefined,
    comments: options["comments"] !== false,
    code_vs_comments: (options["codeVsComments"] as boolean) || false,
    rm_comments: (() => {
      const rmComments = options["rmComments"];
      if (!rmComments) return false;
      if (rmComments === true) return true;
      return rmComments as string;
    })(),
    dry_run: (options["dryRun"] as boolean) || false,
    top_files: options["topFiles"] as number | undefined,
    top_dirs: options["topDirs"] as number | undefined,
    duplicates: (options["duplicates"] as boolean) || false,
    workspaces: (options["workspaces"] as boolean) || false,
  };

  const explicitCliKeys = new Set<string>();
  const optionMapping: Record<string, string> = {
    filesOnly: "files_only",
    linesOnly: "lines_only",
    exclude: "exclude_patterns",
    excludeExt: "exclude_extensions",
    includeExt: "include_extensions",
    excludeDir: "exclude_dirs",
    includeDir: "include_dirs",
    excludeName: "exclude_names",
    includeName: "include_names",
    maxSize: "max_size",
    minSize: "min_size",
    hidden: "no_hidden",
    empty: "no_empty",
    followLinks: "follow_links",
    maxDepth: "max_depth",
    stats: "show_stats",
    progress: "show_progress",
    binary: "no_binary",
    ignoreCase: "ignore_case",
    quiet: "quiet",
    export: "export",
    exportPath: "export_path",
    stdout: "stdout",
    explain: "explain",
    init: "init",
    force: "force",
    gitignore: "use_gitignore",
    watch: "watch",
    watchDebounce: "watch_debounce",
    comments: "comments",
    codeVsComments: "code_vs_comments",
    rmComments: "rm_comments",
    dryRun: "dry_run",
    topFiles: "top_files",
    topDirs: "top_dirs",
    duplicates: "duplicates",
    workspaces: "workspaces",
  };

  for (const opt of program.options) {
    const key = opt.attributeName();
    if (program.getOptionValueSource(key) === "cli") {
      const mappedKey = optionMapping[key] || key;
      explicitCliKeys.add(mappedKey);
    }
  }

  if (positionalArgs.length > 0) {
    explicitCliKeys.add("directory");
    explicitCliKeys.add("directories");
  }

  const configArgs = loadConfig(primaryDirectory);
  const args = configArgs
    ? mergeConfigIntoArgs(cliArgs, configArgs, explicitCliKeys)
    : cliArgs;

  if (args.code_vs_comments) {
    args.comments = true;
  }

  if (args.dry_run && !args.rm_comments) {
    throw new InvalidArgumentError("--dry-run requires --rm-comments");
  }

  if (args.force && !args.init) {
    throw new InvalidArgumentError("--force requires --init");
  }

  return args;
}
