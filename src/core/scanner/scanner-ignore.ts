import * as fs from "fs";
import ignore from "ignore";
import * as path from "path";

class GitignoreCache {
  private cache = new Map<
    string,
    {
      instance: ignore.Ignore;
      gitignorePaths: Array<{ path: string; mtime: number }>;
    }
  >();

  private getGitignorePaths(
    dirPath: string,
    baseDir: string,
  ): Array<{ path: string; mtime: number }> {
    const gitignorePaths: Array<{ path: string; mtime: number }> = [];

    function collectGitignoreFiles(currentDir: string, baseDir: string) {
      const gitignorePath = path.join(currentDir, ".gitignore");
      try {
        if (
          fs.existsSync(gitignorePath) &&
          fs.statSync(gitignorePath).isFile()
        ) {
          const stats = fs.statSync(gitignorePath);
          gitignorePaths.push({ path: gitignorePath, mtime: stats.mtimeMs });
        }
      } catch {}

      try {
        const entries = fs.readdirSync(currentDir);
        for (const entry of entries) {
          const entryPath = path.join(currentDir, entry);
          try {
            if (fs.lstatSync(entryPath).isDirectory() && entry !== ".git") {
              collectGitignoreFiles(entryPath, baseDir);
            }
          } catch {}
        }
      } catch {}
    }

    collectGitignoreFiles(dirPath, baseDir);
    return gitignorePaths;
  }

  private isCacheValid(
    dirPath: string,
    cached: {
      instance: ignore.Ignore;
      gitignorePaths: Array<{ path: string; mtime: number }>;
    },
  ): boolean {
    const currentPaths = this.getGitignorePaths(dirPath, dirPath);

    if (currentPaths.length !== cached.gitignorePaths.length) {
      return false;
    }

    for (const currentPath of currentPaths) {
      const cachedPath = cached.gitignorePaths.find(
        (p) => p.path === currentPath.path,
      );
      if (!cachedPath) {
        return false;
      }

      if (currentPath.mtime !== cachedPath.mtime) {
        return false;
      }
    }

    return true;
  }

  buildIgnoreInstance(dirPath: string): ignore.Ignore {
    const cached = this.cache.get(dirPath);
    if (cached && this.isCacheValid(dirPath, cached)) {
      return cached.instance;
    }

    const ig = ignore();
    ig.add(".git");
    ig.add(".gitignore");
    ig.add(".lcignore");

    const gitignorePaths: Array<{ path: string; mtime: number }> = [];

    function addGitignorePatterns(
      gitignoreDir: string,
      baseDir: string,
      content: string,
    ): void {
      const relativeDir = path.relative(baseDir, gitignoreDir) || ".";
      const relativeDirNormalized =
        relativeDir === "." ? "" : relativeDir.replace(/\\/g, "/") + "/";

      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const normalizedRule = trimmed.replace(/\\/g, "/");

        if (relativeDir === ".") {
          ig.add(normalizedRule);
        } else {
          if (normalizedRule.startsWith("!")) {
            const negatedRule = normalizedRule.slice(1);
            if (negatedRule.startsWith("/")) {
              ig.add(
                "!" +
                  (relativeDirNormalized + negatedRule.slice(1)).replace(
                    /\/+/g,
                    "/",
                  ),
              );
            } else {
              ig.add(
                "!" +
                  (relativeDirNormalized + negatedRule).replace(/\/+/g, "/"),
              );
            }
          } else if (normalizedRule.startsWith("/")) {
            const rootRelativePattern = normalizedRule.slice(1);
            ig.add(
              (relativeDirNormalized + rootRelativePattern).replace(
                /\/+/g,
                "/",
              ),
            );
          } else if (normalizedRule.includes("**")) {
            ig.add(normalizedRule);
            if (relativeDirNormalized) {
              ig.add(
                (relativeDirNormalized + normalizedRule).replace(/\/+/g, "/"),
              );
            }
          } else {
            const scopedPattern = (
              relativeDirNormalized + normalizedRule
            ).replace(/\/+/g, "/");
            ig.add(scopedPattern);
          }
        }
      }
    }

    function readGitignoreFiles(currentDir: string, baseDir: string): void {
      const gitignorePath = path.join(currentDir, ".gitignore");
      try {
        if (
          fs.existsSync(gitignorePath) &&
          fs.statSync(gitignorePath).isFile()
        ) {
          const stats = fs.statSync(gitignorePath);
          gitignorePaths.push({ path: gitignorePath, mtime: stats.mtimeMs });
          const content = fs.readFileSync(gitignorePath, "utf-8");
          addGitignorePatterns(currentDir, baseDir, content);
        }
      } catch {}

      try {
        const entries = fs.readdirSync(currentDir);
        for (const entry of entries) {
          const entryPath = path.join(currentDir, entry);
          try {
            if (fs.lstatSync(entryPath).isDirectory() && entry !== ".git") {
              readGitignoreFiles(entryPath, baseDir);
            }
          } catch {}
        }
      } catch {}
    }

    readGitignoreFiles(dirPath, dirPath);

    this.cache.set(dirPath, {
      instance: ig,
      gitignorePaths: gitignorePaths,
    });

    return ig;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

const gitignoreCache = new GitignoreCache();

export function buildIgnoreInstance(dirPath: string): ignore.Ignore {
  return gitignoreCache.buildIgnoreInstance(dirPath);
}

export function buildIgnoreInstanceWithoutGitignore(): ignore.Ignore {
  const ig = ignore();
  ig.add(".git");
  ig.add(".gitignore");
  ig.add(".lcignore");
  return ig;
}

export function clearGitignoreCache(): void {
  gitignoreCache.clearCache();
}
