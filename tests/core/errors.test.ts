import { describe, expect, it } from "vitest";
import { ErrorCode, LineCounterError, isError } from "../../src/core/errors.js";

describe("LineCounterError", () => {
  describe("constructor", () => {
    it("should create an error with message and code", () => {
      const error = new LineCounterError("Test error", ErrorCode.IO_ERROR);
      expect(error.message).toBe("Test error");
      expect(error.code).toBe(ErrorCode.IO_ERROR);
      expect(error.name).toBe("LineCounterError");
    });

    it("should include optional properties", () => {
      const cause = new Error("Original error");
      const error = new LineCounterError("Test error", ErrorCode.IO_ERROR, {
        cause,
        suggestion: "Test suggestion",
        filePath: "/test/path",
        lineNumber: 42,
      });
      expect(error.cause).toBe(cause);
      expect(error.suggestion).toBe("Test suggestion");
      expect(error.filePath).toBe("/test/path");
      expect(error.lineNumber).toBe(42);
    });
  });

  describe("static factory methods", () => {
    it("should create IO error", () => {
      const error = LineCounterError.io("File not found", undefined, "/test");
      expect(error.code).toBe(ErrorCode.IO_ERROR);
      expect(error.message).toContain("File not found");
      expect(error.filePath).toBe("/test");
      expect(error.suggestion).toBeDefined();
    });

    it("should create invalid size format error", () => {
      const error = LineCounterError.invalidSizeFormat("invalid");
      expect(error.code).toBe(ErrorCode.INVALID_SIZE_FORMAT);
      expect(error.message).toContain("invalid");
      expect(error.suggestion).toBeDefined();
    });

    it("should create invalid regex error", () => {
      const cause = new Error("Invalid regex");
      const error = LineCounterError.invalidRegex("[invalid", cause);
      expect(error.code).toBe(ErrorCode.INVALID_REGEX);
      expect(error.message).toContain("[invalid");
      expect(error.cause).toBe(cause);
      expect(error.suggestion).toBeDefined();
    });

    it("should create directory not found error", () => {
      const error = LineCounterError.directoryNotFound("/nonexistent");
      expect(error.code).toBe(ErrorCode.DIRECTORY_NOT_FOUND);
      expect(error.message).toContain("/nonexistent");
      expect(error.filePath).toBe("/nonexistent");
      expect(error.suggestion).toBeDefined();
    });

    it("should create not a directory error", () => {
      const error = LineCounterError.notADirectory("/file.txt");
      expect(error.code).toBe(ErrorCode.NOT_A_DIRECTORY);
      expect(error.message).toContain("/file.txt");
      expect(error.filePath).toBe("/file.txt");
      expect(error.suggestion).toBeDefined();
    });

    it("should create file not found error", () => {
      const error = LineCounterError.fileNotFound("/missing.txt");
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.message).toContain("/missing.txt");
      expect(error.filePath).toBe("/missing.txt");
      expect(error.suggestion).toBeDefined();
    });

    it("should create export path error", () => {
      const error = LineCounterError.exportPathError(
        "/export",
        "Permission denied",
      );
      expect(error.code).toBe(ErrorCode.EXPORT_PATH_ERROR);
      expect(error.message).toContain("/export");
      expect(error.filePath).toBe("/export");
      expect(error.suggestion).toBeDefined();
    });

    it("should create file processing error", () => {
      const cause = new Error("Read error");
      const error = LineCounterError.fileProcessingError(
        "/file.txt",
        "Failed to read",
        cause,
      );
      expect(error.code).toBe(ErrorCode.FILE_PROCESSING_ERROR);
      expect(error.message).toContain("Failed to read");
      expect(error.filePath).toBe("/file.txt");
      expect(error.cause).toBe(cause);
      expect(error.suggestion).toBeDefined();
    });

    it("should create comment parsing error", () => {
      const cause = new Error("Parse error");
      const error = LineCounterError.commentParsingError(
        "/file.ts",
        "Invalid syntax",
        cause,
      );
      expect(error.code).toBe(ErrorCode.COMMENT_PARSING_ERROR);
      expect(error.message).toContain("Invalid syntax");
      expect(error.filePath).toBe("/file.ts");
      expect(error.cause).toBe(cause);
      expect(error.suggestion).toBeDefined();
    });
  });
});

describe("isError", () => {
  it("should return true for LineCounterError", () => {
    const error = LineCounterError.io("Test");
    expect(isError(error)).toBe(true);
  });

  it("should return false for regular Error", () => {
    const error = new Error("Test");
    expect(isError(error)).toBe(false);
  });

  it("should return false for non-error values", () => {
    expect(isError("string")).toBe(false);
    expect(isError(123)).toBe(false);
    expect(isError(null)).toBe(false);
    expect(isError(undefined)).toBe(false);
  });
});
