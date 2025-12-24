import chalk from "chalk";
import * as fs from "fs";
import type { Args } from "../cli/args.js";
import { OutputFormat } from "../cli/args.js";
import { formatSize } from "../utils/strings.js";
import type { FileDetail, Summary } from "./types.js";

function displayDirectory(args: Args): string {
  const dir = args.directory;
  return dir === "." ? "current" : dir;
}

function buildHumanReport(summary: Summary, args: Args): string {
  let out = "";

  if (args.quiet) {
    out += `${summary.total_files} ${summary.total_lines}\n`;
    return out;
  }

  out += "=".repeat(60) + "\n";
  out += "LocIO RESULTS\n";
  out += "=".repeat(60) + "\n\n";

  out += `Directory: ${displayDirectory(args)}\n`;

  if (!args.lines_only) {
    out += `\nTotal Files: ${summary.total_files}\n`;
    out += `\nTotal Files Size: ${formatSize(summary.total_size)}\n`;
  }

  if (!args.files_only) {
    out += `\nTotal Lines: ${summary.total_lines}\n`;
  }

  if (Object.keys(summary.files_by_extension).length > 0) {
    const extensions = Object.keys(summary.files_by_extension).sort();
    out += `\nExtensions: ${extensions.join(", ")}\n`;
  }

  if (args.show_stats && Object.keys(summary.files_by_extension).length > 0) {
    const extensions = Object.keys(summary.files_by_extension).sort();

    out += "\nStatistics by Extension:\n";
    out += "-".repeat(60) + "\n";

    for (const ext of extensions) {
      const files = summary.files_by_extension[ext];
      const size = summary.size_by_extension[ext] || 0;
      const lines = summary.lines_by_extension[ext] || 0;

      out += `  ${ext}: ${files} files`;

      if (!args.lines_only) {
        out += `, ${formatSize(size)}`;
      }

      if (!args.files_only) {
        out += `, ${lines} lines`;
      }

      out += "\n";
    }
  }

  if (args.show_stats && summary.details.length > 0) {
    out += "\nFiles by Directory:\n";
    out += "-".repeat(60) + "\n";

    const byDir: Record<string, FileDetail[]> = {};
    for (const detail of summary.details) {
      if (!byDir[detail.directory]) {
        byDir[detail.directory] = [];
      }
      byDir[detail.directory].push(detail);
    }

    const sortedDirs = Object.keys(byDir).sort();
    for (const dir of sortedDirs) {
      const files = byDir[dir];
      out += `Directory: ${dir}\n`;

      for (const f of files) {
        const sizeStr = formatSize(f.size);
        const linesStr =
          f.lines !== null && !args.files_only ? ` | ${f.lines} lines` : "";

        out += `  - ${f.name} (${f.extension}, ${sizeStr}${linesStr})\n`;
      }

      out += "\n";
    }
  }

  out += "\n";

  return out;
}

