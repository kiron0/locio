# LocIO

**A powerful CLI tool to count lines and files in directories with extensive filtering options.**

## Features

- **Count files and lines** recursively in directories
- **Interactive home page** - friendly menu when run without arguments
- **Extensive filtering** - patterns, extensions, directories, file names
- **Multiple extensions** - comma-separated extension lists (e.g., `rs,ts,js`)
- **Size filtering** - exclude files by minimum/maximum size
- **Binary detection** - automatically exclude binary files
- **Comment analysis** - count comment lines separately (full-line and inline)
- **Remove comments** - automatically remove comments from code files
- **Project type detection** - automatically detects project type (Node.js, Rust, Python, etc.)
- **Auto-excludes** - automatically applies common excludes based on detected project type
- **Export reports** - save results in multiple formats: `txt`, `json`, `csv`, `tsv`, `markdown`, `html`
- **Watch mode** - automatically rescan on file changes
- **Top files/dirs** - show largest files and directories with most files
- **Fast and efficient** - built with TypeScript
- **Rich statistics** - detailed breakdown by file extension and directory

## Quick Start

### Installation

### Run with npx (no global install)

```bash
npx locio@latest
```

### Install globally with npm

```bash
npm install -g locio
```

### Your First Count

```bash
# Count files and lines in current directory (shows interactive menu)
locio

# Count in specific directory
locio /path/to/directory

# Count only TypeScript files (dot is optional: .ts or ts both work)
locio --include-ext ts,tsx --stats
```

## Documentation

**[Full Documentation Available Here](https://locio.js.org)**

The documentation includes:

- Complete CLI reference
- All filtering options and patterns
- Advanced examples and use cases
- Export format specifications (JSON, CSV, TSV)
- Best practices and tips

## Basic CLI Usage

```bash
# Count files and lines
locio

# Count only files
locio --files-only

# Count only lines
locio --lines-only

# Exclude patterns
locio --exclude ".*\.log$" --exclude-dir node_modules

# Include only specific extensions (comma-separated, dots optional)
locio --include-ext rs,ts,js --stats

# Export report in JSON format
locio --stats --export json

# Count comments separately
locio --comments --stats

# Remove comments from TypeScript files
locio --rm-comments ts

# Watch directory for changes
locio --watch
```

## Quick Example

```bash
# Count TypeScript source files with statistics
locio --include-ext ts,tsx --stats

# Count TypeScript files excluding node_modules (multiple extensions supported)
locio --include-ext ts,tsx --exclude-dir node_modules

# Count with size limits and binary exclusion
locio --max-size 5MB --no-binary --stats

# Export JSON report (writes to LocIO-report.json)
locio --stats --export json

# Count comments and show code vs comments ratio
locio --code-vs-comments --stats

# Remove comments from JavaScript and TypeScript files
locio --rm-comments js,ts

# Show top 10 largest files
locio --stats --top-files 10

# Watch mode with statistics
locio --watch
```

---

_"LocIO: Count your code, not your worries."_
