import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LineCounterError } from "../../src/core/errors.js";
import {
  countLines,
  countLinesAsync,
  countLinesFromContent,
  countLinesWithBlank,
  countLinesWithBlankFromContent,
  isBinaryFile,
  parseSize,
} from "../../src/utils/files.js";
import {
  createTempDir,
  createTestFile,
  removeTempDir,
} from "./test-helpers.js";

describe("parseSize", () => {
  it("should parse bytes", () => {
    expect(parseSize("100")).toBe(100);
    expect(parseSize("500B")).toBe(500);
    expect(parseSize("0")).toBe(0);
  });

  it("should parse KB", () => {
    expect(parseSize("1KB")).toBe(1024);
    expect(parseSize("5KB")).toBe(5 * 1024);
    expect(parseSize("10kb")).toBe(10 * 1024);
  });

  it("should parse MB", () => {
    expect(parseSize("1MB")).toBe(1024 * 1024);
    expect(parseSize("2MB")).toBe(2 * 1024 * 1024);
    expect(parseSize("10mb")).toBe(10 * 1024 * 1024);
  });

  it("should parse GB", () => {
    expect(parseSize("1GB")).toBe(1024 * 1024 * 1024);
    expect(parseSize("2GB")).toBe(2 * 1024 * 1024 * 1024);
  });

  it("should handle decimal values", () => {
    expect(parseSize("1.5KB")).toBe(Math.floor(1.5 * 1024));
    expect(parseSize("2.5MB")).toBe(Math.floor(2.5 * 1024 * 1024));
  });

  it("should handle whitespace", () => {
    expect(parseSize(" 100KB ")).toBe(100 * 1024);
    expect(parseSize("  5MB  ")).toBe(5 * 1024 * 1024);
  });

  it("should return error for invalid format", () => {
    const result = parseSize("invalid");
    expect(result).toBeInstanceOf(LineCounterError);
    if (result instanceof LineCounterError) {
      expect(result.code).toBe("INVALID_SIZE_FORMAT");
    }
  });

  it("should return error for empty string", () => {
    const result = parseSize("");
    expect(result).toBeInstanceOf(LineCounterError);
  });
});

describe("isBinaryFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("should detect binary files by extension", () => {
    expect(isBinaryFile("test.jpg")).toBe(true);
    expect(isBinaryFile("test.png")).toBe(true);
    expect(isBinaryFile("test.exe")).toBe(true);
    expect(isBinaryFile("test.dll")).toBe(true);
    expect(isBinaryFile("test.zip")).toBe(true);
  });

  it("should detect text files", () => {
    expect(isBinaryFile("test.txt")).toBe(false);
    expect(isBinaryFile("test.js")).toBe(false);
    expect(isBinaryFile("test.ts")).toBe(false);
    expect(isBinaryFile("test.md")).toBe(false);
  });

  it("should detect binary content with null bytes", () => {
    const filePath = createTestFile(tempDir, "binary.bin", "text\0binary");
    expect(isBinaryFile(filePath, "text\0binary")).toBe(true);
  });

  it("should detect text content without null bytes", () => {
    expect(isBinaryFile("test.txt", "plain text content")).toBe(false);
  });

  it("should handle case-insensitive extensions", () => {
    expect(isBinaryFile("test.JPG")).toBe(true);
    expect(isBinaryFile("test.PNG")).toBe(true);
  });
});

describe("countLinesFromContent", () => {
  it("should count lines correctly", () => {
    expect(countLinesFromContent("")).toBe(1);
    expect(countLinesFromContent("single line")).toBe(1);
    expect(countLinesFromContent("line1\nline2")).toBe(2);
    expect(countLinesFromContent("line1\nline2\nline3")).toBe(3);
  });

  it("should handle Windows line endings", () => {
    expect(countLinesFromContent("line1\r\nline2")).toBe(2);
    expect(countLinesFromContent("line1\r\nline2\r\nline3")).toBe(3);
  });

  it("should handle Mac line endings (old format)", () => {
    expect(countLinesFromContent("line1\rline2")).toBe(1);
  });

  it("should handle mixed line endings", () => {
    expect(countLinesFromContent("line1\nline2\r\nline3")).toBe(3);
  });

  it("should handle files without trailing newline", () => {
    expect(countLinesFromContent("line1\nline2\nline3")).toBe(3);
    expect(countLinesFromContent("line1\nline2\nline3\n")).toBe(4);
  });
});

describe("countLinesWithBlankFromContent", () => {
  it("should count total, blank, and code lines", () => {
    const content = "line1\n\nline2\n   \nline3";
    const result = countLinesWithBlankFromContent(content);
    expect(result.total).toBe(5);
    expect(result.blank).toBeGreaterThan(0);
    expect(result.code).toBeGreaterThan(0);
  });

  it("should handle empty content", () => {
    const result = countLinesWithBlankFromContent("");
    expect(result.total).toBe(1);
    expect(result.blank).toBe(1);
    expect(result.code).toBe(0);
  });

  it("should correctly identify blank lines", () => {
    const content = "code\n\n   \n\t\t\ncode";
    const result = countLinesWithBlankFromContent(content);
    expect(result.blank).toBeGreaterThan(1);
  });
});

describe("countLines", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("should count lines from file", () => {
    const filePath = createTestFile(tempDir, "test.txt", "line1\nline2\nline3");
    const result = countLines(filePath);
    expect(result).toBe(3);
  });

  it("should count lines from content if provided", () => {
    const filePath = createTestFile(tempDir, "test.txt", "line1\nline2");
    const result = countLines(filePath, "line1\nline2\nline3\nline4");
    expect(result).toBe(4);
  });

  it("should handle empty file", () => {
    const filePath = createTestFile(tempDir, "empty.txt", "");
    const result = countLines(filePath);
    expect(result).toBe(1);
  });

  it("should return error for non-existent file", () => {
    const result = countLines(path.join(tempDir, "nonexistent.txt"));
    expect(result).toBeInstanceOf(LineCounterError);
  });
});

describe("countLinesAsync", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("should count lines asynchronously", async () => {
    const filePath = createTestFile(tempDir, "test.txt", "line1\nline2\nline3");
    const result = await countLinesAsync(filePath);
    expect(result).toBe(3);
  });

  it("should count lines from content if provided", async () => {
    const filePath = createTestFile(tempDir, "test.txt", "line1");
    const result = await countLinesAsync(filePath, "line1\nline2\nline3");
    expect(result).toBe(3);
  });

  it("should return error for non-existent file", async () => {
    const result = await countLinesAsync(path.join(tempDir, "nonexistent.txt"));
    expect(result).toBeInstanceOf(LineCounterError);
  });
});

describe("countLinesWithBlank", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("should count lines with blank separation", () => {
    const filePath = createTestFile(tempDir, "test.txt", "code\n\nblank\ncode");
    const result = countLinesWithBlank(filePath);
    if (!(result instanceof LineCounterError)) {
      expect(result.total).toBeGreaterThan(0);
      expect(result.blank).toBeGreaterThan(0);
      expect(result.code).toBeGreaterThan(0);
    }
  });

  it("should use content if provided", () => {
    const filePath = createTestFile(tempDir, "test.txt", "old");
    const result = countLinesWithBlank(filePath, "new\n\ncontent");
    if (!(result instanceof LineCounterError)) {
      expect(result.total).toBe(3);
    }
  });
});
