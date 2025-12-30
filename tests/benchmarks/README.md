# Performance Benchmarks

This directory contains performance benchmarks for LocIO to track performance regressions and measure optimization impact.

## Running Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark file
npm test tests/benchmarks/file-operations.bench.ts
```

## Benchmark Files

### `file-operations.bench.ts`

Benchmarks for core file operations:

- Line counting performance (small, medium, large files)
- File I/O overhead measurements
- Binary file detection performance
- Large codebase simulation (1000+ files)

### `scanner-performance.bench.ts`

Benchmarks for full scanner workflows:

- Small codebase scanning (< 100 files)
- Medium codebase scanning (100-1000 files)
- Filter performance (extension filters, exclude patterns)
- Performance regression tests

## Benchmark Results

Benchmark results are printed to the console showing execution time in milliseconds. Use these results to:

1. **Track Performance Regressions**: Compare results before/after code changes
2. **Measure Optimization Impact**: Compare performance before/after optimizations
3. **Identify Bottlenecks**: Find slow operations that need optimization
4. **Test Large Codebases**: Ensure performance scales well with large directories

## Example Output

```
File Operations Benchmarks
  ✓ benchmark: countLinesFromContent - small file (100 lines)
    countLinesFromContent (100 lines): 12.34ms
  ✓ benchmark: countLinesFromContent - medium file (1000 lines)
    countLinesFromContent (1000 lines): 45.67ms
```

## Performance Targets

- **Line Counting**: < 1ms per 1000 lines (in-memory)
- **File I/O**: < 5ms per file (including read and parse)
- **Small Codebase (< 100 files)**: < 100ms total scan time
- **Medium Codebase (100-1000 files)**: < 1s total scan time
- **Large Codebase (1000+ files)**: < 5s total scan time

## Notes

- Benchmarks use temporary directories that are cleaned up after each test
- Results may vary based on system performance and disk speed
- Run benchmarks multiple times and average results for more accurate measurements
- Use `--reporter=verbose` for more detailed output
