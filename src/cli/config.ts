import * as fs from "fs";
import * as path from "path";
import type { Args } from "./args.js";
import { parseOutputFormat } from "./utils.js";

export interface LocIOConfig {
  exclude_patterns?: string[];
  exclude_extensions?: string[];
  include_extensions?: string[];
  exclude_dirs?: string[];
  include_dirs?: string[];
  exclude_names?: string[];
  include_names?: string[];
  max_size?: string;
  min_size?: string;
  no_hidden?: boolean;
  no_empty?: boolean;
  follow_links?: boolean;
  max_depth?: number;
  stats?: boolean;
  no_progress?: boolean;
  no_binary?: boolean;
  ignore_case?: boolean;
  quiet?: boolean;
  export?: string;
  export_path?: string;
  watch?: boolean;
  watch_debounce?: number;
  comments?: boolean;
  code_vs_comments?: boolean;
  top_files?: number;
  top_dirs?: number;
  duplicates?: boolean;
  workspaces?: boolean;
}

const CONFIG_FILES = [".lociorc.json", "locio.config.json"] as const;

export function loadConfig(startDir: string): Partial<Args> | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (true) {
    for (const filename of CONFIG_FILES) {
      const filePath = path.join(dir, filename);
      const config = readJsonFile(filePath);
      if (config) {
        return mapConfigToArgs(config);
      }
    }

    const pkgPath = path.join(dir, "package.json");
    const pkg = readJsonFile(pkgPath);
    if (pkg && typeof pkg === "object" && "locio" in pkg) {
      const locioConfig = (pkg as Record<string, unknown>)["locio"];
      if (locioConfig && typeof locioConfig === "object") {
        return mapConfigToArgs(locioConfig as LocIOConfig);
      }
    }

    const parentDir = path.dirname(dir);
    if (parentDir === dir || parentDir === root) {
      break;
    }
    dir = parentDir;
  }

  return null;
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function mapConfigToArgs(config: LocIOConfig): Partial<Args> {
  const args: Partial<Args> = {};
  const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === "string");
  const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

  if (isStringArray(config.exclude_patterns))
    args.exclude_patterns = config.exclude_patterns;
  if (isStringArray(config.exclude_extensions))
    args.exclude_extensions = config.exclude_extensions;
  if (isStringArray(config.include_extensions))
    args.include_extensions = config.include_extensions;
  if (isStringArray(config.exclude_dirs))
    args.exclude_dirs = config.exclude_dirs;
  if (isStringArray(config.include_dirs))
    args.include_dirs = config.include_dirs;
  if (isStringArray(config.exclude_names))
    args.exclude_names = config.exclude_names;
  if (isStringArray(config.include_names))
    args.include_names = config.include_names;
  if (typeof config.max_size === "string") args.max_size = config.max_size;
  if (typeof config.min_size === "string") args.min_size = config.min_size;
  if (typeof config.no_hidden === "boolean") args.no_hidden = config.no_hidden;
  if (typeof config.no_empty === "boolean") args.no_empty = config.no_empty;
  if (typeof config.follow_links === "boolean")
    args.follow_links = config.follow_links;
  if (isNonNegativeInteger(config.max_depth)) args.max_depth = config.max_depth;
  if (typeof config.stats === "boolean") args.show_stats = config.stats;
  if (typeof config.no_progress === "boolean")
    args.show_progress = !config.no_progress;
  if (typeof config.no_binary === "boolean") args.no_binary = config.no_binary;
  if (typeof config.ignore_case === "boolean")
    args.ignore_case = config.ignore_case;
  if (typeof config.quiet === "boolean") args.quiet = config.quiet;
  if (typeof config.export_path === "string")
    args.export_path = config.export_path;
  if (typeof config.watch === "boolean") args.watch = config.watch;
  if (isNonNegativeInteger(config.watch_debounce))
    args.watch_debounce = config.watch_debounce;
  if (typeof config.comments === "boolean") args.comments = config.comments;
  if (typeof config.code_vs_comments === "boolean")
    args.code_vs_comments = config.code_vs_comments;
  if (isNonNegativeInteger(config.top_files)) args.top_files = config.top_files;
  if (isNonNegativeInteger(config.top_dirs)) args.top_dirs = config.top_dirs;
  if (typeof config.duplicates === "boolean")
    args.duplicates = config.duplicates;
  if (typeof config.workspaces === "boolean")
    args.workspaces = config.workspaces;

  if (typeof config.export === "string") {
    const parsed = parseOutputFormat(config.export);
    if (parsed !== undefined) {
      args.export = parsed;
    }
  }

  return args;
}

export function mergeConfigIntoArgs(
  cliArgs: Args,
  configArgs: Partial<Args>,
  explicitCliKeys: Set<string>,
): Args {
  const merged = { ...cliArgs };

  for (const [key, value] of Object.entries(configArgs)) {
    if (explicitCliKeys.has(key)) continue;
    (merged as Record<string, unknown>)[key] = value;
  }

  return merged;
}
