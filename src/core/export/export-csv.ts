import type { Args } from "../../cli/args.js";
import { detectProjectType, ProjectType } from "../detection/index.js";
import type { Summary } from "../types.js";
import {
  displayDirectory,
  formatProjectType,
  getExtensions,
} from "./export-utils.js";

export function buildCsvOutput(summary: Summary, args: Args): string {
  const projectType = detectProjectType(args.directory);
  let out = `# Directory,${displayDirectory(args)}\n`;
  if (projectType !== ProjectType.Unknown) {
    out += `# Project Type,${formatProjectType(projectType)}\n`;
  }
  if (args.comments) {
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
      out += `${ext},${count},${lines},${codeLines},${commentLines},${blankLines},${size}`;
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
      out += `${ext},${count},${lines},${size}\n`;
    }
  }
  return out;
}
