import { isNum } from "../../core/format";
import { palette } from "../../theme/palette";

interface MetricSparklineProps {
  /** Today's hourly values. Nulls are hours the metric has no reading for. */
  points: (number | null)[];
  /** Yesterday's values, drawn as a faint dashed line. Only used when there
   *  is no target to compare against. */
  yesterdayPoints?: (number | null)[];
  /** Line colour — the caller has already graded the card, so it passes the
   *  grade's colour in rather than this deciding again. */
  stroke: string;
  target?: number | null;
}

// The trend line inside a Process Performance or KPI tile.
//
// With a target, the y-axis is a band centred on the target rather than a fit to
// the data, so the distance from the dashed target line is proportional to the
// size of the miss and two tiles can be compared by eye. Without one, it falls
// back to fitting the data and draws yesterday for reference instead.
export const MetricSparkline = ({
  points,
  yesterdayPoints,
  stroke: strokeColor,
  target,
}: MetricSparklineProps) => {
  const width = 160;
  const height = 16;
  const padding = 2;
  const chartHeight = height - padding * 2;

  const allValids = [...points, ...(yesterdayPoints || [])].filter(
    (v): v is number => typeof v === "number",
  );
  if (allValids.length === 0) return null;

  let min: number;
  let max: number;
  if (isNum(target)) {
    const worstMiss = Math.max(...allValids.map((v) => Math.abs(v - target)));
    const band = Math.max(
      Math.abs(target) * 0.1,
      worstMiss * 1.15,
      Math.abs(target) * 0.01 || 0.01,
    );
    min = target - band;
    max = target + band;
  } else {
    max = Math.max(...allValids);
    min = Math.min(...allValids);
  }
  const range = max - min || 1;

  const yFor = (p: number) =>
    height - padding - ((p - min) / range) * (chartHeight * 0.95);

  const getSvgPoints = (arr: (number | null)[]) => {
    return arr
      .map((p, i) => {
        if (p === null || p === undefined) return null;
        const x = (i / (arr.length - 1)) * width;
        return `${x},${yFor(p)}`;
      })
      .filter((val) => val !== null)
      .join(" ");
  };

  const targetY = isNum(target) ? yFor(target) : null;

  const todayPointsStr = getSvgPoints(points);
  const yesterdayPointsStr = yesterdayPoints
    ? getSvgPoints(yesterdayPoints)
    : "";

  let lastIdx = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i] !== null && points[i] !== undefined) {
      lastIdx = i;
      break;
    }
  }
  const lastVal = lastIdx !== -1 ? points[lastIdx] : null;
  let lastPointCoord = null;
  if (lastIdx !== -1 && lastVal !== null) {
    const x = (lastIdx / (points.length - 1)) * width;
    lastPointCoord = { x, y: yFor(lastVal) };
  }

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {targetY !== null && Number.isFinite(targetY) && (
        <line
          x1="0"
          y1={targetY}
          x2={width}
          y2={targetY}
          stroke={palette.inkMuted}
          strokeWidth="0.4"
          strokeDasharray="3 2"
          className="opacity-70"
        />
      )}
      {targetY === null && yesterdayPointsStr && (
        <polyline
          fill="none"
          stroke={palette.inkDim}
          strokeWidth="0.4"
          strokeDasharray="2 2"
          points={yesterdayPointsStr}
          className="opacity-45 animate-sparkline"
        />
      )}
      {todayPointsStr && (
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.0"
          points={todayPointsStr}
          className="opacity-15 animate-sparkline"
          style={{
            filter: `drop-shadow(0 0 1.5px ${strokeColor})`,
          }}
        />
      )}
      {todayPointsStr && (
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.5"
          points={todayPointsStr}
          className="opacity-95 animate-sparkline"
        />
      )}
      {lastPointCoord && (
        <>
          <circle
            cx={lastPointCoord.x}
            cy={lastPointCoord.y}
            r="1.2"
            fill={strokeColor}
            className="animate-pulse-glow"
            style={{
              transformOrigin: `${lastPointCoord.x}px ${lastPointCoord.y}px`,
              filter: `drop-shadow(0 0 0.8px ${strokeColor})`,
            }}
          />
          <circle
            cx={lastPointCoord.x}
            cy={lastPointCoord.y}
            r="0.6"
            fill={palette.white}
            stroke={strokeColor}
            strokeWidth="0.4"
          />
        </>
      )}
    </svg>
  );
};

export default MetricSparkline;
