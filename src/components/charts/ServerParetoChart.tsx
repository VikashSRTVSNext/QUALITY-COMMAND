import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { palette } from "../../theme/palette";
import { OTHER_COLOR } from "./seriesPalette";

const CUTOFF_PCT = 80;
const AXIS_TICK = { fill: palette.inkDim, fontSize: 9.5, fontWeight: 700 };

export type ServerParetoBar = {
  key: string;
  /** Axis text. Truncated on the axis, full in the tooltip. */
  label: string;
  value: number;
  /** Cumulative share, 0–100, AS SENT by the server. */
  cumPct: number;
  /** Buckets that are not a cause in their own right — Others, (none),
   *  Uncategorised — drawn grey so they never read as the top defect. */
  muted?: boolean;
  /** Tooltip lines under the title, label → value. */
  details?: [string, string][];
  /** A sentence under the figures (a sample tester comment, say). */
  note?: string | null;
};

export type ServerParetoColors = {
  vital: string;
  tail: string;
  muted: string;
  line: string;
  cutoff: string;
};

/** The dashboard's status colours: red vital few, blue tail, amber line. */
const DEFAULT_COLORS: ServerParetoColors = {
  vital: palette.critical,
  tail: palette.accentRail,
  muted: OTHER_COLOR,
  line: palette.warning,
  cutoff: palette.warning,
};

export type ServerParetoChartProps = {
  bars: ServerParetoBar[];
  /** Left-axis title: "Units", "Events". */
  valueLabel: string;
  height?: number;
  labelChars?: number;
  /** Override the bar / line colours for one screen's own palette. */
  colors?: ServerParetoColors;
};

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * A pareto whose order and cumulative line come from the server.
 *
 * ParetoChart sorts and accumulates on the client, which is right for a log it
 * aggregates itself. The rework endpoints already return pareto order with
 * `cum_pct`, and the category one counts a unit under every cause it was
 * reworked for — so recomputing the cumulative from bar heights here would draw
 * a different line from the figure the API documents. This draws what it is
 * given and nothing else.
 *
 * Vital-few bars (up to and including the one that crosses 80%) are red, the
 * tail dimmed, the muted buckets grey — the same reading as ParetoChart.
 */
export const ServerParetoChart = ({
  bars,
  valueLabel,
  height = 260,
  labelChars = 12,
  colors = DEFAULT_COLORS,
}: ServerParetoChartProps) => {
  const cutoffIndex = bars.findIndex((b) => b.cumPct >= CUTOFF_PCT);
  const vitalCount = cutoffIndex === -1 ? bars.length : cutoffIndex + 1;
  const angled = bars.some((b) => b.label.length > 6) || bars.length > 8;

  const renderTooltip = ({ active, payload }: any) => {
    const b: ServerParetoBar | undefined = active ? payload?.[0]?.payload : undefined;
    if (!b) return null;
    return (
      <div className="bg-panel border border-line-soft rounded-lg px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] max-w-[340px]">
        <div className="text-[11px] font-black text-white break-words">{b.label}</div>
        <div className="mt-1.5 pt-1.5 border-t border-line/60 space-y-0.5 text-[10px] font-mono">
          {[...(b.details ?? []), ["Cumulative", `${b.cumPct.toFixed(1)}%`] as [string, string]].map(
            ([k, v]) => (
              <div key={k} className="flex gap-4 whitespace-nowrap">
                <span className="text-ink-muted">{k}</span>
                <span className="ml-auto text-white font-bold tabular-nums">{v}</span>
              </div>
            ),
          )}
        </div>
        {b.note && (
          <div className="mt-1.5 pt-1.5 border-t border-line/60 text-[10px] text-ink-secondary leading-snug break-words">
            {b.note}
          </div>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={bars} margin={{ top: 18, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={palette.line} strokeDasharray="2 4" />
        <XAxis
          dataKey="label"
          interval={0}
          tick={{ ...AXIS_TICK, ...(angled ? { angle: -32, textAnchor: "end" as const } : {}) }}
          tickFormatter={(v: string) => truncate(String(v), labelChars)}
          height={angled ? 58 : 18}
          tickLine={false}
          axisLine={{ stroke: palette.line }}
        />
        <YAxis
          yAxisId="count"
          allowDecimals={false}
          tick={AXIS_TICK}
          width={40}
          tickLine={false}
          axisLine={false}
          label={{
            value: valueLabel,
            angle: -90,
            position: "insideLeft",
            style: { fill: palette.inkDim, fontSize: 9.5, fontWeight: 700, textAnchor: "middle" },
          }}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={[0, 100]}
          ticks={[0, 25, 50, 80, 100]}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => `${v}%`}
          width={36}
          tickLine={false}
          axisLine={false}
        />
        {bars.length > 1 && (
          <ReferenceLine yAxisId="pct" y={CUTOFF_PCT} stroke={colors.cutoff} strokeDasharray="3 3" strokeOpacity={0.65} />
        )}
        <Tooltip
          cursor={{ fill: palette.white, fillOpacity: 0.04 }}
          isAnimationActive={false}
          wrapperStyle={{ outline: "none", zIndex: 60 }}
          content={renderTooltip}
        />
        <Bar yAxisId="count" dataKey="value" maxBarSize={64} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {bars.map((b, i) => (
            <Cell
              key={b.key}
              fill={b.muted ? colors.muted : i < vitalCount ? colors.vital : colors.tail}
              fillOpacity={b.muted || i < vitalCount ? 0.9 : 0.75}
            />
          ))}
          <LabelList dataKey="value" position="top" fill={palette.inkMuted} fontSize={9.5} fontWeight={700} />
        </Bar>
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="cumPct"
          stroke={colors.line}
          strokeWidth={1.6}
          dot={{ r: 2, fill: colors.line, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default ServerParetoChart;
