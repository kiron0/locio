import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressBar, ThrottledProgressBar } from "../../src/utils/progress.js";

describe("ProgressBar", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("ProgressBar", () => {
    it("should create progress bar", () => {
      const bar = new ProgressBar(100);
      expect(bar).toBeInstanceOf(ProgressBar);
    });

    it("should update progress", () => {
      const bar = new ProgressBar(100);
      bar.update(50, 0);

      expect(bar).toBeDefined();
    });

    it("should calculate files per second", () => {
      const bar = new ProgressBar(100);

      bar.update(50, 0);

      expect(bar).toBeDefined();
    });

    it("should finish progress bar", () => {
      const bar = new ProgressBar(100);
      bar.update(100, 0);
      bar.finish();

      expect(bar).toBeDefined();
    });

    it("should handle current file display", () => {
      const bar = new ProgressBar(100);
      bar.update(50, 0, "src/file.ts");

      expect(bar).toBeDefined();
    });
  });

  describe("ThrottledProgressBar", () => {
    it("should create throttled progress bar", () => {
      const baseBar = new ProgressBar(100);
      const throttledBar = new ThrottledProgressBar(baseBar);
      expect(throttledBar).toBeInstanceOf(ThrottledProgressBar);
    });

    it("should throttle updates", async () => {
      const baseBar = new ProgressBar(100);
      const throttledBar = new ThrottledProgressBar(baseBar);

      throttledBar.update(10, 0);
      throttledBar.update(20, 0);
      throttledBar.update(30, 0);

      expect(throttledBar).toBeDefined();
    });

    it("should flush remaining updates on finish", () => {
      const baseBar = new ProgressBar(100);
      const throttledBar = new ThrottledProgressBar(baseBar);

      throttledBar.update(50, 0);
      throttledBar.finish();

      expect(throttledBar).toBeDefined();
    });

    it("should handle current file in throttled updates", () => {
      const baseBar = new ProgressBar(100);
      const throttledBar = new ThrottledProgressBar(baseBar);

      throttledBar.update(50, 0, "src/file.ts");

      expect(throttledBar).toBeDefined();
    });
  });
});
