// Fetches one fixture partition over HTTP and caches it.
//
// Fixtures are static assets under public/demo-data, so they are fetched rather
// than imported: a bundled import would put all 19 MB into the JS graph and
// make the first paint wait for every drill-down's data. Fetching keeps the
// partitioning real — a partition is only read when a screen asks for it.
//
// Three details that are easy to get wrong here:
//
//  1. BASE_URL. Vite serves this app under `/factory-command-center/`, so a
//     bare "/demo-data/..." resolves to the wrong origin path in both dev and
//     the nginx image. Every URL goes through `assetUrl`.
//
//  2. The real `fetch`. The demo transport replaces globalThis.fetch, so this
//     module must hold a reference to the ORIGINAL — otherwise loading a
//     fixture re-enters the shim, which looks for a handler, finds none, and
//     throws. Captured at module load, before any shim is installed.
//
//  3. 404 vs HTML. A missing fixture under a SPA fallback returns index.html
//     with a 200, which then fails to parse as JSON with a confusing message.
//     The manifest lists every file that exists, so a caller can check first
//     and the loader reports a clear miss.

/**
 * The page's own fetch, captured before installDemoTransport can swap it.
 *
 * Bound to globalThis because an unbound reference throws "Illegal invocation"
 * in some browsers.
 */
const nativeFetch: typeof fetch =
  typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : (undefined as unknown as typeof fetch);

/** Where the fixture set lives, relative to the app's base path. */
export const DEMO_DATA_ROOT = "demo-data";

