import { memo } from "react";
import { MAT } from "../materials";

interface TruckProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  color?: number;
  scale?: number;
}

/**
 * Low-poly logistics truck (trailer + cab + wheels + amber beacon).
 * Reused for parked and patrolling trucks on the loading lane.
 */
export const Truck = memo(function Truck({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = 0x2563eb,
  scale = 1,
}: TruckProps) {
  const wheels: [number, number][] = [
    [-0.75, 1.2], [0.75, 1.2],
    [-0.75, -0.6], [0.75, -0.6],
    [-0.75, -1.6], [0.75, -1.6],
  ];
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* trailer */}
      <mesh position={[0, 0.75, -0.6]} castShadow material={MAT.metal}>
        <boxGeometry args={[1.4, 1.25, 3]} />
      </mesh>
      {/* cab */}
      <mesh position={[0, 0.6, 1.45]} castShadow>
        <boxGeometry args={[1.4, 1.0, 1]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* windshield */}
      <mesh position={[0, 0.85, 1.96]} material={MAT.screen}>
        <boxGeometry args={[1.15, 0.45, 0.05]} />
      </mesh>
      {/* wheels */}
      {wheels.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]} castShadow material={MAT.machineDark}>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 12]} />
        </mesh>
      ))}
      {/* roof beacon */}
      <mesh position={[0, 1.18, 1.45]} material={MAT.ledAmber}>
        <boxGeometry args={[0.2, 0.09, 0.2]} />
      </mesh>
    </group>
  );
});

export default Truck;
