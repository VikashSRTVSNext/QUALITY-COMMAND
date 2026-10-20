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
 * Parsed partitions, keyed by relative path.
 *
 * Unbounded on purpose. The whole set is 19 MB of JSON across 1,267 files and a
 * session touches a small fraction of it; an LRU here would evict a partition
 * the user is still paging through and turn a sort into a refetch. If a much
 * larger set is generated with --volume, this is the first thing to revisit.
 */
const cache = new Map<string, unknown>();

/**
 * In-flight requests, so N components asking for the same partition in the
 * same tick produce one request.
 *
 * This matters more than it looks: the dashboard mounts several panels at once
 * and StrictMode double-invokes effects, so the same day's summary is commonly
 * requested four times before the first response lands.
 */
const inFlight = new Map<string, Promise<unknown>>();

export const loadFixture = async <T>(relative: string): Promise<T> => {
  if (cache.has(relative)) return cache.get(relative) as T;

  const pending = inFlight.get(relative);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    const res = await nativeFetch(assetUrl(relative));
    if (!res.ok) throw new FixtureMissing(relative);
    const text = await res.text();
    // Guard against the SPA fallback handing back index.html with a 200.
    if (text.startsWith("<")) throw new FixtureMissing(relative);
    const parsed = JSON.parse(text) as T;
    cache.set(relative, parsed);
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

/** Diagnostics for the README and the dev-time banner. */
export const cacheStats = () => ({
  partitions: cache.size,
  inFlight: inFlight.size,
});

/** Test seam only. Not used by the app. */
export const resetFixtureCache = () => {
  cache.clear();
  inFlight.clear();
};
