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
  isMultiTargetScan,
  isSingleFile,
} from "./export-utils.js";

export function buildJsonOutput(summary: Summary, args: Args): string {
  const projectType = !isMultiTargetScan(args)
    ? detectProjectType(args.directory)
    : ProjectType.Unknown;

  interface JsonLanguageOutput {
    language: string;
    extensions: string[];
    files: number;
    size: number;
    lines?: number;
    code_lines?: number;
    comment_lines?: number;
    blank_lines?: number;
  }

  interface JsonOutput {
    directory: string;
    project_type?: ProjectType;
    project_type_display?: string;
    files?: number;
    size?: number;
    size_formatted?: string;
    lines?: number;
    comment_lines?: number;
    code_lines?: number;
    blank_lines?: number;
    full_line_comments?: number;
    inline_comments?: number;
    code_vs_comments_ratio?: number;
    stats?: Record<
      string,
      {
        files: number;
        lines?: number;
        size: number;
        comment_lines?: number;
        code_lines?: number;
        blank_lines?: number;
        full_line_comments?: number;
        inline_comments?: number;
        code_vs_comments_ratio?: number;
      }
    >;
    by_extension?: Record<
      string,
      {
        files: number;
        lines?: number;
        size: number;
        comment_lines?: number;
        code_lines?: number;
        blank_lines?: number;
        full_line_comments?: number;
        inline_comments?: number;
        code_vs_comments_ratio?: number;
      }
    >;
    by_language?: JsonLanguageOutput[];
    top_files?: Array<{
      name: string;
      directory: string;
      extension: string;
      size: number;
      size_formatted: string;
      lines: number | null;
    }>;
    top_directories?: Array<{
      directory: string;
      file_count: number;
      total_size: number;
      total_size_formatted: string;
      total_lines: number;
    }>;
    duplicate_groups?: Summary["duplicate_groups"];
    exclusions?: Summary["exclusions"];
  }

  const output: JsonOutput = {
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
    const stats: Record<
      string,
      {
        files: number;
        size: number;
        lines?: number;
        comment_lines?: number;
        code_lines?: number;
        blank_lines?: number;
        full_line_comments?: number;
        inline_comments?: number;
        code_vs_comments_ratio?: number;
      }
    > = {};

    const extensions = getExtensions(summary);
    if (extensions.length > 0) {
      for (const ext of extensions) {
        stats[ext] = {
          files: summary.files_by_extension[ext],
          size: summary.size_by_extension[ext] || 0,
        };
        if (!args.files_only) {
          stats[ext].lines = summary.lines_by_extension[ext] || 0;
        }
        if (!args.files_only && args.comments) {
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
    }
    output.stats = stats;
    output.by_extension = stats;
  }

  const langStats = getLanguageBreakdown(summary);
  if (langStats.length > 0) {
    output.by_language = langStats.map((lang) => ({
      language: lang.language,
      extensions: lang.extensions,
      files: lang.files,
      size: lang.size,
      ...(!args.files_only
        ? {
            lines: lang.lines,
            code_lines: lang.code_lines,
            comment_lines: lang.comment_lines,
            blank_lines: lang.blank_lines,
          }
        : {}),
    }));
  }

  if (summary.duplicate_groups && summary.duplicate_groups.length > 0) {
    output.duplicate_groups = summary.duplicate_groups;
  }

  if (args.explain && summary.exclusions) {
    output.exclusions = summary.exclusions;
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
