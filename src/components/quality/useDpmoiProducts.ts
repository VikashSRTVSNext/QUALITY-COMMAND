import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";

export type DpmoiRow = {
  item: string | null;
  /** AOI_TOP_REWORK_IN04 / AOI_BOT_REWORK_IN04. */
  operation: string | null;
  /** From the opportunity master (TBL_PLCM_ITEM_DPMO). */
  description: string | null;
  /** Boards — COUNT(DISTINCT sfc) x qty_started, because these rows are lots. */
  qty: number | null;
  defects_total: number | null;
  defects_comp: number | null;
  defects_solder: number | null;
  defects_place: number | null;
  opportunities: number | null;
  /** Null, NOT zero, when the item has no opportunity row: the denominator is
   *  unknown rather than the board perfect. */
  dpmo: number | null;
};

export type DpmoiResponse = {
  step: string;
  business_date: string;
  operations: string[];
  rows: DpmoiRow[];
  totals: {
    qty: number | null;
    defects_total: number | null;
    opportunities: number | null;
    dpmo: number | null;
  };
  /** Rows whose item+operation is absent from the opportunity master. Their
   *  defects are real and their rate uncomputable. */
  missing_opportunities: {
    item: string | null;
    operation: string | null;
    qty: number | null;
    defects_total: number | null;
  }[];
};

/** DPMOI per item and operation, as the plant's Daily DPMOi screen lists it. */
export const useDpmoiProducts = (businessDate?: string | null) => {
  const [data, setData] = useState<DpmoiResponse | null>(null);
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
          apiUrl(`/process/dpmoi/breakdown${qs ? `?${qs}` : ""}`),
        );
        if (!res.ok) throw new Error("Failed to fetch DPMOI breakdown");
        const json: DpmoiResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching DPMOI breakdown:", err);
        setError("Could not load the DPMOI breakdown.");
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
