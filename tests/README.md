# LocIO Test Suite

This directory contains the test suite for LocIO.

## Test Structure

```
tests/
├── core/              # Unit tests for core modules
│   ├── errors.test.ts
│   └── filter/
│       └── filter.test.ts
├── utils/             # Unit tests for utility modules
│   ├── files.test.ts
│   ├── version.test.ts
│   └── test-helpers.ts  # Test utilities and fixtures
├── integration/       # Integration tests
│   └── scanner.test.ts
└── README.md          # This file
```

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with UI

```bash
npm run test:ui
```

### Run tests with coverage

```bash
npm run test:coverage
```

## Test Utilities

The `tests/utils/test-helpers.ts` file provides utilities for creating test fixtures:

- `createTempDir()` - Creates a temporary directory for testing
- `removeTempDir()` - Cleans up temporary directories
- `createTestFile()` - Creates a test file with content
- `createTestDirStructure()` - Creates a nested directory structure
- `generateMockFileContent()` - Generates mock file content for testing
- `createLargeTestFile()` - Creates large files for performance testing

## Writing Tests

### Unit Tests

Unit tests should be placed in the appropriate subdirectory matching the source structure:

- `tests/core/` - Tests for `src/core/`
- `tests/utils/` - Tests for `src/utils/`

### Integration Tests

Integration tests test full workflows and should be placed in `tests/integration/`.

### Example Test

```typescript
import { describe, expect, it } from "vitest";
import { someFunction } from "../../src/module.js";

describe("someFunction", () => {
  it("should do something", () => {
    const result = someFunction("input");
    expect(result).toBe("expected");
  });
});
```

## Test Coverage Goals

- Aim for >80% code coverage
- Test edge cases
- Test error conditions
- Test performance-critical paths

## Mocking

- **Mock File System**: Use `tests/utils/mock-fs.ts` and `tests/utils/mock-helpers.ts` for in-memory file system operations
- **Isolation**: Unit tests should use mock file system when possible for faster execution and better isolation
- **Integration Tests**: Use real file system with temporary directories for integration tests
- **Example**: See `tests/utils/files-mock.test.ts` for examples of using mock file system

### Mock File System Usage

```typescript
import { setupMockFileSystem, createMockFile } from "./utils/mock-helpers.js";

describe("My Test", () => {
  it("should work with mock file system", () => {
    const fs = setupMockFileSystem({
      "file.txt": "content",
      dir: {
        "nested.txt": "nested content",
      },
    });

    expect(fs.existsSync("/file.txt")).toBe(true);
    expect(fs.readFileSync("/file.txt")).toBe("content");
  });
});
```

## Performance Benchmarks

Performance benchmarks can be added to track:

- Performance regressions
- Large codebase handling
- Before/after optimization comparisons
