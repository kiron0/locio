import { describe, expect, it } from "vitest";
import {
  countLinesFromContent,
  isBinaryFile,
  parseSize,
} from "../../src/utils/files.js";
import {
  createMockFile,
  createMockDirStructure,
  setupMockFileSystem,
} from "./mock-helpers.js";
import { createMockFileSystem } from "./mock-fs.js";

describe("File Utilities with Mock File System", () => {
  describe("parseSize", () => {
    it("should parse sizes without file I/O", () => {
      expect(parseSize("100")).toBe(100);
      expect(parseSize("1KB")).toBe(1024);
      expect(parseSize("5MB")).toBe(5 * 1024 * 1024);
    });
  });

  describe("countLinesFromContent", () => {
    it("should count lines from content without file I/O", () => {
      expect(countLinesFromContent("line1\nline2\nline3")).toBe(3);
      expect(countLinesFromContent("")).toBe(1);
    });
  });

  describe("isBinaryFile with mock content", () => {
    it("should detect binary files from content", () => {
      expect(isBinaryFile("test.jpg", "text content")).toBe(true);
      expect(isBinaryFile("test.txt", "text\0binary")).toBe(true);
      expect(isBinaryFile("test.txt", "plain text")).toBe(false);
    });
  });

  describe("Mock File System Operations", () => {
    it("should create and read files in mock file system", () => {
      const fs = createMockFileSystem();
      const filePath = createMockFile(fs, "/test.txt", "hello world");

      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath)).toBe("hello world");
    });

    it("should create directory structure", () => {
      const fs = setupMockFileSystem({
        src: {
          "file1.ts": "const x = 1;",
          "file2.ts": "const y = 2;",
          subdir: {
            "file3.ts": "const z = 3;",
          },
        },
      });

      expect(fs.existsSync("/src/file1.ts")).toBe(true);
      expect(fs.existsSync("/src/subdir/file3.ts")).toBe(true);
      expect(fs.readFileSync("/src/file1.ts")).toBe("const x = 1;");
    });

    it("should handle file stats", () => {
      const fs = createMockFileSystem();
      createMockFile(fs, "/test.txt", "content");

      const stats = fs.statSync("/test.txt");
      expect(stats.isFile).toBe(true);
      expect(stats.isDirectory).toBe(false);
      expect(stats.size).toBe(7);
    });

    it("should list directory contents", () => {
      const fs = createMockFileSystem();
      fs.mkdirSync("/dir", { recursive: true });
      fs.writeFileSync("/dir/file1.txt", "content1");
      fs.writeFileSync("/dir/file2.txt", "content2");
      fs.mkdirSync("/dir/subdir", { recursive: true });

      const entries = fs.readdirSync("/dir");
      expect(entries.length).toBeGreaterThanOrEqual(3);
      expect(entries).toContain("file1.txt");
      expect(entries).toContain("file2.txt");
      expect(entries).toContain("subdir");
    });

    it("should remove files and directories", () => {
      const fs = createMockFileSystem();
      fs.writeFileSync("/file.txt", "content");
      fs.mkdirSync("/dir", { recursive: true });
      fs.writeFileSync("/dir/nested.txt", "nested");

      expect(fs.existsSync("/file.txt")).toBe(true);
      expect(fs.existsSync("/dir")).toBe(true);
      expect(fs.existsSync("/dir/nested.txt")).toBe(true);

      fs.rmSync("/file.txt");
      expect(fs.existsSync("/file.txt")).toBe(false);

      fs.rmSync("/dir", { recursive: true });
      expect(fs.existsSync("/dir")).toBe(false);
      expect(fs.existsSync("/dir/nested.txt")).toBe(false);
    });
  });
});
