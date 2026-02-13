import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OutputFormat } from "../../../src/cli/args.js";
import { exportReport } from "../../../src/core/export/export.js";
import type { Summary } from "../../../src/core/types.js";
import { createSummary } from "../../../src/core/types.js";
import { createTempDir, removeTempDir } from "../../utils/test-helpers.js";

describe("Export Functionality - Simple Tests", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
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

  function createTestArgs(exportFormat?: OutputFormat | OutputFormat[]) {
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
});
