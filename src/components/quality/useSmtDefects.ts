import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";

/** Every breakdown counts BOARDS and RECORDS separately, and they are not
 *  interchangeable: twenty bad joints on one board is one board with a print
 *  problem, not twenty boards. `boards` is the number the card is built on. */
type Counted = { records: number; boards: number };

export type SmtByNc = Counted & {
  nc: string;
  description: string | null;
};
export type SmtByRefDes = Counted & { ref_des: string };
export type SmtByComponent = Counted & { component: string };
export type SmtByResource = Counted & { resource: string };

/** One row of the plant's OP_RES_NCLOG screen. */
export type SmtLogRow = {
  slno: number;
  /** Board serial. Distinct SFCs here equal the failed-board count above; there
   *  are more rows than boards because one board can fail several ways. */
  sfc: string;
  date_time: string | null;
  verified_state: string | null;
  failure_id: string | null;
  nc: string | null;
  nc_description: string | null;
  category: string | null;
  nc_closed_by: string | null;
  ref_des: string | null;
  component: string | null;
  item: string | null;
  /** The rework operation the defect was raised at. */
  operation: string | null;
  resource: string | null;
  times_processed: number | null;
  /** What the operator wrote at the rework station. */
  comment: string | null;
  /** The measurement that tripped the test. A different record from `comment`,
   *  joined on SFC + failure id + attempt, so either can be null alone. */
  failure_comments: string | null;
};

export type SmtDefectsResponse = {
  step: string;
  item: string;
  product_name: string | null;
  business_date: string;
  site_code: string | null;
  window: { from: string; to: string };
  /** Echo of what was applied to `log`. The breakdowns above it never move. */
  filters: {
    resource: string | null;
    nc: string | null;
    times_processed: number | null;
  };
  /** The product's own figures, matching its level-one row exactly. */
  parent: {
    boards: number | null;
    done: number | null;
    ok: number | null;
    failed: number | null;
    defect_records: number | null;
    failure_pct: number | null;
  };
  /** Distinct failed boards and defect records in the current selection. */
  boards: number | null;
  records: number | null;
  /** The four cuts. All cover the WHOLE log — filtering the table never moves
   *  them, so the figures a slice is measured against stay put. */
  by_nc: SmtByNc[];
  by_ref_des: SmtByRefDes[];
  by_component: SmtByComponent[];
  resources: SmtByResource[];
  /** Records the source left without each attribute. Surfaced rather than
   *  swallowed: it is why a breakdown can sum to less than the record count. */
  missing: {
    ref_des: number;
    component: number;
    resource: number;
    nc_description: number;
  };
  log_records: number;
  log: SmtLogRow[];
};

export type SmtFilters = {
  resource: string | null;
  nc: string | null;
  timesProcessed: number | null;
};

export const EMPTY_SMT_FILTERS: SmtFilters = {
  resource: null,
  nc: null,
  timesProcessed: null,
};

/**
 * The NC log behind one product's SMT solder defects — level two of SMT_DEFECTS.
 *
 * Its own hook rather than useProductDefects: the shape is close but not the
 * same. There is no disposition-category breakdown here (the log IS the rows the
 * card counted), the cuts are by NC code, reference designator, component and
 * machine, and every one of them carries a board count beside its record count.
 *
 * `/process/SMT_DEFECTS/products/{item}/testers` answers 501 and is never called:
 * a defect raised at a rework station has no first-pass tester to attribute to.
 * The machine breakdown is the `resources` block here.
 */
export const useSmtDefects = (
  item: string | null,
  businessDate?: string | null,
  filters: SmtFilters = EMPTY_SMT_FILTERS,
) => {
  const [data, setData] = useState<SmtDefectsResponse | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const { resource, nc, timesProcessed } = filters;

  useEffect(() => {
    if (!item) {
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
        // "category", not "nc" -- the route is shared with the MES steps and
        // takes their parameter name, even though the response echoes the value
        // back as `filters.nc`. Sending "nc" is accepted and silently ignored,
        // which is worse than an error: the log comes back unfiltered.
        if (nc) params.set("category", nc);
        if (timesProcessed != null)
          params.set("times_processed", String(timesProcessed));
        const qs = params.toString();
        const res = await fetch(
          apiUrl(
            `/process/SMT_DEFECTS/products/${encodeURIComponent(item)}/defects` +
              `${qs ? `?${qs}` : ""}`,
          ),
        );
        if (!res.ok) throw new Error(`Failed to fetch SMT defects for ${item}`);

        const json: SmtDefectsResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Error fetching SMT defects for ${item}:`, err);
        setError("Could not load the SMT defect log.");
        setState("error");
      }
    };

    setState("loading");
    fetchLog();
    return () => {
      cancelled = true;
    };
    // `data` is deliberately not cleared before a refetch: the filters change
    // often and the breakdowns never do, so blanking them would flicker the
    // panel for no reason.
  }, [item, businessDate, resource, nc, timesProcessed]);

  return { data, state, error };
};

export type SmtDefectsQuery = ReturnType<typeof useSmtDefects>;
