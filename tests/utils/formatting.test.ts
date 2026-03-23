import { describe, expect, it } from "vitest";
import { countLinesWithComments } from "../../src/utils/formatting/comments.js";
import { formatSize } from "../../src/utils/formatting/index.js";

describe("Formatting Utilities", () => {
  describe("formatSize", () => {
    it("should format bytes", () => {
      expect(formatSize(0)).toBe("0 B");
      expect(formatSize(500)).toBe("500 B");
      expect(formatSize(1023)).toBe("1023 B");
    });

    it("should format kilobytes", () => {
      expect(formatSize(1024)).toBe("1.00 KB");
      expect(formatSize(1536)).toBe("1.50 KB");
      expect(formatSize(10240)).toBe("10.00 KB");
    });

    it("should format megabytes", () => {
      expect(formatSize(1024 * 1024)).toBe("1.00 MB");
      expect(formatSize(2.5 * 1024 * 1024)).toBe("2.50 MB");
      expect(formatSize(100 * 1024 * 1024)).toBe("100.00 MB");
    });

    it("should format gigabytes", () => {
      expect(formatSize(1024 * 1024 * 1024)).toBe("1.00 GB");
      expect(formatSize(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
    });

    it("should handle large sizes", () => {
      const oneTB = 1024 * 1024 * 1024 * 1024;
      const result = formatSize(oneTB);

      expect(result).toMatch(/\d+\.\d+ (GB|TB)/);
    });
  });

  describe("Comment Parsing", () => {
    it("should count comments in TypeScript code", () => {
      const code = `// Single line comment
const x = 1; // Inline comment
/* Multi-line
   comment */
const y = 2;
`;
      const result = countLinesWithComments("test.ts", code);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.commentLines).toBeGreaterThan(0);
        expect(result.fullLineComments).toBeGreaterThan(0);
      }
    });

    it("should count comments in JavaScript code", () => {
      const code = `// Comment
function test() {
  return true;
}`;
      const result = countLinesWithComments("test.js", code);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.commentLines).toBeGreaterThanOrEqual(1);
        expect(result.fullLineComments).toBeGreaterThanOrEqual(1);
      }
    });

    it("should count inline comments", () => {
      const code = `const x = 1; // Inline comment
const y = 2; // Another inline`;
      const result = countLinesWithComments("test.ts", code);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.inlineComments).toBeGreaterThanOrEqual(2);
      }
    });

    it("should handle code without comments", () => {
      const code = `const x = 1;
const y = 2;
function test() {
  return x + y;
}`;
      const result = countLinesWithComments("test.ts", code);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.commentLines).toBe(0);
        expect(result.inlineComments).toBe(0);
        expect(result.fullLineComments).toBe(0);
      }
    });

    it("should handle empty code", () => {
      const result = countLinesWithComments("test.ts", "");

      if (result) {
        expect(result.totalLines).toBe(0);
        expect(result.commentLines).toBe(0);
        expect(result.codeLines).toBe(0);
      } else {
        expect(result).toBeNull();
      }
    });

    it("should handle multi-line comments", () => {
      const code = `/* This is a
   multi-line
   comment */
const x = 1;`;
      const result = countLinesWithComments("test.ts", code);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.fullLineComments).toBeGreaterThan(0);
      }
    });

    it("should not treat backticks inside comments as template literals", () => {
      const code = `// comment with a backtick: \`
const x = 1;
// another real comment
const y = 2;`;
      const result = countLinesWithComments("test.ts", code);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.commentLines).toBe(2);
        expect(result.fullLineComments).toBe(2);
      }
    });

    it("should ignore comment markers inside multi-line template literals", () => {
      const code = `const s = \`// not a comment
still inside template
\`;
// real comment
const x = 1;`;
      const result = countLinesWithComments("test.ts", code);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.commentLines).toBe(1);
        expect(result.fullLineComments).toBe(1);
      }
    });

    it("does not count a trailing newline as an extra blank line", () => {
      const result = countLinesWithComments("test.ts", "const x = 1;\n");
      expect(result).not.toBeNull();
      if (result) {
        expect(result.totalLines).toBe(1);
        expect(result.codeLines).toBe(1);
        expect(result.blankLines).toBe(0);
      }
    });
  });
});
