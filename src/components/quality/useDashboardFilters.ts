// The filter-aware dashboard queries: yield rows, KPI cards, the Process
// Performance strip, and the option lists behind the product and line pills.
//
// The data hooks are inert until the dashboard is in a FILTERED scope: a date
// range, a product or a line. Without one the dashboard keeps reading the SSE
// snapshot it already has, which is the fast path for first paint, so these
// hooks return null and fire no request. With one they take over, even for
// today: the streams only publish the unfiltered current day, and showing that
// under a product chip would be the plant figure with a misleading label.
//
// While filtered, the streams are still useful as a "something changed" signal.
// The dashboard turns each push into a `refreshTick` bump and these hooks refetch
// on it, keeping the figures on screen until the new ones land.
//
// Every request goes through an AbortController. The filter can change
// mid-flight, and the failure that matters is a slow old response landing after
// a fast new one and showing the wrong selection.

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../../core/api/config";
import {
  buildDashboardParams,
  isRangeActive,
  optionVolume,
  rangeError,
  type DateRange,
  type KpiResponse,
  type ProcessFilterOptions,
  type ProductOption,
  type ProductYieldResponse,
  type ProductsResponse,
  type YieldRequestLevel,
} from "./dashboardFilters";

export type QueryState = "idle" | "loading" | "ready" | "error";

/**
 * Reads FastAPI's error body so the UI can show the backend's own wording.
 *
 * The documented 400s (bad range, unknown shift) and 404s (unknown step) carry a
 * `detail` string that is safe to show verbatim; 422 carries a validation array
 * instead, which is not, hence the typeof check.
 */
export const readError = async (res: Response): Promise<string> => {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // Non-JSON body (a proxy error page, usually). Fall through.
  }
  return `Request failed (${res.status}).`;
};

/** A range the backend would 400, checked only when a range is actually set. */
const scopeError = (range: DateRange): string | null =>
  isRangeActive(range) ? rangeError(range) : null;

/**
 * One GET, keyed on its URL.
 *
 * `url: null` = inert (idle, no data). `invalid` = a request certain to 400, so
 * the local message is shown instead of spending a round trip on it.
 *
 * A change of URL is a new question and clears the old answer. A `refreshTick`
 * bump is the SAME question asked again, so the current data stays up and the
 * state stays "ready" until the replacement arrives. Otherwise every SSE push
 * would blink the table through "Loading…".
 */
const useScopedFetch = <T,>(
  url: string | null,
  invalid: string | null,
  refreshTick: number,
  label: string,
) => {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<QueryState>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (invalid) {
      lastUrl.current = null;
      setData(null);
      setState("error");
      setError(invalid);
      return;
    }
    if (url === null) {
      lastUrl.current = null;
      setData(null);
      setState("idle");
      setError(null);
      return;
    }

    const isRefresh = lastUrl.current === url;
    lastUrl.current = url;
    if (!isRefresh) {
      setData(null);
      setState("loading");
      setError(null);
    }

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(await readError(res));
        const json: T = await res.json();
        if (ctrl.signal.aborted) return;
        setData(json);
        setState("ready");
        setError(null);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        console.error(`Error fetching ${label}:`, err);
        // A failed background refresh keeps the last good figures: they are
        // still the right selection, just a few seconds older.
        if (!isRefresh) setData(null);
        setState("error");
        setError(err instanceof Error ? err.message : "Request failed.");
      }
    })();

    return () => ctrl.abort();
  }, [url, invalid, refreshTick, label]);

  return { data, state, error };
};

interface YieldQueryArgs {
  range: DateRange;
  shift: "A" | "B" | "C" | null;
  level: YieldRequestLevel;
  /** Item codes. Empty selects every product. */
  products: string[];
  /** False keeps the hook inert (the snapshot is the source). */
  active: boolean;
  refreshTick?: number;
}

/**
 * Product-yield rows for the filtered scope.
 *
 * Returns `rows: null` while inert, which is the caller's signal to keep using
 * the snapshot rows from the SSE feed. The row shape is identical on both
 * sources, so one table renders either.
 */
export const useRangeProductYield = ({
  range,
  shift,
  level,
  products,
  active,
  refreshTick = 0,
}: YieldQueryArgs) => {
  const url = active
    ? apiUrl(
        `/dashboard/product-yield?${buildDashboardParams({ range, shift, level, products })}`,
      )
    : null;
  const { data, state, error } = useScopedFetch<ProductYieldResponse>(
    url,
    active ? scopeError(range) : null,
    refreshTick,
    "filtered product yield",
  );
  return { data, rows: data?.rows ?? null, meta: data?.meta ?? null, state, error };
};

/**
 * The five KPI card figures for the filtered scope, from /dashboard/kpis.
 *
 * Takes `product` now that the backend reads mart_kpi_product_shift. Under a
 * product filter `totals.customer_audit` is null: the audit is a plant score
 * with no product, and the caller must say so rather than show 0.
 */
