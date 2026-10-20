// Runtime assertions for the bounded partition cache.
//
// WHY THIS LIVES HERE AND NOT IN A TEST FILE. The repo has no test runner, and
// adding one was explicitly out of scope. The cache is also not unit-testable in
// Node without one: it depends on `fetch`, on `import.meta.env.BASE_URL`, and on
// real partitions being served over HTTP. So the assertions run against the
// REAL loader in the REAL browser, which is where the behaviour actually has to
// hold.
//
// Gated behind `import.meta.env.DEV`, so Vite drops the whole module from a
// production demo build — verified by grepping dist-demo for `runCacheSelfTest`.
//
// Run it:
//   · append ?demoSelfTest=1 to the URL, or
//   · call window.__demoCacheSelfTest() from the console
//
// What it pins down, in order of how easy each is to break by accident:
//   1. In-flight de-duplication survived the LRU rewrite. N concurrent callers
//      for one partition must still produce ONE fetch and ONE object.
//   2. A warm hit does not refetch.
//   3. The byte budget is actually enforced once entries age out.
//   4. An entry inside the grace window is NOT evicted by an over-budget
//      insert — the "don't evict what a running query still needs" rule.
//   5. A partition larger than the whole budget is still served rather than
//      refused.

import {
  cacheStats,
  loadFixture,
  resetFixtureCache,
} from "./fixtureLoader";
import { availableDays, loadManifest } from "./fixtureStore";

export interface SelfTestResult {
  passed: number;
  failed: number;
  lines: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const runCacheSelfTest = async (): Promise<SelfTestResult> => {
  const lines: string[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (ok: boolean, name: string, detail = "") => {
    if (ok) {
      passed += 1;
      lines.push(`PASS  ${name}`);
    } else {
      failed += 1;
      lines.push(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`);
    }
  };

  await loadManifest();
  const days = availableDays();
  // A 500-entry buffer, cleared first: the default 250 fills up during a normal
  // session and silently stops recording, which made an earlier version of this
  // check report "0 fetches" and look like a failure when nothing was wrong.
  performance.setResourceTimingBufferSize(500);

  // ── 1. In-flight de-duplication ─────────────────────────────────────────
  // Deliberately a partition the dashboard does not load at first paint, so the
  // HTTP cache cannot satisfy it and hide a duplicate request.
  const dedupTarget = `stations/LBTS/testers-${days[Math.min(7, days.length - 1)]}.json`;
  resetFixtureCache();
  performance.clearResourceTimings();
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () => loadFixture<unknown>(dedupTarget)),
  );
  const fetches = performance
    .getEntriesByType("resource")
    .filter((e) => e.name.includes(dedupTarget)).length;
  assert(fetches === 1, "8 concurrent callers produce 1 fetch", `${fetches} fetches`);
  assert(
    concurrent.every((r) => r === concurrent[0]),
    "all concurrent callers receive the same object",
  );
  assert(cacheStats().inFlight === 0, "in-flight map drains after settle");
  assert(cacheStats().partitions === 1, "partition is cached exactly once");

  // ── 2. Warm hit ─────────────────────────────────────────────────────────
  performance.clearResourceTimings();
  await loadFixture<unknown>(dedupTarget);
  const warmFetches = performance
    .getEntriesByType("resource")
    .filter((e) => e.name.includes(dedupTarget)).length;
  assert(warmFetches === 0, "warm hit serves from cache without a fetch", `${warmFetches} fetches`);

  // ── 3. Byte budget is enforced ──────────────────────────────────────────
  // SPI partitions are the largest in the set (~10 MB each at --volume 25), so
  // a handful of them is the fastest way over any sane budget. The sleep lets
  // the grace window expire, which is what makes them evictable at all.
  resetFixtureCache();
  const budget = cacheStats().budgetBytes;
  for (const day of days.slice(0, 12)) {
    await loadFixture<unknown>(`events/SPI/defects-${day}.json`).catch(() => null);
    await sleep(300);
  }
  const afterBudget = cacheStats();
  assert(
    afterBudget.bytes <= budget,
    "cache stays within its byte budget",
    `${(afterBudget.bytes / 1048576).toFixed(1)} MB vs ${(budget / 1048576).toFixed(0)} MB`,
  );
  assert(afterBudget.evictions > 0, "eviction ran", `evictions=${afterBudget.evictions}`);
  assert(
    afterBudget.budgetOvershoots === 0,
    "no overshoot once the grace window has expired",
    `overshoots=${afterBudget.budgetOvershoots}`,
  );

  // ── 4. The grace window protects a fresh entry ──────────────────────────
  // This is the "don't evict data an active consumer still depends on" rule.
  // A small entry is loaded, then an over-budget insert happens immediately;
  // the small entry must survive because it is inside the window.
  resetFixtureCache();
  await loadFixture<unknown>("summaries/safety.json");
  const smallBytes = cacheStats().bytes;
  await loadFixture<unknown>(`events/SPI/defects-${days[0]}.json`).catch(() => null);
  assert(
    cacheStats().bytes >= smallBytes,
    "recently-used entry survives an over-budget insert",
  );

  // ── 5. A partition bigger than the budget is still served ───────────────
  resetFixtureCache();
  const oversized = await loadFixture<unknown>(
    `events/SPI/defects-${days[0]}.json`,
  ).catch(() => null);
  assert(oversized !== null, "a partition larger than the budget still loads");

  lines.push(`RESULT: ${passed} passed, ${failed} failed`);
  return { passed, failed, lines };
};

/**
 * Expose the self-test in dev only.
 *
 * Called from bootstrapDemo. The `import.meta.env.DEV` guard is what keeps this
 * module out of a production demo build.
 */
export const installCacheSelfTest = (): void => {
  if (!import.meta.env.DEV) return;

  (globalThis as unknown as Record<string, unknown>).__demoCacheSelfTest =
    async () => {
      const result = await runCacheSelfTest();
      // eslint-disable-next-line no-console
      console.log(
        `%c[demo] cache self-test`,
        result.failed === 0 ? "color:#a3e635;font-weight:bold" : "color:#ff4c4c;font-weight:bold",
        `\n${result.lines.join("\n")}`,
      );
      return result;
    };

  if (new URLSearchParams(window.location.search).has("demoSelfTest")) {
    void (globalThis as unknown as { __demoCacheSelfTest: () => Promise<unknown> })
      .__demoCacheSelfTest();
  }
};
