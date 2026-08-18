// Shared zone data model for the factory quality views.
// Consumed by the 2D plant-layout overlay (FactoryLayoutOverlay) and the
// quality dashboard so there is a single source of truth.

export type ZoneStatus = "healthy" | "warning" | "critical" | "unknown";

export interface ZoneDef {
  id: string;
  name: string;
  status: ZoneStatus;
  score: number;
  detail: string;
}

// Status → CSS colour. Green / amber / red / grey only.
export const STATUS_CSS: Record<ZoneStatus, string> = {
  healthy:  "#2fe0a0",
  warning:  "#f59e0b",
  critical: "#f24b5c",
  unknown:  "#64748b",
};

export const STATUS_LABEL: Record<ZoneStatus, string> = {
  healthy:  "Healthy",
  warning:  "Warning",
  critical: "Critical",
  unknown:  "Unknown",
};

// The six process areas of the plant, in flow order.
export const ZONES: ZoneDef[] = [
  {
    id: "smt",
    name: "SMT",
    status: "healthy",
    score: 100,
    detail: "SMT placement lines 1–4 · Healthy",
  },
  {
    id: "mft",
    name: "MFT",
    status: "healthy",
    score: 100,
    detail: "Module function test · Healthy",
  },
  {
    id: "thermalgel",
    name: "THERMAL GEL",
    status: "healthy",
    score: 100,
    detail: "Thermal gel dispense · Healthy",
  },
  {
    id: "rfm",
    name: "RFM",
    status: "healthy",
    score: 100,
    detail: "RF module calibration · Healthy",
  },
  {
    id: "testing",
    name: "TESTING",
    status: "healthy",
    score: 100,
    detail: "Functional test · Healthy",
  },
  {
    id: "packaging",
    name: "PACKAGING",
    status: "healthy",
    score: 100,
    detail: "Final pack & label · Healthy",
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

// ---------------------------------------------------------------------------
// TIP: You can visually edit, drag, and fine-tune these coordinates in the browser.
// Open the "Quality Plant Floor Layout" modal in the UI, click "Edit Overlay" at the 
// top-right, adjust the handles, and click "Copy Config" to get the updated JSON.
// ---------------------------------------------------------------------------
export const ZONE_OVERLAYS: Record<string, ZoneOverlay> = {
  // Calibrated in the browser with the "Edit Overlay" tool and pasted back here
  // on 2026-08-12, replacing the hand-estimated outlines. This is now the
  // DEFAULT every browser and every machine starts from.
  //
  // Note for future edits: FactoryLayoutOverlay reads
  // localStorage["custom_zone_overlays"] over this object, so on a machine that
  // has been used for calibration the saved copy still wins. "Reset" in the
  // editor clears that key and falls back here.
  //
  // The outlines now overlap by design rather than tiling at a shared vertex —
  // thermalgel runs beneath SMT and RFM wraps around testing, which is what the
  // floor actually looks like. rfm is a 6-point outline for that reason.
  smt: {
    poly: [
      [50, 364],
      [758, 43],
      [924, 126],
      [220, 502],
    ],
    anchor: [400, 277],
    label: [0.087, 0.088],
  },
  mft: {
    poly: [
      [951, 136],
      [1324, 315],
      [1126, 456],
      [761, 255],
    ],
    anchor: [1118, 267],
    label: [0.95, 0.14],
  },
  thermalgel: {
    poly: [
      [672, 292],
      [737, 260],
      [1103, 472],
      [1050, 525],
    ],
    anchor: [854, 361],
    label: [0, 0.546],
  },
  rfm: {
    poly: [
      [267, 562],
      [674, 331],
      [1287, 681],
      [1103, 840],
      [702, 566],
      [421, 700],
    ],
    anchor: [1023, 629],
    label: [0.961, 0.54],
  },
  testing: {
    poly: [
      [339, 816],
      [679, 592],
      [872, 717],
      [505, 972],
    ],
    anchor: [465, 845],
    label: [0.08, 0.71],
  },
  packaging: {
    poly: [
      [790, 781],
      [883, 719],
      [1122, 868],
      [1010, 966],
      [900, 874],
    ],
    anchor: [1028, 863],
    label: [0.96, 0.77],
  },
};
