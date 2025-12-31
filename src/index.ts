#!/usr/bin/env node

import * as p from "@clack/prompts";
import chalk from "chalk";
import * as process from "process";
import { createCommand, parseArgs } from "./cli/args.js";
import { runWithExit } from "./cli/handler.js";
import { getPackageVersion } from "./utils/version.js";

async function showInteractiveHome(): Promise<boolean> {
  const version = getPackageVersion();

  p.intro(chalk.cyan.bold(`LocIO CLI v${version}`));
  p.note("A fast, flexible line and file counter for your projects.", "About");

  const choice = await p.select({
    message: "Select an option:",
    options: [
      {
        value: "1",
        label: "Quick scan of current directory (default settings)",
      },
      {
        value: "2",
        label: "Show common command examples",
      },
      {
        value: "3",
        label: "View full help (same as --help)",
      },
      {
        value: "q",
        label: "Quit",
      },
    ],
  });

  if (p.isCancel(choice)) {
    p.outro(chalk.green("Thank you for using LocIO."));
    return false;
  }

  switch (choice) {
    case "1":
      p.note(
        'Running quick scan on current directory (".") with default settings...',
        "Starting scan",
      );
      return true;
    case "2":
      p.note(
        [
          "locio .                     # Quick scan",
          "locio . --files-only        # Show only file counts",
          "locio . --lines-only        # Show only line counts",
          'locio . --exclude "target"  # Ignore patterns',
          "locio . --include-ext ts,js # Filter by extension",
          "locio . --export json       # Export to JSON",
        ].join("\n"),
        "Common Commands",
      );
      p.note("Use --help for more options", "Tip");
      return false;
    case "3":
      console.log();
      const program = createCommand();
      program.outputHelp();
      console.log();
      return false;
    case "q":
      p.outro(chalk.green("Thank you for using LocIO."));
      return false;
    default:
      return false;
  }
}

async function main(): Promise<void> {
  if (process.argv.length === 2 && process.stdin.isTTY) {
    const shouldRun = await showInteractiveHome();
    if (!shouldRun) {
      return;
    }
  }

  const args = parseArgs();
  await runWithExit(args);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
