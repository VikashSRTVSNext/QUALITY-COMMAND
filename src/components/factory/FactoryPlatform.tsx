import { memo } from "react";
import { Grid } from "@react-three/drei";
import { MAT } from "./materials";
import { PLATFORM } from "./zones";

/**
 * Raised industrial platform the whole plant sits on.
 * Beveled base (base slab + inset top cap leaves a chamfer rim), metallic PBR
 * surface, a subtle blueprint grid, a glowing cyan perimeter strip, an
 * industrial outer border, and maintenance walkways down the aisles.
 *
 * Why: a single grounded plinth turns six separate cells into one cohesive
 * "miniature smart factory" object instead of blocks floating on a plane.
 */
export const FactoryPlatform = memo(function FactoryPlatform() {
  const { w, d, cx, cz } = PLATFORM;
  const bT = 0.35; // perimeter strip thickness

  return (
    <group position={[cx, 0, cz]}>
      {/* Beveled base: main slab + slightly larger foot for the chamfer read */}
      <mesh position={[0, -1.1, 0]} receiveShadow castShadow material={MAT.platform}>
        <boxGeometry args={[w + 1.4, 0.6, d + 1.4]} />
      </mesh>
      <mesh position={[0, -0.55, 0]} receiveShadow material={MAT.platform}>
        <boxGeometry args={[w, 1.0, d]} />
      </mesh>
      {/* Inset top surface (chamfer rim visible around it) */}
      <mesh position={[0, 0.02, 0]} receiveShadow material={MAT.platformTop}>
        <boxGeometry args={[w - 1.2, 0.16, d - 1.2]} />
      </mesh>

      {/* Blueprint grid on the deck */}
      <Grid
        position={[0, 0.11, 0]}
        args={[w - 1.2, d - 1.2]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={0x1d2b3a}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={0x27506a}
        fadeDistance={90}
        fadeStrength={1.5}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Maintenance walkways (lighter strips) down the central + cross aisles */}
      <mesh position={[0, 0.12, 0]} material={MAT.walkway}>
        <boxGeometry args={[1.6, 0.06, d - 1.6]} />
      </mesh>
      {[-6.25, 6.25].map((z) => (
        <mesh key={z} position={[0, 0.12, z]} material={MAT.walkway}>
          <boxGeometry args={[w - 1.6, 0.06, 1.6]} />
        </mesh>
      ))}

      {/* Glowing cyan perimeter strip on the top rim */}
      {[
        [0, -(d / 2) + 0.2, w, bT],
        [0, (d / 2) - 0.2, w, bT],
        [-(w / 2) + 0.2, 0, bT, d],
        [(w / 2) - 0.2, 0, bT, d],
      ].map(([px, pz, sw, sd], i) => (
        <mesh key={i} position={[px, 0.14, pz]} material={MAT.ledCyan}>
          <boxGeometry args={[sw, 0.08, sd]} />
        </mesh>
      ))}

      {/* Industrial outer border (raised dark frame) */}
      {[
        [0, -(d / 2), w + 1.4, 0.5],
        [0, (d / 2), w + 1.4, 0.5],
        [-(w / 2), 0, 0.5, d + 1.4],
        [(w / 2), 0, 0.5, d + 1.4],
      ].map(([px, pz, sw, sd], i) => (
        <mesh key={`b${i}`} position={[px, -0.2, pz]} material={MAT.frame} castShadow>
          <boxGeometry args={[sw, 1.2, sd]} />
        </mesh>
      ))}
    </group>
  );
});

export default FactoryPlatform;
