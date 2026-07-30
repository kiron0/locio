import type { Args } from "../../cli/args.js";
import { detectProjectType, ProjectType } from "../detection/index.js";
import type { Summary } from "../types.js";
import {
  displayDirectory,
  formatProjectType,
  getExtensions,
  getLanguageBreakdown,
  isMultiTargetScan,
} from "./export-utils.js";

function csvCell(value: string | number): string {
  let cell = String(value);
  if (/^[=+\-@\t\r]/.test(cell)) {
    cell = `'${cell}`;
  }
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function buildCsvOutput(summary: Summary, args: Args): string {
  const projectType = !isMultiTargetScan(args)
    ? detectProjectType(args.directory)
    : ProjectType.Unknown;
  let out = `# Directory,${csvCell(displayDirectory(args))}\n`;
  if (projectType !== ProjectType.Unknown) {
    out += `# Project Type,${formatProjectType(projectType)}\n`;
  }
  if (args.files_only) {
    out += "Extension,Files,Size\n";
    const extensions = getExtensions(summary);
    for (const ext of extensions) {
      const count = summary.files_by_extension[ext];
      const size = summary.size_by_extension[ext] || 0;
      out += `${csvCell(ext)},${count},${size}\n`;
    }
  } else if (args.comments) {
    out += "Extension,Files,Lines,Code Lines,Comment Lines,Blank Lines,Size";
    if (args.code_vs_comments) {
      out += ",Code vs Comments Ratio";
    }
    out += "\n";
    const extensions = getExtensions(summary);
    for (const ext of extensions) {
      const count = summary.files_by_extension[ext];
      const lines = summary.lines_by_extension[ext] || 0;
      const codeLines = summary.code_lines_by_extension?.[ext] || 0;
      const commentLines = summary.comment_lines_by_extension?.[ext] || 0;
      const blankLines = summary.blank_lines_by_extension?.[ext] || 0;
      const size = summary.size_by_extension[ext] || 0;
      out += `${csvCell(ext)},${count},${lines},${codeLines},${commentLines},${blankLines},${size}`;
      if (args.code_vs_comments && codeLines > 0) {
        const ratio = ((commentLines || 0) / codeLines).toFixed(2);
        out += `,${ratio}`;
      }
      out += "\n";
    }
  } else {
    out += "Extension,Files,Lines,Size\n";
    const extensions = getExtensions(summary);
    for (const ext of extensions) {
      const count = summary.files_by_extension[ext];
      const lines = summary.lines_by_extension[ext] || 0;
      const size = summary.size_by_extension[ext] || 0;
      out += `${csvCell(ext)},${count},${lines},${size}\n`;
    }
  }
  const langStats = getLanguageBreakdown(summary);
  if (langStats.length > 0) {
    out += "\n# Language Breakdown\n";
    if (args.files_only) {
      out += "Language,Files,Size\n";
      for (const lang of langStats) {
        out += `${csvCell(lang.language)},${lang.files},${lang.size}\n`;
      }
    } else {
      out += "Language,Files,Lines,Code Lines,Comment Lines,Blank Lines,Size\n";
      for (const lang of langStats) {
        out += `${csvCell(lang.language)},${lang.files},${lang.lines},${lang.code_lines},${lang.comment_lines},${lang.blank_lines},${lang.size}\n`;
      }
    }
  }

  if (summary.duplicate_groups && summary.duplicate_groups.length > 0) {
    out += "\n# Duplicate Files\n";
    out += "Hash,Files Count,Lines,Size,File Paths\n";
    for (const group of summary.duplicate_groups) {
      const paths = group.files.map((f) => f.fullPath).join(";");
      out += `${group.hash},${group.files.length},${group.lines},${group.size},${csvCell(paths)}\n`;
    }
  }

  return out;
}
