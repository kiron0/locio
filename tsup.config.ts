import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["cjs", "esm"],
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
    if (options.define) {
      options.define["process.env.NODE_ENV"] = '"production"';
    }
  },
  external: [],
  noExternal: [],
  platform: "node",
});
