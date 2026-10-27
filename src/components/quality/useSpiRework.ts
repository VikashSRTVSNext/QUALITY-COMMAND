import { apiUrl } from "../../core/api/config";
import {
  scopeParams,
  useParetoFetch,
  type ReworkPeriod,
  type ReworkScope,
} from "./useReworkParetos";

// The per-product rework paretos behind the SPI and DPMOI drill-downs
// (handoff 3.6 and 3.7). Same period rules as the unit paretos — `scopeParams`
// is shared so the views can never drift — but Week and Month only: both
// endpoints refuse `day`, so a Day scope never leaves this file.

/** One bar. Exactly one of the identity keys is set, depending on the chart. */
export type ChainParetoRow = {
  defect?: string;
  component?: string;
  nc?: string;
  /** "" when the defect had no designator on record (label "(no ref_des)"). */
  ref_des?: string;
  label: string;
  /** DPMOI only: the NC master's text, may be null. */
  description?: string | null;
  /** SPI counts components on NG boards; DPMOI counts defects. */
  components?: number;
  defects?: number;
  share_pct?: number;
  cum_pct: number;
  /** "Others" only: how many rows it folds. */
  folded?: number;
};

type Envelope = {
  item: string;
  product_name: string | null;
  top: number;
  period: ReworkPeriod;
};

export type SpiDefectParetoResponse = Envelope & {
  totals: {
    boards_inspected: number;
    ng_boards: number;
    components: number;
    /** Components dropped because their result was a WARNING_… name. */
    warning_components: number;
    distinct_defects: number;
  };
  rows: ChainParetoRow[];
};

export type SpiComponentParetoResponse = Envelope & {
  defect: string;
  defect_label: string;
  totals: { components: number; distinct_components: number };
  rows: ChainParetoRow[];
};

export type DpmoiNcParetoResponse = Envelope & {
  operation: string | null;
  operations: string[];
  totals: {
    boards_inspected: number;
    /** The card's own figure for the same filters; should equal `defects`. */
    card_defects: number;
    defects: number;
    distinct_ncs: number;
  };
  rows: ChainParetoRow[];
};

export type DpmoiComponentParetoResponse = Envelope & {
  nc: string;
  nc_description: string | null;
  totals: { defects: number; distinct_components: number };
  rows: ChainParetoRow[];
};

export type DpmoiRefDesParetoResponse = Envelope & {
  nc: string;
  nc_description: string | null;
  component: string;
  totals: { defects: number; distinct_ref_des: number };
  rows: ChainParetoRow[];
};

const chainUrl = (
  path: string,
  scope: ReworkScope,
  top: number,
  extra: Record<string, string | null | undefined> = {},
) => {
  // Day is a 400 on these endpoints; fall back to Week rather than send it.
  const q = scopeParams(scope.granularity === "day" ? { ...scope, granularity: "week" } : scope);
  q.set("top", String(top));
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  return apiUrl(`${path}?${q}`);
};

// ── SPI (3.6): defect → component ───────────────────────────────────────────

const spiBase = (item: string) => `/rework/spi/products/${encodeURIComponent(item)}/pareto`;

export const useSpiDefectPareto = (item: string, scope: ReworkScope, top: number) =>
  useParetoFetch<SpiDefectParetoResponse>(
    chainUrl(`${spiBase(item)}/defect`, scope, top),
    "SPI defect",
  );

/** Idles until a defect is chosen. A WARNING_… defect is never sent: the API
 *  refuses it. */
export const useSpiComponentPareto = (
  item: string,
  scope: ReworkScope,
  top: number,
  defect: string | null,
) =>
  useParetoFetch<SpiComponentParetoResponse>(
    defect && defect !== "Others" && !/^WARNING/i.test(defect)
      ? chainUrl(`${spiBase(item)}/component`, scope, top, { defect })
      : null,
    "SPI component",
  );

// ── DPMOI (3.7): NC code → component → ref_des ─────────────────────────────

/** Product root. The paretos sit under `pareto/`; the weekly trend does not. */
const dpmoiItem = (item: string) => `/rework/dpmoi/products/${encodeURIComponent(item)}`;
const dpmoiBase = (item: string) => `${dpmoiItem(item)}/pareto`;

export const useDpmoiNcPareto = (
  item: string,
  operation: string | null,
  scope: ReworkScope,
  top: number,
) =>
  useParetoFetch<DpmoiNcParetoResponse>(
    chainUrl(`${dpmoiBase(item)}/nc`, scope, top, { operation }),
    "DPMOI NC",
  );

export const useDpmoiComponentPareto = (
  item: string,
  operation: string | null,
  scope: ReworkScope,
  top: number,
  nc: string | null,
) =>
  useParetoFetch<DpmoiComponentParetoResponse>(
    nc && nc !== "Others"
      ? chainUrl(`${dpmoiBase(item)}/component`, scope, top, { operation, nc })
      : null,
    "DPMOI component",
  );

/** `component` may legitimately be "(unnamed)" — it is clickable and is sent
 *  as-is. Only the "Others" fold is refused. */
export const useDpmoiRefDesPareto = (
  item: string,
  operation: string | null,
  scope: ReworkScope,
  top: number,
  nc: string | null,
  component: string | null,
) =>
  useParetoFetch<DpmoiRefDesParetoResponse>(
    nc && nc !== "Others" && component && component !== "Others"
      ? chainUrl(`${dpmoiBase(item)}/ref-des`, scope, top, { operation, nc, component })
      : null,
    "DPMOI ref_des",
  );

// ── DPMOI (3.7): NC codes by fiscal week ────────────────────────────────────

export type DpmoiNcTrendBucket = {
  /** "WK39". */
  label: string;
  from: string;
  to: string;
  /** A week not reached yet. Kept on the axis, greyed. */
  in_future: boolean;
  /** The bar's total. */
  defects: number;
  /** nc -> defects; a code missing here is 0 that week. */
  by_nc: Record<string, number>;
};

export type DpmoiNcTrendResponse = {
  step: "DPMOI";
  item: string;
  bucket: "week";
  period: ReworkPeriod;
  /** The stack series in drawing order, biggest first: the NC chart's own
   *  top codes plus Others, so the two charts add up to the same totals. */
  ncs: {
    nc: string;
    label: string;
    description: string | null;
    defects: number;
    folded?: number;
  }[];
  buckets: DpmoiNcTrendBucket[];
  /** `defects` equals the NC pareto's totals.defects. */
  totals: { defects: number; distinct_ncs: number };
};

/** One bar per fiscal week, stacked by NC code. Same params as the NC pareto. */
export const useDpmoiNcTrend = (
  item: string,
  operation: string | null,
  scope: ReworkScope,
  top: number,
) =>
  useParetoFetch<DpmoiNcTrendResponse>(
    chainUrl(`${dpmoiItem(item)}/trend/nc`, scope, top, { operation }),
    "DPMOI NC trend",
  );
