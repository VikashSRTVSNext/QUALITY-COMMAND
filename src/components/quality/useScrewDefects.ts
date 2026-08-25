import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";

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
  operations: string[];
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
export const useScrewDefects = (businessDate?: string | null) => {
  const [data, setData] = useState<ScrewDefectsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchRows = async () => {
      try {
        const params = new URLSearchParams();
        if (businessDate) params.set("business_date", businessDate);
        const qs = params.toString();
        const res = await fetch(
          apiUrl(`/process/screw-defects/breakdown${qs ? `?${qs}` : ""}`),
        );
        if (!res.ok) throw new Error("Failed to fetch screw defects");
        const json: ScrewDefectsResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching screw defects:", err);
        setError("Could not load the screw defect breakdown.");
        setState("error");
      }
    };

    setState("loading");
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [businessDate]);

  return { data, state, error };
};
