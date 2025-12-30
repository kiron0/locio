import { describe, expect, it, vi } from "vitest";
import type { Args } from "../../src/cli/args.js";
import { OutputFormat } from "../../src/cli/args.js";
import { ErrorCode, LineCounterError } from "../../src/core/errors.js";
import { ErrorLogger } from "../../src/utils/error-logger.js";

describe("ErrorLogger", () => {
  function createArgsWithArrayExport(
    quiet = false,
    exportFormat: OutputFormat | OutputFormat[],
  ): Args {
    return {
      directory: ".",
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: [],
      exclude_extensions: [],
      exclude_dirs: [],
      include_dirs: [],
      exclude_names: [],
      include_names: [],
      no_hidden: false,
      no_empty: false,
      follow_links: false,
      show_stats: false,
      show_progress: false,
      no_binary: false,
      ignore_case: false,
      quiet,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
      export: exportFormat,
    };
  }

  function createTestArgs(quiet = false, exportFormat?: OutputFormat): Args {
    return {
      directory: ".",
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: [],
      exclude_extensions: [],
      exclude_dirs: [],
      include_dirs: [],
      exclude_names: [],
      include_names: [],
      no_hidden: false,
      no_empty: false,
      follow_links: false,
      show_stats: false,
      show_progress: false,
      no_binary: false,
      ignore_case: false,
      quiet,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
      export: exportFormat,
    };
  }

  describe("Constructor", () => {
    it("should create error logger with quiet mode", () => {
      const args = createTestArgs(true);
      const logger = new ErrorLogger(args);
      expect(logger).toBeInstanceOf(ErrorLogger);
    });

    it("should detect JSON export format", () => {
      const args = createTestArgs(false, OutputFormat.Json);
      const logger = new ErrorLogger(args);

      expect(logger).toBeInstanceOf(ErrorLogger);
    });

    it("should detect JSON in array export formats", () => {
      const args = createArgsWithArrayExport(false, [
        OutputFormat.Json,
        OutputFormat.Html,
      ]);
      const logger = new ErrorLogger(args);
      expect(logger).toBeInstanceOf(ErrorLogger);
    });
  });

  describe("logError", () => {
    it("should log LineCounterError with all properties", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      const error = LineCounterError.io(
        "Test error",
        undefined,
        "/path/to/file.ts",
      );

      logger.logError(error);

      const errors = logger.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(ErrorCode.IO_ERROR);
      expect(errors[0].message).toContain("Test error");
      expect(errors[0].filePath).toBe("/path/to/file.ts");
    });

    it("should log generic Error", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      const error = new Error("Generic error");

      logger.logError(error, "/path/to/file.ts");

      const errors = logger.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(ErrorCode.FILE_PROCESSING_ERROR);
      expect(errors[0].message).toBe("Generic error");
      expect(errors[0].filePath).toBe("/path/to/file.ts");
    });

    it("should include error cause when available", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      const cause = new Error("Underlying error");
      const error = new Error("Main error");
      error.cause = cause;

      logger.logError(error);

      const errors = logger.getErrors();
      expect(errors[0].cause).toBeDefined();
      expect(errors[0].cause?.message).toBe("Underlying error");
    });

    it("should not include cause for non-Error causes", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      const error = new Error("Test");
      error.cause = { someProperty: "value" } as any;

      logger.logError(error);

      const errors = logger.getErrors();
      expect(errors[0].cause).toBeUndefined();
    });
  });

  describe("getErrors", () => {
    it("should return all logged errors", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);

      logger.logError(LineCounterError.io("Error 1"));
      logger.logError(LineCounterError.io("Error 2"));

      const errors = logger.getErrors();
      expect(errors.length).toBe(2);
    });

    it("should return a copy of errors array", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      logger.logError(LineCounterError.io("Error"));

      const errors1 = logger.getErrors();
      const errors2 = logger.getErrors();

      expect(errors1).not.toBe(errors2);
      expect(errors1).toEqual(errors2);
    });
  });

  describe("getErrorsAsJson", () => {
    it("should return errors as JSON string", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      logger.logError(LineCounterError.io("Test error"));

      const json = logger.getErrorsAsJson();
      expect(typeof json).toBe("string");

      const data = JSON.parse(json);
      expect(data.errors).toBeDefined();
      expect(data.total).toBe(1);
      expect(Array.isArray(data.errors)).toBe(true);
    });

    it("should include error summary in JSON", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      logger.logError(LineCounterError.io("Error 1"));
      logger.logError(LineCounterError.io("Error 2"));

      const json = logger.getErrorsAsJson();
      const data = JSON.parse(json);

      expect(data.total).toBe(2);
      expect(data.errors.length).toBe(2);
    });
  });

  describe("getErrorSummary", () => {
    it("should return error summary statistics", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      logger.logError(LineCounterError.io("Error 1", undefined, "/file1.ts"));
      logger.logError(LineCounterError.io("Error 2", undefined, "/file2.ts"));
      logger.logError(LineCounterError.fileNotFound("/file3.ts"), "/file3.ts");

      const summary = logger.getErrorSummary();

      expect(summary.total).toBe(3);
      expect(summary.byCode).toBeDefined();
      expect(summary.byFile).toBeDefined();
      expect(summary.byFile["/file1.ts"]).toBe(1);
      expect(summary.byFile["/file2.ts"]).toBe(1);
      expect(summary.byFile["/file3.ts"]).toBe(1);
    });

    it("should count errors by code", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      logger.logError(LineCounterError.io("IO Error"));
      logger.logError(LineCounterError.io("Another IO Error"));
      logger.logError(LineCounterError.fileNotFound("/file.ts"));

      const summary = logger.getErrorSummary();

      expect(summary.byCode[ErrorCode.IO_ERROR]).toBe(2);
      expect(summary.byCode[ErrorCode.FILE_NOT_FOUND]).toBe(1);
    });
  });

  describe("clear", () => {
    it("should clear all logged errors", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      logger.logError(LineCounterError.io("Error 1"));
      logger.logError(LineCounterError.io("Error 2"));

      expect(logger.hasErrors()).toBe(true);
      logger.clear();
      expect(logger.hasErrors()).toBe(false);
      expect(logger.getErrorCount()).toBe(0);
    });
  });

  describe("hasErrors", () => {
    it("should return false when no errors logged", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      expect(logger.hasErrors()).toBe(false);
    });

    it("should return true when errors are logged", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      logger.logError(LineCounterError.io("Error"));
      expect(logger.hasErrors()).toBe(true);
    });
  });

  describe("getErrorCount", () => {
    it("should return correct error count", () => {
      const args = createTestArgs();
      const logger = new ErrorLogger(args);
      expect(logger.getErrorCount()).toBe(0);

      logger.logError(LineCounterError.io("Error 1"));
      expect(logger.getErrorCount()).toBe(1);

      logger.logError(LineCounterError.io("Error 2"));
      expect(logger.getErrorCount()).toBe(2);
    });
  });

  describe("Quiet Mode", () => {
    it("should not output to console in quiet mode", () => {
      const args = createTestArgs(true);
      const logger = new ErrorLogger(args);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      logger.logError(LineCounterError.io("Error"));

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
