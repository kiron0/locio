import * as path from "path";

export class LineCounterError extends Error {
  public suggestion?: string;

  constructor(
    message: string,
    public cause?: Error,
    suggestion?: string,
  ) {
    super(message);
    this.name = "LineCounterError";
    this.suggestion = suggestion;
  }

  static io(message: string, cause?: Error): LineCounterError {
    const suggestion =
      "Check if the file/directory exists, you have read permissions, and there's sufficient disk space.";
    return new LineCounterError(`IO error: ${message}`, cause, suggestion);
  }

  static invalidSizeFormat(format: string): LineCounterError {
    const suggestion =
      "Size format should be a number followed by a unit (e.g., '5MB', '1KB', '500B').\n" +
      "Valid units: B, KB, MB, GB, TB (case-insensitive).";
    return new LineCounterError(
      `Invalid size format: ${format}`,
      undefined,
      suggestion,
    );
  }

  static invalidRegex(pattern: string, cause?: Error): LineCounterError {
    const suggestion =
      "Check your regex pattern syntax. Common issues:\n" +
      "  - Escape special characters with backslash (\\* for literal *)\n" +
      "  - Use proper grouping syntax (parentheses, brackets)\n" +
      "  - Verify quantifiers are properly placed\n" +
      "  - Test your pattern at https://regex101.com";
    return new LineCounterError(
      `Invalid regex pattern: ${pattern}${cause ? `: ${cause.message}` : ""}`,
      cause,
      suggestion,
    );
  }

  static directoryNotFound(pathStr: string): LineCounterError {
    let resolvedPath: string;
    try {
      resolvedPath = path.resolve(pathStr);
    } catch {
      resolvedPath = pathStr;
    }
    const suggestion =
      `The path "${pathStr}" does not exist.\n` +
      `  - Check if the path is correct (resolved: ${resolvedPath})\n` +
      "  - Use relative paths like '.' for current directory\n" +
      "  - Verify you have read permissions\n" +
      "  - Check if it's a file instead of a directory (use the file path directly)";
    return new LineCounterError(
      `Directory not found: ${pathStr}`,
      undefined,
      suggestion,
    );
  }

  static notADirectory(pathStr: string): LineCounterError {
    const suggestion =
      `"${pathStr}" exists but is not a directory.\n` +
      "  - If it's a file, you can scan it directly: locio <file-path>\n" +
      "  - If you meant a directory, check the path spelling\n" +
      "  - Use 'locio .' to scan the current directory";
    return new LineCounterError(
      `Not a directory: ${pathStr}`,
      undefined,
      suggestion,
    );
  }

  static fileNotFound(pathStr: string): LineCounterError {
    const suggestion =
      `The file "${pathStr}" does not exist.\n` +
      "  - Check if the file path is correct\n" +
      "  - Verify the file extension\n" +
      "  - Ensure you have read permissions";
    return new LineCounterError(
      `File not found: ${pathStr}`,
      undefined,
      suggestion,
    );
  }

  static exportPathError(pathStr: string, reason: string): LineCounterError {
    const suggestion =
      `Cannot write to export path "${pathStr}": ${reason}\n` +
      "  - Ensure the directory exists or can be created\n" +
      "  - Check write permissions\n" +
      "  - Verify there's sufficient disk space\n" +
      "  - Use an absolute path if relative paths aren't working";
    return new LineCounterError(
      `Export path error: ${pathStr}`,
      undefined,
      suggestion,
    );
  }
}

export function isError<T>(
  result: T | LineCounterError,
): result is LineCounterError {
  return result instanceof LineCounterError;
}
