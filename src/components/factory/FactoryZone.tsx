import { memo, useMemo, useRef, ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZoneDef, STATUS_HEX } from "./zones";
import { MAT } from "./materials";

interface FactoryZoneProps {
  zone: ZoneDef;
  selected: boolean;
  onSelect: (id: string) => void;
  children?: ReactNode;
}

const PULSE_SPEED = { healthy: 0.8, warning: 1.5, critical: 2.6 };

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

  // Independent emissive material per zone so each pulses on its own.
  const borderMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 2, toneMapped: false }),
    [hex],
  );
  const floorMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.08, depthWrite: false }),
    [hex],
  );

  const borderRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = 0.5 + 0.5 * Math.sin(t * PULSE_SPEED[status]);
    borderMat.emissiveIntensity = (selected ? 1.5 : 0.95) + p * (status === "critical" ? 0.8 : 0.35);
    floorMat.opacity = (selected ? 0.13 : 0.06) + p * 0.03;
  });

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
