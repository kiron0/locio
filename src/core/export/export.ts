import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import type { Args } from "../../cli/args.js";
import { OutputFormat } from "../../cli/args.js";
import { formatSize } from "../../utils/formatting/index.js";
import { detectProjectType, ProjectType } from "../detection/index.js";
import type { FileDetail, Summary } from "../types.js";

function getCommentStats(
  source:
    | FileDetail
    | {
        comment_lines?: number | null;
        code_lines?: number | null;
        full_line_comments?: number | null;
        inline_comments?: number | null;
      },
): {
  codeLines: number;
  commentLines: number;
  fullLineComments: number;
  inlineComments: number;
} {
  return {
    codeLines: source.code_lines || 0,
    commentLines: source.comment_lines || 0,
    fullLineComments: source.full_line_comments || 0,
    inlineComments: source.inline_comments || 0,
  };
}

function formatCommentsText(
  codeLines: number,
  commentLines: number,
  fullLineComments: number,
  inlineComments: number,
  blankLines?: number,
): string {
  let result = ` (${codeLines} code, ${commentLines} comments`;
  if (blankLines !== undefined && blankLines > 0) {
    result += `, ${blankLines} blank`;
  }
  if (fullLineComments > 0 || inlineComments > 0) {
    result += `: ${fullLineComments} full-line, ${inlineComments} inline`;
  }
  result += `)`;
  return result;
}

function formatCommentsChalk(
  codeLines: number,
  commentLines: number,
  fullLineComments: number,
  inlineComments: number,
  blankLines?: number,
): string {
  let result = ` ${chalk.gray(`(${chalk.blue(codeLines)} code, ${chalk.cyan(commentLines)} comments`)}`;
  if (blankLines !== undefined && blankLines > 0) {
    result += chalk.gray(`, ${chalk.gray(blankLines)} blank`);
  }
  if (fullLineComments > 0 || inlineComments > 0) {
    result += chalk.gray(
      `: ${chalk.yellow(fullLineComments)} full-line, ${chalk.magenta(inlineComments)} inline`,
    );
  }
  result += chalk.gray(`)`);
  return result;
}

function shouldShowComments(args: Args, hasCommentData: boolean): boolean {
  return (
    (args.comments || args.show_stats) && !args.files_only && hasCommentData
  );
}

function formatFileSizeAndLines(
  size: number,
  lines: number | null,
  args: Args,
): { sizeStr: string; linesStr: string } {
  return {
    sizeStr: formatSize(size),
    linesStr: lines !== null && !args.files_only ? ` | ${lines} lines` : "",
  };
}

function groupFilesByDirectory(
  details: FileDetail[],
): Record<string, FileDetail[]> {
  const byDir: Record<string, FileDetail[]> = {};
  for (const detail of details) {
    if (!byDir[detail.directory]) {
      byDir[detail.directory] = [];
    }
    byDir[detail.directory].push(detail);
  }
  return byDir;
}

function isSingleFile(args: Args): boolean {
  try {
    const stats = fs.statSync(args.directory);
    return stats.isFile();
  } catch {
    return false;
  }
}

function displayDirectory(args: Args): string {
  const dir = args.directory;
  try {
    const stats = fs.statSync(dir);
    if (stats.isFile()) {
      return path.basename(dir);
    }
  } catch {}
  return dir === "." ? "current" : dir;
}

export function formatProjectType(projectType: ProjectType): string {
  const typeMap: Record<ProjectType, string> = {
    [ProjectType.NodeJS]: "Node.js",
    [ProjectType.Rust]: "Rust",
    [ProjectType.Python]: "Python",
    [ProjectType.Go]: "Go",
    [ProjectType.Java]: "Java",
    [ProjectType.CSharp]: "C#",
    [ProjectType.Ruby]: "Ruby",
    [ProjectType.PHP]: "PHP",
    [ProjectType.Swift]: "Swift",
    [ProjectType.Kotlin]: "Kotlin",
    [ProjectType.Dart]: "Dart",
    [ProjectType.TypeScript]: "TypeScript",
    [ProjectType.Vue]: "Vue.js",
    [ProjectType.React]: "React",
    [ProjectType.Angular]: "Angular",
    [ProjectType.NextJS]: "Next.js",
    [ProjectType.Unknown]: "Unknown",
  };
  return typeMap[projectType] || projectType;
}

function getTopFiles(summary: Summary, n: number): FileDetail[] {
  return [...summary.details].sort((a, b) => b.size - a.size).slice(0, n);
}

function getTopDirectories(
  summary: Summary,
  n: number,
): Array<{
  directory: string;
  fileCount: number;
  totalSize: number;
  totalLines: number;
}> {
  const dirStats: Record<
    string,
    { fileCount: number; totalSize: number; totalLines: number }
  > = {};

  for (const detail of summary.details) {
    if (!dirStats[detail.directory]) {
      dirStats[detail.directory] = {
        fileCount: 0,
        totalSize: 0,
        totalLines: 0,
      };
    }
    dirStats[detail.directory].fileCount += 1;
    dirStats[detail.directory].totalSize += detail.size;
    if (detail.lines !== null) {
      dirStats[detail.directory].totalLines += detail.lines;
    }
  }

  return Object.entries(dirStats)
    .map(([directory, stats]) => ({ directory, ...stats }))
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, n);
}

