// Shift and level filtering for the product-yield rows.
//
// /dashboard/stream/product-yield sends every row unfiltered, so the filtering
// that GET /dashboard/product-yield?shift=&level= used to do server-side happens
// here instead. That is the point of taking it from the stream: switching tabs
// costs no request at all.
//
// These rules MIRROR app/dashboard.py::product_yield. If that filter changes,
// this has to change with it — a mismatch shows up as rows appearing under the
// wrong tab, which is not obvious from looking at the table.

export type YieldLevel = "ALL" | "UNITS" | "TRX" | "PA";

/**
 * A row's level as the API names it (UNIT / TRX / PA). Rows carry `level`
 * since 2026-10-31; older ones are classified from `sub_module` by the same
 * rule the tabs use.
 */
export const levelOfRow = (row: any): "UNIT" | "TRX" | "PA" => {
  const lvl = String(row?.level ?? "").toUpperCase();
  if (lvl === "UNIT" || lvl === "TRX" || lvl === "PA") return lvl;
  const sub = String(row?.sub_module ?? "").toUpperCase();
  if (sub === "UNIT") return "UNIT";
  // TRX is everything that is neither a unit nor a power supply — defined by
  // exclusion server-side too, so a new sub_module lands here rather than
  // vanishing from every tab.
  if (sub === "PA" || sub === "PSU") return "PA";
  return "TRX";
};

const matchesLevel = (row: any, level: YieldLevel): boolean => {
  if (level === "ALL") return true;
  // The UI says UNITS, the data says UNIT.
  return levelOfRow(row) === (level === "UNITS" ? "UNIT" : level);
};

/**
 * @param shift "A" | "B" | "C", or null for the whole production day. The feed
 *   tags whole-day rows "D", which is what the REST endpoint mapped "Full Day"
 *   onto.
 */
export const filterYieldRows = (
  rows: any[],
  level: YieldLevel,
  shift: string | null,
): any[] => {
  const targetShift = (shift ?? "D").toUpperCase();
  return (rows ?? []).filter(
    (row) =>
      String(row?.shift ?? "").toUpperCase() === targetShift &&
      matchesLevel(row, level),
  );
};