export const assetUrl = (relative: string): string => {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${DEMO_DATA_ROOT}/${relative.replace(/^\/+/, "")}`;
};

export class FixtureMissing extends Error {
  constructor(public relative: string) {
    super(`demo fixture not found: ${relative}`);
    this.name = "FixtureMissing";
  }
}

/**
 * Byte budget for parsed partitions, in bytes of source JSON.
 *
 * Budgeted on BYTES, not entry count. Partitions range from ~2 KB (a day's KPI
 * summary) to ~10 MB (one day of SPI pad log at --volume 25), so a count-based
 * limit would either evict almost nothing or evict far too much depending on
 * which partitions a session happened to touch.
 *
 * 24 MB of source JSON was chosen from measurement, not taste:
 *   · the committed --volume 1 set is 35 MB total, so a typical session caches
 *     most of what it touches and evicts only on an exhaustive traversal
 *   · parsed JS objects run roughly 3-6x their JSON text, so 24 MB of text
 *     lands around 80-150 MB of heap, which is the band the app already sat in
 *     before this cap existed
 *
 * Measured consequence of having NO cap, which is why this exists: exhaustively
 * opening every drill-down drove the heap from 26 MB to 445 MB at 1M rows, and
 * from 28 MB to 80 MB at 100k, monotonically and with no ceiling.
 */
const CACHE_BUDGET_BYTES = 24 * 1024 * 1024;

/**
 * An entry accessed within this window is not evicted.
 *
 * This is a THRASH guard, not a correctness guard, and the distinction matters
 * for choosing the value. Handlers `await` a partition and then hold it in a
 * local for the rest of the call, so evicting a cached entry can never corrupt
 * a running query — the worst case is that the next identical query refetches.
 * What the window buys is that a 30-day roll-up which loads 30 partitions and
 * then reads them does not evict its own first partition before reading it.
 *
 * Measured tuning: at 1M rows (10 MB partitions) a 1000 ms window left the
 * cache 260 overshoots above budget, because three large partitions can land
 * inside one second and none of them is evictable. 250 ms covers any single
 * handler's load-then-read cycle — the slowest measured handler was a 506 ms
 * 30-day KPI roll-up, but its partitions are ~2 KB summaries, and the large
 * partitions are only ever loaded one per handler call.
 */
const EVICT_GRACE_MS = 250;

interface CacheEntry {
  value: unknown;
  /** Source JSON length. The real retained size is larger, but this is
   *  proportional to it and free to obtain at parse time. */
  bytes: number;
  lastUsed: number;
}

/**
 * Parsed partitions, keyed by relative path. Bounded; see CACHE_BUDGET_BYTES.
 *
 * Map iteration order is insertion order, which is NOT access order, so the
 * eviction pass sorts by `lastUsed` rather than relying on it.
 */
const cache = new Map<string, CacheEntry>();
let cachedBytes = 0;

/** Eviction diagnostics, surfaced by cacheStats() and asserted in the cache
 *  verification described in src/demo/README.md. */
let evictions = 0;
let evictedBytes = 0;
let budgetOvershoots = 0;

/**
 * In-flight requests, so N components asking for the same partition in the
 * same tick produce one request.
 *
 * This matters more than it looks: the dashboard mounts several panels at once
 * and StrictMode double-invokes effects, so the same day's summary is commonly
 * requested four times before the first response lands.
 *
 * Deliberately a separate map from `cache`: an in-flight entry is not in the
 * cache yet, so it is structurally impossible for the eviction pass to drop a
 * partition that is still downloading.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Evict least-recently-used entries until the budget is met.
 *
 * Entries inside the grace window are skipped, so a budget that cannot be
 * satisfied without touching them is deliberately left overshot rather than
 * breaking a query that is mid-flight. That is the correct trade: exceeding a
 * soft memory target for a few hundred milliseconds is recoverable, evicting
 * data a running handler is about to read is not.
 */
const evictToBudget = (): void => {
  if (cachedBytes <= CACHE_BUDGET_BYTES) return;

  const now = Date.now();
  const candidates = [...cache.entries()]
    .filter(([, e]) => now - e.lastUsed >= EVICT_GRACE_MS)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  for (const [key, entry] of candidates) {
    if (cachedBytes <= CACHE_BUDGET_BYTES) return;
    cache.delete(key);
    cachedBytes -= entry.bytes;
    evictions += 1;
    evictedBytes += entry.bytes;
  }

  if (cachedBytes > CACHE_BUDGET_BYTES) {
    // Everything over budget is still inside the grace window. Counted rather
    // than forced, and visible through cacheStats().
    budgetOvershoots += 1;
  }
};

const remember = (relative: string, value: unknown, bytes: number): void => {
  const existing = cache.get(relative);
  if (existing) cachedBytes -= existing.bytes;
  cache.set(relative, { value, bytes, lastUsed: Date.now() });
  cachedBytes += bytes;
  evictToBudget();
};

export const loadFixture = async <T>(relative: string): Promise<T> => {
  const hit = cache.get(relative);
  if (hit) {
    hit.lastUsed = Date.now();
    return hit.value as T;
  }

  const pending = inFlight.get(relative);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    const res = await nativeFetch(assetUrl(relative));
    if (!res.ok) throw new FixtureMissing(relative);
    const text = await res.text();
    // Guard against the SPA fallback handing back index.html with a 200.
    if (text.startsWith("<")) throw new FixtureMissing(relative);
    const parsed = JSON.parse(text) as T;
    remember(relative, parsed, text.length);
    return parsed;
  })();

  inFlight.set(relative, promise);
  try {
    return (await promise) as T;
  } finally {
    inFlight.delete(relative);
  }
};

/** Null instead of throwing, for the many endpoints where "no fixture" is a
 *  legitimate empty answer rather than a fault. */
export const loadFixtureOrNull = async <T>(
  relative: string,
): Promise<T | null> => {
  try {
    return await loadFixture<T>(relative);
  } catch (err) {
    if (err instanceof FixtureMissing) return null;
    throw err;
  }
};

/** Diagnostics for the README, the dev-time banner and cache verification. */
export const cacheStats = () => ({
  partitions: cache.size,
  inFlight: inFlight.size,
  bytes: cachedBytes,
  budgetBytes: CACHE_BUDGET_BYTES,
  evictions,
  evictedBytes,
  budgetOvershoots,
});

/** Test seam only. Not used by the app. */
export const resetFixtureCache = () => {
  cache.clear();
  inFlight.clear();
  cachedBytes = 0;
  evictions = 0;
  evictedBytes = 0;
  budgetOvershoots = 0;
};
