import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanDirectory } from "../../src/core/scanner/index.js";
import { scanFile } from "../../src/core/scanner/scanner.js";
import type { Args } from "../../src/cli/args.js";
import {
  createTempDir,
  createTestDirStructure,
  createTestFile,
  removeTempDir,
} from "../utils/test-helpers.js";

describe("Scanner Integration Tests", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("should scan a simple directory structure", async () => {
    createTestDirStructure(tempDir, {
      "file1.ts": "const x = 1;\nconst y = 2;",
      "file2.js": "function test() {\n  return true;\n}",
      subdir: {
        "file3.ts": "export const z = 3;",
      },
    });

    const args: Args = {
      directory: tempDir,
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
      quiet: true,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = await scanDirectory(args);

    expect(result).toBeDefined();
    if (result && !(result instanceof Error)) {
      expect(result.total_files).toBeGreaterThan(0);
      expect(result.total_lines).toBeGreaterThan(0);
    }
  });

  it("should respect exclude patterns", async () => {
    createTestDirStructure(tempDir, {
      "file1.ts": "const x = 1;",
      node_modules: {
        "file2.ts": "const y = 2;",
      },
      dist: {
        "file3.js": "const z = 3;",
      },
    });

    const args: Args = {
      directory: tempDir,
      files_only: false,
      lines_only: false,
      exclude_patterns: ["node_modules", "dist"],
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
      quiet: true,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = await scanDirectory(args);

    expect(result).toBeDefined();
    if (result && !(result instanceof Error)) {
      expect(result.total_files).toBe(1);
    }
  });

  it("should filter by extension", async () => {
    createTestDirStructure(tempDir, {
      "file1.ts": "const x = 1;",
      "file2.js": "const y = 2;",
      "file3.ts": "const z = 3;",
    });

    const args: Args = {
      directory: tempDir,
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: ["ts"],
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
      quiet: true,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = await scanDirectory(args);

    expect(result).toBeDefined();
    if (result && !(result instanceof Error)) {
      expect(result.total_files).toBe(2);
    }
  });

  it("should handle empty directory", async () => {
    const args: Args = {
      directory: tempDir,
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
      quiet: true,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = await scanDirectory(args);

    expect(result).toBeDefined();
    if (result && !(result instanceof Error)) {
      expect(result.total_files).toBe(0);
      expect(result.total_lines).toBe(0);
    }
  });

  it("should handle max_depth option", async () => {
    createTestDirStructure(tempDir, {
      level1: {
        "file1.ts": "const x = 1;",
        level2: {
          "file2.ts": "const y = 2;",
          level3: {
            "file3.ts": "const z = 3;",
          },
        },
      },
    });

    const args: Args = {
      directory: tempDir,
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: [],
      exclude_extensions: [],
      exclude_dirs: [],
      include_dirs: [],
      exclude_names: [],
      include_names: [],
      max_depth: 2,
      no_hidden: false,
      no_empty: false,
      follow_links: false,
      show_stats: false,
      show_progress: false,
      no_binary: false,
      ignore_case: false,
      quiet: true,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = await scanDirectory(args);

    expect(result).toBeDefined();
    if (result && !(result instanceof Error)) {
      expect(result.total_files).toBeLessThanOrEqual(2);
    }
  });

  it("should apply exclude_dir when scanning a single file path", async () => {
    const srcDir = path.join(tempDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    const filePath = createTestFile(srcDir, "file.ts", "const x = 1;");

    const args: Args = {
      directory: filePath,
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: [],
      exclude_extensions: [],
      exclude_dirs: ["src"],
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
      quiet: true,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = await scanFile(args);

    expect(result).toBeDefined();
    if (result && !(result instanceof Error)) {
      expect(result.total_files).toBe(0);
    }
  });

  it("should apply include_dir when scanning a single file path", async () => {
    const srcDir = path.join(tempDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    const filePath = createTestFile(srcDir, "file.ts", "const x = 1;");

    const args: Args = {
      directory: filePath,
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: [],
      exclude_extensions: [],
      exclude_dirs: [],
      include_dirs: ["other"],
      exclude_names: [],
      include_names: [],
      no_hidden: false,
      no_empty: false,
      follow_links: false,
      show_stats: false,
      show_progress: false,
      no_binary: false,
      ignore_case: false,
      quiet: true,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = await scanFile(args);

    expect(result).toBeDefined();
    if (result && !(result instanceof Error)) {
      expect(result.total_files).toBe(0);
    }
  });

  it("explains exclusions and can bypass gitignore rules", async () => {
    createTestFile(tempDir, "included.ts", "const included = true;");
    createTestFile(tempDir, "ignored.ts", "const ignored = true;");
    createTestFile(tempDir, "excluded.log", "noise");
    fs.writeFileSync(path.join(tempDir, ".gitignore"), "ignored.ts\n", "utf-8");

    const args: Args = {
      directory: tempDir,
      directories: [tempDir],
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: [],
      exclude_extensions: ["log"],
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
      quiet: true,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
      duplicates: false,
      workspaces: false,
      explain: true,
      use_gitignore: true,
    };

    const explained = await scanDirectory(args);
    expect(explained).not.toBeInstanceOf(Error);
    if (explained instanceof Error) return;
    expect(explained.total_files).toBe(1);
    expect(explained.exclusions?.by_reason.gitignore).toBeGreaterThan(0);
    expect(explained.exclusions?.by_reason["exclude-extension"]).toBe(1);

    const withoutGitignore = await scanDirectory({
      ...args,
      use_gitignore: false,
    });
    expect(withoutGitignore).not.toBeInstanceOf(Error);
    if (!(withoutGitignore instanceof Error)) {
      expect(withoutGitignore.total_files).toBe(2);
    }
  });
});
