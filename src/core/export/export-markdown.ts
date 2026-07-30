import type { Args } from "../../cli/args.js";
import { formatSize } from "../../utils/formatting/index.js";
import { detectProjectType, ProjectType } from "../detection/index.js";
import type { Summary } from "../types.js";
import {
  displayDirectory,
  formatProjectType,
  getExtensions,
  getLanguageBreakdown,
  getTopDirectories,
  getTopFiles,
  groupFilesByDirectory,
  isMultiTargetScan,
} from "./export-utils.js";

export function buildMarkdownOutput(summary: Summary, args: Args): string {
  const projectType = !isMultiTargetScan(args)
    ? detectProjectType(args.directory)
    : ProjectType.Unknown;
  let md = `# LocIO Report\n\n`;
  md += `**Directory:** ${displayDirectory(args)}\n`;
  if (projectType !== ProjectType.Unknown) {
    md += `**Project Type:** ${formatProjectType(projectType)}\n`;
  }
  md += `\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Files | ${summary.total_files} |\n`;
  md += `| Total Size | ${formatSize(summary.total_size)} |\n`;

  if (!args.files_only) {
    md += `| Total Lines | ${summary.total_lines} |\n`;
    if (args.comments && summary.total_comment_lines !== undefined) {
      md += `| Comment Lines | ${summary.total_comment_lines} |\n`;
      if (summary.total_code_lines !== undefined) {
        md += `| Code Lines | ${summary.total_code_lines} |\n`;
      }
      if (
        summary.total_blank_lines !== undefined &&
        summary.total_blank_lines > 0
      ) {
        md += `| Blank Lines | ${summary.total_blank_lines} |\n`;
      }
      if (
        args.code_vs_comments &&
        summary.total_code_lines !== undefined &&
        summary.total_code_lines > 0
      ) {
        const ratio = (
          summary.total_comment_lines! / summary.total_code_lines
        ).toFixed(2);
        md += `| Code vs Comments Ratio | ${ratio}:1 |\n`;
      }
    }
  }

  const langStats = getLanguageBreakdown(summary);
  if (langStats.length > 0) {
    md += `\n## Statistics by Language\n\n`;
    if (args.files_only) {
      md += `| Language | Files | Size |\n`;
      md += `|----------|-------|------|\n`;
      for (const lang of langStats) {
        md += `| ${lang.language} | ${lang.files} | ${formatSize(lang.size)} |\n`;
      }
    } else {
      md += `| Language | Files | Lines | Code | Comments | Blanks | Size |\n`;
      md += `|----------|-------|-------|------|----------|--------|------|\n`;
      for (const lang of langStats) {
        md += `| ${lang.language} | ${lang.files} | ${lang.lines} | ${lang.code_lines} | ${lang.comment_lines} | ${lang.blank_lines} | ${formatSize(lang.size)} |\n`;
      }
    }
  }

  if (summary.duplicate_groups && summary.duplicate_groups.length > 0) {
    md += `\n## Duplicate Files\n\n`;
    md += `Found **${summary.duplicate_groups.length}** groups of duplicate files:\n\n`;
    for (const group of summary.duplicate_groups) {
      const wasted = group.lines * (group.files.length - 1);
      md += `### ${group.files.length} copies (${group.lines} lines each, ${wasted} lines wasted)\n\n`;
      for (const f of group.files) {
        md += `- \`${f.fullPath}\`\n`;
      }
      md += `\n`;
    }
  }

  if (args.explain && summary.exclusions) {
    md += `\n## Exclusions\n\n`;
    md += `Excluded **${summary.exclusions.total}** files.\n\n`;
    md += `| Reason | Files |\n|--------|------:|\n`;
    for (const [reason, count] of Object.entries(
      summary.exclusions.by_reason,
    )) {
      md += `| ${reason} | ${count} |\n`;
    }
    if (summary.exclusions.examples.length > 0) {
      md += `\n### Examples\n\n`;
      for (const example of summary.exclusions.examples) {
        md += `- \`${example.path.replace(/`/g, "\\`")}\` — ${example.reason}\n`;
      }
    }
    if (summary.exclusions.omitted > 0) {
      md += `\n_${summary.exclusions.omitted} more omitted._\n`;
    }
  }

  const extensions = getExtensions(summary);
  if (extensions.length > 0) {
    md += `\n## Statistics by Extension\n\n`;
    md += `| Extension | Files |`;
    if (!args.lines_only) {
      md += ` Size |`;
    }
    if (!args.files_only) {
      md += ` Lines |`;
      if (args.comments) {
        md += ` Code | Comments |`;
        if (args.code_vs_comments) {
          md += ` Ratio |`;
        }
      }
    }
    md += `\n`;
    md += `|----------|-------|`;
    if (!args.lines_only) {
      md += `------|`;
    }
    if (!args.files_only) {
      md += `-------|`;
      if (args.comments) {
        md += `------|-----------|`;
        if (args.code_vs_comments) {
          md += `-------|`;
        }
      }
    }
    md += `\n`;
    for (const ext of extensions) {
      const files = summary.files_by_extension[ext];
      const size = summary.size_by_extension[ext] || 0;
      const lines = summary.lines_by_extension[ext] || 0;
      const codeLines = summary.code_lines_by_extension?.[ext] || 0;
      const commentLines = summary.comment_lines_by_extension?.[ext] || 0;

      md += `| \`${ext}\` | ${files} |`;
      if (!args.lines_only) {
        md += ` ${formatSize(size)} |`;
      }
      if (!args.files_only) {
        md += ` ${lines} |`;
        if (args.comments) {
          md += ` ${codeLines} | ${commentLines} |`;
          if (args.code_vs_comments && codeLines > 0) {
            const ratio = ((commentLines || 0) / codeLines).toFixed(2);
            md += ` ${ratio}:1 |`;
          } else if (args.code_vs_comments) {
            md += ` - |`;
          }
        }
      }
      md += `\n`;
    }
  }

  if (args.show_stats && summary.details && summary.details.length > 0) {
    md += `\n## Files by Directory\n\n`;
    const byDir = groupFilesByDirectory(summary.details);
    const sortedDirs = Object.keys(byDir).sort();
    for (const dir of sortedDirs) {
      const files = byDir[dir];
      md += `### ${dir}\n\n`;
      md += `| File | Extension | Size |`;
      if (!args.files_only) {
        md += ` Lines |`;
        if (args.comments || args.show_stats) {
          md += ` Code | Comments | Blank | Full-Line | Inline |`;
        }
      }
      md += `\n`;
      md += `|------|-----------|------|`;
      if (!args.files_only) {
        md += `-------|`;
        if (args.comments || args.show_stats) {
          md += `------|----------|-------|----------|--------|`;
        }
      }
      md += `\n`;

      for (const f of files) {
        md += `| ${f.name} | \`${f.extension}\` | ${formatSize(f.size)} |`;
        if (!args.files_only && f.lines !== null) {
          md += ` ${f.lines} |`;
          if (args.comments || args.show_stats) {
            const codeLines = f.code_lines || 0;
            const commentLines = f.comment_lines || 0;
            const blankLines = f.blank_lines || 0;
            const fullLineComments = f.full_line_comments || 0;
            const inlineComments = f.inline_comments || 0;
            md += ` ${codeLines} | ${commentLines} | ${blankLines} | ${fullLineComments} | ${inlineComments} |`;
          }
        }
        md += `\n`;
      }
      md += `\n`;
    }
  }

  if (args.top_files && args.top_files > 0) {
    const topFiles = getTopFiles(summary, args.top_files);
    md += `\n## Top ${args.top_files} Largest Files\n\n`;
    md += `| Size | File | Extension |`;
    if (!args.files_only) {
      md += ` Lines |`;
    }
    md += `\n`;
    md += `|------|------|-----------|`;
    if (!args.files_only) {
      md += `-------|`;
    }
    md += `\n`;
    for (const file of topFiles) {
      md += `| ${formatSize(file.size)} | ${file.name} | \`${file.extension}\` |`;
      if (!args.files_only && file.lines !== null) {
        md += ` ${file.lines} |`;
      }
      md += `\n`;
    }
    md += `\n`;
  }

  if (args.top_dirs && args.top_dirs > 0) {
    const topDirs = getTopDirectories(summary, args.top_dirs);
    md += `\n## Top ${args.top_dirs} Directories (by file count)\n\n`;
    md += `| Files | Directory | Size |`;
    if (!args.files_only) {
      md += ` Lines |`;
    }
    md += `\n`;
    md += `|-------|-----------|------|`;
    if (!args.files_only) {
      md += `-------|`;
    }
    md += `\n`;
    for (const dir of topDirs) {
      md += `| ${dir.fileCount} | ${dir.directory} | ${formatSize(dir.totalSize)} |`;
      if (!args.files_only) {
        md += ` ${dir.totalLines} |`;
      }
      md += `\n`;
    }
    md += `\n`;
  }

  md += `\n---\n\n`;
  md += `*Generated by [LocIO](https://locio.js.org)*\n`;

  return md;
}
