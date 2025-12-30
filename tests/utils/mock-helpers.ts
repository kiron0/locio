import { MockFileSystem, createMockFileSystem } from "./mock-fs.js";

export function createMockFile(
  fs: MockFileSystem,
  filePath: string,
  content: string,
): string {
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function createMockDirStructure(
  fs: MockFileSystem,
  baseDir: string,
  structure: Record<string, string | Record<string, unknown>>,
): void {
  const normalizedBase = baseDir.replace(/\\/g, "/");
  const base =
    normalizedBase === "/"
      ? "/"
      : normalizedBase.endsWith("/")
        ? normalizedBase
        : normalizedBase + "/";

  for (const [name, content] of Object.entries(structure)) {
    const fullPath = base === "/" ? `/${name}` : `${base}${name}`;

    if (typeof content === "string") {
      fs.writeFileSync(fullPath, content, "utf-8");
    } else {
      fs.mkdirSync(fullPath, { recursive: true });

      if (Object.keys(content).length > 0) {
        createMockDirStructure(
          fs,
          fullPath,
          content as Record<string, string | Record<string, unknown>>,
        );
      }
    }
  }
}

export function setupMockFileSystem(
  structure: Record<string, string | Record<string, unknown>>,
): MockFileSystem {
  const fs = createMockFileSystem();
  createMockDirStructure(fs, "/", structure);
  return fs;
}

export function createMockTempDir(
  fs: MockFileSystem,
  prefix = "/tmp/",
): string {
  return fs.mkdtempSync(prefix);
}
