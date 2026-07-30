interface BenchmarkOptions {
  runs?: number;
  warmupRuns?: number;
}

const DEFAULT_RUNS = 7;
const DEFAULT_WARMUP_RUNS = 1;

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function resolveOption(
  direct: number | undefined,
  envName: string,
  fallback: number,
): number {
  if (typeof direct === "number" && direct > 0) {
    return direct;
  }

  return parsePositiveInt(process.env[envName]) ?? fallback;
}

export async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  options: BenchmarkOptions = {},
): Promise<void> {
  const runs = resolveOption(options.runs, "LOCIO_BENCH_RUNS", DEFAULT_RUNS);
  const warmupRuns = resolveOption(
    options.warmupRuns,
    "LOCIO_BENCH_WARMUP_RUNS",
    DEFAULT_WARMUP_RUNS,
  );

  for (let i = 0; i < warmupRuns; i++) {
    await fn();
  }

  const durations: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    durations.push(performance.now() - start);
  }

  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const avg = total / runs;
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  console.log(
    `  ${name}: avg ${avg.toFixed(2)}ms (${runs} runs, min ${min.toFixed(2)}ms, max ${max.toFixed(2)}ms)`,
  );
}
