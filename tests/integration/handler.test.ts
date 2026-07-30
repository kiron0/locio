import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutputFormat, type Args } from "../../src/cli/args.js";
import { runWithExit } from "../../src/cli/handler.js";
import {
  createTempDir,
  createTestFile,
  removeTempDir,
} from "../utils/test-helpers.js";

describe("CLI handler integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  function createBaseArgs(): Args {
    return {
      directory: tempDir,
      directories: [tempDir],
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      exclude_extensions: [],
      include_extensions: [],
      exclude_dirs: [],
      include_dirs: [],
      exclude_names: [],
      include_names: [],
      max_size: undefined,
      min_size: undefined,
      no_hidden: false,
      no_empty: false,
      follow_links: false,
      max_depth: undefined,
      show_stats: false,
      show_progress: false,
      no_binary: false,
      ignore_case: false,
      quiet: true,
      export: OutputFormat.Json,
      export_path: path.join(tempDir, "reports"),
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
      top_files: undefined,
      top_dirs: undefined,
      collect_details: undefined,
      max_details: undefined,
      watch_debounce: undefined,
      duplicates: false,
      workspaces: false,
    };
  }

  it("detects duplicates across multiple target directories", async () => {
    const dirOne = path.join(tempDir, "one");
    const dirTwo = path.join(tempDir, "two");
    fs.mkdirSync(dirOne, { recursive: true });
    fs.mkdirSync(dirTwo, { recursive: true });

    createTestFile(dirOne, "a.ts", "same\n");
    createTestFile(dirTwo, "b.ts", "same\n");

    const args = createBaseArgs();
    args.directory = dirOne;
    args.directories = [dirOne, dirTwo];
    args.duplicates = true;

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);

    await expect(runWithExit(args)).rejects.toThrow("process.exit:0");
    exitSpy.mockRestore();

    const reportPath = path.join(tempDir, "reports", "LocIO-report.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    expect(report.duplicate_groups).toBeDefined();
    expect(report.duplicate_groups).toHaveLength(1);
    expect(report.duplicate_groups[0].files).toHaveLength(2);
  });
});