function buildHumanReport(summary: Summary, args: Args): string {
  let out = "";

  if (args.quiet) {
    out += `${summary.total_files} ${summary.total_lines}\n`;
    return out;
  }

  out += "=".repeat(60) + "\n";
  out += "LocIO RESULTS".padStart(37).padEnd(60) + "\n";
  out += "=".repeat(60) + "\n\n";

  out += `Directory: ${displayDirectory(args)}\n`;

  if (!args.lines_only) {
    if (isSingleFile(args)) {
      out += `\nSize: ${formatSize(summary.total_size)}\n`;
    } else {
      out += `\nTotal Files: ${summary.total_files}\n`;
      out += `\nTotal Files Size: ${formatSize(summary.total_size)}\n`;
    }
  }

  if (!args.files_only) {
    out += `\nTotal Lines: ${summary.total_lines}\n`;
    if (
      (args.comments || args.show_stats) &&
      summary.total_comment_lines !== undefined
    ) {
      out += `Total Comment Lines: ${summary.total_comment_lines}\n`;
      if (summary.total_full_line_comments !== undefined) {
        out += `  - Full Line Comments: ${summary.total_full_line_comments}\n`;
      }
      if (summary.total_inline_comments !== undefined) {
        out += `  - Inline Comments: ${summary.total_inline_comments}\n`;
      }
      if (summary.total_code_lines !== undefined) {
        out += `Total Code Lines: ${summary.total_code_lines}\n`;
      }
      if (
        summary.total_blank_lines !== undefined &&
        summary.total_blank_lines > 0
      ) {
        out += `Total Blank Lines: ${summary.total_blank_lines}\n`;
      }
      if (args.code_vs_comments && summary.total_code_lines !== undefined) {
        const ratio =
          summary.total_code_lines > 0
            ? (summary.total_comment_lines / summary.total_code_lines).toFixed(
                2,
              )
            : "0.00";
        out += `Code vs Comments Ratio: ${ratio}:1 (${summary.total_comment_lines} comments per ${summary.total_code_lines} code lines)\n`;
      }
    }
  }

  if (Object.keys(summary.files_by_extension).length > 0) {
    const extensions = Object.keys(summary.files_by_extension).sort();
    out += `\nExtensions: ${extensions.join(", ")}\n`;
  }

  if (args.show_stats && Object.keys(summary.files_by_extension).length > 0) {
    const extensions = Object.keys(summary.files_by_extension).sort();

    out += "\nStatistics by Extension:\n";
    out += "-".repeat(60) + "\n";

    for (const ext of extensions) {
      const files = summary.files_by_extension[ext];
      const size = summary.size_by_extension[ext] || 0;
      const lines = summary.lines_by_extension[ext] || 0;

      out += `  ${ext}: ${files} files`;

      if (!args.lines_only) {
        out += `, ${formatSize(size)}`;
      }

      if (!args.files_only) {
        out += `, ${lines} lines`;
        if (
          shouldShowComments(
            args,
            summary.comment_lines_by_extension?.[ext] !== undefined,
          )
        ) {
          const stats = getCommentStats({
            comment_lines: summary.comment_lines_by_extension?.[ext] || 0,
            code_lines: summary.code_lines_by_extension?.[ext] || 0,
            full_line_comments:
              summary.full_line_comments_by_extension?.[ext] || 0,
            inline_comments: summary.inline_comments_by_extension?.[ext] || 0,
          });
          const blankLines = summary.blank_lines_by_extension?.[ext] || 0;
          out += formatCommentsText(
            stats.codeLines,
            stats.commentLines,
            stats.fullLineComments,
            stats.inlineComments,
            blankLines,
          );
          if (args.code_vs_comments && stats.codeLines > 0) {
            const ratio = (stats.commentLines / stats.codeLines).toFixed(2);
            out += ` [${ratio}:1]`;
          }
        }
      }

      out += "\n";
    }
  }

  if (args.show_stats && summary.details.length > 0) {
    out += "\nFiles by Directory:\n";
    out += "-".repeat(60) + "\n";

    const byDir = groupFilesByDirectory(summary.details);
    const sortedDirs = Object.keys(byDir).sort();
    for (const dir of sortedDirs) {
      const files = byDir[dir];
      out += `Directory: ${dir}\n`;

      for (const f of files) {
        const sizeStr = formatSize(f.size);
        const linesStr =
          f.lines !== null && !args.files_only ? ` | ${f.lines} lines` : "";

        let commentsStr = "";
        if (
          shouldShowComments(
            args,
            f.comment_lines !== undefined && f.comment_lines !== null,
          )
        ) {
          const stats = getCommentStats(f);
          commentsStr = formatCommentsText(
            stats.codeLines,
            stats.commentLines,
            stats.fullLineComments,
            stats.inlineComments,
            f.blank_lines || undefined,
          );
        }

        out += `  - ${f.name} (${f.extension}, ${sizeStr}${linesStr}${commentsStr})\n`;
      }

      out += "\n";
    }
  }

  if (args.top_files && args.top_files > 0) {
    const topFiles = getTopFiles(summary, args.top_files);
    out += `\nTop ${args.top_files} Largest Files:\n`;
    out += "-".repeat(60) + "\n";
    for (const file of topFiles) {
      const { sizeStr, linesStr } = formatFileSizeAndLines(
        file.size,
        file.lines,
        args,
      );
      out += `  ${sizeStr.padEnd(10)} ${file.name} (${file.extension})${linesStr}\n`;
    }
  }

  if (args.top_dirs && args.top_dirs > 0) {
    const topDirs = getTopDirectories(summary, args.top_dirs);
    out += `\nTop ${args.top_dirs} Directories (by file count):\n`;
    out += "-".repeat(60) + "\n";
    for (const dir of topDirs) {
      const sizeStr = formatSize(dir.totalSize);
      const linesStr = !args.files_only ? ` | ${dir.totalLines} lines` : "";
      out += `  ${dir.fileCount.toString().padEnd(5)} files ${dir.directory} (${sizeStr}${linesStr})\n`;
    }
  }

  out += "\n";

  return out;
}

