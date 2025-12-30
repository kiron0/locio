#!/usr/bin/env node

import chalk from "chalk";
import * as process from "process";
import * as readline from "readline";
import { createCommand, parseArgs } from "./cli/args.js";
import { runWithExit } from "./cli/handler.js";
import { getPackageVersion } from "./utils/version.js";

function showInteractiveHome(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const version = getPackageVersion();

    console.log(chalk.cyan("===================================="));
    console.log(chalk.cyan.bold(`           LocIO CLI v${version}`));
    console.log(chalk.cyan("===================================="));
    console.log(
      chalk.gray("A fast, flexible line and file counter for your projects.\n"),
    );

    console.log(chalk.white.bold("Select an option:"));
    console.log(
      chalk.green("  1)") +
        " Quick scan of current directory (default settings)",
    );
    console.log(chalk.blue("  2)") + " Show common command examples");
    console.log(chalk.yellow("  3)") + " View full help (same as --help)");
    console.log(chalk.gray("  q)") + " Quit\n");

    process.nextTick(() => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const askChoice = () => {
        rl.question(chalk.cyan("Enter choice (1/2/3/q): "), (input) => {
          const choice = input.trim().toLowerCase();

          if (!["1", "2", "3", "q"].includes(choice)) {
            console.log(
              chalk.red("❌ Invalid choice. Please enter 1, 2, 3, or q.\n"),
            );
            askChoice();
            return;
          }

          switch (choice) {
            case "1":
              console.log(
                chalk.green(
                  '\n✓ Running quick scan on current directory (".") with default settings...\n',
                ),
              );
              rl.close();
              resolve(true);
              break;
            case "2":
              console.log(chalk.cyan.bold("\n📚 Common Commands:\n"));
              console.log(
                chalk.white("  locio .") +
                  chalk.gray("                    # Quick scan"),
              );
              console.log(
                chalk.white("  locio . --files-only") +
                  chalk.gray("        # Show only file counts"),
              );
              console.log(
                chalk.white("  locio . --lines-only") +
                  chalk.gray("       # Show only line counts"),
              );
              console.log(
                chalk.white('  locio . --exclude "target"') +
                  chalk.gray("  # Ignore patterns"),
              );
              console.log(
                chalk.white("  locio . --include-ext ts,js") +
                  chalk.gray(" # Filter by extension"),
              );
              console.log(
                chalk.white("  locio . --export json") +
                  chalk.gray("       # Export to JSON"),
              );
              console.log(
                chalk.gray("\n💡 Tip: Use --help for more options\n"),
              );
              rl.close();
              resolve(false);
              break;
            case "3":
              console.log();
              const program = createCommand();
              program.outputHelp();
              console.log();
              rl.close();
              resolve(false);
              break;
            case "q":
              console.log(chalk.green("\n✓ Thank you for using LocIO."));
              rl.close();
              resolve(false);
              break;
          }
        });
      };

      rl.on("error", (err) => {
        console.error("\nFailed to read input. Exiting.");
        rl.close();
        reject(err);
      });

      askChoice();
    });
  });
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
