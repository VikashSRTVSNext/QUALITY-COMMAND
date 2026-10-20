// Demo-layer types.
//
// The response contracts are NOT redefined here — they are re-exported from
// dashboardFilters.ts so a handler that drifts from the shipped contract fails
// to compile. The only new types are the ones the demo layer itself needs: the
// manifest, the handler signature and the simulator's frames.

export type {
  DateRange,
  KpiMetricKey,
  KpiResponse,
  KpiTotals,
  ProcessFilterOptions,
  ProcessFilterStep,
  ProductOption,
  ProductYieldMeta,
  ProductYieldResponse,
  ProductYieldRow,
  ProductsResponse,
  ShiftCode,
  YieldRequestLevel,
} from "../components/quality/dashboardFilters";

/**
 * What a handler returns.
 *
 * Deliberately shaped so an MSW handler is a one-line adapter:
 *
 *   http.get(apiUrl('/dashboard/kpis'), async ({ request }) => {
 *     const { status, body } = await handler(new URL(request.url));
 *     return HttpResponse.json(body, { status });
 *   })
 *
 * `headers` and `blob` exist only for /alerts/shift-report, which answers with
 * an xlsx body and a Content-Disposition the caller parses for the filename.
 */
export interface DemoResponse {
  status: number;
  /** JSON-serialisable body. Ignored when `blob` is set. */
  body?: unknown;
  blob?: Blob;
  headers?: Record<string, string>;
}

/**
 * A handler. Receives the parsed URL and, for the one POST, the request.
 *
 * Takes a URL rather than a params object so the query-string semantics the app
 * relies on — repeated `product`, meaningful omission — are read the same way
 * the real backend reads them, and so MSW can hand its own URL straight in.
 */
export type DemoHandler = (
  url: URL,
  request?: Request,
) => Promise<DemoResponse> | DemoResponse;

/** One entry in the route table. `path` is matched after API_BASE_URL is
 *  stripped, with `:param` segments captured. */
export interface DemoRoute {
  method: "GET" | "POST";
  /** e.g. "/process/:step/products/:item/testers" */
  path: string;
  handler: DemoHandler;
}

/** Path parameters captured from a matched route. */
export type RouteParams = Record<string, string>;

// ── Fixture manifest ────────────────────────────────────────────────────────

export interface FixtureManifest {
  /** Bumped when the on-disk layout changes, so a stale fixture set is a clear
   *  error rather than a silently half-loaded dashboard. */
  version: number;
  /** The seed every number was derived from. */
  seed: string;
  /**
   * The scenario's last production day, as generated. The loader shifts every
   * date by (today - anchorDate) so the window stays inside the picker's
   * rolling bound. See demoClock.ts.
   */
  anchorDate: string;
  /** Production days present, oldest first, as generated (pre-shift). */
  days: string[];
  /** Relative paths that exist, so the loader can 404 honestly instead of
   *  fetching index.html and parsing it as JSON. */
  files: string[];
  /** Diagnostics reported by the validator and the README. */
  stats: {
    rows: Record<string, number>;
    totalRows: number;
    bytes: number;
  };
}

/** One SSE frame. `stream` selects which of the three EventSources emits it. */
export interface DemoSnapshotFrame {
  stream: "processPerformance" | "productYield" | "other";
  /** Milliseconds from playback start. Frames replay in this order. */
  at: number;
  /** The `snapshot` event payload — a subset of the keys handleData reads. */
  payload: Record<string, unknown>;
}

export interface DemoRealtimeFixture {
  frames: DemoSnapshotFrame[];
}
