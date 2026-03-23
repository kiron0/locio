import { defineConfig } from "tsup";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version: string;
};

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  minify: "terser",
  target: "es2022",
  treeshake: {
    preset: "smallest",
    moduleSideEffects: false,
  },
  splitting: false,
  bundle: true,
  esbuildOptions(options) {
    options.drop = ["debugger"];
    options.legalComments = "none";
    options.define ??= {};
    options.define["process.env.NODE_ENV"] = '"production"';
    options.define.__LOCIO_VERSION__ = JSON.stringify(pkg.version);
  },
  external: ["chalk", "commander", "fast-glob", "ignore"],
  noExternal: [],
  platform: "node",
});
