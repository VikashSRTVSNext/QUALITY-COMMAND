// Query semantics shared by the handlers.
//
// These reproduce the arithmetic the real endpoints do, and three rules in here
// are ones the dashboard explicitly depends on:
//
//  1. A RANGE IS SUMMED, NOT AVERAGED. Raw counts are added first and the
//     percentage is taken once at the end, so a day that tested nine times as
//     many boards carries nine times the weight. Averaging the daily
//     percentages would disagree with the card exactly on the weeks where
//     volume swung — which is the comparison the UI is warned about.
//
//  2. SHIFT D IS A ROW, NOT A SUM. The whole-day figure is stored separately
//     from A/B/C. Asking for the day reads the D row; it never adds the three
//     shifts, which would double-count against it.
//
//  3. `no_target` IS NOT A FAILURE. A product the target sheet has no row for
//     has not failed anything and must not be graded critical.

import type { KpiMetricKey, KpiTotals } from "./types";

// ── Yield rows ──────────────────────────────────────────────────────────────

export interface YieldRowLike {
  item: string;
  product: string;
  sub_module: string | null;
  shift: string;
  tested: number;
  failed: number;
  fpy: number | null;
  spy: number | null;
  target_yield: number | null;
  status: string;
  ai_recommendation: string | null;
  id: number;
}

/** Levels are decided by `sub_module`, not a level column. Mirrors
 *  matchesLevel in productYieldFilter.ts, including TRX-by-exclusion. */
export const matchesLevel = (
  subModule: string | null | undefined,
  level: string | null,
): boolean => {
  if (!level) return true;
  const sub = String(subModule ?? "").toUpperCase();
  const want = level.toUpperCase();
  if (want === "UNIT" || want === "UNITS") return sub === "UNIT";
  if (want === "PA") return sub === "PA" || sub === "PSU";
  if (want === "TRX") return sub !== "UNIT" && sub !== "PA" && sub !== "PSU";
  return true;
};

/**
 * The endpoint accepts the full dotted code, the base code before the dot, or
 * the display name. Reproduced so a selection made in one window still matches
 * in another, which is what the frontend's own fallback assumes.
 */
export const matchesProduct = (
  row: { item: string; product: string },
  selected: string[],
): boolean => {
  if (selected.length === 0) return true;
  const base = row.item.split(".")[0];
  return selected.some((s) => s === row.item || s === base || s === row.product);
};

/** Shift filter. null/absent means the whole production day: the D row. */
export const matchesShift = (rowShift: string, shift: string | null): boolean =>
  rowShift.toUpperCase() === (shift ?? "D").toUpperCase();

export const yieldStatusFor = (
  fpy: number | null,
  targetPct: number | null,
): "healthy" | "warning" | "critical" | "no_target" | "unknown" => {
  if (targetPct == null) return "no_target";
  if (fpy == null) return "unknown";
  if (fpy >= targetPct) return "healthy";
  return fpy >= targetPct - 5 ? "warning" : "critical";
};

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 10000) / 100 : null;

/**
 * Collapse one product's rows across several days into a single row.
 *
 * `days` counts the days THIS product actually ran, which is not the length of
 * the range — a product showing 2 inside a 15-day window had a quiet fortnight,
 * and the table surfaces that because a yield off two days is a much weaker
 * signal than one off fifteen.
 *
 * Status is recomputed from the range's own yield, never carried over from a
 * single day.
 */
export const collapseYieldRows = (
  rows: YieldRowLike[],
  shift: string | null,
): (YieldRowLike & { days: number })[] => {
  interface Acc {
    row: YieldRowLike;
    tested: number;
    failed: number;
    recovered: number;
    days: number;
  }
  const byItem = new Map<string, Acc>();

  for (const row of rows) {
    const acc = byItem.get(row.item);
    if (!acc) {
      byItem.set(row.item, {
        row,
        tested: row.tested,
        failed: row.failed,
        recovered: recoveredOf(row),
        days: 1,
      });
      continue;
    }
    acc.tested += row.tested;
    acc.failed += row.failed;
    acc.recovered += recoveredOf(row);
    acc.days += 1;
  }

  const out = [...byItem.values()].map((acc) => {
    const fpy = pct(acc.tested - acc.failed, acc.tested);
    const spy = pct(acc.tested - acc.failed + acc.recovered, acc.tested);
    return {
      ...acc.row,
      tested: acc.tested,
      failed: acc.failed,
      fpy,
      spy,
      status: yieldStatusFor(fpy, acc.row.target_yield),
      shift: (shift ?? "D").toUpperCase(),
      days: acc.days,
    };
  });

  // Stable, and the same ordering the dropdown uses.
  out.sort((a, b) => a.product.localeCompare(b.product));
  return out.map((r, i) => ({ ...r, id: i + 1 }));
};

/**
 * Boards that failed first pass then passed a retest, reconstructed from the
 * stored percentages.
 *
 * The per-product table holds no recovery count — which is exactly why
 * `spy_is_weighted_mean` is always true on this source. Accurate to rounding,
 * not exact.
 */
const recoveredOf = (row: YieldRowLike): number =>
  Math.round((((row.spy ?? 0) - (row.fpy ?? 0)) / 100) * row.tested);

// ── KPI roll-ups ────────────────────────────────────────────────────────────

const COUNT_KEYS = [
  "units_tested",
  "units_passed_fp",
  "units_recovered",
  "modules_tested",
  "modules_passed_fp",
  "modules_recovered",
] as const;

export type CountKey = (typeof COUNT_KEYS)[number];
export type Counts = Record<CountKey, number>;

