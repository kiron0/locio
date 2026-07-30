import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Args, OutputFormat } from "../../../src/cli/args.js";
import { exportReport } from "../../../src/core/export/export.js";
import { buildHtmlOutput } from "../../../src/core/export/export-html.js";
import { buildHumanReport } from "../../../src/core/export/export-human.js";
import { buildJsonOutput } from "../../../src/core/export/export-json.js";
import type { Summary } from "../../../src/core/types.js";
import { createSummary } from "../../../src/core/types.js";
import { createTempDir, removeTempDir } from "../../utils/test-helpers.js";

describe("Export Functionality - Simple Tests", () => {
  let tempDir: string;
  let externalDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    externalDir = createTempDir();
  });

  afterEach(() => {
    try {
      const reportsDir = path.join(tempDir, "reports");
      if (fs.existsSync(reportsDir)) {
        const files = fs.readdirSync(reportsDir);
        for (const file of files) {
          if (file.startsWith("LocIO-report")) {
            fs.unlinkSync(path.join(reportsDir, file));
          }
        }
      }
    } catch {}
    removeTempDir(tempDir);
    removeTempDir(externalDir);
  });

  function createTestSummary(): Summary {
    const summary = createSummary();
    summary.total_files = 3;
    summary.total_lines = 15;
    summary.total_size = 150;
    summary.files_by_extension = { ts: 2, js: 1 };
    summary.lines_by_extension = { ts: 10, js: 5 };
    summary.size_by_extension = { ts: 100, js: 50 };
    summary.code_lines_by_extension = { ts: 8, js: 4 };
    summary.comment_lines_by_extension = { ts: 2, js: 1 };
    summary.blank_lines_by_extension = { ts: 1, js: 1 };
    summary.details = [
      {
        directory: tempDir,
        name: "file1.ts",
        extension: "ts",
        size: 50,
        lines: 5,
      },
      {
        directory: tempDir,
        name: "file2.ts",
        extension: "ts",
        size: 50,
        lines: 5,
      },
      {
        directory: tempDir,
        name: "file3.js",
        extension: "js",
        size: 50,
        lines: 5,
      },
    ];
    return summary;
  }

  function createTestArgs(exportFormat?: OutputFormat | OutputFormat[]): Args {
    return {
      directory: tempDir,
      directories: [tempDir],
      files_only: false,
      lines_only: false,
      exclude_patterns: [],
      include_extensions: [],
      exclude_extensions: [],
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
      export: exportFormat,
      export_path: undefined as string | undefined,
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

  function getReportPath(filename: string): string {
    return path.join(tempDir, "reports", filename);
  }

  describe("JSON Export", () => {
    it("writes structured output directly to stdout", () => {
      const summary = createTestSummary();
      const args = createTestArgs();
      args.stdout = OutputFormat.Json;
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);

      exportReport(summary, args);

      const output = String(writeSpy.mock.calls[0]?.[0]);
      expect(JSON.parse(output).files).toBe(3);
      expect(fs.existsSync(getReportPath("LocIO-report.json"))).toBe(false);
      writeSpy.mockRestore();
    });

    it("should export summary as JSON to current directory", () => {
      const summary = createTestSummary();
      const args = createTestArgs(OutputFormat.Json);

      exportReport(summary, args);

      const jsonFile = getReportPath("LocIO-report.json");
      expect(fs.existsSync(jsonFile)).toBe(true);

      const content = fs.readFileSync(jsonFile, "utf-8");
      const data = JSON.parse(content);

      expect(data.files).toBe(3);
      expect(data.lines).toBe(15);
      expect(data.size).toBe(150);

      expect(data.by_language).toBeDefined();
      if (Array.isArray(data.by_language)) {
        const langs = data.by_language.map(
          (l: { language: string }) => l.language,
        );
        expect(langs).toContain("TypeScript");
        expect(langs).toContain("JavaScript");
      }
    });

    it("should include extension statistics when show_stats is true", () => {
      const summary = createTestSummary();
      const args = createTestArgs(OutputFormat.Json);
      args.show_stats = true;

      exportReport(summary, args);

      const jsonFile = getReportPath("LocIO-report.json");
      if (fs.existsSync(jsonFile)) {
        const content = fs.readFileSync(jsonFile, "utf-8");
        const data = JSON.parse(content);

        expect(data.stats).toBeDefined();
        if (data.stats) {
          expect(data.stats.ts).toBeDefined();
          expect(data.stats.ts.files).toBe(2);
        }
      }
    });

    it("should write reports beside a scanned file instead of under the file path", () => {
      const summary = createTestSummary();
      const singleFile = path.join(tempDir, "single.ts");
      fs.writeFileSync(singleFile, "const x = 1;\n", "utf-8");

      const args = createTestArgs(OutputFormat.Json);
      args.directory = singleFile;
      args.directories = [singleFile];

      exportReport(summary, args);

      const jsonFile = path.join(tempDir, "reports", "LocIO-report.json");
      expect(fs.existsSync(jsonFile)).toBe(true);
    });

    it("should allow exporting to a custom absolute directory outside the scan root", () => {
      const summary = createTestSummary();
      const args = createTestArgs(OutputFormat.Json);
      args.export_path = path.join(externalDir, "reports");

      exportReport(summary, args);

      const jsonFile = path.join(externalDir, "reports", "LocIO-report.json");
      expect(fs.existsSync(jsonFile)).toBe(true);
    });

    it("should label multi-directory reports with all scanned directories", () => {
      const summary = createTestSummary();
      const firstDir = path.join(tempDir, "one");
      const secondDir = path.join(tempDir, "two");
      fs.mkdirSync(firstDir, { recursive: true });
      fs.mkdirSync(secondDir, { recursive: true });

      const args = createTestArgs(OutputFormat.Json);
      args.directory = firstDir;
      args.directories = [firstDir, secondDir];

      const output = JSON.parse(buildJsonOutput(summary, args));
      expect(output.directory).toBe(`${firstDir}, ${secondDir}`);
      expect("project_type" in output).toBe(false);
    });

    it("should omit line and comment metrics from JSON files-only reports", () => {
      const summary = createTestSummary();
      const args = createTestArgs(OutputFormat.Json);
      args.files_only = true;
      args.show_stats = true;
      args.comments = true;

      const output = JSON.parse(buildJsonOutput(summary, args));
      expect(output.lines).toBeUndefined();
      expect(output.stats.ts.lines).toBeUndefined();
      expect(output.stats.ts.comment_lines).toBeUndefined();
      expect(output.by_language[0].lines).toBeUndefined();
      expect(output.by_language[0].comment_lines).toBeUndefined();
    });
  });

  describe("HTML Export", () => {
    it("should export summary as HTML", () => {
      const summary = createTestSummary();
      const args = createTestArgs(OutputFormat.Html);

      exportReport(summary, args);

      const htmlFile = getReportPath("LocIO-report.html");
      expect(fs.existsSync(htmlFile)).toBe(true);

      const content = fs.readFileSync(htmlFile, "utf-8");
      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("LocIO Report");
      expect(content).toContain("Total Files");

      expect(content).toContain("languageChart");
      expect(content).toContain("treemapContainer");
      expect(content).toContain("Interactive Treemap");
    });

    it("should include dependency graph in HTML", () => {
      const summary = createTestSummary();
      const args = createTestArgs(OutputFormat.Html);

      exportReport(summary, args);

      const htmlFile = getReportPath("LocIO-report.html");
      if (fs.existsSync(htmlFile)) {
        const content = fs.readFileSync(htmlFile, "utf-8");

        expect(content).toContain("vis-network");
        expect(content).toContain("dependencyGraph");
        expect(content).toContain("Directory Structure Graph");
      }
    });

    it("escapes filenames and inline script data", () => {
      const summary = createTestSummary();
      summary.details[0] = {
        directory: `${tempDir}/\"><img src=x onerror=alert(1)>`,
        name: "</script><script>alert(1)</script>.ts",
        extension: "</script><script>alert(2)</script>",
        size: 50,
        lines: 5,
      };
      const args = createTestArgs(OutputFormat.Html);
      args.top_files = 1;
      args.top_dirs = 1;

      const content = buildHtmlOutput(summary, args);

      expect(content).not.toContain("<script>alert(1)</script>");
      expect(content).not.toContain("<script>alert(2)</script>");
      expect(content).not.toContain("<img src=x onerror=alert(1)>");
      expect(content).toContain("\\u003c/script\\u003e");
      expect(content).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });
  });

  describe("CSV Export", () => {
    it("should export summary as CSV", () => {
      const summary = createTestSummary();
      const args = createTestArgs(OutputFormat.Csv);
      args.show_stats = true;

      exportReport(summary, args);

      const csvFile = getReportPath("LocIO-report.csv");
      expect(fs.existsSync(csvFile)).toBe(true);

      const content = fs.readFileSync(csvFile, "utf-8");
      expect(content).toContain("Extension,Files,Lines,Size");
      expect(content).toContain("ts,2,10,100");
    });
  });

  describe("Markdown Export", () => {
    it("should export summary as Markdown", () => {
      const summary = createTestSummary();
      const args = createTestArgs(OutputFormat.Markdown);

      exportReport(summary, args);

      const mdFile = getReportPath("LocIO-report.md");
      expect(fs.existsSync(mdFile)).toBe(true);

      const content = fs.readFileSync(mdFile, "utf-8");
      expect(content).toContain("# LocIO Report");
      expect(content).toContain("## Summary");
      expect(content).toContain("| Total Files | 3 |");
    });
  });

  describe("Human Report", () => {
    it("should omit line metrics from language stats in files-only mode", () => {
      const summary = createTestSummary();
      const args = createTestArgs();
      args.files_only = true;
      args.quiet = false;

      const report = buildHumanReport(summary, args);
      expect(report).toContain("Statistics by Language:");
      expect(report).not.toMatch(/files,\s+\d+\s+lines/);
    });

    it("should print only file counts in quiet files-only mode", () => {
      const summary = createTestSummary();
      const args = createTestArgs();
      args.files_only = true;

      const report = buildHumanReport(summary, args);
      expect(report).toBe("3\n");
    });

    it("should print only line counts in quiet lines-only mode", () => {
      const summary = createTestSummary();
      const args = createTestArgs();
      args.lines_only = true;

      const report = buildHumanReport(summary, args);
      expect(report).toBe("15\n");
    });
  });
});
