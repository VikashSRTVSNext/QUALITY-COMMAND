import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAT } from "../materials";

interface ConveyorProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  length?: number;
  width?: number;
  speed?: number;
  chevrons?: number;
}

/**
 * Belt conveyor: rubber belt + steel side rails + legs, with chevron markers
 * that travel along the belt (useFrame) so the line reads as running, not static.
 * Why: movement is the single strongest cue that a twin is "live".
 */
export const Conveyor = memo(function Conveyor({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  length = 6,
  width = 1.2,
  speed = 1.4,
  chevrons = 5,
}: ConveyorProps) {
  const marks = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (!marks.current) return;
    for (const m of marks.current.children) {
      m.position.z += speed * dt;
      if (m.position.z > length / 2) m.position.z -= length;
    }
  });

  const legY = -0.55;
  return (
    <group position={position} rotation={rotation}>
      {/* belt surface */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow material={MAT.rubber}>
        <boxGeometry args={[width, 0.16, length]} />
      </mesh>
      {/* side rails */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * width) / 2, 0.06, 0]} castShadow material={MAT.metal}>
          <boxGeometry args={[0.12, 0.28, length]} />
        </mesh>
      ))}
      {/* legs */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * width) / 2.6, legY, (sz * length) / 2.6]} castShadow material={MAT.machineDark}>
            <cylinderGeometry args={[0.08, 0.08, 1.1, 8]} />
          </mesh>
        )),
      )}
      {/* travelling chevrons */}
      <group ref={marks}>
        {Array.from({ length: chevrons }, (_, i) => (
          <mesh key={i} position={[0, 0.1, -length / 2 + (i * length) / chevrons]} material={MAT.ledCyan}>
            <boxGeometry args={[width * 0.6, 0.04, 0.18]} />
          </mesh>
        ))}
      </group>
    </group>
  );
});

export default Conveyor;
