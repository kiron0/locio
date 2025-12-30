import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WatchCache, getDebounceMs } from "../../src/cli/watch.js";
import { WATCH_CONSTANTS } from "../../src/core/constants.js";
import { FileSystemEventRateLimiter } from "../../src/utils/security.js";
import {
  createTempDir,
  createTestFile,
  removeTempDir,
} from "../utils/test-helpers.js";

describe("Watch Mode", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (tempDir) {
      removeTempDir(tempDir);
    }
  });

  describe("WatchCache", () => {
    it("should detect new file as changed", () => {
      const cache = new WatchCache();
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");

      expect(cache.isFileChanged(filePath)).toBe(true);
    });

    it("should detect unchanged file as not changed", () => {
      const cache = new WatchCache();
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");

      cache.updateFile(filePath);
      expect(cache.isFileChanged(filePath)).toBe(false);
    });

    it("should detect file content change", () => {
      const cache = new WatchCache();
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");

      cache.updateFile(filePath);
      fs.writeFileSync(filePath, "const x = 2;", "utf-8");

      expect(cache.isFileChanged(filePath)).toBe(true);
    });

    it("should detect file modification time change", async () => {
      const cache = new WatchCache();
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");

      cache.updateFile(filePath);

      await new Promise((resolve) => setTimeout(resolve, 10));
      fs.writeFileSync(filePath, "const x = 1;", "utf-8");

      expect(cache.isFileChanged(filePath)).toBe(true);
    });

    it("should handle file removal", () => {
      const cache = new WatchCache();
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");

      cache.updateFile(filePath);
      cache.removeFile(filePath);

      expect(cache.isFileChanged(filePath)).toBe(true);
    });

    it("should clear all cached files", () => {
      const cache = new WatchCache();
      const file1 = createTestFile(tempDir, "test1.ts", "const x = 1;");
      const file2 = createTestFile(tempDir, "test2.ts", "const y = 2;");

      cache.updateFile(file1);
      cache.updateFile(file2);
      cache.clear();

      expect(cache.isFileChanged(file1)).toBe(true);
      expect(cache.isFileChanged(file2)).toBe(true);
    });

    it("should handle non-existent file gracefully", () => {
      const cache = new WatchCache();
      const nonExistentFile = path.join(tempDir, "nonexistent.ts");

      expect(cache.isFileChanged(nonExistentFile)).toBe(true);
    });

    it("should generate consistent hash for same content", () => {
      const cache = new WatchCache();
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");

      const hash1 = cache.getFileHash(filePath);
      const hash2 = cache.getFileHash(filePath);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
    });

    it("should generate different hash for different content", () => {
      const cache = new WatchCache();
      const file1 = createTestFile(tempDir, "test1.ts", "const x = 1;");
      const file2 = createTestFile(tempDir, "test2.ts", "const y = 2;");

      const hash1 = cache.getFileHash(file1);
      const hash2 = cache.getFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("FileSystemEventRateLimiter", () => {
    it("should allow events within limit", () => {
      const limiter = new FileSystemEventRateLimiter(10, 1000);

      for (let i = 0; i < 10; i++) {
        expect(limiter.shouldAllow()).toBe(true);
      }
    });

    it("should rate limit events exceeding limit", () => {
      const limiter = new FileSystemEventRateLimiter(5, 1000);

      for (let i = 0; i < 5; i++) {
        expect(limiter.shouldAllow()).toBe(true);
      }

      expect(limiter.shouldAllow()).toBe(false);
    });

    it("should reset rate limiter", () => {
      const limiter = new FileSystemEventRateLimiter(5, 1000);

      for (let i = 0; i < 5; i++) {
        limiter.shouldAllow();
      }

      expect(limiter.shouldAllow()).toBe(false);
      limiter.reset();

      expect(limiter.shouldAllow()).toBe(true);
    });

    it("should allow events after time window expires", async () => {
      const limiter = new FileSystemEventRateLimiter(5, 100);

      for (let i = 0; i < 5; i++) {
        limiter.shouldAllow();
      }

      expect(limiter.shouldAllow()).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(limiter.shouldAllow()).toBe(true);
    });

    it("should handle rapid events correctly", () => {
      const limiter = new FileSystemEventRateLimiter(3, 1000);

      expect(limiter.shouldAllow()).toBe(true);
      expect(limiter.shouldAllow()).toBe(true);
      expect(limiter.shouldAllow()).toBe(true);
      expect(limiter.shouldAllow()).toBe(false);
      expect(limiter.shouldAllow()).toBe(false);
    });
  });

  describe("Watch Mode Debouncing", () => {
    it("should use default debounce time", () => {
      const args = { directory: tempDir, watch: true } as any;

      const debounceMs = getDebounceMs(args);

      expect(debounceMs).toBe(WATCH_CONSTANTS.DEFAULT_DEBOUNCE_MS);
    });

    it("should use custom debounce time", () => {
      const args = {
        directory: tempDir,
        watch: true,
        watch_debounce: 1000,
      } as any;

      const debounceMs = getDebounceMs(args);

      expect(debounceMs).toBe(1000);
    });

    it("should enforce minimum debounce time", () => {
      const args = {
        directory: tempDir,
        watch: true,
        watch_debounce: 50,
      } as any;

      const debounceMs = getDebounceMs(args);

      expect(debounceMs).toBe(WATCH_CONSTANTS.MIN_DEBOUNCE_MS);
    });

    it("should enforce maximum debounce time", () => {
      const args = {
        directory: tempDir,
        watch: true,
        watch_debounce: 10000,
      } as any;

      const debounceMs = getDebounceMs(args);

      expect(debounceMs).toBe(WATCH_CONSTANTS.MAX_DEBOUNCE_MS);
    });
  });

  describe("File Change Detection", () => {
    it("should detect file creation", async () => {
      const cache = new WatchCache();

      const filePath = path.join(tempDir, "newfile.ts");
      expect(cache.isFileChanged(filePath)).toBe(true);

      fs.writeFileSync(filePath, "const x = 1;", "utf-8");
      cache.updateFile(filePath);

      expect(cache.isFileChanged(filePath)).toBe(false);
    });

    it("should detect file modification", async () => {
      const cache = new WatchCache();
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");

      cache.updateFile(filePath);
      expect(cache.isFileChanged(filePath)).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 10));
      fs.writeFileSync(filePath, "const x = 2;", "utf-8");

      expect(cache.isFileChanged(filePath)).toBe(true);
    });

    it("should detect file deletion", () => {
      const cache = new WatchCache();
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");

      cache.updateFile(filePath);
      fs.unlinkSync(filePath);
      cache.removeFile(filePath);

      expect(cache.isFileChanged(filePath)).toBe(true);
    });

    it("should handle multiple file changes", async () => {
      const cache = new WatchCache();
      const file1 = createTestFile(tempDir, "test1.ts", "const x = 1;");
      const file2 = createTestFile(tempDir, "test2.ts", "const y = 2;");
      const file3 = createTestFile(tempDir, "test3.ts", "const z = 3;");

      cache.updateFile(file1);
      cache.updateFile(file2);
      cache.updateFile(file3);

      expect(cache.isFileChanged(file1)).toBe(false);
      expect(cache.isFileChanged(file2)).toBe(false);
      expect(cache.isFileChanged(file3)).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 10));
      fs.writeFileSync(file1, "const x = 10;", "utf-8");
      fs.writeFileSync(file2, "const y = 20;", "utf-8");

      expect(cache.isFileChanged(file1)).toBe(true);
      expect(cache.isFileChanged(file2)).toBe(true);
      expect(cache.isFileChanged(file3)).toBe(false);
    });

    it("should detect changes in subdirectories", async () => {
      const cache = new WatchCache();
      const subDir = path.join(tempDir, "subdir");
      fs.mkdirSync(subDir, { recursive: true });
      const filePath = path.join(subDir, "test.ts");

      fs.writeFileSync(filePath, "const x = 1;", "utf-8");
      cache.updateFile(filePath);

      expect(cache.isFileChanged(filePath)).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 10));
      fs.writeFileSync(filePath, "const x = 2;", "utf-8");

      expect(cache.isFileChanged(filePath)).toBe(true);
    });
  });

  describe("Watch Mode Integration", () => {
    it("should handle file changes correctly", async () => {
      const filePath = createTestFile(tempDir, "test.ts", "const x = 1;");
      const cache = new WatchCache();

      cache.updateFile(filePath);
      expect(cache.isFileChanged(filePath)).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 10));
      fs.writeFileSync(filePath, "const x = 2;\nconst y = 3;", "utf-8");

      expect(cache.isFileChanged(filePath)).toBe(true);

      cache.updateFile(filePath);
      expect(cache.isFileChanged(filePath)).toBe(false);
    });

    it("should track multiple changed files", () => {
      const cache = new WatchCache();
      const files = [
        createTestFile(tempDir, "file1.ts", "const a = 1;"),
        createTestFile(tempDir, "file2.ts", "const b = 2;"),
        createTestFile(tempDir, "file3.ts", "const c = 3;"),
      ];

      files.forEach((file) => cache.updateFile(file));

      files.forEach((file) => {
        expect(cache.isFileChanged(file)).toBe(false);
      });

      fs.writeFileSync(files[0], "const a = 10;", "utf-8");
      fs.writeFileSync(files[2], "const c = 30;", "utf-8");

      expect(cache.isFileChanged(files[0])).toBe(true);
      expect(cache.isFileChanged(files[1])).toBe(false);
      expect(cache.isFileChanged(files[2])).toBe(true);
    });
  });
});
