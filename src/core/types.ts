export interface FileDetail {
  directory: string;
  name: string;
  extension: string;
  size: number;
  lines: number | null;
  comment_lines?: number | null;
  code_lines?: number | null;
  blank_lines?: number | null;
  full_line_comments?: number | null;
  inline_comments?: number | null;
}

export interface Summary {
  total_files: number;
  total_lines: number;
  total_size: number;
  total_comment_lines?: number;
  total_code_lines?: number;
  total_blank_lines?: number;
  total_full_line_comments?: number;
  total_inline_comments?: number;
  files_by_extension: Record<string, number>;
  lines_by_extension: Record<string, number>;
  comment_lines_by_extension?: Record<string, number>;
  code_lines_by_extension?: Record<string, number>;
  blank_lines_by_extension?: Record<string, number>;
  full_line_comments_by_extension?: Record<string, number>;
  inline_comments_by_extension?: Record<string, number>;
  size_by_extension: Record<string, number>;
  details: FileDetail[];
}

export function createSummary(): Summary {
  return {
    total_files: 0,
    total_lines: 0,
    total_size: 0,
    total_comment_lines: 0,
    total_code_lines: 0,
    total_blank_lines: 0,
    total_full_line_comments: 0,
    total_inline_comments: 0,
    files_by_extension: {},
    lines_by_extension: {},
    comment_lines_by_extension: {},
    code_lines_by_extension: {},
    blank_lines_by_extension: {},
    full_line_comments_by_extension: {},
    inline_comments_by_extension: {},
    size_by_extension: {},
    details: [],
  };
}
