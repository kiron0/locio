import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectWorkspaces } from "../../../src/core/workspace/workspace.js";
import {
  createTempDir,
  createTestDirStructure,
  removeTempDir,
} from "../../utils/test-helpers.js";

describe("detectWorkspaces", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("should detect workspaces from package.json workspaces array", () => {
    createTestDirStructure(tempDir, {
      packages: {
        core: {
          "package.json": JSON.stringify({ name: "core" }),
        },
        web: {
          "package.json": JSON.stringify({ name: "web" }),
        },
      },
    });

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] }),
      "utf-8",
    );

    const workspaces = detectWorkspaces(tempDir);
    const normalized = workspaces.map((p) => p.replace(/\\/g, "/"));

    expect(normalized.length).toBe(2);
    expect(normalized).toContain(
      path.join(tempDir, "packages/core").replace(/\\/g, "/"),
    );
    expect(normalized).toContain(
      path.join(tempDir, "packages/web").replace(/\\/g, "/"),
    );
  });

  it("should return empty array when no workspaces are configured", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "no-workspaces" }),
      "utf-8",
    );

    const workspaces = detectWorkspaces(tempDir);
    expect(workspaces).toEqual([]);
  });
});
