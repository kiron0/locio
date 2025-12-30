import type { Summary } from "../types.js";

interface FileUpdate {
  ext: string;
  size: number;
  lines: number | null;
  commentStats: {
    totalLines: number;
    commentLines: number;
    codeLines: number;
    fullLineComments: number;
    inlineComments: number;
    blankLines: number;
  } | null;
}

export class SummaryBuilder {
  private batch: FileUpdate[] = [];
  private batchSize: number;
  private summary: Summary;

  constructor(summary: Summary, batchSize: number = 100) {
    this.summary = summary;
    this.batchSize = batchSize;
  }

  addFile(update: FileUpdate): void {
    this.batch.push(update);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.batch.length === 0) {
      return;
    }

    for (const update of this.batch) {
      this.applyUpdate(update);
    }

    this.batch = [];
  }

  private applyUpdate(update: FileUpdate): void {
    const { ext, size, lines, commentStats } = update;

    this.summary.total_files += 1;
    this.summary.total_size += size;

    if (!this.summary.files_by_extension[ext]) {
      this.summary.files_by_extension[ext] = 0;
      this.summary.size_by_extension[ext] = 0;
      if (lines !== null) {
        this.summary.lines_by_extension[ext] = 0;
      }
    }

    this.summary.files_by_extension[ext] += 1;
    this.summary.size_by_extension[ext] += size;

    if (lines !== null) {
      this.summary.total_lines += lines;
      this.summary.lines_by_extension[ext] =
        (this.summary.lines_by_extension[ext] || 0) + lines;
    }

    if (commentStats) {
      this.summary.total_comment_lines =
        (this.summary.total_comment_lines || 0) + commentStats.commentLines;
      this.summary.total_code_lines =
        (this.summary.total_code_lines || 0) + commentStats.codeLines;
      this.summary.total_blank_lines =
        (this.summary.total_blank_lines || 0) + commentStats.blankLines;
      this.summary.total_full_line_comments =
        (this.summary.total_full_line_comments || 0) +
        commentStats.fullLineComments;
      this.summary.total_inline_comments =
        (this.summary.total_inline_comments || 0) + commentStats.inlineComments;

      if (!this.summary.comment_lines_by_extension) {
        this.summary.comment_lines_by_extension = {};
        this.summary.code_lines_by_extension = {};
        this.summary.blank_lines_by_extension = {};
        this.summary.full_line_comments_by_extension = {};
        this.summary.inline_comments_by_extension = {};
      }

      this.summary.comment_lines_by_extension![ext] =
        (this.summary.comment_lines_by_extension![ext] || 0) +
        commentStats.commentLines;
      this.summary.code_lines_by_extension![ext] =
        (this.summary.code_lines_by_extension![ext] || 0) +
        commentStats.codeLines;
      this.summary.blank_lines_by_extension![ext] =
        (this.summary.blank_lines_by_extension![ext] || 0) +
        commentStats.blankLines;
      this.summary.full_line_comments_by_extension![ext] =
        (this.summary.full_line_comments_by_extension![ext] || 0) +
        commentStats.fullLineComments;
      this.summary.inline_comments_by_extension![ext] =
        (this.summary.inline_comments_by_extension![ext] || 0) +
        commentStats.inlineComments;
    }
  }
}