function humanReport(summary: Summary, args: Args): void {
  if (args.quiet) {
    console.log(`${summary.total_files} ${summary.total_lines}`);
    return;
  }

  console.log("\n" + chalk.cyan("=".repeat(60)));
  console.log(chalk.cyan.bold("LocIO RESULTS".padStart(37).padEnd(60)));
  console.log(chalk.cyan("=".repeat(60)));

  console.log(`\n${chalk.green.bold("Directory:")} ${displayDirectory(args)}`);

  if (!args.lines_only) {
    if (isSingleFile(args)) {
      console.log(
        `\n${chalk.green.bold("Size:")} ${chalk.white(formatSize(summary.total_size))}`,
      );
    } else {
      console.log(
        `\n${chalk.green.bold("Total Files:")} ${chalk.yellow(summary.total_files)}`,
      );
      console.log(
        `\n${chalk.green.bold("Total Files Size:")} ${chalk.white(formatSize(summary.total_size))}`,
      );
    }
  }

  if (!args.files_only) {
    console.log(
      `\n${chalk.green.bold("Total Lines:")} ${chalk.yellow(summary.total_lines)}`,
    );
    if (
      (args.comments || args.show_stats) &&
      summary.total_comment_lines !== undefined
    ) {
      console.log(
        `\n${chalk.green.bold("Total Comment Lines:")} ${chalk.cyan(summary.total_comment_lines)}`,
      );
      if (summary.total_full_line_comments !== undefined) {
        console.log(
          `  ${chalk.gray("─")} ${chalk.green("Full Line Comments:")} ${chalk.cyan(summary.total_full_line_comments)}`,
        );
      }
      if (summary.total_inline_comments !== undefined) {
        console.log(
          `  ${chalk.gray("─")} ${chalk.green("Inline Comments:")} ${chalk.cyan(summary.total_inline_comments)}`,
        );
      }
      if (summary.total_code_lines !== undefined) {
        console.log(
          `\n${chalk.green.bold("Total Code Lines:")} ${chalk.blue(summary.total_code_lines)}`,
        );
      }
      if (
        summary.total_blank_lines !== undefined &&
        summary.total_blank_lines > 0
      ) {
        console.log(
          `\n${chalk.green.bold("Total Blank Lines:")} ${chalk.gray(summary.total_blank_lines)}`,
        );
      }
      if (args.code_vs_comments && summary.total_code_lines !== undefined) {
        const ratio =
          summary.total_code_lines > 0
            ? (summary.total_comment_lines / summary.total_code_lines).toFixed(
                2,
              )
            : "0.00";
        console.log(
          `\n${chalk.green.bold("Code vs Comments Ratio:")} ${chalk.magenta(ratio)}:1 ${chalk.gray(`(${summary.total_comment_lines} comments per ${summary.total_code_lines} code lines)`)}`,
        );
      }
    }
  }

  if (Object.keys(summary.files_by_extension).length > 0) {
    const extensions = Object.keys(summary.files_by_extension).sort();
    console.log(
      `\n${chalk.green.bold("Extensions:")} ${chalk.white(extensions.join(", "))}`,
    );
  }

  if (args.show_stats && Object.keys(summary.files_by_extension).length > 0) {
    console.log(`\n${chalk.cyan.bold("Statistics by Extension:")}`);
    console.log(chalk.gray("-".repeat(60)));

    const extensions = Object.keys(summary.files_by_extension).sort();

    for (const ext of extensions) {
      const files = summary.files_by_extension[ext];
      const size = summary.size_by_extension[ext] || 0;
      const lines = summary.lines_by_extension[ext] || 0;

      let line = `  ${chalk.white(ext)}: ${chalk.yellow(files)} files`;

      if (!args.lines_only) {
        line += `, ${chalk.white(formatSize(size))}`;
      }

      if (!args.files_only) {
        line += `, ${chalk.yellow(lines)} lines`;
        if (
          shouldShowComments(
            args,
            summary.comment_lines_by_extension?.[ext] !== undefined,
          )
        ) {
          const stats = getCommentStats({
            comment_lines: summary.comment_lines_by_extension?.[ext] || 0,
            code_lines: summary.code_lines_by_extension?.[ext] || 0,
            full_line_comments:
              summary.full_line_comments_by_extension?.[ext] || 0,
            inline_comments: summary.inline_comments_by_extension?.[ext] || 0,
          });
          const blankLines = summary.blank_lines_by_extension?.[ext] || 0;
          line += formatCommentsChalk(
            stats.codeLines,
            stats.commentLines,
            stats.fullLineComments,
            stats.inlineComments,
            blankLines,
          );
          if (args.code_vs_comments && stats.codeLines > 0) {
            const ratio = (stats.commentLines / stats.codeLines).toFixed(2);
            line += ` ${chalk.magenta(`[${ratio}:1]`)}`;
          }
        }
      }

      console.log(line);
    }
  }

  if (args.show_stats && summary.details.length > 0) {
    console.log(`\n${chalk.cyan.bold("Files by Directory:")}`);
    console.log(chalk.gray("-".repeat(60)));

    const byDir = groupFilesByDirectory(summary.details);
    const sortedDirs = Object.keys(byDir).sort();
    for (const dir of sortedDirs) {
      const files = byDir[dir];
      console.log(chalk.green.bold(`Directory: ${dir}`));

      for (const f of files) {
        const sizeStr = formatSize(f.size);
        const linesStr =
          f.lines !== null && !args.files_only ? ` | ${f.lines} lines` : "";

        let commentsStr = "";
        if (
          shouldShowComments(
            args,
            f.comment_lines !== undefined && f.comment_lines !== null,
          )
        ) {
          const stats = getCommentStats(f);
          commentsStr = formatCommentsChalk(
            stats.codeLines,
            stats.commentLines,
            stats.fullLineComments,
            stats.inlineComments,
            f.blank_lines || undefined,
          );
        }

        console.log(
          `  - ${chalk.white(f.name)} (${chalk.blue(f.extension)}, ${chalk.white(sizeStr)}${linesStr}${commentsStr})`,
        );
      }

      console.log();
    }
  }

  if (args.top_files && args.top_files > 0) {
    const topFiles = getTopFiles(summary, args.top_files);
    console.log(`\n${chalk.cyan.bold(`Top ${args.top_files} Largest Files:`)}`);
    console.log(chalk.gray("-".repeat(60)));
    for (const file of topFiles) {
      const { sizeStr, linesStr } = formatFileSizeAndLines(
        file.size,
        file.lines,
        args,
      );
      console.log(
        `  ${chalk.yellow(sizeStr.padEnd(10))} ${chalk.white(file.name)} ${chalk.blue(`(${file.extension})`)}${linesStr}`,
      );
    }
  }

  if (args.top_dirs && args.top_dirs > 0) {
    const topDirs = getTopDirectories(summary, args.top_dirs);
    console.log(
      `\n${chalk.cyan.bold(`Top ${args.top_dirs} Directories (by file count):`)}`,
    );
    console.log(chalk.gray("-".repeat(60)));
    for (const dir of topDirs) {
      const sizeStr = formatSize(dir.totalSize);
      const linesStr = !args.files_only ? ` | ${dir.totalLines} lines` : "";
      console.log(
        `  ${chalk.yellow(dir.fileCount.toString().padEnd(5))} files ${chalk.white(dir.directory)} ${chalk.gray(`(${sizeStr}${linesStr})`)}`,
      );
    }
  }

  console.log();
}

