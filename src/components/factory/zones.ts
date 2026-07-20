// Shared zone data model for the Factory Quality Twin.
// Consumed by both the R3F scene (FactoryScene) and the HTML overlay
// (labels / detail card) so there is a single source of truth.

export type ZoneStatus = "healthy" | "warning" | "critical";

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
};

export const STATUS_CSS: Record<ZoneStatus, string> = {
  healthy: "#2fe0a0",
  warning: "#f5b02e",
  critical: "#f24b5c",
};

export const STATUS_LABEL: Record<ZoneStatus, string> = {
  healthy: "Healthy",
  warning: "At Risk",
  critical: "Critical",
};

// Compact 2-column × 3-row grid so the cells read as one cohesive plant floor.
// (cell 14×11, ~1.5u aisles)
export const ZONES: ZoneDef[] = [
  { id: "smt",        name: "SMT",         status: "healthy",  score: 96, kind: "smt",        x: -7.75, z: -12.5, w: 14, d: 11,
    detail: "SMT placement lines 1–4 · OEE 96% · All feeders nominal" },
  { id: "mft",        name: "MFT",         status: "healthy",  score: 95, kind: "mft",        x:  7.75, z: -12.5, w: 14, d: 11,
    detail: "Module function test · Pass 99.1% · Cp 1.9 / Cpk 1.8" },
  { id: "thermalgel", name: "THERMAL GEL", status: "warning",  score: 79, kind: "thermalgel", x: -7.75, z:  0,    w: 14, d: 11,
    detail: "Thermal gel dispense · Fail% 6.8 · Check nozzle pressure & volume" },
  { id: "rfm",        name: "RFM",         status: "healthy",  score: 93, kind: "rfm",        x:  7.75, z:  0,    w: 14, d: 11,
    detail: "RF module calibration · Pass 98.4% · Signal margins nominal" },
  { id: "testing",    name: "TESTING",     status: "warning",  score: 80, kind: "testing",    x: -7.75, z:  12.5, w: 14, d: 11,
    detail: "Functional test · Pass 97.4% · Torque drift on bench 3" },
  { id: "packaging",  name: "PACKAGING",   status: "critical", score: 71, kind: "packaging",  x:  7.75, z:  12.5, w: 14, d: 11,
    detail: "Final pack & label · 71% first-pass · Ship queue blocked" },
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
