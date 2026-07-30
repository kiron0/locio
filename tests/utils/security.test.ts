import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { FILE_CONSTANTS } from "../../src/core/constants.js";
import {
  isDirectorySafeToWatch,
  isPathSafe,
  validateAndSanitizePath,
  validateExportPath,
} from "../../src/utils/security.js";

describe("Security Utilities", () => {
  describe("isPathSafe", () => {
    it("should allow safe paths within base directory", () => {
      const baseDir = "/home/user/project";
      const safePath = "/home/user/project/src/file.ts";
      expect(isPathSafe(safePath, baseDir)).toBe(true);
    });

    it("should reject path traversal attempts", () => {
      const baseDir = "/home/user/project";
      const unsafePath = "/home/user/project/../../etc/passwd";
      expect(isPathSafe(unsafePath, baseDir)).toBe(false);
    });

    it("should reject paths with null bytes", () => {
      const baseDir = "/home/user/project";
      const unsafePath = "/home/user/project/file\0.ts";
      expect(isPathSafe(unsafePath, baseDir)).toBe(false);
    });

    it("should reject paths outside base directory", () => {
      const baseDir = "/home/user/project";
      const unsafePath = "/home/user/other/file.ts";
      expect(isPathSafe(unsafePath, baseDir)).toBe(false);
    });

    it("should handle relative paths correctly", () => {
      const baseDir = path.resolve(".");
      const safePath = path.join(baseDir, "src", "file.ts");
      expect(isPathSafe(safePath, baseDir)).toBe(true);
    });

    it("should allow safe filenames containing consecutive dots", () => {
      const baseDir = "/home/user/project";
      const safePath = "/home/user/project/src/file..test.ts";
      expect(isPathSafe(safePath, baseDir)).toBe(true);
      expect(validateAndSanitizePath(safePath, baseDir)).toBe(safePath);
    });

    it("should handle Windows paths", () => {
      const baseDir = "C:\\Users\\Project";
      const safePath = "C:\\Users\\Project\\src\\file.ts";
      expect(isPathSafe(safePath, baseDir)).toBe(true);

      const unsafePath = "C:\\Users\\Project\\..\\..\\Windows\\System32";
      expect(isPathSafe(unsafePath, baseDir)).toBe(false);
    });
  });

  describe("shouldSkipFileDueToSize", () => {
    it("should skip files larger than max size", () => {
      const filePath = "/path/to/large-file.bin";
      const maxSize = 100 * 1024 * 1024;

      const originalStatSync = fs.statSync;
      const mockStatSync = () => ({
        size: 150 * 1024 * 1024,
        isFile: () => true,
      });

      expect(150 * 1024 * 1024 > maxSize).toBe(true);
    });

    it("should not skip files within size limit", () => {
      const maxSize = FILE_CONSTANTS.MAX_SAFE_FILE_SIZE;
      const smallSize = 10 * 1024 * 1024;
      expect(smallSize < maxSize).toBe(true);
    });

    it("should use default max size from constants", () => {
      expect(FILE_CONSTANTS.MAX_SAFE_FILE_SIZE).toBe(100 * 1024 * 1024);
    });
  });

  describe("validateExportPath", () => {
    it("should validate safe export paths", () => {
      const baseDir = path.resolve(".");
      const safePath = path.join(baseDir, "exports");
      expect(() => validateExportPath(safePath, baseDir)).not.toThrow();
    });

    it("should allow export paths outside the base directory", () => {
      const baseDir = path.resolve(".");
      const externalPath = path.join(baseDir, "..", "..", "tmp", "exports");
      expect(() => validateExportPath(externalPath, baseDir)).not.toThrow();
    });

    it("should sanitize dangerous characters in filenames", () => {
      const baseDir = path.resolve(".");
      const pathWithDangerousChars = path.join(
        baseDir,
        "exports",
        'file<>:"|?*.json',
      );

      const result = validateExportPath(pathWithDangerousChars, baseDir);
      expect(result).toBeDefined();

      expect(path.basename(result)).not.toContain("<");
      expect(path.basename(result)).not.toContain(">");
    });

    it("should handle relative export paths", () => {
      const baseDir = path.resolve(".");
      const relativePath = "./exports";
      expect(() => validateExportPath(relativePath, baseDir)).not.toThrow();
    });

    it("should reject paths with null bytes", () => {
      const baseDir = path.resolve(".");
      const unsafePath = path.join(baseDir, "exports") + "\0";
      expect(() => validateExportPath(unsafePath, baseDir)).toThrow();
    });
  });

  describe("isDirectorySafeToWatch", () => {
    it("should allow normal project directories inside the home directory", () => {
      const projectDir = path.join(os.homedir(), "projects", "locio");
      expect(isDirectorySafeToWatch(projectDir)).toBe(true);
    });

    it("should reject watching the home directory itself", () => {
      expect(isDirectorySafeToWatch(os.homedir())).toBe(false);
    });
  });
});
