import React from "react";
import {
  LAYOUT_IMAGE,
  STATUS_CSS,
  STATUS_LABEL,
  ZONE_OVERLAYS,
  ZoneDef,
} from "./zones";

import qualityOgLayout from "../../assets/Quality-OG-Layout.png";

interface FactoryLayoutOverlayProps {
  /** Live zones — same array the 3D twin consumes, statuses fed by the SSE feed. */
  zones: ZoneDef[];
  /**
   * `full` draws the reference callouts (name + status, leader line to the room).
   * `compact` draws the outlines with a small chip at each room's centre, for the
   * dashboard card where a callout would be too small to read.
   */
  variant?: "compact" | "full";
  className?: string;
}

const { w: W, h: H } = LAYOUT_IMAGE;

// Rounded-corner polygon, to match the render's soft neon outlines. Each corner
// is cut back by `r` along both of its edges and bridged with a quadratic curve;
// the cut is clamped to half the shorter edge so tight corners never invert.
const roundedPolygonPath = (pts: [number, number][], r: number): string => {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];

    const lenPrev = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) || 1;
    const lenNext = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1;
    const cut = Math.min(r, lenPrev / 2, lenNext / 2);

    const from: [number, number] = [
      cur[0] + ((prev[0] - cur[0]) / lenPrev) * cut,
      cur[1] + ((prev[1] - cur[1]) / lenPrev) * cut,
    ];
    const to: [number, number] = [
      cur[0] + ((next[0] - cur[0]) / lenNext) * cut,
      cur[1] + ((next[1] - cur[1]) / lenNext) * cut,
    ];

    d += i === 0 ? `M ${from[0]} ${from[1]}` : ` L ${from[0]} ${from[1]}`;
    d += ` Q ${cur[0]} ${cur[1]} ${to[0]} ${to[1]}`;
  }
  return `${d} Z`;
};

const centroid = (pts: [number, number][]): [number, number] => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

export const FactoryLayoutOverlay: React.FC<FactoryLayoutOverlayProps> = ({
  zones,
  variant = "full",
  className = "",
}) => {
  const isFull = variant === "full";

  // Only zones the render actually has a room for. A zone the feed sends that
  // isn't on this layout is skipped rather than drawn at the origin.
  const drawn = zones
    .map((zone) => ({ zone, overlay: ZONE_OVERLAYS[zone.id] }))
    .filter((z) => z.overlay);

  return (
    // The inner box is locked to the image's aspect ratio, so the SVG (image
    // pixels) and the HTML callouts (fractions of the box) land on the same
    // spot at every display size — no letterbox maths anywhere.
    <div
      className={`relative flex h-full w-full items-center justify-center ${className}`}
    >
      <div
        className="relative w-full"
        style={{ aspectRatio: `${W} / ${H}`, maxHeight: "100%" }}
      >
        <img
          src={qualityOgLayout}
          alt="Quality plant floor layout"
          className="absolute inset-0 h-full w-full select-none rounded-lg"
          draggable={false}
        />

        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: "none" }}
        >
          {drawn.map(({ zone, overlay }) => {
            const color = STATUS_CSS[zone.status];
            const [ax, ay] = overlay.anchor;
            return (
              <g key={zone.id}>
                <path
                  d={roundedPolygonPath(overlay.poly, 26)}
                  fill={color}
                  fillOpacity={0.07}
                  stroke={color}
                  strokeWidth={5}
                  strokeLinejoin="round"
                  className={zone.status === "critical" ? "animate-pulse" : ""}
                  style={{
                    filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 20px ${color})`,
                  }}
                />
                {isFull && (
                  <>
                    <line
                      x1={overlay.label[0] * W}
                      y1={overlay.label[1] * H}
                      x2={ax}
                      y2={ay}
                      stroke={color}
                      strokeWidth={3}
                      strokeOpacity={0.9}
                    />
                    <circle cx={ax} cy={ay} r={8} fill={color} />
                    <circle cx={ax} cy={ay} r={16} fill={color} fillOpacity={0.25} />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {drawn.map(({ zone, overlay }) => {
          const color = STATUS_CSS[zone.status];
          const [cx, cy] = centroid(overlay.poly);
          const [lx, ly] = isFull ? overlay.label : [cx / W, cy / H];

          // A callout's width is screen px while `label` is a fraction of the
          // box, so centring it lets a narrow viewport push it past the edge.
          // Pinning the box by its outward-facing edge instead keeps it inside
          // at any size, and puts the leader line's root under the box — so the
          // line reads as emerging from the side facing the room.
          const pinRight = isFull && lx > 0.5;
          const pos: React.CSSProperties = isFull
            ? pinRight
              ? { right: `${(1 - lx) * 100}%` }
              : { left: `${lx * 100}%` }
            : { left: `${lx * 100}%`, transform: "translate(-50%, -50%)" };

          return (
            <div
              key={zone.id}
              title={zone.detail}
              className={
                isFull
                  ? "absolute -translate-y-1/2 rounded-lg border-2 bg-[#050d17]/95 px-3.5 py-1.5"
                  : "absolute flex items-center gap-1 rounded border bg-[#050d17]/90 px-1.5 py-[2px]"
              }
              style={{
                ...pos,
                top: `${ly * 100}%`,
                borderColor: color,
                boxShadow: `0 0 14px ${color}55`,
              }}
            >
              {isFull ? (
                <>
                  <div className="whitespace-nowrap text-[13px] font-black uppercase tracking-wider text-white">
                    {zone.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                    />
                    <span
                      className="whitespace-nowrap text-[12px] font-bold"
                      style={{ color }}
                    >
                      {STATUS_LABEL[zone.status]}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                  <span className="whitespace-nowrap text-[8px] font-black uppercase leading-none tracking-wider text-white">
                    {zone.name}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FactoryLayoutOverlay;
