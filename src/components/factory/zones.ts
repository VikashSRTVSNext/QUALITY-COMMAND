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
  { id: "smt",        name: "SMT",         status: "unknown",  score: 0, kind: "smt",        x: -7.75, z: -12.5, w: 14, d: 11,
    detail: "SMT placement lines 1–4 · Status unknown" },
  { id: "mft",        name: "MFT",         status: "unknown",  score: 0, kind: "mft",        x:  7.75, z: -12.5, w: 14, d: 11,
    detail: "Module function test · Status unknown" },
  { id: "thermalgel", name: "THERMAL GEL", status: "unknown",  score: 0, kind: "thermalgel", x: -7.75, z:  0,    w: 14, d: 11,
    detail: "Thermal gel dispense · Status unknown" },
  { id: "rfm",        name: "RFM",         status: "unknown",  score: 0, kind: "rfm",        x:  7.75, z:  0,    w: 14, d: 11,
    detail: "RF module calibration · Status unknown" },
  { id: "testing",    name: "TESTING",     status: "unknown",  score: 0, kind: "testing",    x: -7.75, z:  12.5, w: 14, d: 11,
    detail: "Functional test · Status unknown" },
  { id: "packaging",  name: "PACKAGING",   status: "unknown",  score: 0, kind: "packaging",  x:  7.75, z:  12.5, w: 14, d: 11,
    detail: "Final pack & label · Status unknown" },
];

// Platform bounds derived from the zones (+ margin) — used by FactoryPlatform.
export const PLATFORM = (() => {
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
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
