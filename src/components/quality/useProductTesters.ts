import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";
import type { DateRange } from "./dashboardFilters";

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
   *  from reading as if they covered every failure. Equals pending_units +
   *  undispositioned_units + failures whose NC code has no category. */
  uncaused_units: number | null;
  /** Failed, an operator has entered a disposition, nobody has verified it yet.
   *
   *  This is the number that reconciles us with the MES portal. Cause counts are
   *  VERIFIED-only, and that review lands a median of 28 minutes after the test
   *  (p90 ~3 hours), so MES shows a failure well before it can appear in any
   *  cause column. Shown as "pending" rather than hidden, so an in-flight review
   *  does not read as a stale dashboard. */
  pending_units: number | null;
  /** Failed with no disposition row at all yet. */
  undispositioned_units: number | null;
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
    /** DISTINCT units, from their own query -- NOT the sum of the tester rows,
     *  which counts a unit once per machine it ran. The three partition the
     *  product's failed units exactly. */
    verified_units: number | null;
    pending_units: number | null;
    undispositioned_units: number | null;
    /** Verified, but its NC code has no category in the master -- so it cannot
     *  appear in a cause column. A master-data gap, NOT a review backlog: the
     *  two are shown separately because they need different people to act. */
    unmapped_units: number | null;
    /** DISTINCT failed units -- the denominator the three counts above
     *  partition. NOT the same as `failed`, which sums qty_failed and so
     *  counts failure EVENTS: a unit that fails twice in a day is 2 there and
     *  1 here. They coincide on most steps and diverge on high-volume ones. */
    failed_units: number | null;
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
  /** Dashboard date range. When set, the endpoint covers that whole window
   *  instead of one production day — so a log opened from a ranged table can
   *  account for the failures that table shows. */
  range?: DateRange | null,
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
        if (range?.from) params.set("date_from", range.from);
        if (range?.to) params.set("date_to", range.to);
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
    // The two range STRINGS, not the object: the caller rebuilds it each
    // render and an object dependency would refetch on every one.
  }, [step, item, businessDate, range?.from, range?.to]);

  return { data, state, error };
};
