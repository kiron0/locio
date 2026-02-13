import type { LanguageStats, Summary } from "../types.js";

export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",

  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",

  py: "Python",
  pyw: "Python",
  pyi: "Python",
  pyx: "Python",

  java: "Java",

  jsp: "JSP",
  jspx: "JSP",

  kt: "Kotlin",
  kts: "Kotlin",

  scala: "Scala",
  sc: "Scala",

  c: "C",
  h: "C",

  cpp: "C++",
  cxx: "C++",
  cc: "C++",
  hpp: "C++",
  hxx: "C++",
  hh: "C++",

  cs: "C#",
  csx: "C#",

  fs: "F#",
  fsx: "F#",
  fsi: "F#",

  go: "Go",

  rs: "Rust",

  swift: "Swift",

  dart: "Dart",

  rb: "Ruby",
  erb: "Ruby",
  rake: "Ruby",
  gemspec: "Ruby",

  php: "PHP",
  phtml: "PHP",

  pl: "Perl",
  pm: "Perl",

  lua: "Lua",

  r: "R",
  rmd: "R",

  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  fish: "Shell",

  ps1: "PowerShell",
  psm1: "PowerShell",
  psd1: "PowerShell",

  bat: "Batch",
  cmd: "Batch",

  html: "HTML",
  htm: "HTML",

  css: "CSS",

  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  styl: "Stylus",

  vue: "Vue",

  svelte: "Svelte",

  json: "JSON",
  jsonc: "JSON",
  json5: "JSON",

  yml: "YAML",
  yaml: "YAML",

  toml: "TOML",

  ini: "INI",
  cfg: "INI",
  conf: "Config",

  xml: "XML",
  xsl: "XML",
  xslt: "XML",
  xsd: "XML",
  wsdl: "XML",
  plist: "XML",
  csproj: "XML",
  sln: "XML",
  props: "XML",

  md: "Markdown",
  mdx: "Markdown",
  markdown: "Markdown",

  rst: "reStructuredText",

  tex: "LaTeX",
  sty: "LaTeX",

  sql: "SQL",

  graphql: "GraphQL",
  gql: "GraphQL",

  proto: "Protocol Buffers",

  hs: "Haskell",
  lhs: "Haskell",

  ex: "Elixir",
  exs: "Elixir",

  erl: "Erlang",
  hrl: "Erlang",

  clj: "Clojure",
  cljs: "Clojure",
  cljc: "Clojure",
  edn: "Clojure",

  ml: "OCaml",
  mli: "OCaml",

  zig: "Zig",

  nim: "Nim",

  v: "V",

  asm: "Assembly",
  s: "Assembly",

  groovy: "Groovy",
  gvy: "Groovy",

  m: "Objective-C",
  mm: "Objective-C",

  dockerfile: "Dockerfile",

  makefile: "Makefile",
  mk: "Makefile",

  cmake: "CMake",

  tf: "Terraform",
  tfvars: "Terraform",

  hcl: "HCL",

  nix: "Nix",

  sol: "Solidity",

  hbs: "Handlebars",

  ejs: "EJS",

  pug: "Pug",
  jade: "Pug",

  txt: "Plain Text",
  text: "Plain Text",
  log: "Log",

  csv: "CSV",
  tsv: "TSV",

  diff: "Diff",
  patch: "Diff",

  wat: "WebAssembly",
  wast: "WebAssembly",
};

export function getLanguageName(ext: string): string {
  const normalized = ext.replace(/^\./, "").toLowerCase();
  return EXTENSION_TO_LANGUAGE[normalized] || capitalizeExtension(normalized);
}

function capitalizeExtension(ext: string): string {
  if (!ext) return "Unknown";
  return ext.charAt(0).toUpperCase() + ext.slice(1);
}

export function groupByLanguage(summary: Summary): LanguageStats[] {
  const langMap = new Map<
    string,
    {
      extensions: Set<string>;
      files: number;
      lines: number;
      code_lines: number;
      comment_lines: number;
      blank_lines: number;
      size: number;
    }
  >();

  const extensions = Object.keys(summary.files_by_extension || {});

  for (const ext of extensions) {
    const language = getLanguageName(ext);

    let entry = langMap.get(language);
    if (!entry) {
      entry = {
        extensions: new Set(),
        files: 0,
        lines: 0,
        code_lines: 0,
        comment_lines: 0,
        blank_lines: 0,
        size: 0,
      };
      langMap.set(language, entry);
    }

    entry.extensions.add(ext);
    entry.files += summary.files_by_extension[ext] || 0;
    entry.lines += summary.lines_by_extension[ext] || 0;
    entry.code_lines += summary.code_lines_by_extension?.[ext] || 0;
    entry.comment_lines += summary.comment_lines_by_extension?.[ext] || 0;
    entry.blank_lines += summary.blank_lines_by_extension?.[ext] || 0;
    entry.size += summary.size_by_extension[ext] || 0;
  }

  const result: LanguageStats[] = [];
  for (const [language, data] of langMap) {
    result.push({
      language,
      extensions: Array.from(data.extensions).sort(),
      files: data.files,
      lines: data.lines,
      code_lines: data.code_lines,
      comment_lines: data.comment_lines,
      blank_lines: data.blank_lines,
      size: data.size,
    });
  }

  result.sort((a, b) => b.lines - a.lines);

  return result;
}
