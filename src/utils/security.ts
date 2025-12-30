import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { FILE_CONSTANTS } from "../core/constants.js";
import { LineCounterError } from "../core/errors.js";

const SENSITIVE_DIRECTORIES = new Set([
  "/",
  "/bin",
  "/sbin",
  "/usr/bin",
  "/usr/sbin",
  "/etc",
  "/var",
  "/sys",
  "/proc",
  "/dev",

  "C:\\Windows",
  "C:\\Windows\\System32",
  "C:\\Program Files",
  "C:\\Program Files (x86)",

  os.homedir(),
]);

export function isPathSafe(filePath: string, baseDir: string): boolean {
  try {
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(baseDir);

    const relative = path.relative(resolvedBase, resolvedPath);

    if (relative.includes("..")) {
      return false;
    }

    if (filePath.includes("\0")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function validateAndSanitizePath(
  filePath: string,
  baseDir: string,
): string {
  if (filePath.includes("\0")) {
    throw LineCounterError.io(
      "Invalid file path: contains null bytes",
      undefined,
      filePath,
    );
  }

  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);

  const relative = path.relative(resolvedBase, resolvedPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw LineCounterError.io(
      "Path traversal detected: file path must be within base directory",
      undefined,
      filePath,
    );
  }

  return resolvedPath;
}

export function isDirectorySafeToWatch(dirPath: string): boolean {
  try {
    const resolved = path.resolve(dirPath);

    for (const sensitive of SENSITIVE_DIRECTORIES) {
      const sensitiveResolved = path.resolve(sensitive);
      if (
        resolved === sensitiveResolved ||
        resolved.startsWith(sensitiveResolved + path.sep)
      ) {
        return false;
      }
    }

    if (resolved === path.parse(resolved).root) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function validateExportPath(
  exportPath: string,
  baseDir: string,
): string {
  if (exportPath.includes("\0")) {
    throw LineCounterError.exportPathError(
      exportPath,
      "Path contains null bytes",
    );
  }

  let resolvedPath: string;
  if (path.isAbsolute(exportPath)) {
    resolvedPath = path.resolve(exportPath);
  } else {
    resolvedPath = path.resolve(baseDir, exportPath);
  }

  const baseResolved = path.resolve(baseDir);
  const relative = path.relative(baseResolved, path.dirname(resolvedPath));

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw LineCounterError.exportPathError(
      exportPath,
      "Path traversal detected in export path",
    );
  }

  const filename = path.basename(resolvedPath);
  const sanitizedFilename = filename.replace(/[<>:"|?*\x00-\x1f]/g, "_");

  if (sanitizedFilename !== filename) {
    resolvedPath = path.join(path.dirname(resolvedPath), sanitizedFilename);
  }

  return resolvedPath;
}

export function isFileSizeSafe(
  filePath: string,
  maxSize: number = FILE_CONSTANTS.MAX_SAFE_FILE_SIZE,
): boolean {
  try {
    const stats = fs.statSync(filePath);
    return stats.size <= maxSize;
  } catch {
    return false;
  }
}

export function getFileSize(filePath: string): number | null {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return null;
  }
}

export function shouldSkipFileDueToSize(
  filePath: string,
  maxSize: number = FILE_CONSTANTS.MAX_SAFE_FILE_SIZE,
): boolean {
  const size = getFileSize(filePath);
  if (size === null) {
    return true;
  }
  return size > maxSize;
}

export class FileSystemEventRateLimiter {
  private events: number[] = [];
  private maxEvents: number;
  private timeWindow: number;

  constructor(maxEvents: number = 100, timeWindow: number = 1000) {
    this.maxEvents = maxEvents;
    this.timeWindow = timeWindow;
  }

  shouldAllow(): boolean {
    const now = Date.now();

    this.events = this.events.filter((time) => now - time < this.timeWindow);

    if (this.events.length >= this.maxEvents) {
      return false;
    }

    this.events.push(now);
    return true;
  }

  reset(): void {
    this.events = [];
  }
}
