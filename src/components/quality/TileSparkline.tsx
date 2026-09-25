import { useState } from "react";
import { palette } from "../../theme/palette";

// Trend line inside a Process Performance tile. Hover shows the value and how
// far it sits from target.
//
// One point is one HOUR live and one production DAY under a date range, which is
// why the tooltip's unit is a prop: the shape is identical, but a tooltip that
// says "hr" over a week of daily points is simply wrong.
//
// When a target exists the y-axis is a fixed band centred on the target rather
// than a fit to the data, so a small miss looks small and two tiles can be
// compared by eye.
export const TileSparkline = ({
  points,
  type,
  color,
  target,
  targetDirection,
  bucketLabel = "hr",
}: {
  points: (number | null)[];
  type: string;
  color: string;
  target?: number | null;
  targetDirection?: string | null;
  /** What one point is. "hr" live, "day" over a range. */
  bucketLabel?: string;
}) => {
  const width = 100;
  const height = 24;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const values = points.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (values.length < 2) return null;

  let direction = targetDirection;
  if (!direction) {
    if (type === "failure" || type === "dpmo") {
      direction = "lower";
    } else if (type === "yield") {
      direction = "higher";
    }
  }

  let minVal: number;
  let maxVal: number;

  if (target !== null && target !== undefined) {
    const worstMiss = Math.max(...values.map((v) => Math.abs(v - target)));
    const band = Math.max(
      Math.abs(target) * 0.1,
      worstMiss * 1.15,
      Math.abs(target) * 0.01 || 0.01,
    );
    minVal = target - band;
    maxVal = target + band;
  } else {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.01, 0.01);
    minVal = lo - pad;
    maxVal = hi + pad;
  }

  const paddingY = 3;
  const chartHeight = height - paddingY * 2;
  const range = maxVal - minVal || 1;
  const denom = points.length > 1 ? points.length - 1 : 1;

  let path = "";
  let penDown = false;
  points.forEach((val, i) => {
    if (typeof val !== "number" || !Number.isFinite(val)) {
      penDown = false;
      return;
    }
    const x = (i / denom) * width;
    const y = paddingY + chartHeight - ((val - minVal) / range) * chartHeight;
    path += `${penDown ? " L" : " M"} ${x} ${y}`;
    penDown = true;
  });

  const glowColor = color;

  const targetY =
    target !== null && target !== undefined
      ? paddingY + chartHeight - ((target - minVal) / range) * chartHeight
      : null;

  const hovered =
    hoverIdx !== null && typeof points[hoverIdx] === "number"
      ? (points[hoverIdx] as number)
      : null;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    const ratio = (e.clientX - box.left) / box.width;
    const idx = Math.round(ratio * denom);
    setHoverIdx(Math.min(Math.max(idx, 0), points.length - 1));
  };

  const hoverX = hoverIdx !== null ? (hoverIdx / denom) * width : 0;
  const hoverY =
    hovered !== null
      ? paddingY + chartHeight - ((hovered - minVal) / range) * chartHeight
      : 0;

  const deviation =
    hovered !== null && target !== null && target !== undefined
      ? direction === "lower"
        ? target - hovered
        : hovered - target
      : null;

  return (
    <div className="relative w-full h-full">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {targetY !== null && Number.isFinite(targetY) ? (
          <line
            x1="0"
            y1={targetY}
            x2={width}
            y2={targetY}
            stroke={palette.white}
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.35"
          />
        ) : (
          <line
            x1="0"
            y1={paddingY}
            x2={width}
            y2={paddingY}
            stroke={palette.white}
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.2"
          />
        )}

        <path
          d={path}
          fill="none"
          stroke={glowColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hovered !== null && (
          <>
            <line
              x1={hoverX}
              y1={paddingY}
              x2={hoverX}
              y2={height - paddingY}
              stroke={palette.white}
              strokeWidth="0.5"
              opacity="0.35"
            />
            <circle cx={hoverX} cy={hoverY} r="1.8" fill={glowColor} />
          </>
        )}
      </svg>

      {hovered !== null && (
        <div
          className="absolute -top-7 z-20 px-1.5 py-0.5 rounded bg-panel border border-line whitespace-nowrap pointer-events-none"
          style={{
            left: `${Math.min(Math.max(hoverX, 16), width - 16)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="text-ink-muted text-[8.5px] font-bold uppercase mr-1">
            {bucketLabel}
          </span>
          <span className="text-white text-[9.5px] font-mono font-bold">
            {hovered.toFixed(2)}
            {type === "dpmo" ? "" : "%"}
          </span>
          {deviation !== null && (
            <span
              className="text-[9.5px] font-mono font-bold ml-1"
              style={{
                color: deviation >= 0 ? palette.healthy : palette.critical,
              }}
            >
              {deviation >= 0 ? "+" : ""}
              {deviation.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TileSparkline;
