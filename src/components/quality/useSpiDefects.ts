import { useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";

/** One defect code from the inspection machine.
 *
 *  `pads` and `boards` are DIFFERENT UNITS and must never be added together or
 *  shown without a label saying which is which: one board routinely carries
 *  eleven pads of the same fault, which is one failed board, not eleven. */
export type SpiDefectCode = {
  /** Identity. The vocabulary is open — it comes from the machine, not from a
   *  table this project controls — so never hard-code a list or a colour keyed
   *  to it. Seen so far: BRIDGING, POSITION, EXCESSIVE_VOLUME,
   *  INSUFFICIENT_VOLUME and their WARNING_ variants. */
  code: string;
  /** Display text. Always render this, never the code. */
  label: string;
  pads: number;
  boards: number;
  pct_of_failed_boards: number | null;
};

/** The same pads grouped by component reference — usually the most actionable
 *  cut, because a repeat offender points at a stencil aperture rather than at a
 *  bad print. Worth the same weight on screen as the defect breakdown. */
export type SpiComponent = {
  component: string;
  pads: number;
  boards: number;
  defects: string[];
};

export type SpiTester = { tester_id: string; pads: number };
export type SpiSide = { pcb_side: string; pads: number };

/** One NG board. The SFC is the hinge between the two levels: level one counts
 *  boards, level two names them. */
export type SpiBoard = {
  sfc: string;
  board_time: string | null;
  /** item + S + sfc + panel + lot, concatenated. Where the item code comes from. */
  panel_barcode: string | null;
  process_lot: string | null;
  tester_id: string | null;
  pads: number;
};

/** One printed deposit of solder paste, with the measurement that tripped it. */
export type SpiPadRow = {
  slno: number;
  sfc: string;
  /** T top, B bottom. */
  pcb_side: string | null;
  tester_id: string | null;
  pad_id: number | null;
  component: string | null;
  pin: string | null;
  result_name: string | null;
  defect_result_name: string | null;
  /** Flagged by the machine, then released by an operator. Stays in the log —
   *  an engineer reading a failed board wants the whole board — but is NOT in
   *  `defects`, which is why the table and the chart above it can disagree. */
  cleared: boolean;
  /** Read as a percentage of the programmed target: 100 nominal, 164 over-
   *  printed, 26 starved. The source documents no unit, so render the bare
   *  number until the SPI engineer confirms one. */
  volume: number | null;
  height: number | null;
  area: number | null;
  /** How far the deposit sits off the pad centre. */
  offset_x: number | null;
  offset_y: number | null;
  /** Where the pad is on the board. */
  pos_x: number | null;
  pos_y: number | null;
  pad_width: number | null;
  pad_height: number | null;
  panel_result_name: string | null;
  panel_defect_result_name: string | null;
};

export type SpiDefectsResponse = {
  item: string;
  product_name: string | null;
  business_date?: string | null;
  /** The product's own figures, matching its level-one row exactly. */
  parent: {
    boards: number | null;
    ok: number | null;
    failed: number | null;
    yield_pct: number | null;
  };
  /** Boards and pads AFTER the filters. Show it beside the totals so a filtered
   *  view is obviously filtered. */
  selection: { boards: number | null; pads: number | null };
  /** These four are ALWAYS the product's full figures — they do not respond to
   *  the filters. Deliberate: the numbers a slice is measured against must not
   *  move when the slice does. */
  defects: SpiDefectCode[];
  components: SpiComponent[];
  testers: SpiTester[];
  sides: SpiSide[];
  /** Pads an operator cleared, sitting on a board that failed for some other
   *  pad. In `pad_log`, not in `defects`. */
  released: number;
  /** NG boards with no pad rows at all — real failures the source cannot
   *  explain. Surface it rather than swallowing it. */
  unexplained: { boards: number; sfcs: string[] };
  /** Rows collapsed by pad de-duplication. Normal on some machines; only
   *  matters to someone reconciling against raw SQL. */
  duplicate_source_rows: number;
  boards: SpiBoard[];
  pad_log: SpiPadRow[];
};

export type SpiFilters = {
  /** One inspection machine, e.g. SPI002. Named `resource` because the route is
   *  shared with the MES steps. */
  resource: string | null;
  /** One defect code, e.g. BRIDGING. Shared-route naming again. */
  category: string | null;
  /** T or B. */
  pcbSide: string | null;
};

export const EMPTY_SPI_FILTERS: SpiFilters = {
  resource: null,
  category: null,
  pcbSide: null,
};

/**
 * Pad defects behind one product's failed solder-paste inspections.
 *
 * Level two of the SPI drill-down. Everything it returns describes the NG boards
 * of one product on one day — the same boards the SPI card counted as failures,
 * so `parent.failed` is always the number of boards the pad log covers.
 *
 * NOT the same shape as the other steps' level two: SPI has pads where the MES
 * steps have non-conformance records, which is why this has its own hook and
 * modal rather than reusing ProductDrilldownModal.
 *
 * The board filter is deliberately absent here. Every board's pads are already
 * in `pad_log`, so narrowing to one SFC is a client-side filter, not a request.
 *
 * `times_processed` and `verified_only` are accepted by the shared route and
 * ignored for SPI, so they are never sent.
 */
export const useSpiDefects = (
  item: string | null,
  businessDate?: string | null,
  filters: SpiFilters = EMPTY_SPI_FILTERS,
) => {
  const [data, setData] = useState<SpiDefectsResponse | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "stale" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const { resource, category, pcbSide } = filters;

  useEffect(() => {
    if (!item) {
      setState("idle");
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchDefects = async () => {
      try {
        const params = new URLSearchParams();
        if (businessDate) params.set("business_date", businessDate);
        if (resource) params.set("resource", resource);
        if (category) params.set("category", category);
        if (pcbSide) params.set("pcb_side", pcbSide);
        const qs = params.toString();
        const res = await fetch(
          apiUrl(
            `/process/SPI/products/${encodeURIComponent(item)}/defects` +
              `${qs ? `?${qs}` : ""}`,
          ),
        );

        // 404 here is not a fault: the item had no boards on that day. Almost
        // always a business_date that moved between the two calls, so the honest
        // answer is "re-open it", not a red error.
        if (res.status === 404) {
          if (cancelled) return;
          const body = await res.json().catch(() => null);
          setError(
            body?.detail ??
              `No inspected boards for ${item} on this production day.`,
          );
          setState("stale");
          return;
        }
        if (!res.ok) throw new Error(`Failed to fetch SPI defects for ${item}`);

        const json: SpiDefectsResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(`Error fetching SPI defects for ${item}:`, err);
        setError("Could not load the pad defects.");
        setState("error");
      }
    };

    setState("loading");
    fetchDefects();
    return () => {
      cancelled = true;
    };
    // `data` is intentionally NOT cleared before a refetch: the filters change
    // often, and blanking the summary blocks on every chip click would make the
    // panel flicker even though those blocks never change.
  }, [item, businessDate, resource, category, pcbSide]);

  return { data, state, error };
};

export type SpiDefectsQuery = ReturnType<typeof useSpiDefects>;
