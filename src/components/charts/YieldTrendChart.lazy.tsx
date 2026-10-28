import { Suspense, lazy } from "react";
import type { YieldTrendChartProps } from "./YieldTrendChart";

const Chart = lazy(() => import("./YieldTrendChart"));

/**
 * YieldTrendChart with Recharts kept out of the page bundle. Import this one.
 *
 * Shares the Recharts chunk with the other lazy charts.
 */
export const YieldTrendChartLazy = (props: YieldTrendChartProps) => (
  <Suspense fallback={<div style={{ height: props.height ?? 260 }} />}>
    <Chart {...props} />
  </Suspense>
);

export default YieldTrendChartLazy;
