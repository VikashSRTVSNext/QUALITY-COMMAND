// Date-range and product filtering for the QCC dashboard.
//
// These mirror the contract in the 15 Sep 2026 backend handoff. Three rules
// from it drive everything in this file, and none of them are obvious from the
// endpoint signatures alone:
//
//  1. A date switches the data source. With no date parameters the numbers come
//     from the live Redis snapshot (today only) — which this app receives on the
//     SSE feed, not over REST. Send either date and the same shapes come from the
//     database instead and can span any range. So "no range selected" is not a
//     special case of the range query, it is a different transport, and
//     `isRangeActive` is what picks between them.
//
//  2. Dates are PRODUCTION days, not calendar days. A production day runs 06:15
//     to 06:15 IST, so a board tested at 02:00 on the 12th belongs to the 11th.
//     The backend owns that boundary; we send plain YYYY-MM-DD and never do
//     date arithmetic on a timestamp here.
//
//  3. Repeated `product` values select several products. URLSearchParams.set
//     would keep only the last one, so this file uses .append and every caller
//     must go through buildDashboardParams rather than hand-rolling a query
//     string.

/** Hard ceiling from the backend: a longer span is rejected with a 400. */
export const MAX_RANGE_DAYS = 400;

/** Both null = no range selected = live snapshot. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

export const EMPTY_RANGE: DateRange = { from: null, to: null };

/**
 * True once either end is set.
 *
 * Deliberately `from || to`, not `from && to`: one date without the other is a
 * valid query for that single day, not an open-ended range, so a half-filled
 * picker is already a database query and must not keep reading the snapshot.
 */
export const isRangeActive = (range: DateRange): boolean =>
  Boolean(range.from || range.to);

/**
 * Inclusive day count, or null when either end is missing.
 *
 * Parsed as UTC (the `T00:00:00Z` suffix) purely so the subtraction is immune to
 * the viewer's own timezone and to DST — these are opaque day labels owned by
 * the backend, not instants, and treating them as local dates makes the span
 * off by one for anyone west of UTC.
 */
