import * as fs from "fs";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { parseCommaSeparated } from "../../cli/utils.js";
import { isBinaryFile, parseSize } from "../../utils/files.js";
import {
  detectProjectType,
  getProjectExcludes,
  type ProjectType,
} from "../detection/index.js";
import { LineCounterError } from "../errors.js";
import {
  DEFAULT_IGNORED_EXTENSIONS,
  DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS,
} from "./ignored.js";

function loadDefaultIgnoredExtensions(): string[] {
  return DEFAULT_IGNORED_EXTENSIONS.map((ext) => ext.toLowerCase());
}

const DEFAULT_COMMENT_IGNORED_EXTENSIONS = new Set(
  DEFAULT_RM_COMMENTS_IGNORED_EXTENSIONS.map((ext) => ext.toLowerCase()),
);

export interface FilterPatterns {
  exclude_patterns: RegExp[];
  exclude_extensions: string[];
  include_extensions: string[];
  exclude_dirs: RegExp[];
  include_dirs: RegExp[];
  exclude_names: RegExp[];
  include_names: RegExp[];
  detected_project_type?: ProjectType;

  exclude_extensions_set?: Set<string>;
  include_extensions_set?: Set<string>;

  combined_exclude_patterns?: RegExp | null;
  combined_exclude_dirs?: RegExp | null;
  combined_exclude_names?: RegExp | null;
  max_size_bytes?: number;
  min_size_bytes?: number;
  ignored_comment_extensions_set: Set<string>;
  rm_comment_extensions_set?: Set<string>;
  rm_comments_all_files: boolean;
}

