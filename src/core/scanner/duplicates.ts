import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { DuplicateGroup, FileDetail } from "../types.js";

const DEFAULT_MAX_FILES = 1000;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export function findDuplicates(
  details: FileDetail[],
  rootDir: string,
  maxFileSize: number = DEFAULT_MAX_FILE_SIZE,
): DuplicateGroup[] {
  const hashMap = new Map<
    string,
    {
      size: number;
      lines: number;
      files: Array<{ directory: string; name: string; fullPath: string }>;
    }
  >();

  const filesToProcess = details.slice(0, DEFAULT_MAX_FILES);
  const sizeFrequency = new Map<number, number>();
  for (const detail of filesToProcess) {
    if (detail.size > 0 && detail.size <= maxFileSize) {
      sizeFrequency.set(detail.size, (sizeFrequency.get(detail.size) || 0) + 1);
    }
  }

  for (const detail of filesToProcess) {
    const fullPath = path.resolve(rootDir, detail.directory, detail.name);

    try {
      if (detail.size > maxFileSize) continue;

      if (detail.size === 0) continue;
      if ((sizeFrequency.get(detail.size) || 0) < 2) continue;

      if (!fs.existsSync(fullPath)) continue;
      const currentStats = fs.statSync(fullPath);
      if (!currentStats.isFile() || currentStats.size !== detail.size) continue;
      const content = fs.readFileSync(fullPath);
      const hash = crypto.createHash("sha256").update(content).digest("hex");

      let entry = hashMap.get(hash);
      if (!entry) {
        entry = {
          size: detail.size,
          lines: detail.lines || 0,
          files: [],
        };
        hashMap.set(hash, entry);
      }

      entry.files.push({
        directory: detail.directory,
        name: detail.name,
        fullPath,
      });
    } catch {
      continue;
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [hash, entry] of hashMap) {
    if (entry.files.length >= 2) {
      groups.push({
        hash,
        size: entry.size,
        lines: entry.lines,
        files: entry.files,
      });
    }
  }

  groups.sort((a, b) => {
    const wastedA = a.lines * (a.files.length - 1);
    const wastedB = b.lines * (b.files.length - 1);
    return wastedB - wastedA;
  });

  return groups;
}
