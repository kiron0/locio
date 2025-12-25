import * as fs from "fs";
import * as path from "path";

export enum ProjectType {
  NodeJS = "nodejs",
  Rust = "rust",
  Python = "python",
  Go = "go",
  Java = "java",
  CSharp = "csharp",
  Ruby = "ruby",
  PHP = "php",
  Swift = "swift",
  Kotlin = "kotlin",
  Dart = "dart",
  TypeScript = "typescript",
  Vue = "vue",
  React = "react",
  Angular = "angular",
  NextJS = "nextjs",
  Unknown = "unknown",
}

export interface ProjectExcludes {
  exclude_dirs: string[];
  exclude_extensions: string[];
  exclude_names: string[];
}

interface DetectionScore {
  type: ProjectType;
  score: number;
  indicators: string[];
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  [key: string]: any;
}

const PROJECT_TYPE_DETECTORS: Array<{
  type: ProjectType;
  files: string[];
  dirs?: string[];
  packageJsonDeps?: string[];
  packageJsonDevDeps?: string[];
  packageJsonScripts?: string[];
  priority: number;
}> = [
  {
    type: ProjectType.NextJS,
    files: [
      "next.config.js",
      "next.config.ts",
      "next.config.mjs",
      "next.config.cjs",
    ],
    packageJsonDeps: ["next"],
    packageJsonDevDeps: ["next"],
    priority: 100,
  },
  {
    type: ProjectType.Angular,
    files: ["angular.json", "angular-cli.json"],
    packageJsonDeps: ["@angular/core"],
    packageJsonDevDeps: ["@angular/cli", "@angular/core"],
    priority: 90,
  },
  {
    type: ProjectType.Vue,
    files: [
      "vue.config.js",
      "vue.config.ts",
      "vite.config.js",
      "vite.config.ts",
    ],
    packageJsonDeps: ["vue"],
    packageJsonDevDeps: ["vue", "@vitejs/plugin-vue", "vite"],
    dirs: [".nuxt"],
    priority: 85,
  },
  {
    type: ProjectType.React,
    files: ["react-scripts"],
    packageJsonDeps: ["react"],
    packageJsonDevDeps: [
      "react",
      "react-scripts",
      "@vitejs/plugin-react",
      "vite",
    ],
    dirs: ["node_modules/react"],
    priority: 80,
  },
  {
    type: ProjectType.TypeScript,
    files: ["tsconfig.json", "tsconfig.app.json", "tsconfig.base.json"],
    priority: 70,
  },
  {
    type: ProjectType.NodeJS,
    files: ["package.json"],
    priority: 50,
  },
  {
    type: ProjectType.Rust,
    files: ["Cargo.toml", "Cargo.lock"],
    priority: 100,
  },
  {
    type: ProjectType.Python,
    files: [
      "requirements.txt",
      "setup.py",
      "pyproject.toml",
      "Pipfile",
      "poetry.lock",
      "manage.py",
      "setup.cfg",
      "Pipfile.lock",
    ],
    dirs: ["__pycache__"],
    priority: 100,
  },
  {
    type: ProjectType.Go,
    files: ["go.mod", "go.sum", "Gopkg.toml", "Gopkg.lock"],
    priority: 100,
  },
  {
    type: ProjectType.Java,
    files: ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle"],
    dirs: [".gradle"],
    priority: 100,
  },
  {
    type: ProjectType.CSharp,
    files: ["*.csproj", "*.sln", "project.json", "*.fsproj", "*.vbproj"],
    dirs: [".vs"],
    priority: 100,
  },
  {
    type: ProjectType.Ruby,
    files: ["Gemfile", "Rakefile", "Gemfile.lock"],
    dirs: [".bundle"],
    priority: 100,
  },
  {
    type: ProjectType.PHP,
    files: ["composer.json", "composer.lock", "artisan"],
    dirs: ["vendor"],
    priority: 100,
  },
  {
    type: ProjectType.Swift,
    files: ["Package.swift", "*.xcodeproj", "*.xcworkspace"],
    dirs: [".build"],
    priority: 100,
  },
  {
    type: ProjectType.Kotlin,
    files: ["build.gradle.kts", "settings.gradle.kts"],
    dirs: [".gradle"],
    priority: 100,
  },
  {
    type: ProjectType.Dart,
    files: ["pubspec.yaml", "pubspec.yml", "pubspec.lock"],
    dirs: [".dart_tool"],
    priority: 100,
  },
];

