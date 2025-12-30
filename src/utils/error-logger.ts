import type { Args } from "../cli/args.js";
import { OutputFormat } from "../cli/args.js";
import { ErrorCode, LineCounterError } from "../core/errors.js";

export interface ErrorLogEntry {
  timestamp: string;
  code: ErrorCode;
  message: string;
  filePath?: string;
  lineNumber?: number;
  suggestion?: string;
  cause?: {
    message: string;
    stack?: string;
  };
}

export class ErrorLogger {
  private errors: ErrorLogEntry[] = [];
  private quiet: boolean;
  private jsonOutput: boolean;

  constructor(args: Args) {
    this.quiet = args.quiet || false;

    this.jsonOutput =
      (Array.isArray(args.export) && args.export.includes(OutputFormat.Json)) ||
      args.export === OutputFormat.Json;
  }

  logError(error: LineCounterError | Error, filePath?: string): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      code:
        error instanceof LineCounterError
          ? error.code
          : ErrorCode.FILE_PROCESSING_ERROR,
      message: error.message,
      filePath:
        error instanceof LineCounterError
          ? error.filePath || filePath
          : filePath,
      lineNumber:
        error instanceof LineCounterError ? error.lineNumber : undefined,
      suggestion:
        error instanceof LineCounterError ? error.suggestion : undefined,
      cause:
        error.cause && error.cause instanceof Error
          ? {
              message: error.cause.message,
              stack: error.cause.stack,
            }
          : undefined,
    };

    this.errors.push(entry);

    if (!this.quiet && !this.jsonOutput) {
      this.logToConsole(entry);
    }
  }

  private logToConsole(entry: ErrorLogEntry): void {
    const parts: string[] = [];

    if (entry.filePath) {
      parts.push(`File: ${entry.filePath}`);
    }
    if (entry.lineNumber) {
      parts.push(`Line: ${entry.lineNumber}`);
    }

    const context = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    console.error(`⚠️  [${entry.code}] ${entry.message}${context}`);

    if (entry.suggestion && !this.quiet) {
      console.error(`💡 ${entry.suggestion}`);
    }
  }

  getErrors(): ErrorLogEntry[] {
    return [...this.errors];
  }

  getErrorsAsJson(): string {
    return JSON.stringify(
      {
        errors: this.errors,
        total: this.errors.length,
      },
      null,
      2,
    );
  }

  getErrorSummary(): {
    total: number;
    byCode: Record<ErrorCode, number>;
    byFile: Record<string, number>;
  } {
    const byCode: Partial<Record<ErrorCode, number>> = {};
    const byFile: Record<string, number> = {};

    for (const error of this.errors) {
      byCode[error.code] = (byCode[error.code] || 0) + 1;
      if (error.filePath) {
        byFile[error.filePath] = (byFile[error.filePath] || 0) + 1;
      }
    }

    return {
      total: this.errors.length,
      byCode: byCode as Record<ErrorCode, number>,
      byFile,
    };
  }

  clear(): void {
    this.errors = [];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrorCount(): number {
    return this.errors.length;
  }
}
