import { memo, useMemo, useRef, ReactNode } from "react";
import * as THREE from "three";
import { ZoneDef, STATUS_HEX } from "./zones";
import { MAT } from "./materials";

interface FactoryZoneProps {
  zone: ZoneDef;
  selected: boolean;
  onSelect: (id: string) => void;
  children?: ReactNode;
}

/**
 * Per-cell health frame: a transparent tinted floor highlight + an emissive
 * perimeter that pulses at a status-dependent rate (calm green → urgent red).
 * Hosts the cell's machine arrangement as children. Handles click-to-select.
 *
 * Why: colour-coded, animated cell outlines are how operators read plant health
 * at a glance on a big wall — and they make each cell feel "alive".
 */
export const FactoryZone = memo(function FactoryZone({ zone, selected, onSelect, children }: FactoryZoneProps) {
  const { x, z, w, d, status } = zone;
  const hex = STATUS_HEX[status];

  // Independent border material: flat matte material to look clean, high premium and minimalist without fluorescent neon glow
  const borderMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: hex, metalness: 0.1, roughness: 0.8 }),
    [hex],
  );
  const floorMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: selected ? 0.12 : 0.06, depthWrite: false }),
    [hex],
  );

  const borderRef = useRef<THREE.Group>(null);
  // Removed pulsing animation loop to save performance and make it look clean/minimalist

  const bt = 0.14; // border thickness
  const by = 0.16;

  return (
    <group position={[x, 0, z]}>
      {/* transparent floor highlight */}
      <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat}>
        <planeGeometry args={[w, d]} />
      </mesh>

      {/* emissive perimeter border */}
      <group ref={borderRef}>
        {[
          [0, -d / 2, w, bt],
          [0, d / 2, w, bt],
          [-w / 2, 0, bt, d],
          [w / 2, 0, bt, d],
        ].map(([px, pz, sw, sd], i) => (
          <mesh key={i} position={[px, by, pz]} material={borderMat}>
            <boxGeometry args={[sw, 0.1, sd]} />
          </mesh>
        ))}
        {/* corner posts */}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={`c${i}`} position={[(sx * w) / 2, 0.35, (sz * d) / 2]} material={borderMat}>
            <boxGeometry args={[0.16, 0.7, 0.16]} />
          </mesh>
        ))}
      </group>

      {/* machine arrangement */}
      {children}

      {/* invisible pick target for click/hover */}
      <mesh
        position={[0, 1, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(zone.id); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        <boxGeometry args={[w, 3, d]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* subtle base plate under the cell */}
      <mesh position={[0, 0.12, 0]} receiveShadow material={MAT.platformTop}>
        <boxGeometry args={[w - 0.3, 0.04, d - 0.3]} />
      </mesh>
    </group>
  );
});

export default FactoryZone;
