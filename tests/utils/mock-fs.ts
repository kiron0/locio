import * as path from "path";

export class MockFileSystem {
  private files = new Map<string, string>();
  private dirs = new Set<string>();
  private stats = new Map<string, MockStats>();

  constructor() {
    this.dirs.add("/");
  }

  writeFileSync(filePath: string, content: string, encoding?: string): void {
    const normalizedPath = this.normalizePath(filePath);
    const dir = path.dirname(normalizedPath);

    this.mkdirSync(dir, { recursive: true });

    this.files.set(normalizedPath, content);
    this.stats.set(normalizedPath, new MockStats(content.length, false));
  }

  readFileSync(filePath: string, encoding?: string): string {
    const normalizedPath = this.normalizePath(filePath);
    const content = this.files.get(normalizedPath);

    if (content === undefined) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${filePath}'`,
      );
      (error as any).code = "ENOENT";
      throw error;
    }

    return content;
  }

  existsSync(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.has(normalizedPath) || this.dirs.has(normalizedPath);
  }

  statSync(filePath: string): MockStats {
    const normalizedPath = this.normalizePath(filePath);

    if (this.files.has(normalizedPath)) {
      const content = this.files.get(normalizedPath)!;
      return new MockStats(content.length, false);
    }

    if (this.dirs.has(normalizedPath)) {
      return new MockStats(0, true);
    }

    const error = new Error(
      `ENOENT: no such file or directory, stat '${filePath}'`,
    );
    (error as any).code = "ENOENT";
    throw error;
  }

  mkdirSync(dirPath: string, options?: { recursive?: boolean }): void {
    const normalizedPath = this.normalizePath(dirPath);

    if (this.dirs.has(normalizedPath)) {
      return;
    }

    if (options?.recursive) {
      const parts = normalizedPath.split("/").filter(Boolean);
      let currentPath = "/";

      for (const part of parts) {
        currentPath =
          currentPath === "/" ? `/${part}` : `${currentPath}/${part}`;
        const normalizedCurrentPath = this.normalizePath(currentPath);
        if (!this.dirs.has(normalizedCurrentPath)) {
          this.dirs.add(normalizedCurrentPath);
        }
      }
    } else {
      this.dirs.add(normalizedPath);
    }
  }

  rmSync(
    filePath: string,
    options?: { recursive?: boolean; force?: boolean },
  ): void {
    const normalizedPath = this.normalizePath(filePath);

    if (this.files.has(normalizedPath)) {
      this.files.delete(normalizedPath);
      this.stats.delete(normalizedPath);
      return;
    }

    if (this.dirs.has(normalizedPath)) {
      if (options?.recursive) {
        const normalizedPathWithSlash =
          normalizedPath === "/" ? "/" : normalizedPath + "/";

        const filesToDelete: string[] = [];
        for (const filePath of this.files.keys()) {
          const normalizedFilePath = filePath.replace(/\\/g, "/");
          if (normalizedFilePath.startsWith(normalizedPathWithSlash)) {
            filesToDelete.push(filePath);
          }
        }
        for (const filePath of filesToDelete) {
          this.files.delete(filePath);
          this.stats.delete(filePath);
        }

        const dirsToDelete: string[] = [];
        for (const dirPath of this.dirs) {
          const normalizedDirPath = dirPath.replace(/\\/g, "/");
          if (
            normalizedDirPath !== normalizedPath &&
            normalizedDirPath.startsWith(normalizedPathWithSlash)
          ) {
            dirsToDelete.push(dirPath);
          }
        }
        for (const dirPath of dirsToDelete) {
          this.dirs.delete(dirPath);
        }
      }

      if (normalizedPath !== "/") {
        this.dirs.delete(normalizedPath);
      }
      return;
    }

    if (!options?.force) {
      const error = new Error(
        `ENOENT: no such file or directory, rm '${filePath}'`,
      );
      (error as any).code = "ENOENT";
      throw error;
    }
  }

  mkdtempSync(prefix: string): string {
    const tempPath = prefix + Math.random().toString(36).substring(7);
    this.mkdirSync(tempPath, { recursive: true });
    return tempPath;
  }

  readdirSync(dirPath: string): string[] {
    const normalizedPath = this.normalizePath(dirPath);

    if (!this.dirs.has(normalizedPath)) {
      const error = new Error(
        `ENOENT: no such file or directory, scandir '${dirPath}'`,
      );
      (error as any).code = "ENOENT";
      throw error;
    }

    const entries = new Set<string>();

    for (const filePath of this.files.keys()) {
      const dir = path.dirname(filePath);
      if (dir === normalizedPath) {
        entries.add(path.basename(filePath));
      }
    }

    for (const dir of this.dirs) {
      if (dir !== normalizedPath && dir.startsWith(normalizedPath + "/")) {
        const relative = path.relative(normalizedPath, dir);
        if (!relative.includes("/")) {
          entries.add(relative);
        }
      }
    }

    return Array.from(entries);
  }

  clear(): void {
    this.files.clear();
    this.dirs.clear();
    this.stats.clear();
    this.dirs.add("/");
  }

  private normalizePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.normalize(filePath).replace(/\\/g, "/");
    }

    const normalized = path
      .normalize(path.join("/", filePath))
      .replace(/\\/g, "/");
    return normalized;
  }
}

export class MockStats {
  constructor(
    public size: number,
    public isDirectory: boolean,
  ) {}

  get isFile(): boolean {
    return !this.isDirectory;
  }

  get mtimeMs(): number {
    return Date.now();
  }
}

export function createMockFileSystem(): MockFileSystem {
  return new MockFileSystem();
}
