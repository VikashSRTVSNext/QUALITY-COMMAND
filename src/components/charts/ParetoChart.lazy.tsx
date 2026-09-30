import { Suspense, lazy } from "react";
import type { ParetoChartProps } from "./ParetoChart";

const Chart = lazy(() => import("./ParetoChart"));

/**
 * ParetoChart with Recharts kept out of the page bundle. Import this one.
 *
 * Shares the Recharts chunk with the other lazy charts, so a modal that toggles
 * between the ranked bars and this pays for the library once.
 */
export const ParetoChartLazy = (props: ParetoChartProps) => (
  // Reserves the chart's own height plus the caption line, so toggling does not
  // make the panel jump while the chunk loads.
  <Suspense fallback={<div style={{ height: (props.height ?? 190) + 16 }} />}>
    <Chart {...props} />
  </Suspense>
);

export default ParetoChartLazy;
