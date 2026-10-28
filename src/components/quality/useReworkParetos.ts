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
  /** "2026-10-21", "WK43" or "P10". On Week this is always the SELECTED
   *  week — the last of the span — which is what keeps a dropdown in sync. */
  label: string;
  fiscal_year: number | null;
  /** Week only: "WK39–WK43", the weeks the figures actually cover. */
  span_label?: string | null;
  /** Week only: true when the span came from week_from / week_to rather than
   *  the default five weeks. prev/next anchors are null then. */
  is_range?: boolean;
  /** Week only: every fiscal week in the span, oldest first. Can straddle a
   *  year end (WK50–WK02); fiscal_year tells them apart. */
  weeks?: { label: string; fiscal_year: number | null; from: string; to: string }[];
  /** The whole span: the first week's first day to the last week's last. */
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
  /** A grouped row only (2026-10-28): the raw ids that differ from
   *  `failure_id` only by numbers or hex addresses. Absent on an exact id. */
  variants?: string[];
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
  /** null on open, so the server picks today. On Week this is the LAST week
   *  of the default five-week span. */
  anchor: string | null;
  /** Week only, and only together: an explicit From–To range, each the
   *  `anchor` of a /rework/periods option. Sent INSTEAD of `anchor` — the API
   *  refuses both with different values. */
  weekFrom: string | null;
  weekTo: string | null;
  shift: "A" | "B" | "C" | null;
};

/**
 * The parameters every rework endpoint shares, built in one place so the two
 * paretos and the stacked trend can never disagree about which weeks they
 * cover — the handoff relies on their totals matching.
 */
export const scopeParams = (scope: ReworkScope): URLSearchParams => {
  const q = new URLSearchParams({ granularity: scope.granularity });
  if (scope.granularity === "week" && scope.weekFrom && scope.weekTo) {
    q.set("week_from", scope.weekFrom);
    q.set("week_to", scope.weekTo);
  } else if (scope.anchor) {
    q.set("anchor", scope.anchor);
  }
  if (scope.shift) q.set("shift", scope.shift);
  return q;
};

/** One request, abortable, keeping the last good body while the next loads. */
export const useParetoFetch = <T,>(url: string | null, label: string): ParetoQuery<T> => {
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
    const common = scopeParams(scope);

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

// ── Part 3.5: the category trend and its period dropdown ─────────────────────────

export type ReworkPeriodOption = {
  /** "WK43" or "P10". */
  label: string;
  fiscal_year: number | null;
  from: string;
  to: string;
  /** What to send back as ?anchor= to land on this period. */
  anchor: string;
  partial: boolean;
};

export type ReworkPeriodsResponse = {
  granularity: "week" | "month";
  since: string;
  /** Newest first. */
  options: ReworkPeriodOption[];
};

export type CategoryTrendBucket = {
  /** A date for a week's days, "WK37" for a period's weeks. */
  label: string;
  from: string;
  to: string;
  /** Days or weeks not reached yet. Kept on the axis, empty, so a week
   *  always reads as seven bars. */
  in_future: boolean;
  failed_units: number;
  dispositioned_units: number;
  awaiting_disposition: number;
  by_category: Record<string, number>;
};

export type CategoryTrendResponse = Envelope & {
  bucket: "day" | "week";
  /** Stack order, biggest first — so the biggest sits at the bottom. */
  categories: { category: string; label: string; units: number }[];
  buckets: CategoryTrendBucket[];
  /** Equal to /pareto/category's totals for the same anchor. */
  totals: {
    failed_units: number;
    dispositioned_units: number;
    awaiting_disposition: number;
    assignments: number;
  };
};

/**
 * The period dropdowns: the last 8 fiscal weeks (From and To share the list),
 * or fiscal periods of the last twelve months, newest first. Product-independent, so it is
 * fetched per granularity and not per row. `day` has no dropdown — the arrows
 * cover it — so it idles.
 */
export const useReworkPeriods = (granularity: ReworkGranularity) =>
  useParetoFetch<ReworkPeriodsResponse>(
    granularity === "day"
      ? null
      : apiUrl(`/rework/periods?${new URLSearchParams({ granularity })}`),
    "period list",
  );

/**
 * Defect categories stacked per fiscal week — the weeks of the span on Week,
 * the weeks of the period on Month. Same scope as the paretos; idles on `day`,
 * which the endpoint refuses (one day has nothing to stack).
 */
export const useCategoryTrend = (
  level: YieldRequestLevel | null,
  item: string | null,
  scope: ReworkScope,
) => {
  let url: string | null = null;
  if (level && item && scope.granularity !== "day") {
    const q = scopeParams(scope);
    url = apiUrl(
      `/rework/${encodeURIComponent(level)}/products/` +
        `${encodeURIComponent(item)}/trend/category?${q}`,
    );
  }
  return useParetoFetch<CategoryTrendResponse>(url, "category trend");
};

// ── Part 3.8: weekly yield trend ─────────────────────────────────────────────

export type YieldTrendBucket = {
  /** "WK39". */
  label: string;
  from: string;
  to: string;
  in_future: boolean;
  tested: number;
  failed: number;
  passed: number;
  /** null for a week with nothing tested — a gap in the line, not 0%. */
  fpy_pct: number | null;
  /** null with no target or nothing tested. */
  below_target: boolean | null;
};

export type YieldTrendResponse = Envelope & {
  bucket: "week";
  metric: "fpy";
  /** null when the item has no target: no target line. */
  target_yield_pct: number | null;
  buckets: YieldTrendBucket[];
  totals: {
    tested: number;
    failed: number;
    passed: number;
    fpy_pct: number | null;
    below_target: boolean | null;
  };
};

/**
 * Tested / failed / FPY per fiscal week. Same scope and the same buckets as
 * the category trend, so the two charts line up; idles on `day` (a 400).
 */
export const useYieldTrend = (
  level: YieldRequestLevel | null,
  item: string | null,
  scope: ReworkScope,
) => {
  let url: string | null = null;
  if (level && item && scope.granularity !== "day") {
    url = apiUrl(
      `/rework/${encodeURIComponent(level)}/products/` +
        `${encodeURIComponent(item)}/trend/yield?${scopeParams(scope)}`,
    );
  }
  return useParetoFetch<YieldTrendResponse>(url, "yield trend");
};
