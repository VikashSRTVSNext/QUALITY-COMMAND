import { apiUrl } from "../../core/api/config";
import {
  scopeParams,
  useParetoFetch,
  type ReworkPeriod,
  type ReworkScope,
} from "./useReworkParetos";

// The SPI card's rework paretos (handoff 3.6): which defect types failed the
// boards, then which components carried the one clicked. Same period rules as
// the unit paretos — `scopeParams` is shared so the two can never drift.

type SpiEnvelope = {
  step: "SPI";
  top: number;
  period: ReworkPeriod;
};

export type SpiParetoRow = {
  /** The DefectResultName, e.g. "BRIDGING", or "Others" for the fold. */
  defect?: string;
  /** The ComponentID, "(unnamed)" when the machine gave none, or "Others". */
  component?: string;
  label: string;
  /** One ComponentID on one NG board counts once, however many pins. */
  components: number;
  share_pct?: number;
  cum_pct: number;
  /** "Others" only: how many rows it folds. */
  folded?: number;
};

export type SpiDefectParetoResponse = SpiEnvelope & {
  totals: {
    boards_inspected: number;
    ng_boards: number;
    components: number;
    /** Components dropped because their result was a WARNING_… name. */
    warning_components: number;
    distinct_defects: number;
  };
  rows: SpiParetoRow[];
};

export type SpiComponentParetoResponse = SpiEnvelope & {
  defect: string;
  defect_label: string;
  /** `components` equals the clicked defect bar's. */
  totals: { components: number; distinct_components: number };
  rows: SpiParetoRow[];
};

const spiUrl = (
  chart: "defect" | "component",
  scope: ReworkScope,
  products: string[],
  top: number,
  defect?: string,
) => {
  const q = scopeParams(scope);
  // Repeated, never joined: several products, or a product NAME the API
  // expands to its item codes, same as the dashboard's own filter.
  for (const p of products) q.append("product", p);
  q.set("top", String(top));
  if (defect) q.set("defect", defect);
  return apiUrl(`/rework/spi/pareto/${chart}?${q}`);
};

/** NG-board defects by type for the whole SPI card, or the products given. */
export const useSpiDefectPareto = (
  scope: ReworkScope,
  products: string[],
  top: number,
  enabled = true,
) =>
  useParetoFetch<SpiDefectParetoResponse>(
    enabled ? spiUrl("defect", scope, products, top) : null,
    "SPI defect",
  );

/** The components behind one defect type. Idles until a bar is chosen; a
 *  WARNING_… defect is never sent, because the API refuses it. */
export const useSpiComponentPareto = (
  scope: ReworkScope,
  products: string[],
  top: number,
  defect: string | null,
) =>
  useParetoFetch<SpiComponentParetoResponse>(
    defect && !/^WARNING/i.test(defect)
      ? spiUrl("component", scope, products, top, defect)
      : null,
    "SPI component",
  );
