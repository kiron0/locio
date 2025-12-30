import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Args } from "../../../src/cli/args.js";
import { createFilterPatterns } from "../../../src/core/filter/filter.js";
import { createTempDir, removeTempDir } from "../../utils/test-helpers.js";

describe("createFilterPatterns", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("should create filter patterns from args", () => {
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
      quiet: false,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = createFilterPatterns(args);
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.exclude_extensions).toBeDefined();
      expect(result.include_extensions).toBeDefined();
    }
  });

  it("should handle exclude extensions", () => {
    const args: Args = {
      directory: tempDir,
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: [],
      exclude_extensions: ["js", "ts"],
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
      quiet: false,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = createFilterPatterns(args);
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.exclude_extensions).toContain("js");
      expect(result.exclude_extensions).toContain("ts");
    }
  });

  it("should handle include extensions", () => {
    const args: Args = {
      directory: tempDir,
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: ["ts", "js"],
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
      quiet: false,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = createFilterPatterns(args);
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.include_extensions).toContain("ts");
      expect(result.include_extensions).toContain("js");
    }
  });

  it("should handle exclude patterns", () => {
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
      quiet: false,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = createFilterPatterns(args);
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.exclude_patterns.length).toBeGreaterThan(0);
    }
  });

  it("should handle invalid regex patterns", () => {
    const args: Args = {
      directory: tempDir,
      files_only: false,
      lines_only: false,
      exclude_patterns: ["[invalid"],
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
      quiet: false,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = createFilterPatterns(args);
    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
      expect(result.message).toContain("Invalid regex pattern");
    }
  });

  it("should handle max_size parameter", () => {
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
      max_size: "10MB",
      no_hidden: false,
      no_empty: false,
      follow_links: false,
      show_stats: false,
      show_progress: false,
      no_binary: false,
      ignore_case: false,
      quiet: false,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = createFilterPatterns(args);
    expect(result).not.toBeInstanceOf(Error);
  });

  it("should handle min_size parameter", () => {
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
      min_size: "1KB",
      no_hidden: false,
      no_empty: false,
      follow_links: false,
      show_stats: false,
      show_progress: false,
      no_binary: false,
      ignore_case: false,
      quiet: false,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = createFilterPatterns(args);
    expect(result).not.toBeInstanceOf(Error);
  });

  it("should return error for invalid size format", () => {
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
      max_size: "invalid",
      no_hidden: false,
      no_empty: false,
      follow_links: false,
      show_stats: false,
      show_progress: false,
      no_binary: false,
      ignore_case: false,
      quiet: false,
      version: false,
      watch: false,
      comments: false,
      code_vs_comments: false,
      rm_comments: false,
    };

    const result = createFilterPatterns(args);
    expect(result).toBeInstanceOf(Error);
  });
});
