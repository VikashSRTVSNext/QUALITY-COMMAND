// Client-side column sorting, shared by every table that holds all its rows.
//
// One comparator rather than one per table. The tables differ in their columns
// but not in what sorting MEANS, and six hand-written compare functions is six
// places for "—" to end up at the top of an ascending sort.
//
// NOT for the step-tab products table: that one pages on the server, so sorting
// it here would only reorder the ten rows already on screen and silently lie
// about which product is worst. Its sort is a request parameter.

import { useMemo, useState } from "react";
import type { SortState } from "./SortableTh";

/**
 * Compare two cell values.
 *
 * NULLS ALWAYS SINK, whichever way the column is pointing. A missing value is
 * unknown, not smallest -- a product with no target is not the one with the
 * lowest target, and floating a screen of dashes to the top on every ascending
 * sort buries the rows the sort was for. This is the one rule worth stating,
 * because it is the one a per-table comparator gets wrong.
 */
const compare = (a: unknown, b: unknown): number => {
  const aMissing = a === null || a === undefined || a === "";
  const bMissing = b === null || b === undefined || b === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;

  // Numeric strings compare as numbers: several tables carry counts already
  // formatted ("1,920"), and lexical order would put 1,920 before 86.
  const na = Number(String(a).replace(/,/g, ""));
  const nb = Number(String(b).replace(/,/g, ""));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;

  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
};

/**
 * `rows` ordered by `sort`. Returns the original array untouched when no column
 * is selected -- the feed's own order is meaningful (worst first, or
 * chronological), and SortableTh's third click exists to get back to it.
 */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  /** The value to sort this row by for the given column. */
  get: (row: T, key: K) => unknown,
): T[] {
  if (!sort.key) return rows as T[];
  const key = sort.key;
  const sign = sort.order === "asc" ? 1 : -1;
  // Copied before sorting: the caller's array is usually the fetched data, and
  // sorting it in place would mutate the cache the rest of the panel reads.
  return [...rows].sort((a, b) => sign * compare(get(a, key), get(b, key)));
}

/** `sortRows` plus the state to drive it, which every caller needs anyway. */
export function useTableSort<T, K extends string>(
  rows: readonly T[],
  get: (row: T, key: K) => unknown,
) {
  const [sort, setSort] = useState<SortState<K>>({ key: null, order: "asc" });
  const sorted = useMemo(() => sortRows(rows, sort, get), [rows, sort, get]);
  return { sort, setSort, sorted };
}
