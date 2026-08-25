import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";

export type CauseCell = {
  /** FCR / SMT / PPH / PPF / PPA / SQA / MOD_REJ. */
  code: string;
  /** The plant report's own column heading for it. */
  label: string;
  units: number;
  pct_of_tested: number | null;
};

export type ShiftFigures = {
  tested: number | null;
  ftp: number | null;
  failed: number | null;
  ftpy_pct: number | null;
};

export type TesterRow = {
  resource: string;
  tested: number | null;
  ftp: number | null;
  failed: number | null;
  ftpy_pct: number | null;
  shifts: Record<"A" | "B" | "C", ShiftFigures>;
  causes: CauseCell[];
  /** Failures with no category, or none entered yet. Keeps the cause columns
   *  from reading as if they covered every failure. */
  uncaused_units: number | null;
};

export type ProductTestersResponse = {
  step: string;
  item: string;
  business_date: string;
  operations: { test: string[]; rework: string[] };
  testers: TesterRow[];
  totals: {
    tested: number | null;
    ftp: number | null;
    failed: number | null;
    ftpy_pct: number | null;
    causes: CauseCell[];
    uncaused_units: number | null;
  };
  /** How the cause counts were derived. Surfaced because the rule is still being
   *  confirmed against the plant's own report. */
  cause_rule: string;
};

/**
 * Per-tester yield and failure cause for one product — the middle drill-down level.
 *
 * Mirrors the plant's "ONLINE TESTER [RESOURCE] YIELD REPORT", which is filtered
 * to one item. Verified against it cell-for-cell on the yield columns.
 *
 * NOTE on the totals row: per-tester cause counts do NOT sum to the total. A unit
 * that ran three machines counts at each of them (right for a tester) but is one
 * unit for the product, so the total is a distinct count from the server rather
 * than a sum of the rows above it.
 */
export const useProductTesters = (
  step: string | null,
  item: string | null,
  businessDate?: string | null,
) => {
  const [data, setData] = useState<ProductTestersResponse | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "error" | "unsupported"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!step || !item) {
      setState("idle");
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchTesters = async () => {
      try {
        const params = new URLSearchParams();
        if (businessDate) params.set("business_date", businessDate);
        const qs = params.toString();
        const res = await fetch(
          apiUrl(
            `/process/${encodeURIComponent(step)}/products/` +
              `${encodeURIComponent(item)}/testers${qs ? `?${qs}` : ""}`,
          ),
        );

        // 501 = the step has no verified rework mapping, so causes cannot be
        // located. A real answer, not a fault.
        if (res.status === 501) {
          if (cancelled) return;
          const body = await res.json().catch(() => null);
          setError(body?.detail ?? `No tester breakdown available for ${step}.`);
          setState("unsupported");
          return;
        }
        if (!res.ok) throw new Error(`Failed to fetch ${step} testers for ${item}`);

        const json: ProductTestersResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Error fetching testers for ${step}/${item}:`, err);
        setError("Could not load the tester breakdown.");
        setState("error");
      }
    };

    setState("loading");
    setData(null);
    fetchTesters();
    return () => {
      cancelled = true;
    };
  }, [step, item, businessDate]);

  return { data, state, error };
};
