import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import type { Args } from "../../cli/args.js";
import { formatSize } from "../../utils/formatting/index.js";
import { ProjectType } from "../detection/index.js";
import { groupByLanguage } from "../language/index.js";
import type { FileDetail, LanguageStats, Summary } from "../types.js";

export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

export function truncateToWidth(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) {
    return text;
  }
  return "..." + text.slice(-(maxWidth - 3));
}

export const severityColors = {
  success: chalk.green,
  info: chalk.cyan,
  warning: chalk.yellow,
  error: chalk.red,
  highlight: chalk.white.bold,
  muted: chalk.gray,
};

export function getCommentStats(
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

export function formatCommentsText(
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

export function formatCommentsChalk(
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

export function shouldShowComments(
  args: Args,
  hasCommentData: boolean,
): boolean {
  return (
    (args.comments || args.show_stats) && !args.files_only && hasCommentData
  );
}

export function formatFileSizeAndLines(
  size: number,
  lines: number | null,
  args: Args,
): { sizeStr: string; linesStr: string } {
  return {
    sizeStr: formatSize(size),
    linesStr: lines !== null && !args.files_only ? ` | ${lines} lines` : "",
  };
}

export function groupFilesByDirectory(
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

export function isSingleFile(args: Args): boolean {
  if (isMultiTargetScan(args)) {
    return false;
  }

  try {
    const stats = fs.statSync(args.directory);
    return stats.isFile();
  } catch {
    return false;
  }
}

export function isMultiTargetScan(
  args: Args,
): args is Args & { directories: string[] } {
  return Array.isArray(args.directories) && args.directories.length > 1;
}

export function displayDirectory(args: Args): string {
  if (isMultiTargetScan(args)) {
    return args.directories.join(", ");
  }

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

export function getTopFiles(summary: Summary, n: number): FileDetail[] {
  return [...summary.details].sort((a, b) => b.size - a.size).slice(0, n);
}

export function getTopDirectories(
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

export function getExtensions(summary: Summary): string[] {
  return summary.files_by_extension
    ? Object.keys(summary.files_by_extension).sort()
    : [];
}

export function getLanguageBreakdown(summary: Summary): LanguageStats[] {
  if (summary.by_language && summary.by_language.length > 0) {
    return summary.by_language;
  }
  return groupByLanguage(summary);
}
