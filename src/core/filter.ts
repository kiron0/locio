import * as fs from "fs";
import * as path from "path";
import type { Args } from "../cli/args.js";
import { isBinaryFile, parseSize } from "../utils/files.js";
import { LineCounterError } from "./errors.js";
import { DEFAULT_IGNORED_EXTENSIONS } from "./ignored.js";

function loadDefaultIgnoredExtensions(): string[] {
  return DEFAULT_IGNORED_EXTENSIONS.map((ext) => ext.toLowerCase());
}

export interface FilterPatterns {
  exclude_patterns: RegExp[];
  exclude_extensions: string[];
  include_extensions: string[];
  exclude_dirs: RegExp[];
  include_dirs: RegExp[];
  exclude_names: RegExp[];
  include_names: RegExp[];
}

export function createFilterPatterns(
  args: Args,
): FilterPatterns | LineCounterError {
  try {
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
      ...loadDefaultIgnoredExtensions(),
    ];
    const uniqueExcludeExt = Array.from(new Set(exclude_extensions)).sort();

    const include_extensions: string[] = args.include_extensions.map((e) =>
      e.replace(/^\./, "").toLowerCase(),
    );

    const exclude_dirs: RegExp[] = args.exclude_dirs.map((p) => {
      return new RegExp(p, args.ignore_case ? "i" : undefined);
    });

    const include_dirs: RegExp[] = args.include_dirs.map((p) => {
      return new RegExp(p, args.ignore_case ? "i" : undefined);
    });

    const exclude_names: RegExp[] = args.exclude_names.map((p) => {
      return new RegExp(p, args.ignore_case ? "i" : undefined);
    });

    const include_names: RegExp[] = args.include_names.map((p) => {
      return new RegExp(p, args.ignore_case ? "i" : undefined);
    });

    return {
      exclude_patterns,
      exclude_extensions: uniqueExcludeExt,
      include_extensions,
      exclude_dirs,
      include_dirs,
      exclude_names,
      include_names,
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
): boolean {
  const pathStr = filePath;
  const fileName = path.basename(filePath);

  for (const pattern of patterns.exclude_patterns) {
    if (pattern.test(pathStr)) {
      return true;
    }
  }

  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  if (ext) {
    for (const excludeExt of patterns.exclude_extensions) {
      if (ext === excludeExt.toLowerCase()) {
        return true;
      }
    }

    if (patterns.include_extensions.length > 0) {
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
  } else if (patterns.include_extensions.length > 0) {
    return true;
  }

  const parentDir = path.dirname(filePath);
  for (const pattern of patterns.exclude_dirs) {
    if (pattern.test(parentDir)) {
      return true;
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

  for (const pattern of patterns.exclude_names) {
    if (pattern.test(fileName)) {
      return true;
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

  try {
    const stats = fs.statSync(filePath);
    const size = stats.size;

    if (args.max_size) {
      const maxSize = parseSize(args.max_size);
      if (!(maxSize instanceof LineCounterError) && size > maxSize) {
        return true;
      }
    }

    if (args.min_size) {
      const minSize = parseSize(args.min_size);
      if (!(minSize instanceof LineCounterError) && size < minSize) {
        return true;
      }
    }

    if (args.no_empty && size === 0) {
      return true;
    }
  } catch {}

  if (args.no_binary && isBinaryFile(filePath)) {
    return true;
  }

  return false;
}