const PROJECT_EXCLUDES: Record<ProjectType, ProjectExcludes> = {
  [ProjectType.NodeJS]: {
    exclude_dirs: [
      "node_modules",
      ".next",
      ".nuxt",
      ".cache",
      "dist",
      "build",
      ".turbo",
      ".vercel",
      ".output",
    ],
    exclude_extensions: [],
    exclude_names: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  },
  [ProjectType.NextJS]: {
    exclude_dirs: [
      "node_modules",
      ".next",
      ".vercel",
      "out",
      "dist",
      "build",
      ".turbo",
    ],
    exclude_extensions: [],
    exclude_names: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  },
  [ProjectType.React]: {
    exclude_dirs: [
      "node_modules",
      "build",
      "dist",
      ".cache",
      "coverage",
      ".nyc_output",
    ],
    exclude_extensions: [],
    exclude_names: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  },
  [ProjectType.Vue]: {
    exclude_dirs: [
      "node_modules",
      "dist",
      ".nuxt",
      ".cache",
      "coverage",
      ".output",
    ],
    exclude_extensions: [],
    exclude_names: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  },
  [ProjectType.Angular]: {
    exclude_dirs: [
      "node_modules",
      "dist",
      ".angular",
      "coverage",
      ".nyc_output",
    ],
    exclude_extensions: [],
    exclude_names: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  },
  [ProjectType.TypeScript]: {
    exclude_dirs: [
      "node_modules",
      "dist",
      "build",
      ".cache",
      "coverage",
      ".nyc_output",
    ],
    exclude_extensions: [],
    exclude_names: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  },
  [ProjectType.Rust]: {
    exclude_dirs: ["target", ".cargo"],
    exclude_extensions: [],
    exclude_names: ["Cargo.lock"],
  },
  [ProjectType.Python]: {
    exclude_dirs: [
      "__pycache__",
      ".pytest_cache",
      ".mypy_cache",
      ".ruff_cache",
      ".venv",
      "venv",
      "env",
      ".env",
      "build",
      "dist",
      ".*\\.egg-info",
      ".tox",
      ".coverage",
      "htmlcov",
      ".hypothesis",
    ],
    exclude_extensions: ["pyc", "pyo", "pyd", "so"],
    exclude_names: [
      ".python-version",
      "pip-log.txt",
      "pip-delete-this-directory.txt",
    ],
  },
  [ProjectType.Go]: {
    exclude_dirs: ["vendor", ".cache"],
    exclude_extensions: [],
    exclude_names: ["go.sum"],
  },
  [ProjectType.Java]: {
    exclude_dirs: [
      "target",
      "build",
      ".gradle",
      "out",
      ".idea",
      ".classpath",
      ".settings",
    ],
    exclude_extensions: ["class", "jar", "war", "ear"],
    exclude_names: [".project", ".*\\.iml"],
  },
  [ProjectType.CSharp]: {
    exclude_dirs: [
      "bin",
      "obj",
      ".vs",
      "packages",
      "TestResults",
      "[Bb]in",
      "[Oo]bj",
    ],
    exclude_extensions: ["dll", "exe", "pdb"],
    exclude_names: [],
  },
  [ProjectType.Ruby]: {
    exclude_dirs: ["vendor", ".bundle", "tmp", "log"],
    exclude_extensions: [],
    exclude_names: ["Gemfile.lock"],
  },
  [ProjectType.PHP]: {
    exclude_dirs: ["vendor", "node_modules"],
    exclude_extensions: [],
    exclude_names: ["composer.lock"],
  },
  [ProjectType.Swift]: {
    exclude_dirs: [".build", ".swiftpm", "DerivedData"],
    exclude_extensions: [],
    exclude_names: ["Package.resolved"],
  },
  [ProjectType.Kotlin]: {
    exclude_dirs: [
      "build",
      ".gradle",
      "out",
      ".idea",
      ".classpath",
      ".settings",
    ],
    exclude_extensions: ["class", "jar"],
    exclude_names: [".project", ".*\\.iml"],
  },
  [ProjectType.Dart]: {
    exclude_dirs: [".dart_tool", "build"],
    exclude_extensions: [],
    exclude_names: ["pubspec.lock"],
  },
  [ProjectType.Unknown]: {
    exclude_dirs: [],
    exclude_extensions: [],
    exclude_names: [],
  },
};

function readPackageJson(searchPath: string): PackageJson | null {
  const packageJsonPath = path.join(searchPath, "package.json");
  try {
    if (fs.existsSync(packageJsonPath)) {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      return JSON.parse(content) as PackageJson;
    }
  } catch {}
  return null;
}

function hasDependency(
  pkg: PackageJson | null,
  deps: string[] | undefined,
  devDeps: string[] | undefined,
): boolean {
  if (!pkg || (!deps && !devDeps)) return false;

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  if (deps) {
    for (const dep of deps) {
      if (allDeps[dep]) return true;
    }
  }

  if (devDeps) {
    for (const dep of devDeps) {
      if (allDeps[dep]) return true;
    }
  }

  return false;
}

function hasScript(
  pkg: PackageJson | null,
  scripts: string[] | undefined,
): boolean {
  if (!pkg || !scripts || !pkg.scripts) return false;

  for (const script of scripts) {
    if (pkg.scripts[script]) return true;
  }

  return false;
}