export const emptyCounts = (): Counts =>
  COUNT_KEYS.reduce((a, k) => ({ ...a, [k]: 0 }), {} as Counts);

export const addCounts = (a: Counts, b: Partial<Counts>): Counts => {
  const out = { ...a };
  for (const k of COUNT_KEYS) out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  return out;
};

/**
 * The four yield metrics plus the raw counts.
 *
 * Rule 1 lives here: percentages are derived from the summed counts, so a
 * caller cannot accidentally average them.
 */
export const totalsFrom = (
  counts: Counts,
  customerAudit: number | null,
): KpiTotals => ({
  fpy_unit: pct(counts.units_passed_fp, counts.units_tested),
  spy_unit: pct(
    counts.units_passed_fp + counts.units_recovered,
    counts.units_tested,
  ),
  fpy_module: pct(counts.modules_passed_fp, counts.modules_tested),
  spy_module: pct(
    counts.modules_passed_fp + counts.modules_recovered,
    counts.modules_tested,
  ),
  customer_audit: customerAudit,
  ...counts,
});

export const METRIC_KEYS: KpiMetricKey[] = [
  "fpy_unit",
  "spy_unit",
  "fpy_module",
  "spy_module",
  "customer_audit",
];

/** Percentage points, null when either side is missing. */
export const deltaBetween = (
  current: Partial<KpiTotals>,
  previous: Partial<KpiTotals>,
): Record<KpiMetricKey, number | null> => {
  const out = {} as Record<KpiMetricKey, number | null>;
  for (const key of METRIC_KEYS) {
    const a = current[key];
    const b = previous[key];
    out[key] =
      typeof a === "number" && typeof b === "number"
        ? Math.round((a - b) * 100) / 100
        : null;
  }
  return out;
};

/**
 * Mean of the days that were actually audited.
 *
 * Unaudited days are LEFT OUT rather than scored zero, and the newest day in
 * any window is normally unaudited because the audit is signed off the day
 * after the shift it covers. Null when nothing in the window was audited at
 * all, which the UI must render as "not audited" rather than a red zero.
 */
export const auditAverage = (
  scores: (number | null)[],
): { score: number | null; days_reported: number } => {
  const real = scores.filter((s): s is number => typeof s === "number");
  if (real.length === 0) return { score: null, days_reported: 0 };
  const mean = real.reduce((a, s) => a + s, 0) / real.length;
  return {
    score: Math.round(mean * 100) / 100,
    days_reported: real.length,
  };
};

// ── Paging and sorting ──────────────────────────────────────────────────────

/** Sort keys `/process/{step}/products` accepts. An unknown key is a 400 by
 *  design — the server owns the ordering and refuses to guess. */
export const STEP_SORT_KEYS = [
  "product",
  "done",
  "ok",
  "failed",
  "yield",
  "failure",
] as const;

export const isStepSortKey = (
  key: string,
): key is (typeof STEP_SORT_KEYS)[number] =>
  (STEP_SORT_KEYS as readonly string[]).includes(key);

const SORT_FIELD: Record<string, string> = {
  product: "product_name",
  done: "done",
  ok: "ok",
  failed: "failed",
  yield: "yield_pct",
  failure: "failure_pct",
};

/**
 * Server-side ordering for the step breakdown.
 *
 * With no sort the server chooses worst-first on whichever metric the step
 * reports, which is the ordering that makes the table useful on open.
 */
export const sortStepRows = <T extends Record<string, any>>(
  rows: T[],
  sort: string | null,
  order: string | null,
  metric: "yield" | "failure",
): T[] => {
  const key = sort ?? (metric === "failure" ? "failure" : "yield");
  const field = SORT_FIELD[key] ?? "yield_pct";
  // Worst-first by default: lowest yield, highest failure rate.
  const dir = order === "asc" ? 1 : order === "desc" ? -1 : key === "failure" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (typeof av === "string" || typeof bv === "string") {
      return String(av ?? "").localeCompare(String(bv ?? "")) * (order === "desc" ? -1 : 1);
    }
    return ((av ?? 0) - (bv ?? 0)) * dir;
  });
};

export interface Page<T> {
  rows: T[];
  page: number;
  page_size: number;
  total_products: number;
  total_pages: number;
}

export const paginate = <T>(rows: T[], page: number, pageSize: number): Page<T> => {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Clamped rather than trusted: a page past the end would answer with an
  // empty table and "next" already disabled, with no way forward.
  const safe = Math.min(Math.max(1, page), totalPages);
  return {
    rows: rows.slice((safe - 1) * pageSize, safe * pageSize),
    page: safe,
    page_size: pageSize,
    total_products: total,
    total_pages: totalPages,
  };
};

// ── Query-string readers ────────────────────────────────────────────────────

/** Repeated values, e.g. ?product=a&product=b. `.getAll`, never `.get`. */
export const repeated = (url: URL, name: string): string[] =>
  url.searchParams.getAll(name).filter(Boolean);

export const single = (url: URL, name: string): string | null =>
  url.searchParams.get(name) || null;

export const intParam = (url: URL, name: string, fallback: number): number => {
  const raw = url.searchParams.get(name);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/**
 * The shift letter a request is asking for, or null for the whole day.
 *
 * "D" means the whole production day and is normalised to null here, because
 * the whole-day figure is the default rather than a fourth shift.
 */
export const shiftParam = (url: URL): string | null => {
  const raw = single(url, "shift");
  if (!raw) return null;
  const up = raw.toUpperCase();
  return up === "D" ? null : up;
};

export const VALID_SHIFTS = ["A", "B", "C", "D"];
