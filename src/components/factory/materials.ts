import * as THREE from "three";

/* ============================================================
   Shared PBR palette + material singletons for the Factory Twin.
   Materials are created ONCE and reused across every asset so the
   renderer batches aggressively (minimal state changes / draw calls).
   ============================================================ */

export const PALETTE = {
  // structure
  platform: 0x0a0f16,
  platformTop: 0x111925,
  walkway: 0x151d29,
  // machines
  machine: 0x2a3546, // blue-gray
  machineDark: 0x1a2230,
  metal: 0x3a4759,
  rubber: 0x0d1218, // conveyor belts
  frame: 0x4a5a6e,
  // accents / emissive
  cyan: 0x2dd4ee,
  green: 0x2fe0a0,
  amber: 0xf5b02e,
  red: 0xf24b5c,
  screen: 0x1b3a4a,
} as const;

const std = (color: number, metalness: number, roughness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });

const emissive = (color: number, intensity: number) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, metalness: 0.2, roughness: 0.4, toneMapped: false });

// Structural
export const MAT = {
  platform: std(PALETTE.platform, 0.85, 0.4),
  platformTop: std(PALETTE.platformTop, 0.7, 0.55),
  walkway: std(PALETTE.walkway, 0.5, 0.75),
  // machine bodies
  machine: std(PALETTE.machine, 0.6, 0.5),
  machineDark: std(PALETTE.machineDark, 0.65, 0.55),
  metal: std(PALETTE.metal, 0.8, 0.35),
  frame: std(PALETTE.frame, 0.75, 0.4),
  rubber: std(PALETTE.rubber, 0.2, 0.85),
  roadPaint: std(0xc4d0dc, 0.05, 0.85), // matte lane markings
  robot: std(0x33404f, 0.7, 0.4),
  robotJoint: std(0xf5b02e, 0.5, 0.5), // amber joints
  // emissive accents (toneMapped:false so Bloom picks them up)
  ledCyan: emissive(PALETTE.cyan, 1.5),
  ledGreen: emissive(PALETTE.green, 1.4),
  ledAmber: emissive(PALETTE.amber, 1.4),
  ledRed: emissive(PALETTE.red, 1.6),
  screen: emissive(PALETTE.cyan, 0.8),
  screenDim: std(PALETTE.screen, 0.3, 0.6, { emissive: PALETTE.cyan, emissiveIntensity: 0.5 }),
} as const;

// Emissive material per health status (for zone borders / status LEDs).
export function statusMat(status: "healthy" | "warning" | "critical"): THREE.MeshStandardMaterial {
  return status === "healthy" ? MAT.ledGreen : status === "warning" ? MAT.ledAmber : MAT.ledRed;
}

export const STATUS_COLOR = {
  healthy: PALETTE.green,
  warning: PALETTE.amber,
  critical: PALETTE.red,
} as const;
