import { Suspense, lazy } from "react";
import type { RankedBarChartProps } from "./RankedBarChart";

const Chart = lazy(() => import("./RankedBarChart"));

/**
 * RankedBarChart with Recharts kept out of the page bundle. Import this one.
 *
 * Shares the Recharts chunk with the other lazy charts, so a screen using
 * several of them pays for the library once.
 */
export const RankedBarChartLazy = (props: RankedBarChartProps) => {
  const rows = Math.min(props.bars.length, props.maxBars ?? 10);
  return (
    <Suspense
      fallback={<div style={{ height: rows * (props.rowHeight ?? 26) + 12 }} />}
    >
      <Chart {...props} />
    </Suspense>
  );
};

export default RankedBarChartLazy;
