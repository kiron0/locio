#!/usr/bin/env node

import * as process from "process";
import * as readline from "readline";
import pkg from "../package.json";
import { createCommand, parseArgs } from "./cli/args.js";
import { runWithExit } from "./cli/handler.js";

function showInteractiveHome(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const version = pkg.version;

    console.log("====================================");
    console.log(`           LocIO CLI v${version}`);
    console.log("====================================");
    console.log("A fast, flexible line and file counter for your projects.\n");

    console.log("Select an option:");
    console.log("  1) Quick scan of current directory (default settings)");
    console.log("  2) Show common command examples");
    console.log("  3) View full help (same as --help)");
    console.log("  q) Quit\n");

    process.nextTick(() => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const askChoice = () => {
        rl.question("Enter choice (1/2/3/q): ", (input) => {
          const choice = input.trim();
          switch (choice) {
            case "1":
              console.log(
                '\nRunning quick scan on current directory (".") with default settings...\n',
              );
              rl.close();
              resolve(true);
              break;
            case "2":
              console.log("\nCommon commands:");
              console.log("  LocIO . --files-only");
              console.log(
                "      Scan current directory with default settings.",
              );
              console.log("  LocIO . --files-only");
              console.log("      Show only file counts.");
              console.log("  LocIO . --lines-only");
              console.log("      Show only line counts.");
              console.log('  LocIO . --exclude "target" --exclude-dir ".git"');
              console.log("      Ignore build and VCS directories.");
              console.log("  LocIO . --include-ext rs,ts,tsx");
              console.log("      Only include specific extensions.");
              console.log("  LocIO . --export json");
              console.log("      Print results in JSON format.\n");
              rl.close();
              resolve(false);
              break;
            case "3":
              console.log();
              const program = createCommand();
              program.outputHelp();
              console.log("\n");
              rl.close();
              resolve(false);
              break;
            case "q":
            case "Q":
              console.log("\nThank you for using LocIO.");
              rl.close();
              resolve(false);
              break;
            default:
              console.log("Invalid choice. Please enter 1, 2, 3, or q.\n");
              askChoice();
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

async function main() {
  if (process.argv.length === 2 && process.stdin.isTTY) {
    const shouldRun = await showInteractiveHome();
    if (!shouldRun) {
      return;
    }
  }

  const args = parseArgs();
  runWithExit(args);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
