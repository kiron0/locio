import * as fs from "fs";
import { FILE_CONSTANTS } from "../constants.js";

export class FileStatsCache {
  private cache = new Map<string, fs.Stats>();

  get(filePath: string): fs.Stats | null {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const stats = fs.statSync(filePath);
      this.cache.set(filePath, stats);
      return stats;
    } catch {
      return null;
    }
  }

  async getAsync(filePath: string): Promise<fs.Stats | null> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      this.cache.set(filePath, stats);
      return stats;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export class FileContentCache {
  private cache = new Map<string, string>();
  private maxCacheSize = FILE_CONSTANTS.MAX_MEMORY_FILES;

  async get(filePath: string): Promise<string | null> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const content = await fs.promises.readFile(filePath, "utf-8");

      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }

      this.cache.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
