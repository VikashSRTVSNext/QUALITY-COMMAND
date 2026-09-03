import { Suspense, lazy } from "react";
import type { StackedBarChartProps } from "./StackedBarChart";

const Chart = lazy(() => import("./StackedBarChart"));

/**
 * StackedBarChart with Recharts kept out of the page bundle. Import this one.
 *
 * Same reasoning as StackedBarStrip.lazy — and it shares that chunk, so a screen
 * using both pays for Recharts once. The fallback reserves the chart's exact
 * height so the panel does not jump when it arrives.
 */
export const StackedBarChartLazy = (props: StackedBarChartProps) => (
  <Suspense
    fallback={
      <div
        style={{ height: props.height ?? 260 }}
        className="flex items-center justify-center text-[11px] font-bold text-ink-dim"
      >
        Loading chart…
      </div>
    }
  >
    <Chart {...props} />
  </Suspense>
);

export default StackedBarChartLazy;
