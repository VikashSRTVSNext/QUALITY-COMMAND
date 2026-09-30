import type { RankedBar } from "../charts/RankedBarChart";
import { productionDayOf, shortDay } from "./dashboardFilters";

/**
 * One bar per production day, from any drill-down's log.
 *
 * Shared by all four drill-downs because the Pareto they offer is the same
 * question in each — WHICH DAYS carry the defects — and four copies of a
 * day-bucketing loop is four chances to bucket on the calendar date by mistake.
 * `productionDayOf` is what stops that: a failure at 02:00 belongs to the
 * previous production day, so bucketing on the date part alone would split one
 * night shift across two bars.
 *
 * Returned in CHRONOLOGICAL order. ParetoChart re-sorts its own copy descending,
 * so the caller keeps a usable series either way.
 */
export const defectDateBars = <T,>(
  rows: readonly T[],
  timeOf: (row: T) => string | null | undefined,
): RankedBar[] => {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = productionDayOf(timeOf(row));
    // Rows with no usable timestamp are dropped rather than pooled into an
    // "unknown" bar: a Pareto's percentages are of a total, and a bucket that
    // is not a day would sit in that total claiming to be one.
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, count]) => ({ key: day, label: shortDay(day), value: count }));
};

export default defectDateBars;
