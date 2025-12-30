import * as fs from "fs";
import * as path from "path";
import { LineCounterError } from "../core/errors.js";
import { OutputFormat } from "./args.js";

export function arrayAccumulator(val: string, prev: unknown): string[] {
  return prev && Array.isArray(prev) ? [...prev, val] : [val];
}

export function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function parseOutputFormat(
  value: true | string | undefined,
): OutputFormat | OutputFormat[] | undefined {
  if (value === undefined) return undefined;
  if (value === true) return OutputFormat.Human;

  const formatMap: Record<string, OutputFormat> = {
    json: OutputFormat.Json,
    csv: OutputFormat.Csv,
    tsv: OutputFormat.Tsv,
    markdown: OutputFormat.Markdown,
    md: OutputFormat.Markdown,
    html: OutputFormat.Html,
    human: OutputFormat.Human,
    txt: OutputFormat.Human,
  };

  const formats = parseCommaSeparated(value)
    .map((f) => formatMap[f.toLowerCase()])
    .filter((f): f is OutputFormat => f !== undefined);

  return formats.length > 0
    ? formats.length === 1
      ? formats[0]
      : formats
    : undefined;
}

export function validateDirectory(
  dir: string,
): { path: string; error: null } | { path: null; error: LineCounterError } {
  if (!dir || dir.trim().length === 0) {
    return { path: null, error: LineCounterError.directoryNotFound("") };
  }

  let targetPath: string;
  try {
    targetPath = path.resolve(dir.trim());
  } catch (error) {
    return {
      path: null,
      error: LineCounterError.directoryNotFound(dir),
    };
  }

  if (!fs.existsSync(targetPath)) {
    return { path: null, error: LineCounterError.directoryNotFound(dir) };
  }

  const stats = fs.statSync(targetPath);
  if (!stats.isDirectory() && !stats.isFile()) {
    return { path: null, error: LineCounterError.notADirectory(dir) };
  }

  return { path: targetPath, error: null };
}
