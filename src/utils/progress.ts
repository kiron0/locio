import chalk from "chalk";

export class ProgressBar {
  private total: number;
  private current: number = 0;
  private startTime: number;
  private width: number = 40;
  private errors: number = 0;

  constructor(total: number) {
    this.total = total;
    this.startTime = Date.now();
  }

  update(current: number, errors: number = 0): void {
    this.current = current;
    this.errors = errors;
    this.render();
  }

  increment(errors: number = 0): void {
    this.current++;
    if (errors > 0) {
      this.errors = errors;
    }
    this.render();
  }

  private formatTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  private calculateETA(): string {
    if (this.current === 0) {
      return "calculating...";
    }

    const elapsed = Date.now() - this.startTime;
    const rate = this.current / elapsed;
    const remaining = this.total - this.current;
    const etaMs = remaining / rate;

    if (etaMs < 0 || !isFinite(etaMs)) {
      return "calculating...";
    }

    return this.formatTime(etaMs);
  }

  private render(): void {
    const percentage = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const percentStr = percentage.toFixed(1).padStart(5);
    const currentStr = String(this.current).padStart(String(this.total).length);
    const errorsStr =
      this.errors > 0 ? chalk.red(` (${this.errors} errors)`) : "";
    const elapsed = Date.now() - this.startTime;
    const elapsedStr = this.formatTime(elapsed);
    const etaStr = this.calculateETA();

    if (!process.stderr.isTTY) {
      if (this.current % 100 === 0 || this.current === this.total) {
        process.stderr.write(
          `\rProcessed: ${currentStr}/${this.total} (${percentStr}%) | ${elapsedStr} elapsed | ETA: ${etaStr}${errorsStr}`,
        );
      }
      return;
    }

    const filled = Math.round((percentage / 100) * this.width);
    const empty = this.width - filled;

    const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    const line = `\r${bar} ${percentStr}% | ${currentStr}/${this.total} files | ${elapsedStr} elapsed | ETA: ${etaStr}${errorsStr}`;

    process.stderr.write("\x1b[K" + line);
  }

  finish(): void {
    const elapsed = Date.now() - this.startTime;
    const elapsedStr = this.formatTime(elapsed);
    const errorsStr =
      this.errors > 0 ? chalk.red(` (${this.errors} errors)`) : "";

    if (process.stderr.isTTY) {
      const percentage = 100;
      const bar = chalk.green("█".repeat(this.width));
      const currentStr = String(this.current).padStart(
        String(this.total).length,
      );
      process.stderr.write(
        `\r${bar} ${percentage.toFixed(1).padStart(5)}% | ${currentStr}/${this.total} files | ${elapsedStr}${errorsStr}\n`,
      );
    } else {
      process.stderr.write(
        `\rProcessed: ${this.current}/${this.total} files in ${elapsedStr}${errorsStr}\n`,
      );
    }
  }
}
