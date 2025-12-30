import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function createTempDir(prefix = "locio-test-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

export function createTestFile(
  dirPath: string,
  fileName: string,
  content: string,
): string {
  const filePath = path.join(dirPath, fileName);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function createTestDirStructure(
  baseDir: string,
  structure: Record<string, string | Record<string, unknown>>,
): void {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = path.join(baseDir, name);
    if (typeof content === "string") {
      fs.writeFileSync(fullPath, content, "utf-8");
    } else {
      fs.mkdirSync(fullPath, { recursive: true });
      createTestDirStructure(
        fullPath,
        content as Record<string, string | Record<string, unknown>>,
      );
    }
  }
}

export function generateMockFileContent(
  lines: number,
  options?: {
    blankLines?: number;
    commentLines?: number;
    codeLines?: number;
  },
): string {
  const linesArray: string[] = [];
  const blankLines = options?.blankLines ?? Math.floor(lines * 0.1);
  const commentLines = options?.commentLines ?? Math.floor(lines * 0.2);
  const codeLines = options?.codeLines ?? lines - blankLines - commentLines;

  for (let i = 0; i < codeLines; i++) {
    linesArray.push(`const variable${i} = ${i};`);
  }

  for (let i = 0; i < commentLines; i++) {
    linesArray.push(`// This is comment ${i}`);
  }

  for (let i = 0; i < blankLines; i++) {
    linesArray.push("");
  }

  return linesArray.slice(0, lines).join("\n");
}

export function createLargeTestFile(
  dirPath: string,
  fileName: string,
  sizeInMB: number,
): string {
  const filePath = path.join(dirPath, fileName);
  const sizeInBytes = sizeInMB * 1024 * 1024;
  const chunk = "x".repeat(1024);
  const chunksNeeded = Math.ceil(sizeInBytes / chunk.length);

  const writeStream = fs.createWriteStream(filePath);
  for (let i = 0; i < chunksNeeded; i++) {
    writeStream.write(chunk);
  }
  writeStream.end();

  return filePath;
}