export const useRangeKpis = ({
  range,
  shift,
  products,
  active,
  refreshTick = 0,
}: {
  range: DateRange;
  shift: "A" | "B" | "C" | null;
  products: string[];
  active: boolean;
  refreshTick?: number;
}) => {
  const url = active
    ? apiUrl(`/dashboard/kpis?${buildDashboardParams({ range, shift, products })}`)
    : null;
  const { data, state, error } = useScopedFetch<KpiResponse>(
    url,
    active ? scopeError(range) : null,
    refreshTick,
    "filtered KPIs",
  );

  /** Nothing ran in the scope. An empty state, not a red 0%. */
  const isEmpty = state === "ready" && data?.range.days_with_data === 0;

  return { data, state, error, isEmpty };
};

interface ProcessPerformanceResponse {
  steps?: Record<string, any>;
  filters?: {
    products: string[];
    lines: string[];
    line_steps: string[];
    source: string;
  };
}

/**
 * The Process Performance strip for the filtered scope.
 *
 * Returns the SAME per-step shape the snapshot publishes, so the dashboard swaps
 * one for the other and keeps a single mapping.
 *
 * No shift parameter: every card carries `day` and `by_shift`, and the shift
 * selector picks between them on the client with no new request.
 *
 * With any line set, `steps` holds only the line cards (`filters.line_steps`).
 * A step missing from `steps` under a filter means "no data for this
 * selection", never "use the unfiltered figure".
 */
export const useRangeProcessPerformance = ({
  range,
  products,
  lines,
  active,
  refreshTick = 0,
}: {
  range: DateRange;
  products: string[];
  lines: string[];
  active: boolean;
  refreshTick?: number;
}) => {
  const url = active
    ? apiUrl(
        `/dashboard/process-performance?${buildDashboardParams({ range, shift: null, products, lines })}`,
      )
    : null;
  const { data, state, error } = useScopedFetch<ProcessPerformanceResponse>(
    url,
    active ? scopeError(range) : null,
    refreshTick,
    "filtered process performance",
  );
  return {
    data: data?.steps ?? null,
    lineSteps: data?.filters?.line_steps ?? null,
    state,
    error,
  };
};

/**
 * Options for the yield table's product dropdown: products that actually
 * produced something in the window, from /dashboard/products.
 *
 * Runs with no range too, because the dropdown has to be populated on first
 * paint, when the window is the current production day and both dates are
 * omitted.
 */
export const useProductOptions = (range: DateRange) => {
  const qs = buildDashboardParams({ range, shift: null }).toString();
  const invalid = scopeError(range);
  // Skip a request certain to 400 without clearing: the previous options stay
  // up so the control does not empty out while a date is half-typed.
  const url = invalid ? null : apiUrl(`/dashboard/products${qs ? `?${qs}` : ""}`);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const { data, state } = useScopedFetch<ProductsResponse>(
    url,
    null,
    0,
    "product options",
  );
  useEffect(() => {
    if (state === "ready") setOptions(data?.products ?? []);
    if (state === "error") setOptions([]);
  }, [data, state]);
  return { options, state: url === null && options.length ? "ready" : state };
};

/**
 * Options for the header's product pill and the Process strip's line pill, from
 * /dashboard/process-filter-options. Called again whenever the date range
 * changes, so a pill only offers what ran in that window.
 *
 * The header pill is ONE shared selection across the KPI cards and every
 * process card, so its list is the union of `steps.KPI.products` and each
 * step's products, de-duplicated on `item` and sorted by volume. The volumes are
 * added across steps purely to order the list; they are not a figure anyone
 * reads.
 */
export const useProcessFilterOptions = (range: DateRange) => {
  const qs = buildDashboardParams({ range, shift: null }).toString();
  const invalid = scopeError(range);
  const url = invalid
    ? null
    : apiUrl(`/dashboard/process-filter-options${qs ? `?${qs}` : ""}`);
  const [last, setLast] = useState<ProcessFilterOptions | null>(null);
  const { data, state } = useScopedFetch<ProcessFilterOptions>(
    url,
    null,
    0,
    "process filter options",
  );
  useEffect(() => {
    if (state === "ready" && data) setLast(data);
    if (state === "error") setLast(null);
  }, [data, state]);

  return useMemo(() => {
    const steps = last?.steps ?? {};
    const lineSteps = last?.line_steps ?? [];

    const byItem = new Map<string, ProductOption>();
    for (const step of Object.values(steps)) {
      for (const p of step.products ?? []) {
        const seen = byItem.get(p.item);
        const vol = optionVolume(p) ?? 0;
        if (seen) {
          seen.done = (seen.done ?? 0) + vol;
        } else {
          byItem.set(p.item, {
            item: p.item,
            product: p.product,
            label: p.label,
            done: vol,
          });
        }
      }
    }
    const products = [...byItem.values()].sort(
      (a, b) => (b.done ?? 0) - (a.done ?? 0),
    );

    const lineSet = new Set<string>();
    for (const step of lineSteps) {
      for (const line of steps[step]?.lines ?? []) lineSet.add(line);
    }
    const lines = [...lineSet].sort();

    return {
      products,
      lines,
      lineSteps,
      kpiProducts: steps.KPI?.products ?? [],
      state: url === null && last ? ("ready" as QueryState) : state,
    };
  }, [last, state, url]);
};
