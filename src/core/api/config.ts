// ── Single source of truth for backend hosts ────────────────────────────────
// Every dashboard fetch and the SSE feed resolve their host here. Do not read
// import.meta.env.VITE_API_* directly in components: divergent per-call-site
// fallbacks are what let the UI silently serve remote data while the local
// stack was down (product-yield defaulted to NESC, safety/eri to localhost).

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '');

// Used only when nothing is configured. Keep the deployed NESC service as the
// default so a fresh clone renders real data; point at localhost via .env.local.
const DEFAULT_API_BASE_URL =
  'https://digitwin.dyn.nesc.nokia.net/api/factory-command-center';

/** Base URL of the factory-command-center FastAPI service. */
export const API_BASE_URL = stripTrailingSlash(
  import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    DEFAULT_API_BASE_URL,
);

/** True when API_BASE_URL came from the env rather than the baked-in default. */
export const API_BASE_URL_IS_EXPLICIT = Boolean(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL,
);

/**
 * The three dashboard SSE streams.
 *
 * There is no combined stream any more. /dashboard/stream re-sent the whole
 * snapshot every poll whether or not anything changed — ~170 KB every 2s per
 * open tab, and the pipeline only writes every 180s, so nearly every send was
 * byte-identical to the one before.
 *
 * These three carry one section each (or the remainder) and stay silent until
 * that section actually changes. Splitting also stops the fast section dragging
 * the slow ones down the wire: process_performance changes every cycle, while
 * eri, safety and sustainability move once a day.
 *
 * Every stream carries the `meta` block, so shift and connection status keep
 * arriving no matter which one fires.
 *
 * The prefix is derived from API_BASE_URL so it cannot drift from the REST host.
 * VITE_DASHBOARD_STREAM_URL overrides it when the streams are served elsewhere;
 * VITE_DASHBOARD_SSE_URL is still honoured because deployed images set it, and
 * it names the same prefix.
 */
const STREAM_PREFIX = stripTrailingSlash(
  import.meta.env.VITE_DASHBOARD_STREAM_URL ||
    import.meta.env.VITE_DASHBOARD_SSE_URL ||
    `${API_BASE_URL}/dashboard/stream`,
);

export const DASHBOARD_STREAM_URLS = {
  processPerformance: `${STREAM_PREFIX}/process-performance`,
  productYield: `${STREAM_PREFIX}/product-yield`,
  other: `${STREAM_PREFIX}/other`,
} as const;

/** Build an absolute URL for a dashboard REST route, e.g. '/dashboard/safety'. */
export const apiUrl = (path: string) =>
  `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Base URL for the generic axios data layer (endpoints.ts: /production/lines,
 * /quality/defects). This is a *different* route surface from the dashboard
 * service above and is not known to be served by it, so it keeps its own
 * relative default instead of inheriting API_BASE_URL. Listed here so every
 * backend host the app talks to is visible in one file.
 */
export const LEGACY_REST_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api/v1';

if (import.meta.env.DEV) {
  // Makes "the API is offline but I still see data" diagnosable at a glance.
  console.info(
    `[api] REST ${API_BASE_URL}${API_BASE_URL_IS_EXPLICIT ? '' : ' (built-in default — no VITE_API_URL set)'}\n` +
      `[api] SSE  ${STREAM_PREFIX}/{process-performance,product-yield,other}`,
  );
}
