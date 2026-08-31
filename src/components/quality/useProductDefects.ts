import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";

// Steps whose failures can be broken down to the NC log. Kept in step with the
// backend's _REWORK_OPS map: a step's failures are only explainable when its
// rework operation is known, because the disposition (what was actually done
// about the failure) lives on the rework operation and not on the test.
//
// The endpoint answers 501 for anything unmapped rather than returning an empty
// log, so an unlisted step here fails loudly instead of looking like a product
// with no failures. This list only exists so the UI can avoid offering a click
// that it knows will not resolve.
export const DEFECT_DRILLDOWN_STEPS: Record<string, true> = {
  RTWP: true,
  OTA_TEST: true,
  // Burn-in is a SAMPLE test, not every unit, so expect a handful of units a day
  // here rather than RTWP-sized numbers. A near-empty table is the correct
  // answer for this step, not a bug.
  BURN_IN: true,
  // The pressure / ingress-protection test, and the highest-volume step here:
  // ~900-1000 units a day, so expect the fullest tables of any drill-down.
  IP: true,
  // Despite "SAMPLE" in its operation name, LBTS is not sparse like burn-in --
  // 50-89 units a day, so these tables are worth opening.
  LBTS: true,
  // Automated optical inspection. Every failure here disposes as FCR, so its
  // cause breakdown is one column by nature -- the empty SQA / PP columns are
  // correct, not missing data.
  AUTO_OGI: true,
  // SMT X-ray inspection, and the one step whose cause columns will usually read
  // zero. Its dispositions arrive a MEDIAN OF 3 DAYS after the failure (RTWP's
  // take 28 minutes), and this drill-down scopes causes to a single business day,
  // so they land outside it. The NC log still lists the same-day rows, which is
  // why it stays clickable -- but an empty AXI cause row does NOT mean nobody
  // reviewed the failures.
  AXI: true,
  // Reached from the UNITS level tab, not a step tab of its own: the UNITS table
  // IS the UNIT_TEST_IN04 first-pass report. Disposes through TWO rework
  // operations, best coverage and timing of any step (494/496 units, median
  // 23 min), and the highest failure volume, so the fullest NC logs.
  UNIT_TEST: true,
  // Mapped on an explicit decision, not because the data supports it well.
  // Its cause columns are ALWAYS zero: no verified row for this step carries a
  // category (the codes are 'FAIL' and 'RC1', both NULL in the master). The NC
  // log is the only useful level -- it shows the code, action and comments.
  THERMAL_AVI: true,
  // Reached from the TRX and PA level tabs, which are two slices of one
  // operation. Best coverage (1382/1390), timing (median 26 min) and category
  // spread of any step -- six of the seven cause columns populate.
  MODULE_TEST: true,
};

export type NcLogRow = {
  slno: number;
  /** False = this unit's first pass was on an earlier day. The row is real
   *  rework, but it belongs to another day's yield and is excluded from
   *  `categories` and `parent`. Listed so the log matches the MES portal
   *  row-for-row. */
  first_pass_unit: boolean;
  /** Unit serial. The spine of the whole log — one unit can appear many times. */
  sfc: string;
  /** When the TEST failed, not when the disposition was entered. */
  date_time: string | null;
  verified_state: string | null;
  failure_id: string | null;
  nc: string | null;
  nc_description: string | null;
  /** FCR / SMT / PPH / PPF / PPA / SQA / MOD_REJ, or null when unmapped. */
  category: string | null;
  nc_closed_by: string | null;
  ref_des: string | null;
  component: string | null;
  item: string | null;
  resource: string | null;
  times_processed: number | null;
  /** What the operator did — "Retest (False failure)", "Filter Replaced(...)". */
  comment: string | null;
  /** The measurement that tripped the test — "POS: 1 MeasID: 43 HI: -97 ...". */
  failure_comments: string | null;
  disposition_time: string | null;
};

export type DefectCategory = {
  code: string;
  label: string;
  units: number;
  pct_of_done: number | null;
};

