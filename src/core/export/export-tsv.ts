import type { Args } from "../../cli/args.js";
import { detectProjectType, ProjectType } from "../detection/index.js";
import type { Summary } from "../types.js";
import {
  displayDirectory,
  formatProjectType,
  getExtensions,
} from "./export-utils.js";

export function buildTsvOutput(summary: Summary, args: Args): string {
  const projectType = detectProjectType(args.directory);
  let out = `# Directory\t${displayDirectory(args)}\n`;
  if (projectType !== ProjectType.Unknown) {
    out += `# Project Type\t${formatProjectType(projectType)}\n`;
  }
  if (args.comments) {
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
      out += `${ext}\t${count}\t${lines}\t${codeLines}\t${commentLines}\t${blankLines}\t${size}`;
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
      out += `${ext}\t${count}\t${lines}\t${size}\n`;
    }
  }
  return out;
}
