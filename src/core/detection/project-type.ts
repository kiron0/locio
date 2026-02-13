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
      "nuxt.config.js",
      "nuxt.config.ts",
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
    priority: 75,
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
      "tox.ini",
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
    files: [
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
      "settings.gradle",
      "settings.gradle.kts",
      "build.xml",
      ".classpath",
      "gradlew",
      "mvnw",
    ],
    dirs: [
      ".gradle",
      "WEB-INF",
      "META-INF",
      "src/main/java",
      "src/main/webapp",
    ],
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
    files: ["Gemfile", "Rakefile", "Gemfile.lock", "config.ru"],
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
    files: ["build.gradle.kts", "settings.gradle.kts", "gradlew"],
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

const SOURCE_EXTENSION_MAP: Record<string, ProjectType> = {
  ".java": ProjectType.Java,
  ".jsp": ProjectType.Java,
  ".jspx": ProjectType.Java,
  ".py": ProjectType.Python,
  ".pyw": ProjectType.Python,
  ".rs": ProjectType.Rust,
  ".go": ProjectType.Go,
  ".cs": ProjectType.CSharp,
  ".rb": ProjectType.Ruby,
  ".erb": ProjectType.Ruby,
  ".php": ProjectType.PHP,
  ".phtml": ProjectType.PHP,
  ".swift": ProjectType.Swift,
  ".kt": ProjectType.Kotlin,
  ".kts": ProjectType.Kotlin,
  ".dart": ProjectType.Dart,
};

const SOURCE_SCAN_SKIP_DIRS = new Set([
  "node_modules",
  "target",
  "build",
  "dist",
  "vendor",
  "__pycache__",
  ".gradle",
  ".idea",
  ".vs",
  ".git",
  ".svn",
  "bin",
  "obj",
  "out",
  ".next",
  ".nuxt",
  ".cache",
  ".dart_tool",
  ".build",
  ".cargo",
  "coverage",
  ".nyc_output",
  ".venv",
  "venv",
  "env",
  "tmp",
  "log",
  "logs",
  "DerivedData",
  ".swiftpm",
]);

interface SourceScanResult {
  typeCounts: Map<ProjectType, { count: number; extensions: Set<string> }>;
  hasTypeScriptFiles: boolean;
  hasJsxInRoot: boolean;
}

function scanSourceFiles(
  searchPath: string,
  maxDepth: number = 3,
  maxFiles: number = 500,
): SourceScanResult {
  const result: SourceScanResult = {
    typeCounts: new Map(),
    hasTypeScriptFiles: false,
    hasJsxInRoot: false,
  };
  let filesScanned = 0;

  function scan(dir: string, depth: number) {
    if (depth > maxDepth || filesScanned >= maxFiles) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (filesScanned >= maxFiles) return;
        if (entry.name.startsWith(".")) continue;

        if (entry.isFile()) {
          filesScanned++;
          const ext = path.extname(entry.name).toLowerCase();

          if (ext === ".ts" || ext === ".tsx") {
            result.hasTypeScriptFiles = true;
          }

          if (depth === 0 && (ext === ".jsx" || ext === ".tsx")) {
            result.hasJsxInRoot = true;
          }

          const projectType = SOURCE_EXTENSION_MAP[ext];
          if (projectType) {
            const existing = result.typeCounts.get(projectType) || {
              count: 0,
              extensions: new Set<string>(),
            };
            existing.count++;
            existing.extensions.add(ext);
            result.typeCounts.set(projectType, existing);
          }
        } else if (
          entry.isDirectory() &&
          !SOURCE_SCAN_SKIP_DIRS.has(entry.name.toLowerCase())
        ) {
          scan(path.join(dir, entry.name), depth + 1);
        }
      }
    } catch {}
  }

  scan(searchPath, 0);
  return result;
}