export type ProductDefectsResponse = {
  step: string;
  item: string;
  business_date: string;
  window: { from: string; to: string };
  operations: { test: string[]; rework: string[] };
  /** Copied from the per-product level so the two can be checked against each
   *  other without a second request. */
  parent: {
    boards: number | null;
    done: number | null;
    ok: number | null;
    failed: number | null;
    yield_pct: number | null;
  };
  categories: DefectCategory[];
  uncategorised: { nc: string; units: number }[];
  /** Failures with no disposition typed in yet. Read this before trusting the
   *  category split — it is why the percentages can sum to less than the
   *  failure rate. */
  undispositioned: { events: number; units: number };
  /** Events on units whose first pass happened on an earlier day. Excluded from
   *  every figure above, surfaced so the log does not look like it is missing
   *  rows a floor engineer can see happening. */
  carried_over: { events: number; units: number };
  nc_log_events: number;
  /** Units AND events for what is listed. A cause cell counts UNITS while the log
   *  lists EVENTS, so both are needed or a cell reading "3u" that opens 6 rows
   *  looks like one of the two is broken. */
  selection: { units: number; events: number };
  nc_log: NcLogRow[];
  /** Echo of the narrowing applied to `nc_log`. `parent` and `categories` above
   *  are ALWAYS the product's full figures, filtered or not, so the numbers a
   *  slice is measured against never move. */
  filter: {
    resource: string | null;
    category: string | null;
    times_processed: number | null;
    verified_only: boolean;
  };
};

/** Colour per category. Semantic, not decorative: a false call is not a defect
 *  and must not read like one, while a supplier or SMT fault is a real escape. */
export const CATEGORY_COLOR: Record<string, string> = {
  FCR: "#eab308", // false call — wasted time, not a defect
  SMT: "#ff4c4c",
  PPH: "#f97316",
  PPF: "#f97316",
  PPA: "#f97316",
  SQA: "#ff4c4c",
  MOD_REJ: "#a855f7",
};

/**
 * The NC log behind one product's failures at one step.
 *
 * Fetched on demand rather than held in the dashboard snapshot: this is one
 * product on one day, opened a handful of times, and the rows are wide.
 *
 * `null` item means "closed" — the hook idles without fetching, so the caller
 * can keep it mounted and drive it purely by which row is selected.
 */
export const useProductDefects = (
  step: string | null,
  item: string | null,
  businessDate?: string | null,
  /** Narrow the LISTED ROWS to one tester. The response's `parent` and
   *  `categories` stay product-wide either way, so the figures a slice is
   *  measured against do not move with the filter. */
  resource?: string | null,
  /** Narrow the listed rows to one failure cause. */
  category?: string | null,
  /** One attempt number. The plant's screen defaults to 1. */
  timesProcessed?: number | null,
  /** Only verified records, as the plant's screen shows. */
  verifiedOnly?: boolean,
) => {
  const [data, setData] = useState<ProductDefectsResponse | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error" | "unsupported">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!step || !item) {
      setState("idle");
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchLog = async () => {
      try {
        const params = new URLSearchParams();
        if (businessDate) params.set("business_date", businessDate);
        if (resource) params.set("resource", resource);
        if (category) params.set("category", category);
        if (timesProcessed != null)
          params.set("times_processed", String(timesProcessed));
        if (verifiedOnly) params.set("verified_only", "true");
        const qs = params.toString();
        const res = await fetch(
          apiUrl(
            `/process/${encodeURIComponent(step)}/products/` +
              `${encodeURIComponent(item)}/defects${qs ? `?${qs}` : ""}`,
          ),
        );

        // 501 is a real answer, not a fault: the step has no verified rework
        // mapping yet. Held apart from "error" so the panel can say which of the
        // two it is instead of showing a generic failure for a known gap.
        if (res.status === 501) {
          if (cancelled) return;
          const body = await res.json().catch(() => null);
          setError(body?.detail ?? `No defect breakdown available for ${step}.`);
          setState("unsupported");
          return;
        }
        if (!res.ok) throw new Error(`Failed to fetch ${step} defects for ${item}`);

        const json: ProductDefectsResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Error fetching NC log for ${step}/${item}:`, err);
        setError("Could not load the NC log.");
        setState("error");
      }
    };

    setState("loading");
    setData(null);
    fetchLog();
    return () => {
      cancelled = true;
    };
  }, [
    step,
    item,
    businessDate,
    resource,
    category,
    timesProcessed,
    verifiedOnly,
  ]);

  return { data, state, error };
};

export type ProductDefectsQuery = ReturnType<typeof useProductDefects>;