export function createFilterPatterns(
  args: Args,
): FilterPatterns | LineCounterError {
  try {
    let maxSizeBytes: number | undefined;
    if (args.max_size) {
      const maxSize = parseSize(args.max_size);
      if (maxSize instanceof LineCounterError) {
        return maxSize;
      }
      maxSizeBytes = maxSize;
    }

    let minSizeBytes: number | undefined;
    if (args.min_size) {
      const minSize = parseSize(args.min_size);
      if (minSize instanceof LineCounterError) {
        return minSize;
      }
      minSizeBytes = minSize;
    }

    const detectedProjectType = detectProjectType(args.directory);
    const projectExcludes = getProjectExcludes(detectedProjectType);

    const exclude_patterns: RegExp[] = args.exclude_patterns.map((p) => {
      try {
        return new RegExp(p, args.ignore_case ? "i" : undefined);
      } catch (e) {
        throw LineCounterError.invalidRegex(
          p,
          e instanceof Error ? e : undefined,
        );
      }
    });

    const exclude_extensions: string[] = [
      ...args.exclude_extensions.map((e) => e.replace(/^\./, "").toLowerCase()),
      ...projectExcludes.exclude_extensions.map((e) => e.toLowerCase()),
      ...loadDefaultIgnoredExtensions(),
    ];
    const uniqueExcludeExt = Array.from(new Set(exclude_extensions)).sort();
    const excludeExtensionsSet = new Set(uniqueExcludeExt);

    const include_extensions: string[] = args.include_extensions.map((e) =>
      e.replace(/^\./, "").toLowerCase(),
    );
    const includeExtensionsSet = new Set(include_extensions);

    const exclude_dirs_patterns: string[] = [
      ...args.exclude_dirs,
      ...projectExcludes.exclude_dirs,
    ];
    const exclude_dirs: RegExp[] = exclude_dirs_patterns.map((p) => {
      return new RegExp(p, args.ignore_case ? "i" : undefined);
    });

    const include_dirs: RegExp[] = args.include_dirs.map((p) => {
      return new RegExp(p, args.ignore_case ? "i" : undefined);
    });

    const exclude_names_patterns: string[] = [
      ...args.exclude_names,
      ...projectExcludes.exclude_names,
    ];
    const exclude_names: RegExp[] = exclude_names_patterns.map((p) => {
      return new RegExp(p, args.ignore_case ? "i" : undefined);
    });

    const include_names: RegExp[] = args.include_names.map((p) => {
      return new RegExp(p, args.ignore_case ? "i" : undefined);
    });

    const combinedExcludePatterns =
      exclude_patterns.length > 0
        ? new RegExp(
            exclude_patterns.map((p) => `(?:${p.source})`).join("|"),
            args.ignore_case ? "i" : undefined,
          )
        : null;

    const combinedExcludeDirs =
      exclude_dirs.length > 0
        ? new RegExp(
            exclude_dirs.map((p) => `(?:${p.source})`).join("|"),
            args.ignore_case ? "i" : undefined,
          )
        : null;

    const combinedExcludeNames =
      exclude_names.length > 0
        ? new RegExp(
            exclude_names.map((p) => `(?:${p.source})`).join("|"),
            args.ignore_case ? "i" : undefined,
          )
        : null;

    const rmCommentsAllFiles = args.rm_comments === true;
    const rmCommentExtensionsSet =
      typeof args.rm_comments === "string"
        ? new Set(
            parseCommaSeparated(args.rm_comments).map((ext) =>
              ext.toLowerCase().replace(/^\./, ""),
            ),
          )
        : undefined;

    return {
      exclude_patterns,
      exclude_extensions: uniqueExcludeExt,
      include_extensions,
      exclude_dirs,
      include_dirs,
      exclude_names,
      include_names,
      detected_project_type: detectedProjectType,

      exclude_extensions_set: excludeExtensionsSet,
      include_extensions_set: includeExtensionsSet,
      combined_exclude_patterns: combinedExcludePatterns,
      combined_exclude_dirs: combinedExcludeDirs,
      combined_exclude_names: combinedExcludeNames,
      max_size_bytes: maxSizeBytes,
      min_size_bytes: minSizeBytes,
      ignored_comment_extensions_set: DEFAULT_COMMENT_IGNORED_EXTENSIONS,
      rm_comment_extensions_set: rmCommentExtensionsSet,
      rm_comments_all_files: rmCommentsAllFiles,
    };
  } catch (e) {
    if (e instanceof LineCounterError) {
      return e;
    }
    return LineCounterError.io(
      `Failed to create filter patterns: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function shouldExcludeFile(
  filePath: string,
  args: Args,
  patterns: FilterPatterns,
  stats?: fs.Stats,
): boolean {
  const pathStr = filePath;
  const fileName = path.basename(filePath);

  if (patterns.combined_exclude_patterns) {
    if (patterns.combined_exclude_patterns.test(pathStr)) {
      return true;
    }
  } else {
    for (const pattern of patterns.exclude_patterns) {
      if (pattern.test(pathStr)) {
        return true;
      }
    }
  }

  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  if (ext) {
    if (patterns.exclude_extensions_set) {
      if (patterns.exclude_extensions_set.has(ext)) {
        return true;
      }
    } else {
      for (const excludeExt of patterns.exclude_extensions) {
        if (ext === excludeExt.toLowerCase()) {
          return true;
        }
      }
    }

    if (
      patterns.include_extensions_set &&
      patterns.include_extensions_set.size > 0
    ) {
      if (!patterns.include_extensions_set.has(ext)) {
        return true;
      }
    } else if (patterns.include_extensions.length > 0) {
      let matches = false;
      for (const includeExt of patterns.include_extensions) {
        if (ext === includeExt.toLowerCase()) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        return true;
      }
    }
  } else if (
    (patterns.include_extensions_set &&
      patterns.include_extensions_set.size > 0) ||
    patterns.include_extensions.length > 0
  ) {
    return true;
  }

  const parentDir = path.dirname(filePath);

  if (patterns.combined_exclude_dirs) {
    if (patterns.combined_exclude_dirs.test(parentDir)) {
      return true;
    }
  } else {
    for (const pattern of patterns.exclude_dirs) {
      if (pattern.test(parentDir)) {
        return true;
      }
    }
  }

  if (patterns.include_dirs.length > 0) {
    let matches = false;
    for (const pattern of patterns.include_dirs) {
      if (pattern.test(parentDir)) {
        matches = true;
        break;
      }
    }
    if (!matches) {
      return true;
    }
  }

  if (patterns.combined_exclude_names) {
    if (patterns.combined_exclude_names.test(fileName)) {
      return true;
    }
  } else {
    for (const pattern of patterns.exclude_names) {
      if (pattern.test(fileName)) {
        return true;
      }
    }
  }

  if (patterns.include_names.length > 0) {
    let matches = false;
    for (const pattern of patterns.include_names) {
      if (pattern.test(fileName)) {
        matches = true;
        break;
      }
    }
    if (!matches) {
      return true;
    }
  }

  if (args.no_hidden && fileName.startsWith(".")) {
    return true;
  }

  const size = stats?.size;
  if (size !== undefined) {
    if (
      patterns.max_size_bytes !== undefined &&
      size > patterns.max_size_bytes
    ) {
      return true;
    }

    if (
      patterns.min_size_bytes !== undefined &&
      size < patterns.min_size_bytes
    ) {
      return true;
    }

    if (args.no_empty && size === 0) {
      return true;
    }
  }

  if (args.no_binary && isBinaryFile(filePath)) {
    return true;
  }

  return false;
}
