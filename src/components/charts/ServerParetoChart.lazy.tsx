import { Suspense, lazy } from "react";
import type { ServerParetoChartProps } from "./ServerParetoChart";

const Chart = lazy(() => import("./ServerParetoChart"));

/**
 * ServerParetoChart with Recharts kept out of the page bundle. Import this one.
 *
 * Shares the Recharts chunk with the other lazy charts.
 */
export const ServerParetoChartLazy = (props: ServerParetoChartProps) => (
  <Suspense fallback={<div style={{ height: props.height ?? 260 }} />}>
    <Chart {...props} />
  </Suspense>
);

export default ServerParetoChartLazy;
