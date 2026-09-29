import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";
import type { DateRange } from "./dashboardFilters";

/**
 * The AOI defects behind one DPMOI row — level two of the card.
 *
 * The response's headline is `by_category`, not the log. The card's index blends
 * soldering, placement and component over their SUMMED opportunities, and those
 * three counts differ by an order of magnitude on a real board — so a placement
 * problem arrives already divided by a denominator that has little to do with it
 * and reads as almost nothing. Each category here is divided by its own.
 */

/** Both counts, kept apart: several defects on one board is one bad board. */
type Counted = { defects: number; boards: number };

export type DpmoiCategory = {
  /** solder | placement | component — gold_sync's own buckets, not re-cut here. */
  category: string;
  label: string;
  defects: number | null;
  /** From the opportunity master, per board. */
  opportunities_per_board: number | null;
  /** opportunities_per_board x boards. */
  opportunities: number | null;
  /** Null, NOT zero, when the opportunity count is unknown — the same rule the
   *  table above follows. A zero here would read as a perfect process. */
  dpmo: number | null;
  /**
   * The NC codes this bucket is actually made of, worst first.
   *
   * Shown rather than summarised because the mapping repays checking: the
   * `component` bucket is exactly code E5, whose master description is
   * "Mechanical damage", while "Missing"/"Misplaced component" (A1, A2) land in
   * `placement`. That is the plant's own DAILY_DPMO rule, carried over unchanged
   * — the codes make it auditable instead of hiding it behind a label.
   */
  codes: { nc: string; defects: number }[];
};

export type DpmoiByNc = Counted & {
  nc: string;
  description: string | null;
  category: string;
};
export type DpmoiByRefDes = Counted & { ref_des: string };
export type DpmoiByComponent = Counted & { component: string };
export type DpmoiByResource = Counted & { resource: string };

export type DpmoiLogRow = {
  slno: number;
  /** Board serial. */
  sfc: string;
  nc: string | null;
  nc_description: string | null;
  category: string;
  /** Where on the board. 100% populated on the rows the card counts — the AOI
   *  records missing it are all SAMPLE DEFECT, which the card excludes. */
  ref_des: string | null;
  component: string | null;
  /** The AOI machine the defect was raised on. */
  resource: string | null;
  date_time: string | null;
  comment: string | null;
};

export type DpmoiDetailResponse = {
  step: string;
  business_date: string;
  window: { from: string; to: string };
  item: string;
  operation: string;
  description: string | null;
  product: string | null;
  board_classification: string | null;
  /** mart_dpmo's row for this item and operation — the same row the table above
   *  renders, so the two levels cannot disagree. */
  parent: {
    boards: number | null;
    defects_total: number | null;
    defects_solder: number | null;
    defects_place: number | null;
    defects_comp: number | null;
    opportunities: number | null;
    dpmo: number | null;
  };
  by_category: DpmoiCategory[];
  /** True when any category's opportunity count is missing, so a blank rate can
   *  be explained rather than left as an unexplained gap. */
  opportunities_incomplete: boolean;
  by_nc: DpmoiByNc[];
  by_ref_des: DpmoiByRefDes[];
  by_component: DpmoiByComponent[];
  resources: DpmoiByResource[];
  boards_affected: number;
  records: number;
  missing: { ref_des: number; component: number; resource: number };
  log: DpmoiLogRow[];
};

export type DpmoiDetailQuery = {
  item: string;
  operation: string;
  businessDate?: string | null;
  /** Production-day range. When set it REPLACES businessDate -- the endpoint
   *  ignores the single day once date_from/date_to are given. */
  range?: DateRange | null;
};

export const useDpmoiDetail = ({
  item,
  operation,
  businessDate,
  range = null,
}: DpmoiDetailQuery) => {
  const [data, setData] = useState<DpmoiDetailResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDetail = async () => {
      try {
        const params = new URLSearchParams({ item, operation });
        if (businessDate) params.set("business_date", businessDate);
        // Sent after the single day on purpose: the endpoint ignores
        // business_date once either of these is present, so a range always wins.
        if (range?.from) params.set("date_from", range.from);
        if (range?.to) params.set("date_to", range.to);

        const res = await fetch(
          apiUrl(`/process/dpmoi/detail?${params.toString()}`),
        );
        // 404 is a real answer — this board did not run at this operation on this
        // day — and the endpoint says so in `detail`. Surfacing that beats a
        // generic failure, which reads as a broken request.
        if (res.status === 404) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.detail ?? "No DPMOI row for this board on this day.",
          );
        }
        if (!res.ok) throw new Error("Failed to fetch the DPMOI detail");

        const json: DpmoiDetailResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching DPMOI detail:", err);
        setError(
          err instanceof Error ? err.message : "Could not load the DPMOI detail.",
        );
        setState("error");
      }
    };

    setState("loading");
    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [item, operation, businessDate, range?.from, range?.to]);

  return { data, state, error };
};

export default useDpmoiDetail;
