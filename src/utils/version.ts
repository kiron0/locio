declare const __LOCIO_VERSION__: string | undefined;

export function getPackageVersion(): string {
  if (typeof __LOCIO_VERSION__ === "string" && __LOCIO_VERSION__.length > 0) {
    return __LOCIO_VERSION__;
  }

  try {
    const fs = process.getBuiltinModule("fs") as typeof import("fs");
    const path = process.getBuiltinModule("path") as typeof import("path");
    const url = process.getBuiltinModule("url") as typeof import("url");
    const currentFile = url.fileURLToPath(import.meta.url);
    const currentDirectory = path.dirname(currentFile);
    const possiblePaths = [
      path.join(currentDirectory, "../package.json"),
      path.join(currentDirectory, "../../package.json"),
      path.join(process.cwd(), "package.json"),
    ];

    for (const pkgPath of possiblePaths) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.version) {
          return pkg.version;
        }
      } catch {
        continue;
      }
    }

    return "0.0.0";
  } catch (error) {
    return "0.0.0";
  }
}
