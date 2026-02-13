import type { Summary } from "../types.js";
import { createSummary } from "../types.js";

export function mergeSummaries(labeled: Map<string, Summary>): {
  combined: Summary;
  perDirectory: Map<string, Summary>;
} {
  const combined = createSummary();

  for (const [, summary] of labeled) {
    combined.total_files += summary.total_files;
    combined.total_lines += summary.total_lines;
    combined.total_size += summary.total_size;
    combined.total_comment_lines =
      (combined.total_comment_lines || 0) + (summary.total_comment_lines || 0);
    combined.total_code_lines =
      (combined.total_code_lines || 0) + (summary.total_code_lines || 0);
    combined.total_blank_lines =
      (combined.total_blank_lines || 0) + (summary.total_blank_lines || 0);
    combined.total_full_line_comments =
      (combined.total_full_line_comments || 0) +
      (summary.total_full_line_comments || 0);
    combined.total_inline_comments =
      (combined.total_inline_comments || 0) +
      (summary.total_inline_comments || 0);

    mergeExtensionMap(combined.files_by_extension, summary.files_by_extension);
    mergeExtensionMap(combined.lines_by_extension, summary.lines_by_extension);
    mergeExtensionMap(combined.size_by_extension, summary.size_by_extension);

    if (summary.comment_lines_by_extension) {
      if (!combined.comment_lines_by_extension)
        combined.comment_lines_by_extension = {};
      mergeExtensionMap(
        combined.comment_lines_by_extension,
        summary.comment_lines_by_extension,
      );
    }
    if (summary.code_lines_by_extension) {
      if (!combined.code_lines_by_extension)
        combined.code_lines_by_extension = {};
      mergeExtensionMap(
        combined.code_lines_by_extension,
        summary.code_lines_by_extension,
      );
    }
    if (summary.blank_lines_by_extension) {
      if (!combined.blank_lines_by_extension)
        combined.blank_lines_by_extension = {};
      mergeExtensionMap(
        combined.blank_lines_by_extension,
        summary.blank_lines_by_extension,
      );
    }
    if (summary.full_line_comments_by_extension) {
      if (!combined.full_line_comments_by_extension)
        combined.full_line_comments_by_extension = {};
      mergeExtensionMap(
        combined.full_line_comments_by_extension,
        summary.full_line_comments_by_extension,
      );
    }
    if (summary.inline_comments_by_extension) {
      if (!combined.inline_comments_by_extension)
        combined.inline_comments_by_extension = {};
      mergeExtensionMap(
        combined.inline_comments_by_extension,
        summary.inline_comments_by_extension,
      );
    }

    combined.details.push(...summary.details);

    if (summary.duplicate_groups) {
      if (!combined.duplicate_groups) combined.duplicate_groups = [];
      combined.duplicate_groups.push(...summary.duplicate_groups);
    }

    if (summary.by_language) {
      if (!combined.by_language) combined.by_language = [];
      combined.by_language.push(...summary.by_language);
    }
  }

  return { combined, perDirectory: labeled };
}

function mergeExtensionMap(
  target: Record<string, number>,
  source: Record<string, number>,
): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] || 0) + value;
  }
}
