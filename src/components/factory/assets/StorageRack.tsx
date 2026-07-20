import { memo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { MAT } from "../materials";

interface StorageRackProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  bays?: number;
  levels?: number;
}

const cartonColors = [0x394a5e, 0x2f3d4e, 0x45566b, 0x33424f];

/**
 * Pallet racking: steel uprights + shelf beams + palletized cartons.
 * Cartons are instanced (single draw call) so a dense warehouse costs almost
 * nothing. Why: verticality + storage density instantly reads as "factory".
 */
export const StorageRack = memo(function StorageRack({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  bays = 3,
  levels = 3,
}: StorageRackProps) {
  const bayW = 1.5;
  const levelH = 1.0;
  const depth = 1.3;
  const totalW = bays * bayW;
  const height = levels * levelH;

  const uprights: [number, number][] = [];
  for (let b = 0; b <= bays; b++) {
    const x = -totalW / 2 + b * bayW;
    uprights.push([x, -depth / 2], [x, depth / 2]);
  }

  const cartons: { pos: [number, number, number]; color: number }[] = [];
  for (let b = 0; b < bays; b++)
    for (let l = 0; l < levels; l++) {
      if (Math.random() < 0.18) continue; // a few empty slots
      const x = -totalW / 2 + bayW * (b + 0.5);
      const y = levelH * (l + 0.5);
      cartons.push({ pos: [x, y, 0], color: cartonColors[(b + l) % cartonColors.length] });
    }

  return (
    <group position={position} rotation={rotation}>
      {/* uprights */}
      {uprights.map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]} castShadow material={MAT.frame}>
          <boxGeometry args={[0.12, height, 0.12]} />
        </mesh>
      ))}
      {/* shelf beams */}
      {Array.from({ length: levels + 1 }, (_, l) => (
        <mesh key={l} position={[0, l * levelH, 0]} castShadow material={MAT.metal}>
          <boxGeometry args={[totalW, 0.08, depth]} />
        </mesh>
      ))}
      {/* cartons (instanced) */}
      <Instances limit={bays * levels} castShadow>
        <boxGeometry args={[bayW * 0.7, levelH * 0.6, depth * 0.7]} />
        <meshStandardMaterial metalness={0.3} roughness={0.7} />
        {cartons.map((c, i) => (
          <Instance key={i} position={c.pos} color={c.color} />
        ))}
      </Instances>
      {/* level status LED strip */}
      <mesh position={[0, height + 0.06, depth / 2]} material={MAT.ledCyan}>
        <boxGeometry args={[totalW * 0.9, 0.05, 0.05]} />
      </mesh>
    </group>
  );
});

export default StorageRack;
