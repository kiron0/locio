import chalk from "chalk";
import type { Args } from "../../cli/args.js";
import { formatSize } from "../../utils/formatting/index.js";
import type { Summary } from "../types.js";
import {
  displayDirectory,
  formatCommentsChalk,
  formatCommentsText,
  formatFileSizeAndLines,
  getCommentStats,
  getExtensions,
  getLanguageBreakdown,
  getTerminalWidth,
  getTopDirectories,
  getTopFiles,
  groupFilesByDirectory,
  isSingleFile,
  severityColors,
  shouldShowComments,
} from "./export-utils.js";

function formatQuietOutput(summary: Summary, args: Args): string {
  if (args.files_only && !args.lines_only) {
    return `${summary.total_files}\n`;
  }

  if (args.lines_only && !args.files_only) {
    return `${summary.total_lines}\n`;
  }

  return `${summary.total_files} ${summary.total_lines}\n`;
}

export function buildHumanReport(summary: Summary, args: Args): string {
  let out = "";

  if (args.quiet) {
    out += formatQuietOutput(summary, args);
    return out;
  }

  const terminalWidth = getTerminalWidth();
  const separatorWidth = Math.min(60, terminalWidth - 2);
  const separator = "=".repeat(separatorWidth);

  out += separator + "\n";
  out +=
    "LocIO RESULTS"
      .padStart(Math.floor(separatorWidth / 2) + 6)
      .padEnd(separatorWidth) + "\n";
  out += separator + "\n\n";

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
            ? (summary.total_comment_lines! / summary.total_code_lines).toFixed(
                2,
              )
            : "0.00";
        out += `Code vs Comments Ratio: ${ratio}:1 (${summary.total_comment_lines} comments per ${summary.total_code_lines} code lines)\n`;
      }
    }
  }

  const langStats = getLanguageBreakdown(summary);
  if (langStats.length > 0) {
    out += "\nStatistics by Language:\n";
    out += "-".repeat(60) + "\n";
    for (const lang of langStats) {
      out += `  ${lang.language}: ${lang.files} files`;
      if (!args.files_only) {
        out += `, ${lang.lines} lines`;
      }
      if (!args.lines_only) {
        out += `, ${formatSize(lang.size)}`;
      }
      if (!args.files_only && (lang.code_lines > 0 || lang.comment_lines > 0)) {
        out += ` (${lang.code_lines} code, ${lang.comment_lines} comments, ${lang.blank_lines} blank)`;
      }
      out += "\n";
    }
  }

  const extensions = getExtensions(summary);
  if (extensions.length > 0) {
    out += `\nExtensions: ${extensions.join(", ")}\n`;
  }

  if (args.show_stats && extensions.length > 0) {
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

  if (args.show_stats && summary.details && summary.details.length > 0) {
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

  if (summary.duplicate_groups && summary.duplicate_groups.length > 0) {
    out += `\nDuplicate Files (${summary.duplicate_groups.length} groups):\n`;
    out += "-".repeat(60) + "\n";
    for (const group of summary.duplicate_groups) {
      const wasted = group.lines * (group.files.length - 1);
      out += `  ${group.files.length} copies, ${group.lines} lines each, ${wasted} lines wasted:\n`;
      for (const f of group.files) {
        out += `    - ${f.fullPath}\n`;
      }
    }
  }

  out += "\n";

  return out;
}

export function humanReport(summary: Summary, args: Args): void {
  if (args.quiet) {
    process.stdout.write(formatQuietOutput(summary, args));
    return;
  }

  const terminalWidth = getTerminalWidth();
  const separatorWidth = Math.min(60, terminalWidth - 2);
  const separator = "=".repeat(separatorWidth);
  const titlePadding = Math.floor(separatorWidth / 2) + 6;

  console.log("\n" + severityColors.info(separator));
  console.log(
    severityColors.info.bold(
      "LocIO RESULTS".padStart(titlePadding).padEnd(separatorWidth),
    ),
  );
  console.log(severityColors.info(separator));

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
            ? (summary.total_comment_lines! / summary.total_code_lines).toFixed(
                2,
              )
            : "0.00";
        console.log(
          `\n${chalk.green.bold("Code vs Comments Ratio:")} ${chalk.magenta(ratio)}:1 ${chalk.gray(`(${summary.total_comment_lines} comments per ${summary.total_code_lines} code lines)`)}`,
        );
      }
    }
  }

  const langStats = getLanguageBreakdown(summary);
  if (langStats.length > 0) {
    const termWidth = getTerminalWidth();
    const sepWidth = Math.min(60, termWidth - 2);
    console.log(`\n${severityColors.info.bold("Statistics by Language:")}`);
    console.log(severityColors.muted("-".repeat(sepWidth)));

    for (const lang of langStats) {
      let line = `  ${chalk.white.bold(lang.language)}: ${chalk.yellow(lang.files)} files`;
      if (!args.files_only) {
        line += `, ${chalk.yellow(lang.lines)} lines`;
      }
      if (!args.lines_only) {
        line += `, ${chalk.white(formatSize(lang.size))}`;
      }
      if (!args.files_only && (lang.code_lines > 0 || lang.comment_lines > 0)) {
        line += chalk.gray(
          ` (${chalk.blue(lang.code_lines)} code, ${chalk.cyan(lang.comment_lines)} comments, ${chalk.gray(lang.blank_lines)} blank)`,
        );
      }
      console.log(line);
    }
  }

  const extensions = getExtensions(summary);
  if (extensions.length > 0) {
    console.log(
      `\n${chalk.green.bold("Extensions:")} ${chalk.white(extensions.join(", "))}`,
    );
  }

  if (args.show_stats && extensions.length > 0) {
    const terminalWidth = getTerminalWidth();
    const separatorWidth = Math.min(60, terminalWidth - 2);
    console.log(`\n${severityColors.info.bold("Statistics by Extension:")}`);
    console.log(severityColors.muted("-".repeat(separatorWidth)));

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

  if (args.show_stats && summary.details && summary.details.length > 0) {
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

  if (summary.duplicate_groups && summary.duplicate_groups.length > 0) {
    console.log(
      `\n${chalk.cyan.bold(`Duplicate Files (${summary.duplicate_groups.length} groups):`)}`,
    );
    console.log(chalk.gray("-".repeat(60)));
    for (const group of summary.duplicate_groups) {
      const wasted = group.lines * (group.files.length - 1);
      console.log(
        `  ${chalk.yellow(group.files.length)} copies, ${chalk.yellow(group.lines)} lines each, ${chalk.red(wasted)} lines wasted:`,
      );
      for (const f of group.files) {
        console.log(`    ${chalk.gray("─")} ${chalk.white(f.fullPath)}`);
      }
    }
  }

  console.log();
}
