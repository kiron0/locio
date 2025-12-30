import chalk from "chalk";
import type { Args } from "../cli/args.js";

export class Logger {
  private quiet: boolean;
  private verboseMode: boolean;

  constructor(args: Args) {
    this.quiet = args.quiet || false;

    this.verboseMode = false;
  }

  info(message: string): void {
    if (!this.quiet) {
      console.log(message);
    }
  }

  success(message: string): void {
    if (!this.quiet) {
      console.log(chalk.green(message));
    }
  }

  warn(message: string): void {
    if (!this.quiet) {
      console.warn(chalk.yellow(message));
    }
  }

  error(message: string): void {
    console.error(chalk.red(message));
  }

  debug(message: string): void {
    if (this.verboseMode && !this.quiet) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  verbose(message: string): void {
    if (this.verboseMode && !this.quiet) {
      console.log(chalk.gray(message));
    }
  }
}

export function createLogger(args: Args): Logger {
  return new Logger(args);
}
