import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Args } from "../../src/cli/args.js";
import { OutputFormat } from "../../src/cli/args.js";
import { loadConfig, mergeConfigIntoArgs } from "../../src/cli/config.js";
import { createTempDir, removeTempDir } from "../utils/test-helpers.js";

describe("CLI config loading and merging", () => {
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
      show_progress: true,
      no_binary: false,
      ignore_case: false,
      quiet: false,
      export: undefined,
      export_path: undefined,
      version: false,
      watch: false,
      comments: true,
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

  it("should load config from .lociorc.json with highest precedence", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        locio: {
          exclude_dirs: ["from-package-json"],
          stats: true,
        },
      }),
      "utf-8",
    );

    fs.writeFileSync(
      path.join(tempDir, "locio.config.json"),
      JSON.stringify({
        exclude_dirs: ["from-locio-config"],
        stats: false,
      }),
      "utf-8",
    );

    fs.writeFileSync(
      path.join(tempDir, ".lociorc.json"),
      JSON.stringify({
        exclude_dirs: ["from-rc"],
        stats: true,
        export: "json,html",
      }),
      "utf-8",
    );

    const configArgs = loadConfig(tempDir);
    expect(configArgs).not.toBeNull();

    if (!configArgs) return;

    expect(configArgs.exclude_dirs).toEqual(["from-rc"]);
    expect(configArgs.show_stats).toBe(true);

    expect(configArgs.export).toBeDefined();
    if (Array.isArray(configArgs.export)) {
      expect(configArgs.export).toContain(OutputFormat.Json);
      expect(configArgs.export).toContain(OutputFormat.Html);
    } else {
      expect([OutputFormat.Json, OutputFormat.Html]).toContain(
        configArgs.export,
      );
    }
  });

  it("mergeConfigIntoArgs should not override explicit CLI options", () => {
    const cliArgs = createBaseArgs();
    cliArgs.exclude_dirs = ["from-cli"];
    cliArgs.no_binary = true;

    const configArgs: Partial<Args> = {
      exclude_dirs: ["from-config"],
      no_binary: false,
      include_extensions: ["ts"],
    };

    const explicitCliKeys = new Set<string>(["exclude_dirs", "no_binary"]);

    const merged = mergeConfigIntoArgs(cliArgs, configArgs, explicitCliKeys);

    expect(merged.exclude_dirs).toEqual(["from-cli"]);
    expect(merged.no_binary).toBe(true);
    expect(merged.include_extensions).toEqual(["ts"]);
  });
});
