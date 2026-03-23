import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

declare const __LOCIO_VERSION__: string | undefined;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getPackageVersion(): string {
  try {
    if (typeof __LOCIO_VERSION__ === "string" && __LOCIO_VERSION__.length > 0) {
      return __LOCIO_VERSION__;
    }

    const possiblePaths = [
      join(__dirname, "../package.json"),
      join(__dirname, "../../package.json"),
      join(process.cwd(), "package.json"),
    ];

    for (const pkgPath of possiblePaths) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
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
