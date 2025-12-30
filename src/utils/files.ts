import * as fs from "fs";
import * as path from "path";
import { LineCounterError } from "../core/errors.js";

const BINARY_EXTENSIONS = new Set([
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "o",
  "a",
  "lib",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "ico",
  "svg",
  "pdf",
  "zip",
  "tar",
  "gz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "mp3",
  "mp4",
  "avi",
  "mov",
  "wmv",
  "flv",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
]);

import { FILE_CONSTANTS } from "../core/constants.js";
import { shouldSkipFileDueToSize, isFileSizeSafe } from "./security.js";

function containsNullBytes(content: string): boolean {
  const sample = content.slice(0, FILE_CONSTANTS.BINARY_DETECTION_BUFFER_SIZE);
  return sample.includes("\0");
}

export function parseSize(sizeStr: string): number | LineCounterError {
  const trimmed = sizeStr.trim().toUpperCase();
  let number: string;
  let unit: number;

  if (trimmed.endsWith("KB")) {
    number = trimmed.slice(0, -2);
    unit = 1024;
  } else if (trimmed.endsWith("MB")) {
    number = trimmed.slice(0, -2);
    unit = 1024 * 1024;
  } else if (trimmed.endsWith("GB")) {
    number = trimmed.slice(0, -2);
    unit = 1024 * 1024 * 1024;
  } else if (trimmed.endsWith("B") && trimmed.length > 1) {
    number = trimmed.slice(0, -1);
    unit = 1;
  } else {
    number = trimmed;
    unit = 1;
  }

  const parsed = parseFloat(number);
  if (isNaN(parsed)) {
    return LineCounterError.invalidSizeFormat(sizeStr);
  }

  return Math.floor(parsed * unit);
}

export function isBinaryFile(filePath: string, content?: string): boolean {
  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  if (content) {
    return containsNullBytes(content);
  }

  try {
    const bufferSize = FILE_CONSTANTS.BINARY_DETECTION_BUFFER_SIZE;
    const buffer = Buffer.alloc(bufferSize);
    const fd = fs.openSync(filePath, "r");
    const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, 0);
    fs.closeSync(fd);

    if (bytesRead === 0) {
      return false;
    }

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

const MAX_IN_MEMORY_SIZE = FILE_CONSTANTS.MAX_IN_MEMORY_FILE_SIZE;
const STREAM_THRESHOLD = FILE_CONSTANTS.STREAM_THRESHOLD;

async function countLinesStreaming(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const stream = fs.createReadStream(filePath, {
      encoding: "utf-8",
      highWaterMark: 64 * 1024,
    });

    let lastChar = "";

    stream.on("data", (chunk: string) => {
      for (let i = 0; i < chunk.length; i++) {
        const char = chunk[i];
        if (char === "\n") {
          lineCount++;
        } else if (
          char === "\r" &&
          (i + 1 >= chunk.length || chunk[i + 1] !== "\n")
        ) {
          lineCount++;
        }
        lastChar = char;
      }
    });

    stream.on("end", () => {
      if (lastChar && lastChar !== "\n" && lastChar !== "\r") {
        lineCount++;
      }
      resolve(lineCount);
    });

    stream.on("error", (error) => {
      reject(error);
    });
  });
}

export function countLines(
  filePath: string,
  content?: string,
): number | LineCounterError {
  if (content) {
    return countLinesFromContent(content);
  }

  try {
    if (!isFileSizeSafe(filePath, FILE_CONSTANTS.MAX_SAFE_FILE_SIZE)) {
      return LineCounterError.io(
        `File too large to process: exceeds maximum safe size (${FILE_CONSTANTS.MAX_SAFE_FILE_SIZE / (1024 * 1024)}MB)`,
        undefined,
        filePath,
      );
    }

    const stats = fs.statSync(filePath);

    if (stats.size < MAX_IN_MEMORY_SIZE) {
      const contents = fs.readFileSync(filePath, "utf-8");
      return countLinesFromContent(contents);
    }

    if (stats.size >= STREAM_THRESHOLD) {
      try {
        const contents = fs.readFileSync(filePath, "utf-8");
        return countLinesFromContent(contents);
      } catch (e) {
        return LineCounterError.io(
          `Failed to read large file: ${filePath}`,
          e instanceof Error ? e : undefined,
        );
      }
    }

    const contents = fs.readFileSync(filePath, "utf-8");
    return countLinesFromContent(contents);
  } catch (e) {
    return LineCounterError.io(
      `Failed to read file: ${filePath}`,
      e instanceof Error ? e : undefined,
    );
  }
}

