import * as fs from "fs";
import { LineCounterError } from "../core/errors.js";

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

export function isBinaryFile(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(8192);
    const fd = fs.openSync(filePath, "r");
    const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
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

export function countLines(
  filePath: string,
  includeBlank: boolean,
): number | LineCounterError {
  try {
    const contents = fs.readFileSync(filePath, "utf-8");
    const lines = contents.split(/\r?\n/);

    if (includeBlank) {
      return lines.length;
    } else {
      return lines.filter((line) => line.trim().length > 0).length;
    }
  } catch (e) {
    return LineCounterError.io(
      `Failed to read file: ${filePath}`,
      e instanceof Error ? e : undefined,
    );
  }
}
