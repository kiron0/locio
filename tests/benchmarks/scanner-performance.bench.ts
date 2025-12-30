import { afterEach, beforeEach, describe, it } from "vitest";
import type { Args } from "../../src/cli/args.js";
import { scanDirectory } from "../../src/core/scanner/index.js";
import {
  createTempDir,
  createTestDirStructure,
  removeTempDir,
} from "../utils/test-helpers.js";

async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  const start = performance.now();
  const result = fn();

  if (result instanceof Promise) {
    await result;
    const end = performance.now();
    const duration = end - start;
    console.log(`  ${name}: ${duration.toFixed(2)}ms`);
  } else {
    const end = performance.now();
    const duration = end - start;
    console.log(`  ${name}: ${duration.toFixed(2)}ms`);
  }
}

describe("Scanner Performance Benchmarks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  describe("Small Codebase (< 100 files)", () => {
    beforeEach(() => {
      createTestDirStructure(tempDir, {
        src: {
          "file1.ts": "const x = 1;\nconst y = 2;",
          "file2.ts": "function test() { return true; }",
          "file3.ts": "export const z = 3;",
        },
        tests: {
          "test1.ts": "describe('test', () => {});",
          "test2.ts": "it('works', () => {});",
        },
      });
    });

    it("benchmark: scan small codebase", async () => {
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

      await benchmark("Scan small codebase (< 100 files)", async () => {
        await scanDirectory(args);
      });
    });
  });

  describe("Medium Codebase (100-1000 files)", () => {
    beforeEach(() => {
      const structure: Record<string, string | Record<string, unknown>> = {};

      for (let i = 0; i < 10; i++) {
        const dirFiles: Record<string, string> = {};
        for (let j = 0; j < 10; j++) {
          dirFiles[`file${j}.ts`] = `const x${i}_${j} = ${i * 10 + j};`;
        }
        structure[`dir${i}`] = dirFiles;
      }

      createTestDirStructure(tempDir, structure);
    });

    it("benchmark: scan medium codebase", async () => {
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

      await benchmark("Scan medium codebase (100-1000 files)", async () => {
        await scanDirectory(args);
      });
    });

    it("benchmark: scan with extension filter", async () => {
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

      await benchmark("Scan with extension filter", async () => {
        await scanDirectory(args);
      });
    });

    it("benchmark: scan with exclude patterns", async () => {
      const args: Args = {
        directory: tempDir,
        files_only: false,
        lines_only: false,
        exclude_patterns: ["dir0", "dir1"],
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

      await benchmark("Scan with exclude patterns", async () => {
        await scanDirectory(args);
      });
    });
  });

  describe("Performance Regression Tests", () => {
    it("benchmark: baseline performance (10 files)", async () => {
      const structure: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        structure[`file${i}.ts`] = `const x${i} = ${i};`;
      }
      createTestDirStructure(tempDir, structure);

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

      await benchmark("Baseline: 10 files", async () => {
        await scanDirectory(args);
      });
    });

    it("benchmark: before/after optimization comparison", async () => {
      const structure: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        structure[`file${i}.ts`] = `const x${i} = ${i};\n`.repeat(10);
      }
      createTestDirStructure(tempDir, structure);

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

      await benchmark("Optimization comparison: 100 files", async () => {
        await scanDirectory(args);
      });
    });
  });
});