function checkFileExists(searchPath: string, fileName: string): boolean {
  if (fileName.includes("*")) {
    try {
      const entries = fs.readdirSync(searchPath);
      const pattern = fileName.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return entries.some((entry) => {
        const entryPath = path.join(searchPath, entry);
        try {
          const stats = fs.statSync(entryPath);
          return (stats.isFile() || stats.isDirectory()) && regex.test(entry);
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  } else {
    const filePath = path.join(searchPath, fileName);
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return stats.isFile();
      }
    } catch {}
  }
  return false;
}

function checkDirExists(searchPath: string, dirName: string): boolean {
  const dirPath = path.join(searchPath, dirName);
  try {
    if (fs.existsSync(dirPath)) {
      const stats = fs.statSync(dirPath);
      return stats.isDirectory();
    }
  } catch {}
  return false;
}

function hasTypeScriptFiles(searchPath: string, maxDepth: number = 2): boolean {
  try {
    const entries = fs.readdirSync(searchPath);
    for (const entry of entries) {
      const entryPath = path.join(searchPath, entry);
      try {
        const stats = fs.statSync(entryPath);
        if (
          stats.isFile() &&
          (entry.endsWith(".ts") || entry.endsWith(".tsx"))
        ) {
          return true;
        }
        if (
          stats.isDirectory() &&
          maxDepth > 0 &&
          !entry.startsWith(".") &&
          entry !== "node_modules"
        ) {
          if (hasTypeScriptFiles(entryPath, maxDepth - 1)) {
            return true;
          }
        }
      } catch {}
    }
  } catch {}
  return false;
}

function detectProjectTypeAdvanced(directory: string): DetectionScore[] {
  const absPath = path.resolve(directory);

  let searchPath = absPath;
  try {
    const stats = fs.statSync(absPath);
    if (stats.isFile()) {
      searchPath = path.dirname(absPath);
    }
  } catch {}

  const scores: Map<ProjectType, DetectionScore> = new Map();
  const pkg = readPackageJson(searchPath);

  for (const detector of PROJECT_TYPE_DETECTORS) {
    let score = 0;
    const indicators: string[] = [];

    for (const file of detector.files) {
      if (checkFileExists(searchPath, file)) {
        score += 30;
        indicators.push(`file:${file}`);
      }
    }

    if (detector.dirs) {
      for (const dir of detector.dirs) {
        if (checkDirExists(searchPath, dir)) {
          score += 20;
          indicators.push(`dir:${dir}`);
        }
      }
    }

    if (detector.packageJsonDeps || detector.packageJsonDevDeps) {
      if (
        hasDependency(
          pkg,
          detector.packageJsonDeps,
          detector.packageJsonDevDeps,
        )
      ) {
        score += 50;
        const deps = [
          ...(detector.packageJsonDeps || []),
          ...(detector.packageJsonDevDeps || []),
        ];
        indicators.push(`dep:${deps.join(",")}`);
      }
    }

    if (detector.packageJsonScripts) {
      if (hasScript(pkg, detector.packageJsonScripts)) {
        score += 15;
        indicators.push(`script:${detector.packageJsonScripts.join(",")}`);
      }
    }

    if (detector.type === ProjectType.TypeScript) {
      if (checkFileExists(searchPath, "tsconfig.json")) {
        score += 30;
        indicators.push("file:tsconfig.json");
      }
      if (hasTypeScriptFiles(searchPath)) {
        score += 20;
        indicators.push("typescript-files");
      }
    }

    if (detector.type === ProjectType.React) {
      try {
        const entries = fs.readdirSync(searchPath);
        const hasJsx = entries.some((entry) => {
          const entryPath = path.join(searchPath, entry);
          try {
            const stats = fs.statSync(entryPath);
            return (
              stats.isFile() &&
              (entry.endsWith(".jsx") || entry.endsWith(".tsx"))
            );
          } catch {
            return false;
          }
        });
        if (hasJsx) {
          score += 15;
          indicators.push("jsx-files");
        }
      } catch {}
    }

    score = Math.floor(score * (1 + detector.priority / 100));

    if (score > 0) {
      scores.set(detector.type, {
        type: detector.type,
        score,
        indicators,
      });
    }
  }

  if (pkg) {
    const hasJsFramework = Array.from(scores.keys()).some(
      (type) =>
        type === ProjectType.React ||
        type === ProjectType.Vue ||
        type === ProjectType.Angular ||
        type === ProjectType.NextJS,
    );

    if (!hasJsFramework) {
      if (
        checkFileExists(searchPath, "tsconfig.json") ||
        hasTypeScriptFiles(searchPath)
      ) {
        if (!scores.has(ProjectType.TypeScript)) {
          scores.set(ProjectType.TypeScript, {
            type: ProjectType.TypeScript,
            score: 40,
            indicators: ["tsconfig-or-ts-files"],
          });
        }
      } else {
        if (!scores.has(ProjectType.NodeJS)) {
          scores.set(ProjectType.NodeJS, {
            type: ProjectType.NodeJS,
            score: 30,
            indicators: ["package.json"],
          });
        }
      }
    }
  }

  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

export function detectProjectType(directory: string): ProjectType {
  const scores = detectProjectTypeAdvanced(directory);

  if (scores.length === 0) {
    return ProjectType.Unknown;
  }

  return scores[0].type;
}

export function getProjectExcludes(projectType: ProjectType): ProjectExcludes {
  return PROJECT_EXCLUDES[projectType] || PROJECT_EXCLUDES[ProjectType.Unknown];
}
