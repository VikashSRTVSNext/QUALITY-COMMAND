import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { palette } from "../../theme/palette";

const AXIS_TICK = { fill: palette.inkDim, fontSize: 9.5, fontWeight: 700 };

export type YieldTrendPoint = {
  key: string;
  /** Axis text: "WK39". */
  label: string;
  /** Tooltip sub-title: the week's dates. */
  range?: string;
  passed: number;
  failed: number;
  tested: number;
  /** null breaks the line: nothing was tested, which is not 0%. */
  fpyPct: number | null;
  belowTarget: boolean | null;
  /** A week not reached yet: kept on the axis, dimmed. */
  future?: boolean;
};

export type YieldTrendColors = {
  passed: string;
  failed: string;
  fpy: string;
  target: string;
  belowTarget: string;
};

export type YieldTrendChartProps = {
  points: YieldTrendPoint[];
  /** null hides the target line. */
  targetPct: number | null;
  colors: YieldTrendColors;
  height?: number;
};

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Boards per week as passed + failed stacked bars (count axis), FPY % as a line
 * on the right axis, and the product's target as a dashed rule.
 *
 * The % axis is not pinned to 0–100: FPY lives in the 80s–90s, and a 0 floor
 * would flatten every week into the same line. It starts a few points under the
 * lowest FPY or target shown.
 */
export const YieldTrendChart = ({
  points,
  targetPct,
  colors,
  height = 260,
}: YieldTrendChartProps) => {
  const pcts = points
    .map((p) => p.fpyPct)
    .filter((v): v is number => typeof v === "number");
  if (targetPct !== null) pcts.push(targetPct);
  const low = pcts.length ? Math.min(...pcts) : 0;
  const floor = Math.max(0, Math.floor((low - 5) / 5) * 5);

  const renderTooltip = ({ active, payload }: any) => {
    const p: YieldTrendPoint | undefined = active ? payload?.[0]?.payload : undefined;
    if (!p) return null;
    const rows: [string, string][] = p.future
      ? []
      : [
          ["Tested", fmt(p.tested)],
          ["Passed", fmt(p.passed)],
          ["Failed", fmt(p.failed)],
          ["FPY", p.fpyPct === null ? "— (nothing tested)" : `${p.fpyPct.toFixed(1)}%`],
        ];
    if (!p.future && targetPct !== null) rows.push(["Target", `${targetPct.toFixed(1)}%`]);
    return (
      <div className="bg-panel border border-line-soft rounded-lg px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
        <div className="text-[11px] font-black text-white">{p.label}</div>
        {p.range && <div className="text-[9.5px] text-ink-dim">{p.range}</div>}
        <div className="mt-1.5 pt-1.5 border-t border-line/60 space-y-0.5 text-[10px] font-mono">
          {p.future ? (
            <div className="text-ink-dim">Not reached yet</div>
          ) : (
            rows.map(([k, v]) => (
              <div key={k} className="flex gap-4 whitespace-nowrap">
                <span className="text-ink-muted">{k}</span>
                <span
                  className="ml-auto font-bold tabular-nums"
                  style={{ color: k === "FPY" && p.belowTarget ? colors.belowTarget : palette.white }}
                >
                  {v}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Red where the week is under target, the line's colour otherwise. A null
  // FPY has no point to draw.
  const renderDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (payload?.fpyPct === null || cx === undefined || cy === undefined) {
      return <g key={`dot-${index}`} />;
    }
    const below = payload.belowTarget === true;
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={below ? 3.5 : 2.5}
        fill={below ? colors.belowTarget : colors.fpy}
        stroke="none"
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={palette.line} strokeDasharray="2 4" />
        <XAxis
          dataKey="label"
          interval={0}
          tick={AXIS_TICK}
          height={18}
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
            value: "Boards",
            angle: -90,
            position: "insideLeft",
            style: { fill: palette.inkDim, fontSize: 9.5, fontWeight: 700, textAnchor: "middle" },
          }}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={[floor, 100]}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => `${v}%`}
          width={38}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: palette.white, fillOpacity: 0.04 }}
          isAnimationActive={false}
          wrapperStyle={{ outline: "none", zIndex: 60 }}
          content={renderTooltip}
        />
        <Bar yAxisId="count" dataKey="passed" stackId="boards" fill={colors.passed} maxBarSize={56} isAnimationActive={false}>
          {points.map((p) => (
            <Cell key={p.key} fillOpacity={p.future ? 0.3 : 0.9} />
          ))}
        </Bar>
        <Bar
          yAxisId="count"
          dataKey="failed"
          stackId="boards"
          fill={colors.failed}
          maxBarSize={56}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        >
          {points.map((p) => (
            <Cell key={p.key} fillOpacity={p.future ? 0.3 : 0.95} />
          ))}
        </Bar>
        {targetPct !== null && (
          <ReferenceLine
            yAxisId="pct"
            y={targetPct}
            stroke={colors.target}
            strokeDasharray="5 4"
            strokeOpacity={0.8}
            label={{
              value: `Target ${targetPct}%`,
              position: "insideTopLeft",
              fill: colors.target,
              fontSize: 9,
              fontWeight: 700,
            }}
          />
        )}
        <Line
          yAxisId="pct"
          type="linear"
          dataKey="fpyPct"
          stroke={colors.fpy}
          strokeWidth={1.8}
          connectNulls={false}
          dot={renderDot}
          activeDot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default YieldTrendChart;