export const rangeDayCount = (range: DateRange): number | null => {
  if (!range.from || !range.to) return null;
  const from = Date.parse(`${range.from}T00:00:00Z`);
  const to = Date.parse(`${range.to}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86_400_000) + 1;
};

/**
 * The reason this range cannot be sent, or null when it can.
 *
 * Both conditions are ones the backend answers with a 400. Checking them here
 * as well is not distrust of the server: it keeps a half-typed picker from
 * firing a request that is certain to fail, and it lets the message name the
 * field the user has to fix instead of surfacing a raw `detail` string.
 */
export const rangeError = (range: DateRange): string | null => {
  if (range.from && range.to && range.from > range.to) {
    return `Start date (${range.from}) is after end date (${range.to}).`;
  }
  const days = rangeDayCount(range);
  if (days !== null && days > MAX_RANGE_DAYS) {
    return `Range of ${days} days exceeds the ${MAX_RANGE_DAYS}-day maximum.`;
  }
  return null;
};

/** Shifts the yield table accepts. D — the whole production day — is a stored
 *  row, not A + B + C added up, so it is requested rather than derived. */
export type ShiftCode = "A" | "B" | "C" | "D";

export type YieldRequestLevel = "UNIT" | "TRX" | "PA";

export interface DashboardQuery {
  range: DateRange;
  /** null for the whole production day. */
  shift: "A" | "B" | "C" | null;
  level?: YieldRequestLevel | null;
  /** Item codes, as returned by /dashboard/products. Empty = all products. */
  products?: string[];
}

/**
 * Query string for any of the three dashboard endpoints.
 *
 * Omission is meaningful on every parameter here, so nothing is sent with a
 * placeholder value: no dates means the snapshot, no shift means the whole day,
 * no product means every product.
 */
export const buildDashboardParams = ({
  range,
  shift,
  level,
  products,
}: DashboardQuery): URLSearchParams => {
  const q = new URLSearchParams();
  if (range.from) q.set("date_from", range.from);
  if (range.to) q.set("date_to", range.to);
  if (shift) q.set("shift", shift);
  if (level) q.set("level", level);
  // .append, never .set — see rule 3 at the top of this file.
  for (const item of products ?? []) q.append("product", item);
  return q;
};

/** UI tab -> the `level` value the endpoint takes. The UI says UNITS, the API
 *  says UNIT; the other two agree. Mirrors matchesLevel in productYieldFilter. */
export const LEVEL_PARAM: Record<"UNITS" | "TRX" | "PA", YieldRequestLevel> = {
  UNITS: "UNIT",
  TRX: "TRX",
  PA: "PA",
};

// ── Response shapes ─────────────────────────────────────────────────────────
// Typed rather than `any` because two fields below are easy to misread and the
// compiler is the cheapest place to catch it: the two different `days`, and the
// SPY exactness flags.

export interface ProductYieldRow {
  id: number;
  product: string;
  item: string;
  sub_module: string | null;
  tested: number | null;
  failed: number | null;
  fpy: number | null;
  spy: number | null;
  target_yield: number | null;
  status: "healthy" | "warning" | "critical" | "no_target" | "unknown";
  ai_recommendation: string | null;
  shift: string;
  /**
   * Range source only: how many days of the requested range THIS product
   * actually ran. Not the length of the range — that is meta.days. A product
   * showing 2 inside a 15-day range had a quiet fortnight, and a yield off two
   * days is a much weaker signal than one off fifteen.
   */
  days?: number | null;
}

export interface ProductYieldMeta {
  source: string;
  from: string;
  to: string;
  /** Length of the requested range. Compare with rows[].days, which is
   *  per-product and usually smaller. */
  days: number;
  shift: string | null;
  level: string | null;
  products: string[];
  /**
   * Always true on the range source: the per-product table stores no recovery
   * count, so SPY is reconstructed from the stored percentage. Accurate to
   * rounding, not exact. Not shown to operators, but kept because it is the
   * first thing the backend asks for when a figure is queried.
   */
  spy_is_weighted_mean: boolean;
}

export interface ProductYieldResponse {
  rows: ProductYieldRow[];
  /** Absent on the snapshot source, present whenever dates were sent. */
  meta?: ProductYieldMeta;
}

export interface KpiTotals {
  fpy_unit: number | null;
  spy_unit: number | null;
  fpy_module: number | null;
  spy_module: number | null;
  customer_audit: number | null;
  units_tested: number | null;
  units_passed_fp: number | null;
  units_recovered: number | null;
  modules_tested: number | null;
  modules_passed_fp: number | null;
  modules_recovered: number | null;
}

/** The five card metrics, and only those — the count keys have no delta. */
export type KpiMetricKey =
  | "fpy_unit"
  | "spy_unit"
  | "fpy_module"
  | "spy_module"
  | "customer_audit";

export interface KpiResponse {
  range: {
    from: string;
    to: string;
    days: number;
    shift: string | null;
    /**
     * 0 means nothing ran in the range. That is how "no production" is told
     * apart from "the request broke" — render an empty state, never 0%, which
     * reads as a catastrophic yield.
     */
    days_with_data: number;
  };
  totals: KpiTotals;
  by_shift: (Partial<KpiTotals> & { shift: string })[];
  by_date: (Partial<KpiTotals> & { business_date: string })[];
  /** Equal-length window immediately before the requested one. */
  previous: {
    from: string;
    to: string;
    spy_exact: boolean;
  } & Partial<KpiTotals>;
  /** Percentage points, null when either side is missing. */
  delta_vs_previous: Record<KpiMetricKey, number | null>;
  customer_audit: {
    area: string;
    score: number | null;
    /**
     * Normally one short of days_in_range: the compliance audit is signed off
     * the day after the shift it covers, so the newest day in any range is
     * usually still unaudited. Filing lag, not missing data. Unaudited days are
     * left out of the average rather than scored zero.
     */
    days_reported: number;
    days_in_range: number;
  } | null;
  /** false when SPY was reconstructed from a stored percentage for part of the
   *  range. FPY is exact in every case. */
  spy_exact: boolean;
}

export interface ProductOption {
  item: string;
  product: string;
  sub_module: string | null;
  /** Volume in the window, so the dropdown can sort by it or grey out products
   *  with barely any production. */
  tested: number | null;
}

export interface ProductsResponse {
  range: { from: string; to: string; days: number };
  products: ProductOption[];
}

/**
 * Label for the comparison line on the KPI cards.
 *
 * Built from the dates the API reports, never hardcoded "vs yesterday": the
 * comparison window moves with the range, so a week is compared against the
 * week before it and a month against the month before it. Hardcoding the old
 * wording is wrong for every range except a single day.
 */
export const comparisonLabel = (previous: KpiResponse["previous"]): string =>
  previous.from === previous.to
    ? `vs ${previous.from}`
    : `vs ${previous.from} – ${previous.to}`;
