# Locio

**A powerful CLI tool to count lines and files in directories with extensive filtering options.**

## Features

- **Count files and lines** recursively in directories
- **Interactive home page** - friendly menu when run without arguments
- **Extensive filtering** - patterns, extensions, directories, file names
- **Multiple extensions** - comma-separated extension lists (e.g., `rs,ts,js`)
- **Size filtering** - exclude files by minimum/maximum size
- **Binary detection** - automatically exclude binary files
- **Export reports** - save results as `locio-report.{txt,json,csv,tsv}` files
- **Fast and efficient** - built with Rust
- **Rich statistics** - detailed breakdown by file extension and directory

## Quick Start

### Installation

```bash
npm install -g locio
```

### Your First Count

```bash
# Count files and lines in current directory (shows interactive menu)
locio

# Count in specific directory
locio /path/to/directory

# Count only Rust files (dot is optional: .rs or rs both work)
locio --include-ext rs --stats
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
```

## Quick Example

```bash
# Count Rust source files with statistics
locio --include-ext rs --stats

# Count TypeScript files excluding node_modules (multiple extensions supported)
locio --include-ext ts,tsx --exclude-dir node_modules

# Count with size limits and binary exclusion
locio --max-size 5MB --no-binary --stats

# Export JSON report (writes to locio-report.json)
locio --stats --export json
```

---

**[Visit the full documentation](https://locio.js.org) for complete CLI reference, examples, and tutorials.**

_"Locio: Count your code, not your worries."_
