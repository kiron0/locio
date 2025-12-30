import chalk from "chalk";

export class ThrottledProgressBar {
  private progressBar: ProgressBar;
  private updateQueue: {
    files: number;
    errors: number;
    currentFile?: string;
  }[] = [];
  private lastUpdate = 0;
  private throttleMs = 100;
  private pendingUpdate: NodeJS.Timeout | null = null;

  constructor(progressBar: ProgressBar) {
    this.progressBar = progressBar;
  }

  update(files: number, errors: number, currentFile?: string): void {
    this.updateQueue.push({ files, errors, currentFile });
    this.scheduleUpdate();
  }

  private scheduleUpdate(): void {
    if (this.pendingUpdate) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdate;

    if (timeSinceLastUpdate >= this.throttleMs) {
      this.flushUpdate();
    } else {
      const delay = this.throttleMs - timeSinceLastUpdate;
      this.pendingUpdate = setTimeout(() => {
        this.flushUpdate();
      }, delay);
    }
  }

  private flushUpdate(): void {
    if (this.updateQueue.length === 0) {
      this.pendingUpdate = null;
      return;
    }

    const latest = this.updateQueue[this.updateQueue.length - 1];
    this.progressBar.update(latest.files, latest.errors, latest.currentFile);
    this.updateQueue = [];
    this.lastUpdate = Date.now();
    this.pendingUpdate = null;
  }

  finish(): void {
    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }

    this.flushUpdate();
    this.progressBar.finish();
  }
}

export class ProgressBar {
  private total: number;
  private current: number = 0;
  private startTime: number;
  private width: number = 40;
  private errors: number = 0;
  private currentFile: string = "";
  private lastUpdateTime: number;
  private filesPerSecond: number = 0;

  constructor(total: number) {
    this.total = total;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
  }

  update(current: number, errors: number = 0, currentFile?: string): void {
    this.current = current;
    this.errors = errors;
    if (currentFile) {
      this.currentFile = currentFile;
    }

    const now = Date.now();
    const timeDelta = now - this.lastUpdateTime;
    if (timeDelta > 0) {
      const filesDelta = current - (this.current - 1);
      this.filesPerSecond = (filesDelta / timeDelta) * 1000;
    }
    this.lastUpdateTime = now;

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

  private formatSpeed(): string {
    if (this.filesPerSecond === 0 || !isFinite(this.filesPerSecond)) {
      return "calculating...";
    }
    if (this.filesPerSecond >= 1000) {
      return `${(this.filesPerSecond / 1000).toFixed(1)}k files/s`;
    }
    return `${Math.round(this.filesPerSecond)} files/s`;
  }

  private formatCurrentFile(): string {
    if (!this.currentFile) {
      return "";
    }

    const maxLength = 40;
    if (this.currentFile.length > maxLength) {
      return ` | ${"..." + this.currentFile.slice(-maxLength + 3)}`;
    }
    return ` | ${this.currentFile}`;
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
    const speedStr = this.formatSpeed();
    const currentFileStr = this.formatCurrentFile();

    if (!process.stderr.isTTY) {
      if (this.current % 100 === 0 || this.current === this.total) {
        const fileInfo = this.currentFile
          ? ` | Current: ${this.currentFile}`
          : "";
        process.stderr.write(
          `\rProcessed: ${currentStr}/${this.total} (${percentStr}%) | ${elapsedStr} elapsed | ETA: ${etaStr} | ${speedStr}${fileInfo}${errorsStr}`,
        );
      }
      return;
    }

    const terminalWidth = process.stderr.columns || 80;
    this.width = Math.min(40, Math.max(20, Math.floor(terminalWidth / 4)));

    const filled = Math.round((percentage / 100) * this.width);
    const empty = this.width - filled;

    const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    const line = `\r${bar} ${percentStr}% | ${currentStr}/${this.total} files | ${elapsedStr} elapsed | ETA: ${etaStr} | ${chalk.cyan(speedStr)}${currentFileStr}${errorsStr}`;

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
