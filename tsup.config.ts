import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["cjs", "esm"],
  dts: false,
  clean: true,
  minify: "terser",
  target: "es2020",
  treeshake: true,
  esbuildOptions(options) {
    options.drop = ["debugger"];
  },
});