function readPackageJson(searchPath: string): PackageJson | null {
  try {
    const content = fs.readFileSync(
      path.join(searchPath, "package.json"),
      "utf-8",
    );
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

function checkNestedDir(searchPath: string, subPath: string): boolean {
  try {
    return fs.statSync(path.join(searchPath, subPath)).isDirectory();
  } catch {
    return false;
  }
}

function detectProjectTypeAdvanced(directory: string): DetectionScore[] {
  const absPath = path.resolve(directory);

  let searchPath = absPath;
  try {
    if (fs.statSync(absPath).isFile()) {
      searchPath = path.dirname(absPath);
    }
  } catch {}

  let rootEntries: fs.Dirent[];
  try {
    rootEntries = fs.readdirSync(searchPath, { withFileTypes: true });
  } catch {
    rootEntries = [];
  }

  const rootFiles = new Set<string>();
  const rootDirs = new Set<string>();
  for (const entry of rootEntries) {
    if (entry.isFile()) rootFiles.add(entry.name);
    else if (entry.isDirectory()) rootDirs.add(entry.name);
  }

  const pkg = rootFiles.has("package.json")
    ? readPackageJson(searchPath)
    : null;
  const mergedDeps: Record<string, string> = pkg
    ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    : {};

  const sourceScan = scanSourceFiles(searchPath);

  const scores: Map<ProjectType, DetectionScore> = new Map();

  for (const detector of PROJECT_TYPE_DETECTORS) {
    let score = 0;
    const indicators: string[] = [];

    for (const file of detector.files) {
      if (file.includes("*")) {
        const pattern = new RegExp(
          "^" + file.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
        );
        const matched = rootEntries.some(
          (e) => (e.isFile() || e.isDirectory()) && pattern.test(e.name),
        );
        if (matched) {
          score += 30;
          indicators.push(`file:${file}`);
        }
      } else if (rootFiles.has(file)) {
        score += 30;
        indicators.push(`file:${file}`);
      }
    }

    if (detector.dirs) {
      for (const dir of detector.dirs) {
        const exists = dir.includes("/")
          ? checkNestedDir(searchPath, dir)
          : rootDirs.has(dir);
        if (exists) {
          score += 20;
          indicators.push(`dir:${dir}`);
        }
      }
    }

    if (pkg && (detector.packageJsonDeps || detector.packageJsonDevDeps)) {
      const depsToCheck = [
        ...(detector.packageJsonDeps || []),
        ...(detector.packageJsonDevDeps || []),
      ];
      if (depsToCheck.some((dep) => mergedDeps[dep])) {
        score += 50;
        indicators.push(`dep:${depsToCheck.join(",")}`);
      }
    }

    if (detector.packageJsonScripts && pkg?.scripts) {
      if (detector.packageJsonScripts.some((s) => pkg.scripts![s])) {
        score += 15;
        indicators.push(`script:${detector.packageJsonScripts.join(",")}`);
      }
    }

    if (detector.type === ProjectType.TypeScript) {
      if (sourceScan.hasTypeScriptFiles) {
        score += 20;
        indicators.push("typescript-files");
      }
      if (pkg) {
        const backendDeps = [
          "express",
          "koa",
          "fastify",
          "nest",
          "@nestjs/core",
        ];
        const backendDevDeps = ["ts-node", "ts-node-dev"];
        if (
          backendDeps.some((d) => mergedDeps[d]) ||
          backendDevDeps.some((d) => mergedDeps[d])
        ) {
          score = Math.floor(score * 0.5);
          indicators.push("nodejs-backend-penalty");
        }
      }
    }

    if (detector.type === ProjectType.NodeJS) {
      if (
        rootFiles.has("package.json") &&
        (rootFiles.has("tsconfig.json") || sourceScan.hasTypeScriptFiles)
      ) {
        score += 40;
        indicators.push("nodejs-with-typescript");
      }
    }

    if (detector.type === ProjectType.React) {
      if (sourceScan.hasJsxInRoot) {
        score += 15;
        indicators.push("jsx-files");
      }
    }

    if (detector.type === ProjectType.Kotlin) {
      const javaInfo = sourceScan.typeCounts.get(ProjectType.Java);
      const ktInfo = sourceScan.typeCounts.get(ProjectType.Kotlin);
      if (javaInfo && (!ktInfo || javaInfo.count > ktInfo.count * 2)) {
        score = Math.floor(score * 0.4);
        indicators.push("java-dominant-penalty");
      }
    }

    if (detector.type === ProjectType.Java) {
      const ktInfo = sourceScan.typeCounts.get(ProjectType.Kotlin);
      const javaInfo = sourceScan.typeCounts.get(ProjectType.Java);
      if (ktInfo && (!javaInfo || ktInfo.count > javaInfo.count * 2)) {
        score = Math.floor(score * 0.4);
        indicators.push("kotlin-dominant-penalty");
      }
    }

    score = Math.floor(score * (1 + detector.priority / 100));

    if (score > 0) {
      scores.set(detector.type, { type: detector.type, score, indicators });
    }
  }

  for (const [projectType, info] of sourceScan.typeCounts) {
    const fileScore = Math.min(info.count * 2, 40);
    const extensionBonus = info.extensions.size > 1 ? 10 : 0;
    const totalBoost = fileScore + extensionBonus;
    const extList = Array.from(info.extensions).join(",");

    const existing = scores.get(projectType);
    if (existing) {
      existing.score += totalBoost;
      existing.indicators.push(`source-files:${info.count}(${extList})`);
    } else {
      const detector = PROJECT_TYPE_DETECTORS.find(
        (d) => d.type === projectType,
      );
      const priority = detector?.priority || 50;
      scores.set(projectType, {
        type: projectType,
        score: Math.floor(totalBoost * (1 + priority / 100)),
        indicators: [`source-files:${info.count}(${extList})`],
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
      const hasTsConfig =
        rootFiles.has("tsconfig.json") || sourceScan.hasTypeScriptFiles;

      if (hasTsConfig && rootFiles.has("package.json")) {
        const backendDeps = [
          "express",
          "koa",
          "fastify",
          "nest",
          "@nestjs/core",
        ];
        const backendDevDeps = ["ts-node", "ts-node-dev"];
        const hasBackendDeps =
          backendDeps.some((d) => mergedDeps[d]) ||
          backendDevDeps.some((d) => mergedDeps[d]);

        if (hasBackendDeps && !scores.has(ProjectType.NodeJS)) {
          scores.set(ProjectType.NodeJS, {
            type: ProjectType.NodeJS,
            score: 55,
            indicators: ["package.json", "nodejs-backend-with-typescript"],
          });
        }
        if (!scores.has(ProjectType.TypeScript)) {
          scores.set(ProjectType.TypeScript, {
            type: ProjectType.TypeScript,
            score: 40,
            indicators: ["tsconfig-or-ts-files"],
          });
        }
      } else if (hasTsConfig) {
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

  const jsGenericTypes = [ProjectType.NodeJS, ProjectType.TypeScript];
  const nonJsTypes = [
    ProjectType.Java,
    ProjectType.Python,
    ProjectType.Rust,
    ProjectType.Go,
    ProjectType.CSharp,
    ProjectType.Ruby,
    ProjectType.PHP,
    ProjectType.Swift,
    ProjectType.Kotlin,
    ProjectType.Dart,
  ];

  for (const jsType of jsGenericTypes) {
    const jsScore = scores.get(jsType);
    if (!jsScore) continue;

    const dominantNonJs = nonJsTypes.find((type) => {
      const s = scores.get(type);
      return s && s.score > jsScore.score;
    });

    if (dominantNonJs) {
      const hasStrongSignals = jsScore.indicators.some(
        (i) =>
          i.startsWith("dep:") ||
          i.startsWith("script:") ||
          i === "nodejs-backend-with-typescript",
      );
      if (!hasStrongSignals) {
        jsScore.score = Math.floor(jsScore.score * 0.3);
        jsScore.indicators.push(`penalized:dominant-${dominantNonJs}`);
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
