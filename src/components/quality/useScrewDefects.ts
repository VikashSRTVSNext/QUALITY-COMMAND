import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";
import { appendWindowParams, timeKeyOf, type DateRange } from "./dashboardFilters";
import { readError } from "./useDashboardFilters";

export type ScrewRow = {
  /** MAC_LINE02 etc, taken from the resource prefix (MAC_LINE02_SCREW_01). */
  line: string | null;
  operation: string | null;
  item: string | null;
  /** From the Target sheet, falling back to the MES product description for the
   *  sub-assemblies the sheet does not carry. Null only if both are missing. */
  product_name: string | null;
  /** Screws on this board at this station, from Screw Master.xlsx. */
  no_of_screws: number | null;
  /** Boards through the station. The plant's table calls this "Passed". */
  boards: number | null;
  passed: number | null;
  /** no_of_screws x boards — the DENOMINATOR. */
  total_screws: number | null;
  fail_count: number | null;
  /** fail_count / total_screws. Screws, not boards. */
  defect_pct: number | null;
};

export type ScrewDefectsResponse = {
  step: string;
  business_date: string;
  /** What the rows cover. A single day is a range of one. */
  range: { from: string; to: string; days: number };
  /** The shift the rows were narrowed to, or null for the whole day. */
  shift: string | null;
  operations: string[];
  /** What the backend applied. Absent on older responses. */
  filters?: { products: string[]; lines: string[] };
  rows: ScrewRow[];
  totals: {
    boards: number | null;
    total_screws: number | null;
    fail_count: number | null;
    defect_pct: number | null;
  };
  /** Items running through a screw station with no row in Screw Master.xlsx.
   *  Excluded from every figure above, because their screw count is unknown
   *  rather than zero — read this before trusting a low rate. */
  uncovered: {
    line: string | null;
    operation: string | null;
    item: string | null;
    boards: number | null;
  }[];
};

/**
 * Screw defects by line, operation and item — the table behind the card.
 *
 * Its own endpoint rather than the per-product one every other step tab uses,
 * because the denominator here is SCREWS DRIVEN, not boards. A board carrying 18
 * screws is 18 chances to fail, so "which products make up this figure" is a
 * different question with a different divisor.
 */
export const useScrewDefects = (
  businessDate?: string | null,
  /** Dashboard date range. Both ends null = the live current production day. */
  range?: DateRange | null,
  /** "A" | "B" | "C", or null for the whole production day. */
  shift?: string | null,
  /** Shared product selection. Rows, totals and `uncovered` then cover only
   *  these products. */
  products?: string[] | null,
  /** Selected lines (MAC_LINE01 etc). This breakdown takes them, unlike
   *  DPMOI's. */
  lines?: string[] | null,
) => {
  const [data, setData] = useState<ScrewDefectsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  // The two strings, not the object — see the DPMOI hook for why.
  const rangeFrom = range?.from ?? null;
  const rangeTo = range?.to ?? null;
  const rangeTimes = timeKeyOf(range);
  // Serialised so fresh array literals from the caller do not refetch.
  const productKey = (products ?? []).join("\u0001");
  const lineKey = (lines ?? []).join("\u0001");

  useEffect(() => {
    let cancelled = false;

    const fetchRows = async () => {
      try {
        const params = new URLSearchParams();
        if (businessDate) params.set("business_date", businessDate);
        appendWindowParams(params, range);
        if (shift) params.set("shift", shift);
        // Repeated, never .set: several values are several parameters.
        if (productKey) {
          for (const item of productKey.split("\u0001")) {
            params.append("product", item);
          }
        }
        if (lineKey) {
          for (const line of lineKey.split("\u0001")) {
            params.append("line", line);
          }
        }
        const qs = params.toString();
        const res = await fetch(
          apiUrl(`/process/screw-defects/breakdown${qs ? `?${qs}` : ""}`),
        );
        if (!res.ok) throw new Error(await readError(res));
        const json: ScrewDefectsResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching screw defects:", err);
        setError(err instanceof Error && err.message ? err.message : "Could not load the screw defect breakdown.");
        setState("error");
      }
    };

    setState("loading");
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [businessDate, rangeFrom, rangeTo, rangeTimes, shift, productKey, lineKey]);

  return { data, state, error };
};
