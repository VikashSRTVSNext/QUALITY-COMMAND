// The three range-aware dashboard queries: yield rows, KPI cards and the
// product dropdown's options.
//
// All three are inert until a date range is selected. Without one the dashboard
// keeps reading the SSE snapshot it already has, which is the fast path the
// backend asks us to keep for first paint — so these hooks return null and fire
// no request at all. `isRangeActive` is the switch; see dashboardFilters.ts.
//
// They follow the shape of useProcessProducts: a cancelled flag rather than an
// AbortController, because the range can change mid-flight and the failure mode
// is a slow first response landing after a faster second and showing the wrong
// window.

import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";
import {
  buildDashboardParams,
  isRangeActive,
  rangeError,
  type DateRange,
  type KpiResponse,
  type ProductOption,
  type ProductYieldResponse,
  type ProductsResponse,
  type YieldRequestLevel,
} from "./dashboardFilters";

export type QueryState = "idle" | "loading" | "ready" | "error";

/**
 * Reads FastAPI's error body so the UI can show the backend's own wording.
 *
 * The documented 400s (from after to, range over 400 days, unknown shift) all
 * carry a `detail` string worth showing verbatim; 422 carries a validation
 * array instead, which is not, hence the typeof check.
 */
const readError = async (res: Response): Promise<string> => {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // Non-JSON body (a proxy error page, usually). Fall through.
  }
  return `Request failed (${res.status}).`;
};

interface YieldQueryArgs {
  range: DateRange;
  shift: "A" | "B" | "C" | null;
  level: YieldRequestLevel;
  /** Item codes. Empty selects every product. */
  products: string[];
}

/**
 * Product-yield rows for a date range, straight from the database.
 *
 * Returns `rows: null` while no range is selected, which is the caller's signal
 * to keep using the snapshot rows from the SSE feed. The row shape is identical
 * on both sources, so one table renders either.
 */
export const useRangeProductYield = ({
  range,
  shift,
  level,
  products,
}: YieldQueryArgs) => {
  const [data, setData] = useState<ProductYieldResponse | null>(null);
  const [state, setState] = useState<QueryState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Serialised so the effect does not refire on every render just because the
  // caller passed a fresh array literal for `products`.
  const productKey = products.join("\u0000");

  useEffect(() => {
    if (!isRangeActive(range)) {
      setData(null);
      setState("idle");
      setError(null);
      return;
    }

    // A range the backend would reject with a 400 is not worth a round trip,
    // and the local message names the field to fix.
    const invalid = rangeError(range);
    if (invalid) {
      setData(null);
      setState("error");
      setError(invalid);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setState("loading");
      setError(null);
      try {
        const params = buildDashboardParams({
          range,
          shift,
          level,
          products: productKey ? productKey.split("\u0000") : [],
        });
        const res = await fetch(apiUrl(`/dashboard/product-yield?${params}`));
        if (!res.ok) throw new Error(await readError(res));
        const json: ProductYieldResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching ranged product yield:", err);
        setData(null);
        setState("error");
        setError(err instanceof Error ? err.message : "Request failed.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, shift, level, productKey]);

  return { data, rows: data?.rows ?? null, meta: data?.meta ?? null, state, error };
};

/**
 * The five KPI card figures over a date range.
 *
 * Takes no product parameter on purpose: /dashboard/kpis has none yet. The
 * table behind those cards stores one row per shift for the whole plant with
 * every product's boards already added together, so there is nothing to filter
 * on — sending `product` would be silently ignored. When the backend lands the
 * per-product columns it arrives as a repeatable `product` on this same
 * endpoint with no other change, so only this hook and its caller move.
 */
export const useRangeKpis = (
  range: DateRange,
  shift: "A" | "B" | "C" | null,
) => {
  const [data, setData] = useState<KpiResponse | null>(null);
  const [state, setState] = useState<QueryState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRangeActive(range)) {
      setData(null);
      setState("idle");
      setError(null);
      return;
    }

    const invalid = rangeError(range);
    if (invalid) {
      setData(null);
      setState("error");
      setError(invalid);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setState("loading");
      setError(null);
      try {
        const params = buildDashboardParams({ range, shift });
        const res = await fetch(apiUrl(`/dashboard/kpis?${params}`));
        if (!res.ok) throw new Error(await readError(res));
        const json: KpiResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching ranged KPIs:", err);
        setData(null);
        setState("error");
        setError(err instanceof Error ? err.message : "Request failed.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, shift]);

  /** Nothing ran in the range. An empty state, not a red 0%. */
  const isEmpty = state === "ready" && data?.range.days_with_data === 0;

  return { data, state, error, isEmpty };
};

/**
 * The Process Performance strip over a date range.
 *
 * The strip is normally fed by the SSE snapshot, which only ever describes the
 * current production day. The four KPI-sourced tiles already had a ranged source
 * (useRangeKpis) and followed the picker; the twelve process tiles beside them
 * did not, so applying a range moved four cards and left the rest on today —
 * one strip showing two different windows with nothing saying so.
 *
 * Returns the SAME per-step shape the snapshot publishes, so the dashboard swaps
 * one for the other and keeps a single mapping. `trend` is null on every step:
 * the sparkline is hourly buckets for one day and there is no such thing for a
 * range, which is the same reason the ranged KPI cards lose their line.
 */
export const useRangeProcessPerformance = (range: DateRange) => {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [state, setState] = useState<QueryState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Inert without a range: the snapshot is the source then, and firing this
    // anyway would race it to write the same cards.
    if (!isRangeActive(range)) {
      setData(null);
      setState("idle");
      setError(null);
      return;
    }
    const invalid = rangeError(range);
    if (invalid) {
      setData(null);
      setState("error");
      setError(invalid);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setState("loading");
      setError(null);
      try {
        // No shift in the request: the response carries every shift and the
        // dashboard picks, the same way it does with the snapshot. Switching
        // shift therefore costs no round trip.
        const params = buildDashboardParams({ range, shift: null });
        const res = await fetch(
          apiUrl(`/dashboard/process-performance?${params}`),
        );
        if (!res.ok) throw new Error(await readError(res));
        const json = await res.json();
        if (cancelled) return;
        setData(json?.steps ?? null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching ranged process performance:", err);
        setData(null);
        setState("error");
        setError(err instanceof Error ? err.message : "Request failed.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  return { data, state, error };
};

/**
 * Options for the product dropdown: products that actually produced something
 * in the window.
 *
 * Reads the same table the yield table reads, so the dropdown can never offer a
 * product whose row would come back empty. It therefore has to follow the date
 * picker — a product that ran last week may not have run this week, and options
 * left over from the previous range would reintroduce exactly the empty rows
 * this endpoint exists to prevent.
 *
 * Unlike the other two this DOES run with no range, because the dropdown has to
 * be populated on first paint, when the range is the current production day and
 * both dates are omitted.
 */
export const useProductOptions = (range: DateRange) => {
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [state, setState] = useState<QueryState>("loading");

  useEffect(() => {
    // Skip a request that is certain to 400; the previous options stay up so
    // the control does not empty out while a date is half-typed.
    if (rangeError(range)) return;

    let cancelled = false;

    const run = async () => {
      setState("loading");
      try {
        const params = buildDashboardParams({ range, shift: null });
        const qs = params.toString();
        const res = await fetch(
          apiUrl(`/dashboard/products${qs ? `?${qs}` : ""}`),
        );
        if (!res.ok) throw new Error(await readError(res));
        const json: ProductsResponse = await res.json();
        if (cancelled) return;
        setOptions(json.products ?? []);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching product options:", err);
        setOptions([]);
        setState("error");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  return { options, state };
};
