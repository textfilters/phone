import { performance } from "node:perf_hooks";
import { createPhoneFilter } from "../dist/index.js";

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;

const SHORT_CLEAN = "Hello world";
const LONG_CLEAN = "The quick brown fox jumps over the lazy dog. ".repeat(50);
const DIRECT_PHONE = "Call +1 202 555 0187 for details";
const PHONE_LIKE = "Call 202.555.0187 for details";
const LATE_MATCH =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(40) +
  "Call +44 20 7946 0958 now";

function bench(label, fn, iterations = ITERATIONS) {
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  return { label, iterations, totalMs, avgMs, opsPerSec };
}

function printResults(results) {
  console.log("\nphone benchmark");
  console.log(
    `${"label".padEnd(40)} ${"iter".padStart(7)} ${"total ms".padStart(10)} ${"avg ms".padStart(10)} ${"ops/sec".padStart(10)}`,
  );
  console.log("-".repeat(81));
  for (const result of results) {
    console.log(
      `${result.label.padEnd(40)} ${String(result.iterations).padStart(7)} ${result.totalMs.toFixed(2).padStart(10)} ${result.avgMs.toFixed(4).padStart(10)} ${String(result.opsPerSec).padStart(10)}`,
    );
  }
}

const filter = createPhoneFilter();

printResults([
  bench("createPhoneFilter()", () => createPhoneFilter(), SETUP_ITERATIONS),
  bench("censor short clean", () => filter.censor(SHORT_CLEAN)),
  bench("censor long clean", () => filter.censor(LONG_CLEAN)),
  bench("censor direct phone", () => filter.censor(DIRECT_PHONE)),
  bench("censor phone-like", () => filter.censor(PHONE_LIKE)),
  bench("censor late-match phone", () => filter.censor(LATE_MATCH)),
]);

console.log("\nbenchmark complete\n");
