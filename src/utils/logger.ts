import chalk from "chalk";
import type { Args } from "../cli/args.js";

export class Logger {
  private quiet: boolean;
  private verboseMode: boolean;
  private stdoutReserved: boolean;

  constructor(args: Args) {
    this.quiet = args.quiet || false;
    this.stdoutReserved = args.stdout !== undefined;

    this.verboseMode = false;
  }

  info(message: string): void {
    if (!this.quiet) {
      if (this.stdoutReserved) {
        console.error(message);
      } else {
        console.log(message);
      }
    }
  }

  success(message: string): void {
    if (!this.quiet) {
      if (this.stdoutReserved) {
        console.error(chalk.green(message));
      } else {
        console.log(chalk.green(message));
      }
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
      const output = chalk.gray(`[DEBUG] ${message}`);
      if (this.stdoutReserved) {
        console.error(output);
      } else {
        console.log(output);
      }
    }
  }

  verbose(message: string): void {
    if (this.verboseMode && !this.quiet) {
      const output = chalk.gray(message);
      if (this.stdoutReserved) {
        console.error(output);
      } else {
        console.log(output);
      }
    }
  }
}

export function createLogger(args: Args): Logger {
  return new Logger(args);
}
