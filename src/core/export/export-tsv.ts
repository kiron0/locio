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

function tsvCell(value: string | number): string {
  let cell = String(value).replace(/[\t\r\n]/g, " ");
  if (/^[=+\-@]/.test(cell)) {
    cell = `'${cell}`;
  }
  return cell;
}

export function buildTsvOutput(summary: Summary, args: Args): string {
  const projectType = !isMultiTargetScan(args)
    ? detectProjectType(args.directory)
    : ProjectType.Unknown;
  let out = `# Directory\t${tsvCell(displayDirectory(args))}\n`;
  if (projectType !== ProjectType.Unknown) {
    out += `# Project Type\t${formatProjectType(projectType)}\n`;
  }
  if (args.files_only) {
    out += "Extension\tFiles\tSize\n";
    const extensions = getExtensions(summary);
    for (const ext of extensions) {
      const count = summary.files_by_extension[ext];
      const size = summary.size_by_extension[ext] || 0;
      out += `${tsvCell(ext)}\t${count}\t${size}\n`;
    }
  } else if (args.comments) {
    out +=
      "Extension\tFiles\tLines\tCode Lines\tComment Lines\tBlank Lines\tSize";
    if (args.code_vs_comments) {
      out += "\tCode vs Comments Ratio";
    }
    out += "\n";
    const extensions = getExtensions(summary);
    for (const ext of extensions) {
      const count = summary.files_by_extension![ext];
      const lines = summary.lines_by_extension![ext] || 0;
      const codeLines = summary.code_lines_by_extension?.[ext] || 0;
      const commentLines = summary.comment_lines_by_extension?.[ext] || 0;
      const blankLines = summary.blank_lines_by_extension?.[ext] || 0;
      const size = summary.size_by_extension![ext] || 0;
      out += `${tsvCell(ext)}\t${count}\t${lines}\t${codeLines}\t${commentLines}\t${blankLines}\t${size}`;
      if (args.code_vs_comments && codeLines > 0) {
        const ratio = ((commentLines || 0) / codeLines).toFixed(2);
        out += `\t${ratio}`;
      }
      out += "\n";
    }
  } else {
    out += "Extension\tFiles\tLines\tSize\n";
    const extensions = getExtensions(summary);
    for (const ext of extensions) {
      const count = summary.files_by_extension[ext];
      const lines = summary.lines_by_extension[ext] || 0;
      const size = summary.size_by_extension[ext] || 0;
      out += `${tsvCell(ext)}\t${count}\t${lines}\t${size}\n`;
    }
  }
  const langStats = getLanguageBreakdown(summary);
  if (langStats.length > 0) {
    out += "\n# Language Breakdown\n";
    if (args.files_only) {
      out += "Language\tFiles\tSize\n";
      for (const lang of langStats) {
        out += `${tsvCell(lang.language)}\t${lang.files}\t${lang.size}\n`;
      }
    } else {
      out +=
        "Language\tFiles\tLines\tCode Lines\tComment Lines\tBlank Lines\tSize\n";
      for (const lang of langStats) {
        out += `${tsvCell(lang.language)}\t${lang.files}\t${lang.lines}\t${lang.code_lines}\t${lang.comment_lines}\t${lang.blank_lines}\t${lang.size}\n`;
      }
    }
  }

  if (summary.duplicate_groups && summary.duplicate_groups.length > 0) {
    out += "\n# Duplicate Files\n";
    out += "Hash\tFiles Count\tLines\tSize\tFile Paths\n";
    for (const group of summary.duplicate_groups) {
      const paths = group.files.map((f) => f.fullPath).join(";");
      out += `${group.hash}\t${group.files.length}\t${group.lines}\t${group.size}\t${tsvCell(paths)}\n`;
    }
  }

  if (args.explain && summary.exclusions) {
    out += "\n# Exclusions\nReason\tFiles\n";
    for (const [reason, count] of Object.entries(
      summary.exclusions.by_reason,
    )) {
      out += `${tsvCell(reason)}\t${count}\n`;
    }
    if (summary.exclusions.examples.length > 0) {
      out += "\n# Exclusion Examples\nPath\tReason\n";
      for (const example of summary.exclusions.examples) {
        out += `${tsvCell(example.path)}\t${tsvCell(example.reason)}\n`;
      }
    }
  }

  return out;
}
