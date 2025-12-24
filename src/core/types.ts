export interface FileDetail {
  directory: string;
  name: string;
  extension: string;
  size: number;
  lines: number | null;
}

export interface Summary {
  total_files: number;
  total_lines: number;
  total_size: number;
  files_by_extension: Record<string, number>;
  lines_by_extension: Record<string, number>;
  size_by_extension: Record<string, number>;
  details: FileDetail[];
}

export function createSummary(): Summary {
  return {
    total_files: 0,
    total_lines: 0,
    total_size: 0,
    files_by_extension: {},
    lines_by_extension: {},
    size_by_extension: {},
    details: [],
  };
}
