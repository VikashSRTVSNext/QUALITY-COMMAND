import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { palette } from "../../theme/palette";
import { OTHER_COLOR } from "./seriesPalette";

export type RankedBar = {
  key: string;
  label: string;
  value: number;
  /** Falls back to the neutral colour. Pass the SERIES colour when this list
   *  sits beside a chart that uses the same entities, so the two read as one
   *  picture and the list doubles as that chart's legend. */
  color?: string;
  /** Second line in the tooltip. */
  hint?: string;
};

export type RankedBarChartProps = {
  /** Pre-sorted by the caller — the order is the answer, so this component does
   *  not impose one. */
  bars: RankedBar[];
  unit?: string;
  /** Row height. The chart's own height is derived from it and the row count, so
   *  ten bars are ten readable rows rather than ten slivers. */
  rowHeight?: number;
  /** Rows past this many fold into one "Other" bar. */
  maxBars?: number;
  /** Width reserved for the labels on the left. */
  labelWidth?: number;
  onBarClick?: (key: string) => void;
  emptyLabel?: string;
  className?: string;
};

/**
 * A ranked horizontal bar list — "who contributed most", answered by length.
 *
 * Horizontal because the labels are names (tester ids, product codes, NC codes):
 * names read straight across at full length, where a vertical bar chart has to
 * tilt or truncate them. Vertical bars are for an ordered dimension like time.
 *
 * The value is direct-labelled at the end of every bar, which is the one place
 * labelling every mark is right: there are few rows, the numbers are the point,
 * and it removes the axis entirely.
 */
export const RankedBarChart = ({
  bars,
  unit = "",
  rowHeight = 26,
  maxBars = 10,
  labelWidth = 104,
  onBarClick,
  emptyLabel = "Nothing to rank",
  className = "",
}: RankedBarChartProps) => {
  const head = bars.slice(0, maxBars);
  const tail = bars.slice(maxBars);

  const rows = head.map((b) => ({ ...b }));
  // Summed, not dropped: a ranked list that silently ends understates the whole.
  if (tail.length > 0) {
    rows.push({
      key: "__other__",
      label: `Other (${tail.length})`,
      value: tail.reduce((acc, b) => acc + b.value, 0),
      color: OTHER_COLOR,
      hint: `${tail.length} more, each below the bars shown`,
    });
  }

  if (rows.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-[11px] font-bold text-ink-dim py-8 ${className}`}
      >
        {emptyLabel}
      </div>
    );
  }

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as RankedBar | undefined;
    if (!row) return null;
    return (
      <div className="bg-panel border border-line-soft rounded-lg px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] max-w-[260px]">
        <div className="flex items-center gap-2 text-[11px] whitespace-nowrap">
          <span
            className="w-2 h-2 rounded-sm flex-shrink-0"
            style={{ backgroundColor: row.color ?? OTHER_COLOR }}
          />
          <span className="font-mono font-black text-white">{row.label}</span>
          <span className="ml-auto font-mono font-bold text-ink-muted tabular-nums">
            {row.value}
            {unit}
          </span>
        </div>
        {row.hint && (
          <div className="text-[10px] text-ink-dim leading-snug mt-1">
            {row.hint}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <ResponsiveContainer
        width="100%"
        // Derived, not fixed: rows must not compress as the list grows.
        height={rows.length * rowHeight + 12}
      >
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 34, bottom: 4, left: 0 }}
          barCategoryGap="26%"
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tick={{
              fill: palette.inkMuted,
              fontSize: 10,
              fontWeight: 700,
            }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: palette.white, fillOpacity: 0.04 }}
            isAnimationActive={false}
            wrapperStyle={{ outline: "none", zIndex: 60 }}
            content={renderTooltip}
          />
          <Bar
            dataKey="value"
            isAnimationActive={false}
            radius={[0, 4, 4, 0]}
            cursor={onBarClick ? "pointer" : "default"}
            onClick={(_: unknown, index: number) => {
              const row = rows[index];
              if (row && row.key !== "__other__") onBarClick?.(row.key);
            }}
          >
            {rows.map((r) => (
              <Cell key={r.key} fill={r.color ?? OTHER_COLOR} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              offset={6}
              fill={palette.inkMuted}
              fontSize={10}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RankedBarChart;