export async function countLinesAsync(
  filePath: string,
  content?: string,
): Promise<number | LineCounterError> {
  if (content) {
    return countLinesFromContent(content);
  }

  try {
    if (!isFileSizeSafe(filePath, FILE_CONSTANTS.MAX_SAFE_FILE_SIZE)) {
      return LineCounterError.io(
        `File too large to process: exceeds maximum safe size (${FILE_CONSTANTS.MAX_SAFE_FILE_SIZE / (1024 * 1024)}MB)`,
        undefined,
        filePath,
      );
    }

    const stats = await fs.promises.stat(filePath);

    if (stats.size < MAX_IN_MEMORY_SIZE) {
      const contents = await fs.promises.readFile(filePath, "utf-8");
      return countLinesFromContent(contents);
    }

    if (stats.size >= STREAM_THRESHOLD) {
      try {
        return await countLinesStreaming(filePath);
      } catch (e) {
        return LineCounterError.io(
          `Failed to stream large file: ${filePath}`,
          e instanceof Error ? e : undefined,
        );
      }
    }

    const contents = await fs.promises.readFile(filePath, "utf-8");
    return countLinesFromContent(contents);
  } catch (e) {
    return LineCounterError.io(
      `Failed to read file: ${filePath}`,
      e instanceof Error ? e : undefined,
    );
  }
}

export function countLinesFromContent(content: string): number {
  if (content.length > FILE_CONSTANTS.MAX_SAFE_FILE_SIZE) {
    throw new Error(
      `Content too large: exceeds maximum safe size (${FILE_CONSTANTS.MAX_SAFE_FILE_SIZE / (1024 * 1024)}MB)`,
    );
  }
  return content.split(/\r?\n/).length;
}

export function countLinesWithBlankFromContent(content: string): {
  total: number;
  blank: number;
  code: number;
} {
  if (content.length > FILE_CONSTANTS.MAX_SAFE_FILE_SIZE) {
    throw new Error(
      `Content too large: exceeds maximum safe size (${FILE_CONSTANTS.MAX_SAFE_FILE_SIZE / (1024 * 1024)}MB)`,
    );
  }
  const lines = content.split(/\r?\n/);

  let blank = 0;
  let code = 0;

  for (const line of lines) {
    if (line.trim().length === 0) {
      blank++;
    } else {
      code++;
    }
  }

  return { total: lines.length, blank, code };
}

export function countLinesWithBlank(
  filePath: string,
  content?: string,
): { total: number; blank: number; code: number } | LineCounterError {
  if (content) {
    return countLinesWithBlankFromContent(content);
  }

  try {
    if (!isFileSizeSafe(filePath, FILE_CONSTANTS.MAX_SAFE_FILE_SIZE)) {
      return LineCounterError.io(
        `File too large to process: exceeds maximum safe size (${FILE_CONSTANTS.MAX_SAFE_FILE_SIZE / (1024 * 1024)}MB)`,
        undefined,
        filePath,
      );
    }

    const stats = fs.statSync(filePath);

    if (stats.size < MAX_IN_MEMORY_SIZE) {
      const contents = fs.readFileSync(filePath, "utf-8");
      return countLinesWithBlankFromContent(contents);
    }

    const contents = fs.readFileSync(filePath, "utf-8");
    return countLinesWithBlankFromContent(contents);
  } catch (e) {
    return LineCounterError.io(
      `Failed to read file: ${filePath}`,
      e instanceof Error ? e : undefined,
    );
  }
}
