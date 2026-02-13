import fastGlob from "fast-glob";
import * as fs from "fs";
import * as path from "path";

export function detectWorkspaces(rootDir: string): string[] {
  const resolved = path.resolve(rootDir);

  const pkgPath = path.join(resolved, "package.json");
  const pkgPatterns = readWorkspacePatternsFromPackageJson(pkgPath);
  if (pkgPatterns.length > 0) {
    return resolveWorkspaceGlobs(resolved, pkgPatterns);
  }

  const pnpmPath = path.join(resolved, "pnpm-workspace.yaml");
  const pnpmPatterns = readPnpmWorkspacePatterns(pnpmPath);
  if (pnpmPatterns.length > 0) {
    return resolveWorkspaceGlobs(resolved, pnpmPatterns);
  }

  const lernaPath = path.join(resolved, "lerna.json");
  const lernaPatterns = readLernaPatterns(lernaPath);
  if (lernaPatterns.length > 0) {
    return resolveWorkspaceGlobs(resolved, lernaPatterns);
  }

  return [];
}

function readWorkspacePatternsFromPackageJson(pkgPath: string): string[] {
  try {
    if (!fs.existsSync(pkgPath)) return [];
    const content = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);

    if (Array.isArray(pkg.workspaces)) {
      return pkg.workspaces;
    }
    if (
      pkg.workspaces &&
      typeof pkg.workspaces === "object" &&
      Array.isArray(pkg.workspaces.packages)
    ) {
      return pkg.workspaces.packages;
    }
    return [];
  } catch {
    return [];
  }
}

function readPnpmWorkspacePatterns(filePath: string): string[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    const patterns: string[] = [];
    let inPackages = false;

    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (line === "packages:" || line === "packages: ") {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        if (line.startsWith("- ")) {
          const pattern = line
            .slice(2)
            .trim()
            .replace(/^['"]|['"]$/g, "");
          if (pattern) patterns.push(pattern);
        } else if (line && !line.startsWith("#")) {
          break;
        }
      }
    }
    return patterns;
  } catch {
    return [];
  }
}

function readLernaPatterns(filePath: string): string[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    const lerna = JSON.parse(content);
    if (Array.isArray(lerna.packages)) {
      return lerna.packages;
    }
    return [];
  } catch {
    return [];
  }
}

function resolveWorkspaceGlobs(rootDir: string, patterns: string[]): string[] {
  const dirs: string[] = [];

  for (const pattern of patterns) {
    if (pattern.startsWith("!")) continue;

    try {
      const matches = fastGlob.sync(pattern, {
        cwd: rootDir,
        onlyDirectories: true,
        absolute: true,
        ignore: ["**/node_modules/**"],
      });

      for (const match of matches) {
        const pkgJson = path.join(match, "package.json");
        if (fs.existsSync(pkgJson)) {
          dirs.push(match);
        }
      }
    } catch {
      const literalPath = path.resolve(rootDir, pattern);
      if (
        fs.existsSync(literalPath) &&
        fs.statSync(literalPath).isDirectory()
      ) {
        dirs.push(literalPath);
      }
    }
  }

  return [...new Set(dirs)].sort();
}