function humanReport(summary: Summary, args: Args): void {
  if (args.quiet) {
    console.log(`${summary.total_files} ${summary.total_lines}`);
    return;
  }

  console.log("\n" + chalk.cyan("=".repeat(60)));
  console.log(chalk.cyan.bold("LocIO RESULTS"));
  console.log(chalk.cyan("=".repeat(60)));

  console.log(`\n${chalk.green.bold("Directory:")} ${displayDirectory(args)}`);

  if (!args.lines_only) {
    console.log(
      `\n${chalk.green.bold("Total Files:")} ${chalk.yellow(summary.total_files)}`,
    );
    console.log(
      `\n${chalk.green.bold("Total Files Size:")} ${chalk.white(formatSize(summary.total_size))}`,
    );
  }

  if (!args.files_only) {
    console.log(
      `\n${chalk.green.bold("Total Lines:")} ${chalk.yellow(summary.total_lines)}`,
    );
  }

  if (Object.keys(summary.files_by_extension).length > 0) {
    const extensions = Object.keys(summary.files_by_extension).sort();
    console.log(
      `\n${chalk.green.bold("Extensions:")} ${chalk.white(extensions.join(", "))}`,
    );
  }

  if (args.show_stats && Object.keys(summary.files_by_extension).length > 0) {
    console.log(`\n${chalk.cyan.bold("Statistics by Extension:")}`);
    console.log(chalk.gray("-".repeat(60)));

    const extensions = Object.keys(summary.files_by_extension).sort();

    for (const ext of extensions) {
      const files = summary.files_by_extension[ext];
      const size = summary.size_by_extension[ext] || 0;
      const lines = summary.lines_by_extension[ext] || 0;

      process.stdout.write(
        `  ${chalk.white(ext)}: ${chalk.yellow(files)} files`,
      );

      if (!args.lines_only) {
        process.stdout.write(`, ${chalk.white(formatSize(size))}`);
      }

      if (!args.files_only) {
        process.stdout.write(`, ${chalk.yellow(lines)} lines`);
      }

      console.log();
    }
  }

  if (args.show_stats && summary.details.length > 0) {
    console.log(`\n${chalk.cyan.bold("Files by Directory:")}`);
    console.log(chalk.gray("-".repeat(60)));

    const byDir: Record<string, FileDetail[]> = {};
    for (const detail of summary.details) {
      if (!byDir[detail.directory]) {
        byDir[detail.directory] = [];
      }
      byDir[detail.directory].push(detail);
    }

    const sortedDirs = Object.keys(byDir).sort();
    for (const dir of sortedDirs) {
      const files = byDir[dir];
      console.log(chalk.green.bold(`Directory: ${dir}`));

      for (const f of files) {
        const sizeStr = formatSize(f.size);
        const linesStr =
          f.lines !== null && !args.files_only ? ` | ${f.lines} lines` : "";

        console.log(
          `  - ${chalk.white(f.name)} (${chalk.blue(f.extension)}, ${chalk.white(sizeStr)}${linesStr})`,
        );
      }

      console.log();
    }
  }

  console.log();
}

function buildJsonOutput(summary: Summary, args: Args): string {
  const output: any = {
    directory: displayDirectory(args),
    files: summary.total_files,
    size: summary.total_size,
    size_formatted: formatSize(summary.total_size),
  };

  if (!args.files_only) {
    output.lines = summary.total_lines;
  }

  if (args.show_stats) {
    const stats: Record<string, any> = {};
    for (const ext of Object.keys(summary.files_by_extension)) {
      stats[ext] = {
        files: summary.files_by_extension[ext],
        lines: summary.lines_by_extension[ext] || 0,
        size: summary.size_by_extension[ext] || 0,
      };
    }
    output.by_extension = stats;
  }

  return JSON.stringify(output, null, 2);
}

function buildCsvOutput(summary: Summary, args: Args): string {
  let out = `# Directory,${displayDirectory(args)}\n`;
  out += "Extension,Files,Lines,Size\n";
  for (const ext of Object.keys(summary.files_by_extension)) {
    const count = summary.files_by_extension[ext];
    const lines = summary.lines_by_extension[ext] || 0;
    const size = summary.size_by_extension[ext] || 0;
    out += `${ext},${count},${lines},${size}\n`;
  }
  return out;
}

function buildTsvOutput(summary: Summary, args: Args): string {
  let out = `# Directory\t${displayDirectory(args)}\n`;
  out += "Extension\tFiles\tLines\tSize\n";
  for (const ext of Object.keys(summary.files_by_extension)) {
    const count = summary.files_by_extension[ext];
    const lines = summary.lines_by_extension[ext] || 0;
    const size = summary.size_by_extension[ext] || 0;
    out += `${ext}\t${count}\t${lines}\t${size}\n`;
  }
  return out;
}

function writeReportFile(summary: Summary, args: Args): void {
  const format = args.export || OutputFormat.Human;

  let ext: string;
  let content: string;

  switch (format) {
    case OutputFormat.Human:
      ext = "txt";
      content = buildHumanReport(summary, args);
      break;
    case OutputFormat.Json:
      ext = "json";
      content = buildJsonOutput(summary, args);
      break;
    case OutputFormat.Csv:
      ext = "csv";
      content = buildCsvOutput(summary, args);
      break;
    case OutputFormat.Tsv:
      ext = "tsv";
      content = buildTsvOutput(summary, args);
      break;
  }

  const filename = `LocIO-report.${ext}`;

  try {
    fs.writeFileSync(filename, content, "utf-8");
    if (!args.quiet) {
      console.log(`Report written to ${filename}`);
    }
  } catch (e) {
    console.error(`Failed to create report file ${filename}: ${e}`);
  }
}

export function exportReport(summary: Summary, args: Args): void {
  if (args.export !== undefined) {
    writeReportFile(summary, args);
    return;
  }

  humanReport(summary, args);
}