function buildJsonOutput(summary: Summary, args: Args): string {
  const projectType = detectProjectType(args.directory);
  const output: any = {
    directory: displayDirectory(args),
  };

  if (projectType !== ProjectType.Unknown) {
    output.project_type = projectType;
    output.project_type_display = formatProjectType(projectType);
  }

  if (!isSingleFile(args)) {
    output.files = summary.total_files;
    output.size = summary.total_size;
    output.size_formatted = formatSize(summary.total_size);
  }

  if (!args.files_only) {
    output.lines = summary.total_lines;
    if (args.comments) {
      output.comment_lines = summary.total_comment_lines || 0;
      output.code_lines = summary.total_code_lines || 0;
      output.blank_lines = summary.total_blank_lines || 0;
      output.full_line_comments = summary.total_full_line_comments || 0;
      output.inline_comments = summary.total_inline_comments || 0;
      if (args.code_vs_comments && summary.total_code_lines !== undefined) {
        output.code_vs_comments_ratio =
          summary.total_code_lines > 0
            ? parseFloat(
                (
                  summary.total_comment_lines! / summary.total_code_lines
                ).toFixed(2),
              )
            : 0;
      }
    }
  }

  if (args.show_stats) {
    const stats: Record<string, any> = {};
    for (const ext of Object.keys(summary.files_by_extension)) {
      stats[ext] = {
        files: summary.files_by_extension[ext],
        lines: summary.lines_by_extension[ext] || 0,
        size: summary.size_by_extension[ext] || 0,
      };
      if (args.comments) {
        stats[ext].comment_lines =
          summary.comment_lines_by_extension?.[ext] || 0;
        stats[ext].code_lines = summary.code_lines_by_extension?.[ext] || 0;
        stats[ext].blank_lines = summary.blank_lines_by_extension?.[ext] || 0;
        stats[ext].full_line_comments =
          summary.full_line_comments_by_extension?.[ext] || 0;
        stats[ext].inline_comments =
          summary.inline_comments_by_extension?.[ext] || 0;
        if (
          args.code_vs_comments &&
          summary.code_lines_by_extension?.[ext] &&
          summary.code_lines_by_extension[ext]! > 0
        ) {
          stats[ext].code_vs_comments_ratio = parseFloat(
            (
              (summary.comment_lines_by_extension![ext] || 0) /
              summary.code_lines_by_extension[ext]!
            ).toFixed(2),
          );
        }
      }
    }
    output.by_extension = stats;
  }

  if (args.top_files && args.top_files > 0) {
    const topFiles = getTopFiles(summary, args.top_files);
    output.top_files = topFiles.map((f) => ({
      name: f.name,
      directory: f.directory,
      extension: f.extension,
      size: f.size,
      size_formatted: formatSize(f.size),
      lines: f.lines,
    }));
  }

  if (args.top_dirs && args.top_dirs > 0) {
    const topDirs = getTopDirectories(summary, args.top_dirs);
    output.top_directories = topDirs.map((d) => ({
      directory: d.directory,
      file_count: d.fileCount,
      total_size: d.totalSize,
      total_size_formatted: formatSize(d.totalSize),
      total_lines: d.totalLines,
    }));
  }

  return JSON.stringify(output, null, 2);
}

