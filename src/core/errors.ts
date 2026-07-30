import * as path from "path";

export enum ErrorCode {
  IO_ERROR = "IO_ERROR",
  INVALID_SIZE_FORMAT = "INVALID_SIZE_FORMAT",
  INVALID_REGEX = "INVALID_REGEX",
  DIRECTORY_NOT_FOUND = "DIRECTORY_NOT_FOUND",
  NOT_A_DIRECTORY = "NOT_A_DIRECTORY",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  EXPORT_PATH_ERROR = "EXPORT_PATH_ERROR",
  FILE_PROCESSING_ERROR = "FILE_PROCESSING_ERROR",
  COMMENT_PARSING_ERROR = "COMMENT_PARSING_ERROR",
  CONFIG_EXISTS = "CONFIG_EXISTS",
}

export class LineCounterError extends Error {
  public suggestion?: string;
  public code: ErrorCode;
  public filePath?: string;
  public lineNumber?: number;

  constructor(
    message: string,
    code: ErrorCode,
    options?: {
      cause?: Error;
      suggestion?: string;
      filePath?: string;
      lineNumber?: number;
    },
  ) {
    super(message);
    this.name = "LineCounterError";
    this.code = code;
    this.cause = options?.cause;
    this.suggestion = options?.suggestion;
    this.filePath = options?.filePath;
    this.lineNumber = options?.lineNumber;
  }

  static io(
    message: string,
    cause?: Error,
    filePath?: string,
  ): LineCounterError {
    const suggestion =
      "Check if the file/directory exists, you have read permissions, and there's sufficient disk space.\n" +
      "  - Verify the path is correct\n" +
      "  - Check file system permissions\n" +
      "  - Ensure sufficient disk space is available\n" +
      "  - Try running with elevated permissions if needed";
    return new LineCounterError(`IO error: ${message}`, ErrorCode.IO_ERROR, {
      cause,
      suggestion,
      filePath,
    });
  }

  static invalidSizeFormat(format: string): LineCounterError {
    const suggestion =
      "Size format should be a number followed by a unit (e.g., '5MB', '1KB', '500B').\n" +
      "Valid units: B, KB, MB, GB, TB (case-insensitive).";
    return new LineCounterError(
      `Invalid size format: ${format}`,
      ErrorCode.INVALID_SIZE_FORMAT,
      {
        suggestion,
      },
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
      ErrorCode.INVALID_REGEX,
      {
        cause,
        suggestion,
      },
    );
  }

  static directoryNotFound(pathStr: string): LineCounterError {
    let resolvedPath: string;
    try {
      resolvedPath = path.resolve(pathStr);
    } catch {
      resolvedPath = pathStr;
    }

    const pathExists = (() => {
      try {
        return require("fs").existsSync(resolvedPath);
      } catch {
        return false;
      }
    })();

    const hasBackslashes = pathStr.includes("\\");
    const hasSpaces = pathStr.includes(" ");
    const hasSpecialChars = /['"]/.test(pathStr);
    const missingBackslashes =
      hasSpaces && !hasBackslashes && pathStr.includes(":");

    let suggestion = `The path "${pathStr}" does not exist.\n`;
    suggestion += `  - Check if the path is correct (resolved: ${resolvedPath})\n`;

    if (missingBackslashes) {
      suggestion +=
        "  - ⚠️  WARNING: Path appears to be missing backslashes (\\). This usually means the path wasn't properly quoted.\n";
      suggestion +=
        '  - On Windows, use double quotes: "D:\\path\\with spaces"\n';
      suggestion += "  - Or use forward slashes: D:/path/with spaces\n";
      suggestion += "  - Or escape backslashes: D:\\\\path\\\\with spaces\n";
    }

    if (!pathExists) {
      const parentPath = path.dirname(resolvedPath);
      const parentExists = (() => {
        try {
          return require("fs").existsSync(parentPath);
        } catch {
          return false;
        }
      })();

      if (!parentExists) {
        suggestion += `  - Parent directory "${parentPath}" also does not exist\n`;
      } else {
        suggestion += `  - Parent directory exists, but "${path.basename(resolvedPath)}" is missing\n`;
      }
    }

    suggestion += "  - Use relative paths like '.' for current directory\n";
    suggestion += "  - Verify you have read permissions\n";
    suggestion +=
      "  - Check if it's a file instead of a directory (use the file path directly)\n";
    if (hasSpecialChars || hasSpaces) {
      suggestion +=
        "  - Ensure paths with spaces or special characters are properly quoted in your shell\n";
    }

    return new LineCounterError(
      `Directory not found: ${pathStr}`,
      ErrorCode.DIRECTORY_NOT_FOUND,
      {
        suggestion,
        filePath: pathStr,
      },
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
      ErrorCode.NOT_A_DIRECTORY,
      {
        suggestion,
        filePath: pathStr,
      },
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
      ErrorCode.FILE_NOT_FOUND,
      {
        suggestion,
        filePath: pathStr,
      },
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
      ErrorCode.EXPORT_PATH_ERROR,
      {
        suggestion,
        filePath: pathStr,
      },
    );
  }

  static configExists(pathStr: string): LineCounterError {
    return new LineCounterError(
      `Configuration file already exists: ${pathStr}`,
      ErrorCode.CONFIG_EXISTS,
      {
        suggestion:
          "Use --init --force to overwrite it, or edit the existing file.",
        filePath: pathStr,
      },
    );
  }

  static fileProcessingError(
    filePath: string,
    message: string,
    cause?: Error,
  ): LineCounterError {
    const suggestion =
      `Error processing file "${filePath}": ${message}\n` +
      "  - Check if the file is readable\n" +
      "  - Verify file encoding (should be UTF-8)\n" +
      "  - Ensure file is not corrupted\n" +
      "  - Check available memory";
    return new LineCounterError(
      `File processing error: ${message}`,
      ErrorCode.FILE_PROCESSING_ERROR,
      {
        cause,
        suggestion,
        filePath,
      },
    );
  }

  static commentParsingError(
    filePath: string,
    message: string,
    cause?: Error,
  ): LineCounterError {
    const suggestion =
      `Comment parsing failed for "${filePath}": ${message}\n` +
      "  - File will be processed with basic line counting\n" +
      "  - Comment statistics may be incomplete\n" +
      "  - Check file encoding and syntax";
    return new LineCounterError(
      `Comment parsing error: ${message}`,
      ErrorCode.COMMENT_PARSING_ERROR,
      {
        cause,
        suggestion,
        filePath,
      },
    );
  }
}

export function isError<T>(
  result: T | LineCounterError,
): result is LineCounterError {
  return result instanceof LineCounterError;
}
