import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Args } from "../cli/args.js";

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  peakHeapUsed: number;
  peakRss: number;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  filesProcessed: number;
  errors: number;
  memoryStart: MemoryMetrics;
  memoryEnd: MemoryMetrics;
  memoryPeak: MemoryMetrics;
}

export interface UsageStats {
  totalScans: number;
  totalFilesScanned: number;
  totalLinesScanned: number;
  averageCodebaseSize: number;
  optionUsage: Record<string, number>;
  featureUsage: Record<string, number>;
  exportFormatUsage: Record<string, number>;
  lastUpdated: string;
}

export class MemoryTracker {
  private startMemory: NodeJS.MemoryUsage;
  private peakMemory: NodeJS.MemoryUsage;
  private checkpoints: Array<{ time: number; memory: NodeJS.MemoryUsage }> = [];

  constructor() {
    this.startMemory = process.memoryUsage();
    this.peakMemory = { ...this.startMemory };
  }

  checkpoint(): void {
    const current = process.memoryUsage();
    this.checkpoints.push({ time: Date.now(), memory: current });

    if (current.heapUsed > this.peakMemory.heapUsed) {
      this.peakMemory.heapUsed = current.heapUsed;
    }
    if (current.rss > this.peakMemory.rss) {
      this.peakMemory.rss = current.rss;
    }
    if (current.heapTotal > this.peakMemory.heapTotal) {
      this.peakMemory.heapTotal = current.heapTotal;
    }
    if (current.external > this.peakMemory.external) {
      this.peakMemory.external = current.external;
    }
  }

  getMetrics(): MemoryMetrics {
    const end = process.memoryUsage();
    return {
      heapUsed: end.heapUsed,
      heapTotal: end.heapTotal,
      external: end.external,
      rss: end.rss,
      peakHeapUsed: this.peakMemory.heapUsed,
      peakRss: this.peakMemory.rss,
    };
  }

  getStartMemory(): NodeJS.MemoryUsage {
    return this.startMemory;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function getPerformanceSummary(metrics: PerformanceMetrics): string {
  const memoryIncrease =
    metrics.memoryEnd.heapUsed - metrics.memoryStart.heapUsed;
  const memoryIncreasePercent = (
    (memoryIncrease / metrics.memoryStart.heapUsed) *
    100
  ).toFixed(1);

  return [
    `Duration: ${metrics.duration}ms`,
    `Files: ${metrics.filesProcessed}`,
    `Errors: ${metrics.errors}`,
    `Memory: ${formatBytes(metrics.memoryStart.heapUsed)} → ${formatBytes(metrics.memoryEnd.heapUsed)} (${memoryIncreasePercent}%)`,
    `Peak Memory: ${formatBytes(metrics.memoryPeak.peakRss)} RSS, ${formatBytes(metrics.memoryPeak.peakHeapUsed)} Heap`,
  ].join(" | ");
}

export class UsageStatsTracker {
  private statsPath: string;
  private stats: UsageStats;

  constructor() {
    const homeDir = os.homedir();
    const statsDir = path.join(homeDir, ".locio");
    this.statsPath = path.join(statsDir, "usage-stats.json");

    try {
      if (!fs.existsSync(statsDir)) {
        fs.mkdirSync(statsDir, { recursive: true });
      }
    } catch {}

    this.stats = this.loadStats();
  }

  private loadStats(): UsageStats {
    try {
      if (fs.existsSync(this.statsPath)) {
        const content = fs.readFileSync(this.statsPath, "utf-8");
        return JSON.parse(content);
      }
    } catch {}

    return {
      totalScans: 0,
      totalFilesScanned: 0,
      totalLinesScanned: 0,
      averageCodebaseSize: 0,
      optionUsage: {},
      featureUsage: {},
      exportFormatUsage: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  private saveStats(): void {
    try {
      this.stats.lastUpdated = new Date().toISOString();
      fs.writeFileSync(
        this.statsPath,
        JSON.stringify(this.stats, null, 2),
        "utf-8",
      );
    } catch {}
  }

  trackScan(
    args: Args,
    summary: { total_files: number; total_lines: number },
  ): void {
    this.stats.totalScans++;
    this.stats.totalFilesScanned += summary.total_files;
    this.stats.totalLinesScanned += summary.total_lines;

    if (this.stats.totalScans > 0) {
      this.stats.averageCodebaseSize = Math.round(
        this.stats.totalFilesScanned / this.stats.totalScans,
      );
    }

    const options = [
      "files_only",
      "lines_only",
      "stats",
      "comments",
      "code_vs_comments",
      "watch",
      "no_binary",
      "no_hidden",
      "no_empty",
      "follow_links",
    ];

    for (const option of options) {
      if ((args as unknown as Record<string, unknown>)[option]) {
        this.stats.optionUsage[option] =
          (this.stats.optionUsage[option] || 0) + 1;
      }
    }

    if (args.watch) {
      this.stats.featureUsage["watch"] =
        (this.stats.featureUsage["watch"] || 0) + 1;
    }
    if (args.comments || args.code_vs_comments) {
      this.stats.featureUsage["comments"] =
        (this.stats.featureUsage["comments"] || 0) + 1;
    }
    if (args.rm_comments) {
      this.stats.featureUsage["rm_comments"] =
        (this.stats.featureUsage["rm_comments"] || 0) + 1;
    }
    if (args.top_files || args.top_dirs) {
      this.stats.featureUsage["top_files_dirs"] =
        (this.stats.featureUsage["top_files_dirs"] || 0) + 1;
    }

    if (args.export) {
      const formats = Array.isArray(args.export) ? args.export : [args.export];
      for (const format of formats) {
        const formatKey = format || "human";
        this.stats.exportFormatUsage[formatKey] =
          (this.stats.exportFormatUsage[formatKey] || 0) + 1;
      }
    } else {
      this.stats.exportFormatUsage["human"] =
        (this.stats.exportFormatUsage["human"] || 0) + 1;
    }

    this.saveStats();
  }

  getStats(): UsageStats {
    return { ...this.stats };
  }

  getMostCommonOptions(
    limit: number = 5,
  ): Array<{ option: string; count: number }> {
    return Object.entries(this.stats.optionUsage)
      .map(([option, count]) => ({ option, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getMostUsedExportFormats(
    limit: number = 5,
  ): Array<{ format: string; count: number }> {
    return Object.entries(this.stats.exportFormatUsage)
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  clearStats(): void {
    this.stats = {
      totalScans: 0,
      totalFilesScanned: 0,
      totalLinesScanned: 0,
      averageCodebaseSize: 0,
      optionUsage: {},
      featureUsage: {},
      exportFormatUsage: {},
      lastUpdated: new Date().toISOString(),
    };
    this.saveStats();
  }
}
