import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";
import type { YieldRequestLevel } from "./dashboardFilters";

// The two rework paretos behind a Product Yield row, per the 2026-10-22
// handoff (frontend_filters_and_shift_report.md, Part 3).
//
// Periods are FISCAL — WK43 or P10 come from the plant's calendar, not ISO
// weeks or calendar months — so nothing here computes a date. The server picks
// the period from `anchor` and hands back the anchors either side of it.

export type ReworkGranularity = "day" | "week" | "month";

export type ReworkPeriod = {
  granularity: ReworkGranularity;
  /** "2026-10-21", "WK43" or "P10". */
  label: string;
  fiscal_year: number | null;
  from: string;
  to: string;
  /** Where the data actually stops: `to` on a closed period, today on the
   *  one still running. */
  read_to: string;
  partial: boolean;
  prev_anchor: string | null;
  /** null on the current period — there is nothing after it yet. */
  next_anchor: string | null;
};

type Envelope = {
  level: YieldRequestLevel;
  step: string;
  item: string;
  product_name: string | null;
  sub_module: string | null;
  shift: string | null;
  period: ReworkPeriod;
  operations: { test: string[]; rework: string[] };
};

export type CategoryParetoRow = {
  /** FCR, SMT, PPH, PPF, PPA, SQA, MOD_REJ or UNCATEGORISED. */
  category: string;
  label: string;
  units: number;
  /** Of failed units. Can sum past 100 — a unit reworked under two causes
   *  counts under both. */
  pct_of_failed: number | null;
  share_pct: number;
  cum_pct: number;
};

export type CategoryParetoResponse = Envelope & {
  totals: {
    failed_units: number;
    dispositioned_units: number;
    awaiting_disposition: number;
    assignments: number;
    uncategorised_units: number;
  };
  rows: CategoryParetoRow[];
};

export type FailureIdParetoRow = {
  /** "(none)" when the tester recorded no parameter; "Others" for the fold. */
  failure_id: string;
  events: number;
  /** null on the "Others" row. */
  units: number | null;
  sample_comment: string | null;
  share_pct: number;
  cum_pct: number;
  /** "Others" only. */
  folded_ids?: string[];
};

export type FailureIdParetoResponse = Envelope & {
  totals: { events: number; distinct_failure_ids: number };
  rows: FailureIdParetoRow[];
};

export type ParetoQueryState = "idle" | "loading" | "ready" | "error";

export type ParetoQuery<T> = {
  data: T | null;
  state: ParetoQueryState;
  error: string | null;
  /** HTTP status of the failed request, so the caller can tell "too far
   *  back" (400) from "wrong tab" (404) without parsing the message. */
  status: number | null;
};

export type ReworkScope = {
  granularity: ReworkGranularity;
  /** null on open, so the server picks today. */
  anchor: string | null;
  shift: "A" | "B" | "C" | null;
};

/** One request, abortable, keeping the last good body while the next loads. */
const useParetoFetch = <T,>(url: string | null, label: string): ParetoQuery<T> => {
  const [query, setQuery] = useState<ParetoQuery<T>>({
    data: null,
    state: "idle",
    error: null,
    status: null,
  });

  useEffect(() => {
    if (!url) {
      setQuery({ data: null, state: "idle", error: null, status: null });
      return;
    }
    // Per request, so a slow old period cannot land on top of a newer one.
    const controller = new AbortController();
    setQuery((q) => ({ ...q, state: "loading", error: null, status: null }));

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          // FastAPI's {"detail": "..."}, documented as safe to show.
          const body = await res.json().catch(() => null);
          if (controller.signal.aborted) return;
          setQuery((q) => ({
            ...q,
            state: "error",
            status: res.status,
            error:
              typeof body?.detail === "string"
                ? body.detail
                : `Could not load the ${label} pareto (HTTP ${res.status}).`,
          }));
          return;
        }
        const json = (await res.json()) as T;
        if (controller.signal.aborted) return;
        setQuery({ data: json, state: "ready", error: null, status: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(`Error fetching the ${label} pareto:`, err);
        setQuery((q) => ({
          ...q,
          state: "error",
          status: null,
          error: `Could not load the ${label} pareto.`,
        }));
      }
    })();

    return () => controller.abort();
  }, [url, label]);

  return query;
};

/**
 * Both rework paretos for one product.
 *
 * Two URLs rather than one effect so `top` and `firstPassOnly`, which only the
 * failure-id endpoint takes, refetch that chart alone — the category pareto's
 * URL does not change, so it does not reload.
 */
export const useReworkParetos = (
  level: YieldRequestLevel | null,
  item: string | null,
  scope: ReworkScope,
  top: number,
  firstPassOnly: boolean,
) => {
  let categoryUrl: string | null = null;
  let failureIdUrl: string | null = null;

  if (level && item) {
    const base =
      `/rework/${encodeURIComponent(level)}/products/` +
      `${encodeURIComponent(item)}/pareto`;
    const common = new URLSearchParams({ granularity: scope.granularity });
    if (scope.anchor) common.set("anchor", scope.anchor);
    if (scope.shift) common.set("shift", scope.shift);

    const fid = new URLSearchParams(common);
    fid.set("top", String(top));
    if (firstPassOnly) fid.set("first_pass_only", "true");

    categoryUrl = apiUrl(`${base}/category?${common}`);
    failureIdUrl = apiUrl(`${base}/failure-id?${fid}`);
  }

  const category = useParetoFetch<CategoryParetoResponse>(categoryUrl, "defect category");
  const failureId = useParetoFetch<FailureIdParetoResponse>(failureIdUrl, "failure id");
  return { category, failureId };
};
