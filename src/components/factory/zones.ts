// Shared zone data model for the Factory Quality Twin.
// Consumed by both the R3F scene (FactoryScene) and the HTML overlay
// (labels / detail card) so there is a single source of truth.

export type ZoneStatus = "healthy" | "warning" | "critical" | "unknown";

export interface ZoneDef {
  id: string;
  name: string;
  status: ZoneStatus;
  score: number;
  detail: string;
  /** Footprint on the platform (center x/z, size w/d) in world units. */
  x: number;
  z: number;
  w: number;
  d: number;
  /** Which machine arrangement to render inside the cell. */
  kind: "smt" | "mft" | "thermalgel" | "rfm" | "testing" | "packaging";
}

// Status → hex (numbers for three.js, strings for DOM). Green / amber / red.
export const STATUS_HEX: Record<ZoneStatus, number> = {
  healthy: 0x2fe0a0,
  warning: 0xf5b02e,
  critical: 0xf24b5c,
  unknown: 0x64748b,
};

export const STATUS_CSS: Record<ZoneStatus, string> = {
  healthy: "#2fe0a0",
  warning: "#f5b02e",
  critical: "#f24b5c",
  unknown: "#64748b",
};

export const STATUS_LABEL: Record<ZoneStatus, string> = {
  healthy: "Healthy",
  warning: "At Risk",
  critical: "Critical",
  unknown: "Unknown",
};

// Compact 2-column × 3-row grid so the cells read as one cohesive plant floor.
// (cell 14×11, ~1.5u aisles)
export const ZONES: ZoneDef[] = [
  {
    id: "smt",
    name: "SMT",
    status: "unknown",
    score: 0,
    kind: "smt",
    x: -7.75,
    z: -12.5,
    w: 14,
    d: 11,
    detail: "SMT placement lines 1–4 · Status unknown",
  },
  {
    id: "mft",
    name: "MFT",
    status: "unknown",
    score: 0,
    kind: "mft",
    x: 7.75,
    z: -12.5,
    w: 14,
    d: 11,
    detail: "Module function test · Status unknown",
  },
  {
    id: "thermalgel",
    name: "THERMAL GEL",
    status: "unknown",
    score: 0,
    kind: "thermalgel",
    x: -7.75,
    z: 0,
    w: 14,
    d: 11,
    detail: "Thermal gel dispense · Status unknown",
  },
  {
    id: "rfm",
    name: "RFM",
    status: "unknown",
    score: 0,
    kind: "rfm",
    x: 7.75,
    z: 0,
    w: 14,
    d: 11,
    detail: "RF module calibration · Status unknown",
  },
  {
    id: "testing",
    name: "TESTING",
    status: "unknown",
    score: 0,
    kind: "testing",
    x: -7.75,
    z: 12.5,
    w: 14,
    d: 11,
    detail: "Functional test · Status unknown",
  },
  {
    id: "packaging",
    name: "PACKAGING",
    status: "unknown",
    score: 0,
    kind: "packaging",
    x: 7.75,
    z: 12.5,
    w: 14,
    d: 11,
    detail: "Final pack & label · Status unknown",
  },
];

// ---------------------------------------------------------------------------
// 2D plant-layout overlay (Quality-OG-Layout.png)
//
// The render is a fixed isometric view, so each room can be traced once as a
// polygon in the image's own pixel space and reused at any display size — the
// overlay box always keeps the image's aspect ratio, so these never need
// rescaling. Traced against the 1477x1065 source; the two edge directions are
// the render's isometric axes, u = (1, 0.503) and v = (1, -0.483).
// ---------------------------------------------------------------------------

/** Native pixel size of Quality-OG-Layout.png — the space `poly`/`anchor` live in. */
export const LAYOUT_IMAGE = { w: 1477, h: 1065 };

export interface ZoneOverlay {
  /** Room footprint traced on the render, in LAYOUT_IMAGE pixels. */
  poly: [number, number][];
  /** Where the callout's leader line meets the room, in LAYOUT_IMAGE pixels. */
  anchor: [number, number];
  /**
   * Callout box position, as a fraction of the image box (0..1). Kept in
   * fractions rather than image pixels because the box is HTML — its size is
   * screen px. The x is the box's outward-facing edge (left edge for a zone
   * labelled on the left, right edge on the right), so a narrow viewport can
   * never push it off the image; y is the box's vertical centre.
   */
  label: [number, number];
}

export const ZONE_OVERLAYS: Record<string, ZoneOverlay> = {
  // SMT runs along the north-west wall and MFT along the north-east one; they
  // meet at a single shared vertex, (783, 276), so the two outlines tile rather
  // than cross. The diamond left bare between them and the north corner is the
  // entrance lobby, not a production zone.
  smt: {
    poly: [
      [160, 392],
      [596, 182],
      [783, 276],
      [347, 486],
    ],
    anchor: [400, 277],
    label: [0.08, 0.18],
  },
  mft: {
    poly: [
      [963, 189],
      [1272, 345],
      [1092, 432],
      [783, 276],
    ],
    anchor: [1118, 267],
    label: [0.95, 0.14],
  },
  thermalgel: {
    poly: [
      [335, 527],
      [742, 330],
      [992, 455],
      [585, 652],
    ],
    anchor: [335, 527],
    label: [0.05, 0.47],
  },
  rfm: {
    poly: [
      [1060, 500],
      [1240, 412],
      [1395, 489],
      [1215, 577],
    ],
    anchor: [1240, 412],
    // Pinned to the far right, above the north-east wall: the only clear margin
    // on this side, and it keeps the box clear of the MFT outline.
    label: [0.98, 0.34],
  },
  testing: {
    poly: [
      [380, 745],
      [730, 575],
      [940, 680],
      [590, 850],
    ],
    anchor: [380, 745],
    label: [0.08, 0.71],
  },
  packaging: {
    poly: [
      [860, 700],
      [1100, 580],
      [1280, 670],
      [1040, 790],
    ],
    anchor: [1280, 670],
    label: [0.96, 0.77],
  },
};

// Platform bounds derived from the zones (+ margin) — used by FactoryPlatform.
export const PLATFORM = (() => {
  const b = {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (const z of ZONES) {
    b.minX = Math.min(b.minX, z.x - z.w / 2);
    b.maxX = Math.max(b.maxX, z.x + z.w / 2);
    b.minZ = Math.min(b.minZ, z.z - z.d / 2);
    b.maxZ = Math.max(b.maxZ, z.z + z.d / 2);
  }
  const margin = 4;
  return {
    w: b.maxX - b.minX + margin * 2,
    d: b.maxZ - b.minZ + margin * 2,
    cx: (b.minX + b.maxX) / 2,
    cz: (b.minZ + b.maxZ) / 2,
  };
})();
