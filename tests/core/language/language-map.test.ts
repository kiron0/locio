import { describe, expect, it } from "vitest";
import {
  getLanguageName,
  groupByLanguage,
} from "../../../src/core/language/index.js";
import { createSummary } from "../../../src/core/types.js";

describe("language-map", () => {
  it("getLanguageName should map known extensions and fallback for unknown", () => {
    expect(getLanguageName("ts")).toBe("TypeScript");
    expect(getLanguageName(".tsx")).toBe("TypeScript");
    expect(getLanguageName("js")).toBe("JavaScript");
    expect(getLanguageName(".jsp")).toBe("JSP");

    expect(getLanguageName("foo")).toBe("Foo");
    expect(getLanguageName(".bar")).toBe("Bar");
  });

  it("groupByLanguage should aggregate stats by language", () => {
    const summary = createSummary();

    summary.files_by_extension = { ts: 2, js: 1 };
    summary.lines_by_extension = { ts: 10, js: 5 };
    summary.size_by_extension = { ts: 100, js: 50 };
    summary.code_lines_by_extension = { ts: 8, js: 4 };
    summary.comment_lines_by_extension = { ts: 2, js: 1 };
    summary.blank_lines_by_extension = { ts: 1, js: 1 };

    const result = groupByLanguage(summary);

    expect(result.length).toBe(2);

    const tsLang = result.find((r) => r.language === "TypeScript");
    const jsLang = result.find((r) => r.language === "JavaScript");

    expect(tsLang).toBeDefined();
    expect(jsLang).toBeDefined();

    if (tsLang) {
      expect(tsLang.files).toBe(2);
      expect(tsLang.lines).toBe(10);
      expect(tsLang.code_lines).toBe(8);
      expect(tsLang.comment_lines).toBe(2);
      expect(tsLang.blank_lines).toBe(1);
      expect(tsLang.size).toBe(100);
      expect(tsLang.extensions).toContain("ts");
    }

    if (jsLang) {
      expect(jsLang.files).toBe(1);
      expect(jsLang.lines).toBe(5);
      expect(jsLang.code_lines).toBe(4);
      expect(jsLang.comment_lines).toBe(1);
      expect(jsLang.blank_lines).toBe(1);
      expect(jsLang.size).toBe(50);
      expect(jsLang.extensions).toContain("js");
    }
  });
});
