import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findDuplicates } from "../../../src/core/scanner/index.js";
import type { FileDetail } from "../../../src/core/types.js";
import {
  createTempDir,
  createTestFile,
  removeTempDir,
} from "../../utils/test-helpers.js";

describe("findDuplicates", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  function createFileDetail(fileName: string, lines: number): FileDetail {
    const fullPath = path.join(tempDir, fileName);
    const stats = fs.statSync(fullPath);
    return {
      directory: tempDir,
      name: fileName,
      extension: path.extname(fileName).replace(/^\./, ""),
      size: stats.size,
      lines,
    };
  }

  it("should detect duplicate files by content", () => {
    createTestFile(tempDir, "a.ts", "console.log('x');\n");
    createTestFile(tempDir, "b.ts", "console.log('x');\n");
    createTestFile(tempDir, "c.ts", "console.log('y');\n");

    const details: FileDetail[] = [
      createFileDetail("a.ts", 1),
      createFileDetail("b.ts", 1),
      createFileDetail("c.ts", 1),
    ];

    const groups = findDuplicates(details, tempDir);

    expect(groups.length).toBe(1);
    const group = groups[0];
    expect(group.files.length).toBe(2);
    const fileNames = group.files.map((f) => path.basename(f.fullPath));
    expect(fileNames.sort()).toEqual(["a.ts", "b.ts"]);
  });

  it("should respect maxFileSize and skip very large files", () => {
    createTestFile(tempDir, "small.ts", "console.log('small');\n");
    const largeContent = "x".repeat(1024 * 1024); // 1MB
    createTestFile(tempDir, "large.ts", largeContent);

    const details: FileDetail[] = [
      createFileDetail("small.ts", 1),
      createFileDetail("large.ts", 1),
    ];

    const groups = findDuplicates(details, tempDir, 10); // 10 bytes max

    expect(groups.length).toBe(0);
  });
});
