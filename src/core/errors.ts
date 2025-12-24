export class LineCounterError extends Error {
  constructor(
    message: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "LineCounterError";
  }

  static io(message: string, cause?: Error): LineCounterError {
    return new LineCounterError(`IO error: ${message}`, cause);
  }

  static invalidSizeFormat(format: string): LineCounterError {
    return new LineCounterError(`Invalid size format: ${format}`);
  }

  static invalidRegex(pattern: string, cause?: Error): LineCounterError {
    return new LineCounterError(
      `Invalid regex pattern: ${pattern}${cause ? `: ${cause.message}` : ""}`,
      cause,
    );
  }

  static directoryNotFound(path: string): LineCounterError {
    return new LineCounterError(`Directory not found: ${path}`);
  }

  static notADirectory(path: string): LineCounterError {
    return new LineCounterError(`Not a directory: ${path}`);
  }
}

export function isError<T>(
  result: T | LineCounterError,
): result is LineCounterError {
  return result instanceof LineCounterError;
}
