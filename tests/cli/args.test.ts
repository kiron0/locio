import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCommand, parseArgs } from "../../src/cli/args.js";
import {
  parseNonNegativeIntegerStrict,
  parseOutputFormatStrict,
} from "../../src/cli/utils.js";
import { createTempDir, removeTempDir } from "../utils/test-helpers.js";

describe("CLI argument parsing", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("maps negated commander flags to LocIO args", () => {
    const args = parseArgs([
      tempDir,
      "--no-hidden",
      "--no-empty",
      "--no-progress",
      "--no-binary",
      "--no-comments",
    ]);

    expect(args.no_hidden).toBe(true);
    expect(args.no_empty).toBe(true);
    expect(args.show_progress).toBe(false);
    expect(args.no_binary).toBe(true);
    expect(args.comments).toBe(false);
  });

  it("rejects invalid export formats", () => {
    expect(() => parseOutputFormatStrict("xml")).toThrow(
      /Invalid export format/,
    );
  });

  it("rejects invalid numeric option values", () => {
    expect(() => parseNonNegativeIntegerStrict("nope")).toThrow(
      /Invalid numeric value/,
    );
    expect(() => parseNonNegativeIntegerStrict("12ms")).toThrow(
      /Invalid numeric value/,
    );
    expect(() => parseNonNegativeIntegerStrict("-1")).toThrow(
      /Invalid numeric value/,
    );
  });

  it("fails fast for invalid numeric CLI options", () => {
    const program = createCommand().exitOverride();

    expect(() =>
      program.parse([tempDir, "--max-depth", "nope"], { from: "user" }),
    ).toThrow(/Invalid numeric value/);
  });
});
