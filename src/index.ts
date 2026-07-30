#!/usr/bin/env node

import * as process from "process";
import { InvalidArgumentError } from "commander";
import { parseArgs } from "./cli/args.js";
import { runWithExit } from "./cli/handler.js";

async function main(): Promise<void> {
  const args = parseArgs();
  await runWithExit(args);
}

main().catch((error) => {
  if (error instanceof InvalidArgumentError) {
    console.error(`error: ${error.message}`);
  } else {
    console.error("Unexpected error:", error);
  }
  process.exit(1);
});
