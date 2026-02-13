import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPackageVersion } from "../../src/utils/version.js";
import {
  createTempDir,
  createTestFile,
  removeTempDir,
} from "./test-helpers.js";

describe("getPackageVersion", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    removeTempDir(tempDir);
  });

  it("should return a version string", () => {
    const version = getPackageVersion();
    expect(typeof version).toBe("string");
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("should return default version if package.json not found", () => {
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    const version = getPackageVersion();

    expect(typeof version).toBe("string");
  });

  it("should read version from package.json in current directory", () => {
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    createTestFile(
      tempDir,
      "package.json",
      JSON.stringify({ version: "1.2.3" }),
    );
    const version = getPackageVersion();

    expect(typeof version).toBe("string");
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("should handle invalid JSON gracefully", () => {
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    createTestFile(tempDir, "package.json", "invalid json");
    const version = getPackageVersion();

    expect(typeof version).toBe("string");
  });
});