function buildCsvOutput(summary: Summary, args: Args): string {
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
    for (const ext of Object.keys(summary.files_by_extension)) {
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
    for (const ext of Object.keys(summary.files_by_extension)) {
      const count = summary.files_by_extension[ext];
      const lines = summary.lines_by_extension[ext] || 0;
      const size = summary.size_by_extension[ext] || 0;
      out += `${ext},${count},${lines},${size}\n`;
    }
  }
  return out;
}

function buildTsvOutput(summary: Summary, args: Args): string {
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
    for (const ext of Object.keys(summary.files_by_extension)) {
      const count = summary.files_by_extension[ext];
      const lines = summary.lines_by_extension[ext] || 0;
      const codeLines = summary.code_lines_by_extension?.[ext] || 0;
      const commentLines = summary.comment_lines_by_extension?.[ext] || 0;
      const blankLines = summary.blank_lines_by_extension?.[ext] || 0;
      const size = summary.size_by_extension[ext] || 0;
      out += `${ext}\t${count}\t${lines}\t${codeLines}\t${commentLines}\t${blankLines}\t${size}`;
      if (args.code_vs_comments && codeLines > 0) {
        const ratio = ((commentLines || 0) / codeLines).toFixed(2);
        out += `\t${ratio}`;
      }
      out += "\n";
    }
  } else {
    out += "Extension\tFiles\tLines\tSize\n";
    for (const ext of Object.keys(summary.files_by_extension)) {
      const count = summary.files_by_extension[ext];
      const lines = summary.lines_by_extension[ext] || 0;
      const size = summary.size_by_extension[ext] || 0;
      out += `${ext}\t${count}\t${lines}\t${size}\n`;
    }
  }
  return out;
}

