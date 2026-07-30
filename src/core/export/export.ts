import * as fs from "fs";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { OutputFormat } from "../../cli/args.js";
import { validateExportPath } from "../../utils/security.js";
import type { Summary } from "../types.js";
import { buildCsvOutput } from "./export-csv.js";
import { buildHtmlOutput } from "./export-html.js";
import { buildHumanReport, humanReport } from "./export-human.js";
import { buildJsonOutput } from "./export-json.js";
import { buildMarkdownOutput } from "./export-markdown.js";
import { buildTsvOutput } from "./export-tsv.js";
import { formatProjectType } from "./export-utils.js";

export { formatProjectType };

function getExportBaseDirectory(scanPath: string): string {
  try {
    const stats = fs.statSync(scanPath);
    if (stats.isFile()) {
      return path.dirname(scanPath);
    }
  } catch {}

  return scanPath;
}

function getFormatExtension(format: OutputFormat): string {
  switch (format) {
    case OutputFormat.Human:
      return "txt";
    case OutputFormat.Json:
      return "json";
    case OutputFormat.Csv:
      return "csv";
    case OutputFormat.Tsv:
      return "tsv";
    case OutputFormat.Markdown:
      return "md";
    case OutputFormat.Html:
      return "html";
  }
}

export function buildContentForFormat(
  format: OutputFormat,
  summary: Summary,
  args: Args,
): string {
  switch (format) {
    case OutputFormat.Human:
      return buildHumanReport(summary, args);
    case OutputFormat.Json:
      return buildJsonOutput(summary, args);
    case OutputFormat.Csv:
      return buildCsvOutput(summary, args);
    case OutputFormat.Tsv:
      return buildTsvOutput(summary, args);
    case OutputFormat.Markdown:
      return buildMarkdownOutput(summary, args);
    case OutputFormat.Html:
      return buildHtmlOutput(summary, args);
  }
}

function generateFilename(format: OutputFormat): string {
  const ext = getFormatExtension(format);
  return `LocIO-report.${ext}`;
}

function writeReportFile(summary: Summary, args: Args): number {
  const formats = Array.isArray(args.export)
    ? args.export
    : [args.export || OutputFormat.Human];
  const exportBaseDir = getExportBaseDirectory(args.directory);
  let errors = 0;

  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    const content = buildContentForFormat(format, summary, args);
    const filename = generateFilename(format);

    let finalPath: string = filename;
    try {
      let targetDir: string;

      if (args.export_path) {
        try {
          const validatedPath = validateExportPath(
            args.export_path,
            exportBaseDir,
          );
          targetDir = validatedPath;
          finalPath = path.join(validatedPath, filename);
        } catch (e) {
          const error = e instanceof Error ? e : new Error(String(e));
          console.error(`\n❌ Invalid export path: ${args.export_path}`);
          console.error(`📋 Error: ${error.message}`);
          errors += 1;
          continue;
        }
      } else {
        targetDir = path.join(exportBaseDir, "reports");
        finalPath = path.join(targetDir, filename);
      }

      if (targetDir && targetDir !== "." && targetDir !== filename) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(finalPath, content, "utf-8");
      if (!args.quiet) {
        const message = `Report written to ${finalPath}`;
        if (args.stdout !== undefined) {
          console.error(message);
        } else {
          console.log(message);
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const errorMsg = error.message || String(e);

      let suggestion = "";
      if (errorMsg.includes("ENOENT")) {
        suggestion =
          `The directory for "${filename}" does not exist.\n` +
          "  - Ensure the parent directory exists\n" +
          "  - Check if the path is correct";
      } else if (
        errorMsg.includes("EACCES") ||
        errorMsg.includes("permission")
      ) {
        suggestion =
          `Permission denied when writing to "${filename}".\n` +
          "  - Check write permissions for the directory\n" +
          "  - Try running with appropriate permissions\n" +
          "  - Use a different output directory";
      } else if (errorMsg.includes("ENOSPC")) {
        suggestion =
          "Insufficient disk space.\n" +
          "  - Free up disk space\n" +
          "  - Choose a different location";
      } else {
        suggestion =
          "Check if the path is valid and you have write permissions.";
      }

      console.error(
        `\n❌ Failed to create report file ${finalPath || filename}`,
      );
      console.error(`📋 Error: ${errorMsg}`);
      if (suggestion) {
        console.error(`\n💡 Suggestion:\n${suggestion}`);
      }
      errors += 1;
    }
  }

  return errors;
}

export function exportReport(summary: Summary, args: Args): number {
  let handled = false;
  let errors = 0;

  if (args.stdout !== undefined) {
    const content = buildContentForFormat(args.stdout, summary, args);
    process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
    handled = true;
  }

  if (args.export !== undefined) {
    errors += writeReportFile(summary, args);
    handled = true;
  }

  if (!handled) {
    humanReport(summary, args);
  }
  return errors;
}
