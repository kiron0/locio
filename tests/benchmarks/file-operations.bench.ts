import { afterEach, beforeEach, describe, it } from "vitest";
import { LineCounterError } from "../../src/core/errors.js";
import {
  countLines,
  countLinesAsync,
  countLinesFromContent,
  isBinaryFile,
} from "../../src/utils/files.js";
import {
  createTempDir,
  createTestFile,
  generateMockFileContent,
  removeTempDir,
} from "../utils/test-helpers.js";

async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  const start = performance.now();
  const result = fn();

  if (result instanceof Promise) {
    await result;
    const end = performance.now();
    const duration = end - start;
    console.log(`  ${name}: ${duration.toFixed(2)}ms`);
  } else {
    const end = performance.now();
    const duration = end - start;
    console.log(`  ${name}: ${duration.toFixed(2)}ms`);
  }
}

describe("File Operations Benchmarks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  describe("Line Counting Performance", () => {
    it("benchmark: countLinesFromContent - small file (100 lines)", async () => {
      const content = generateMockFileContent(100);

      await benchmark("countLinesFromContent (100 lines)", () => {
        for (let i = 0; i < 1000; i++) {
          countLinesFromContent(content);
        }
      });
    });

    it("benchmark: countLinesFromContent - medium file (1000 lines)", async () => {
      const content = generateMockFileContent(1000);

      await benchmark("countLinesFromContent (1000 lines)", () => {
        for (let i = 0; i < 100; i++) {
          countLinesFromContent(content);
        }
      });
    });

    it("benchmark: countLinesFromContent - large file (10000 lines)", async () => {
      const content = generateMockFileContent(10000);

      await benchmark("countLinesFromContent (10000 lines)", () => {
        for (let i = 0; i < 10; i++) {
          countLinesFromContent(content);
        }
      });
    });

    it("benchmark: countLines - file I/O overhead", async () => {
      const filePath = createTestFile(
        tempDir,
        "test.txt",
        generateMockFileContent(1000),
      );

      await benchmark("countLines (with file I/O)", () => {
        for (let i = 0; i < 100; i++) {
          countLines(filePath);
        }
      });
    });

    it("benchmark: countLinesAsync - async file I/O", async () => {
      const filePath = createTestFile(
        tempDir,
        "test.txt",
        generateMockFileContent(1000),
      );

      await benchmark("countLinesAsync (with async file I/O)", async () => {
        const promises: Promise<number | LineCounterError>[] = [];
        for (let i = 0; i < 100; i++) {
          promises.push(countLinesAsync(filePath));
        }
        await Promise.all(promises);
      });
    });
  });

  describe("Binary File Detection Performance", () => {
    it("benchmark: isBinaryFile - extension check (fast path)", async () => {
      const filePath = "test.jpg";

      await benchmark("isBinaryFile (extension check)", () => {
        for (let i = 0; i < 10000; i++) {
          isBinaryFile(filePath);
        }
      });
    });

    it("benchmark: isBinaryFile - content check", async () => {
      const content = "text content\0binary data";

      await benchmark("isBinaryFile (content check)", () => {
        for (let i = 0; i < 10000; i++) {
          isBinaryFile("test.txt", content);
        }
      });
    });

    it("benchmark: isBinaryFile - file I/O check", async () => {
      const filePath = createTestFile(
        tempDir,
        "test.bin",
        new Uint8Array([0, 1, 2, 3, 4, 5]).buffer.toString(),
      );

      await benchmark("isBinaryFile (file I/O check)", () => {
        for (let i = 0; i < 100; i++) {
          isBinaryFile(filePath);
        }
      });
    });
  });

  describe("Large Codebase Simulation", () => {
    it("benchmark: process 1000 files", async () => {
      const files: string[] = [];
      for (let i = 0; i < 1000; i++) {
        const filePath = createTestFile(
          tempDir,
          `file${i}.ts`,
          generateMockFileContent(100),
        );
        files.push(filePath);
      }

      await benchmark("Process 1000 files (parallel)", async () => {
        const promises = files.map((file) => countLinesAsync(file));
        await Promise.all(promises);
      });
    });

    it("benchmark: process 1000 files sequentially", async () => {
      const files: string[] = [];
      for (let i = 0; i < 1000; i++) {
        const filePath = createTestFile(
          tempDir,
          `file${i}.ts`,
          generateMockFileContent(100),
        );
        files.push(filePath);
      }

      await benchmark("Process 1000 files (sequential)", async () => {
        for (const file of files) {
          await countLinesAsync(file);
        }
      });
    });
  });
});