function buildMarkdownOutput(summary: Summary, args: Args): string {
  const projectType = detectProjectType(args.directory);
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

  if (Object.keys(summary.files_by_extension).length > 0) {
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

    const extensions = Object.keys(summary.files_by_extension).sort();
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

  if (args.show_stats && summary.details.length > 0) {
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

function buildHtmlOutput(summary: Summary, args: Args): string {
  const projectType = detectProjectType(args.directory);
  const extensions = Object.keys(summary.files_by_extension).sort();
  const extensionData = extensions.map((ext) => ({
    ext,
    files: summary.files_by_extension[ext],
    lines: summary.lines_by_extension[ext] || 0,
    size: summary.size_by_extension[ext] || 0,
    codeLines: summary.code_lines_by_extension?.[ext] || 0,
    commentLines: summary.comment_lines_by_extension?.[ext] || 0,
    blankLines: summary.blank_lines_by_extension?.[ext] || 0,
  }));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LocIO Report - ${displayDirectory(args)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .header p {
      opacity: 0.9;
      font-size: 1.1em;
    }
    .content {
      padding: 40px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 25px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .card h3 {
      color: #667eea;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .card .value {
      font-size: 2.5em;
      font-weight: bold;
      color: #2d3748;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #2d3748;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
    }
    .chart-container {
      position: relative;
      height: 400px;
      margin: 20px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th {
      background: #667eea;
      color: white;
      padding: 15px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:hover {
      background: #f7fafc;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #718096;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LocIO Report</h1>
      <p>Directory: ${displayDirectory(args)}</p>
      ${projectType !== ProjectType.Unknown ? `<p>Project Type: <strong>${formatProjectType(projectType)}</strong></p>` : ""}
    </div>
    <div class="content">
      <div class="summary-cards">
        <div class="card">
          <h3>Total Files</h3>
          <div class="value">${summary.total_files}</div>
        </div>
        <div class="card">
          <h3>Total Size</h3>
          <div class="value">${formatSize(summary.total_size)}</div>
        </div>
        ${
          !args.files_only
            ? `<div class="card">
          <h3>Total Lines</h3>
          <div class="value">${summary.total_lines}</div>
        </div>`
            : ""
        }
        ${
          args.comments && summary.total_comment_lines !== undefined
            ? `<div class="card">
          <h3>Comment Lines</h3>
          <div class="value">${summary.total_comment_lines}</div>
        </div>
        <div class="card">
          <h3>Code Lines</h3>
          <div class="value">${summary.total_code_lines || 0}</div>
        </div>
        ${
          summary.total_blank_lines !== undefined &&
          summary.total_blank_lines > 0
            ? `<div class="card">
          <h3>Blank Lines</h3>
          <div class="value">${summary.total_blank_lines}</div>
        </div>`
            : ""
        }`
            : ""
        }
      </div>

      ${
        extensions.length > 0
          ? `<div class="section">
        <h2>📈 Statistics by Extension</h2>
        <div class="chart-container">
          <canvas id="extensionChart"></canvas>
        </div>
        <table>
          <thead>
            <tr>
              <th>Extension</th>
              <th>Files</th>
              ${!args.lines_only ? "<th>Size</th>" : ""}
              ${!args.files_only ? "<th>Lines</th>" : ""}
              ${args.comments ? "<th>Code</th><th>Comments</th><th>Blank</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${extensionData
              .map(
                (d) => `<tr>
              <td><strong>${d.ext}</strong></td>
              <td>${d.files}</td>
              ${!args.lines_only ? `<td>${formatSize(d.size)}</td>` : ""}
              ${!args.files_only ? `<td>${d.lines}</td>` : ""}
              ${args.comments ? `<td>${d.codeLines}</td><td>${d.commentLines}</td><td>${d.blankLines}</td>` : ""}
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
          : ""
      }

      ${
        args.comments &&
        summary.total_code_lines !== undefined &&
        summary.total_code_lines > 0
          ? `<div class="section">
        <h2>💬 Code vs Comments</h2>
        <div class="chart-container">
          <canvas id="commentChart"></canvas>
        </div>
      </div>`
          : ""
      }

      ${
        args.top_files && args.top_files > 0
          ? (() => {
              const topFiles = getTopFiles(summary, args.top_files!);
              return `<div class="section">
        <h2>📄 Top ${args.top_files} Largest Files</h2>
        <table>
          <thead>
            <tr>
              <th>Size</th>
              <th>File</th>
              <th>Extension</th>
              ${!args.files_only ? "<th>Lines</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${topFiles
              .map(
                (file) => `<tr>
              <td><strong>${formatSize(file.size)}</strong></td>
              <td>${file.name}</td>
              <td><code>${file.extension}</code></td>
              ${!args.files_only && file.lines !== null ? `<td>${file.lines}</td>` : ""}
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
            })()
          : ""
      }

      ${
        args.top_dirs && args.top_dirs > 0
          ? (() => {
              const topDirs = getTopDirectories(summary, args.top_dirs!);
              return `<div class="section">
        <h2>📁 Top ${args.top_dirs} Directories (by file count)</h2>
        <table>
          <thead>
            <tr>
              <th>Files</th>
              <th>Directory</th>
              <th>Size</th>
              ${!args.files_only ? "<th>Lines</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${topDirs
              .map(
                (dir) => `<tr>
              <td><strong>${dir.fileCount}</strong></td>
              <td>${dir.directory}</td>
              <td>${formatSize(dir.totalSize)}</td>
              ${!args.files_only ? `<td>${dir.totalLines}</td>` : ""}
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
            })()
          : ""
      }

      ${
        args.export === OutputFormat.Html
          ? (() => {
              const dirStats: Record<
                string,
                { fileCount: number; totalSize: number; totalLines: number }
              > = {};
              for (const detail of summary.details) {
                if (!dirStats[detail.directory]) {
                  dirStats[detail.directory] = {
                    fileCount: 0,
                    totalSize: 0,
                    totalLines: 0,
                  };
                }
                dirStats[detail.directory].fileCount += 1;
                dirStats[detail.directory].totalSize += detail.size;
                if (detail.lines !== null) {
                  dirStats[detail.directory].totalLines += detail.lines;
                }
              }
              const dirs = Object.entries(dirStats);
              const maxFiles = Math.max(
                ...dirs.map(([, stats]) => stats.fileCount),
              );
              const maxSize = Math.max(
                ...dirs.map(([, stats]) => stats.totalSize),
              );
              return `<div class="section">
        <h2>🗺️ Directory Heatmap</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
          ${dirs
            .map(([dir, stats]) => {
              const fileIntensity = (stats.fileCount / maxFiles) * 100;
              const sizeIntensity = (stats.totalSize / maxSize) * 100;
              const avgIntensity = (fileIntensity + sizeIntensity) / 2;
              const hue = 240 - avgIntensity * 1.2;
              return `<div style="
                background: linear-gradient(135deg, hsl(${hue}, 70%, ${85 - avgIntensity * 0.3}%), hsl(${hue}, 70%, ${75 - avgIntensity * 0.3}%));
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                color: ${avgIntensity > 50 ? "white" : "#2d3748"};
              ">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${dir}">${dir.split("/").pop() || dir}</div>
                <div style="font-size: 0.8em; opacity: 0.9;">
                  <div>📄 ${stats.fileCount} files</div>
                  <div>💾 ${formatSize(stats.totalSize)}</div>
                  ${!args.files_only ? `<div>📝 ${stats.totalLines} lines</div>` : ""}
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>`;
            })()
          : ""
      }
    </div>
    <div class="footer">
      Generated by <a href="https://locio.js.org">LocIO</a>
    </div>
  </div>

  <script>
    ${
      extensions.length > 0
        ? `const extensionCtx = document.getElementById('extensionChart');
    new Chart(extensionCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(extensions)},
        datasets: [
          ${
            !args.files_only
              ? `{
            label: 'Lines',
            data: ${JSON.stringify(extensions.map((e) => summary.lines_by_extension[e] || 0))},
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2
          },`
              : ""
          }
          {
            label: 'Files',
            data: ${JSON.stringify(extensions.map((e) => summary.files_by_extension[e]))},
            backgroundColor: 'rgba(118, 75, 162, 0.8)',
            borderColor: 'rgba(118, 75, 162, 1)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Files and Lines by Extension'
          }
        }
      }
    });`
        : ""
    }

    ${
      args.comments &&
      summary.total_code_lines !== undefined &&
      summary.total_code_lines > 0
        ? `const commentCtx = document.getElementById('commentChart');
    new Chart(commentCtx, {
      type: 'doughnut',
      data: {
        labels: ['Code Lines', 'Comment Lines'],
        datasets: [{
          data: [${summary.total_code_lines}, ${summary.total_comment_lines || 0}],
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)'
          ],
          borderColor: [
            'rgba(102, 126, 234, 1)',
            'rgba(118, 75, 162, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
          },
          title: {
            display: true,
            text: 'Code vs Comments Distribution'
          }
        }
      }
    });`
        : ""
    }
  </script>
</body>
</html>`;

  return html;
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

function buildContentForFormat(
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

function generateFilename(
  format: OutputFormat,
  args: Args,
  index?: number,
): string {
  const ext = getFormatExtension(format);
  let filename: string;

  if (
    Array.isArray(args.export) &&
    args.export.length > 1 &&
    index !== undefined
  ) {
    filename = `LocIO-report-${index + 1}.${ext}`;
  } else {
    filename = `LocIO-report.${ext}`;
  }

  if (args.export_path) {
    return path.join(args.export_path, filename);
  }

  return filename;
}

function writeReportFile(summary: Summary, args: Args): void {
  const formats = Array.isArray(args.export)
    ? args.export
    : [args.export || OutputFormat.Human];

  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    const content = buildContentForFormat(format, summary, args);
    const filename = generateFilename(format, args, i);

    try {
      let targetDir: string;
      if (args.export_path) {
        targetDir = args.export_path;
      } else {
        targetDir = path.dirname(filename);
      }

      if (targetDir !== "." && targetDir !== filename) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(filename, content, "utf-8");
      if (!args.quiet) {
        console.log(`Report written to ${filename}`);
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

      console.error(`\n❌ Failed to create report file ${filename}`);
      console.error(`📋 Error: ${errorMsg}`);
      if (suggestion) {
        console.error(`\n💡 Suggestion:\n${suggestion}`);
      }
    }
  }
}

export function exportReport(summary: Summary, args: Args): void {
  if (args.export !== undefined) {
    writeReportFile(summary, args);
    return;
  }

  humanReport(summary, args);
}
