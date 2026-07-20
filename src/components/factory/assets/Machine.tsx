import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAT, PALETTE } from "../materials";

interface FanProps {
  position?: [number, number, number];
  radius?: number;
  speed?: number;
}

/* ---------- Rotating cooling fan ---------- */
export const Fan = memo(function Fan({
  position = [0, 0, 0],
  radius = 0.3,
  speed = 6,
}: FanProps) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += speed * dt; });
  return (
    <group position={position}>
      <mesh material={MAT.machineDark}>
        <cylinderGeometry args={[radius + 0.05, radius + 0.05, 0.08, 12]} />
      </mesh>
      <group ref={ref}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]} position={[radius / 2, 0.06, 0]} material={MAT.metal}>
            <boxGeometry args={[radius, 0.02, 0.1]} />
          </mesh>
        ))}
      </group>
    </group>
  );
});

/* ---------- Generic CNC / assembly machine ---------- */
interface MachineProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number, number];
  accent?: number;
  fan?: boolean;
}
export const Machine = memo(function Machine({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size = [1.4, 1.4, 1.4],
  accent = PALETTE.cyan,
  fan = true,
}: MachineProps) {
  const [w, h, d] = size;
  return (
    <group position={position} rotation={rotation}>
      {/* body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow material={MAT.machine}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* darker base */}
      <mesh position={[0, 0.1, 0]} castShadow material={MAT.machineDark}>
        <boxGeometry args={[w + 0.1, 0.2, d + 0.1]} />
      </mesh>
      {/* angled HMI screen */}
      <mesh position={[0, h * 0.7, d / 2 + 0.02]} rotation={[-0.35, 0, 0]} material={MAT.screen}>
        <boxGeometry args={[w * 0.5, h * 0.3, 0.04]} />
      </mesh>
      {/* status beacon */}
      <mesh position={[w / 2 - 0.12, h + 0.12, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.22, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {/* cyan trim strip */}
      <mesh position={[0, h * 0.28, d / 2 + 0.01]} material={MAT.ledCyan}>
        <boxGeometry args={[w * 0.8, 0.05, 0.02]} />
      </mesh>
      {fan && <Fan position={[0, h + 0.04, 0]} radius={Math.min(w, d) * 0.22} speed={5 + w} />}
    </group>
  );
});

/* ---------- Inspection table with travelling scan light ---------- */
interface InspectionTableProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  length?: number;
}
export const InspectionTable = memo(function InspectionTable({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  length = 2.4,
}: InspectionTableProps) {
  const scan = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (scan.current) scan.current.position.z = Math.sin(state.clock.elapsedTime * 1.5) * (length / 2 - 0.2);
  });
  return (
    <group position={position} rotation={rotation}>
      {/* table */}
      <mesh position={[0, 0.75, 0]} castShadow material={MAT.metal}>
        <boxGeometry args={[1.3, 0.1, length]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.55, 0.37, (sz * length) / 2.4]} material={MAT.machineDark}>
            <boxGeometry args={[0.1, 0.75, 0.1]} />
          </mesh>
        )),
      )}
      {/* gantry */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.6, 1.2, 0]} material={MAT.frame}>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
        </mesh>
      ))}
      <mesh position={[0, 1.65, 0]} material={MAT.frame}>
        <boxGeometry args={[1.4, 0.12, 0.12]} />
      </mesh>
      {/* travelling scan light */}
      <mesh ref={scan} position={[0, 1.55, 0]} material={MAT.ledCyan}>
        <boxGeometry args={[1.2, 0.04, 0.06]} />
      </mesh>
    </group>
  );
});

interface LedScreenProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
}

/* ---------- Standing LED info screen ---------- */
export const LedScreen = memo(function LedScreen({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size = [1.6, 0.9],
}: LedScreenProps) {
  const [w, h] = size;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, h / 2, 0]} castShadow material={MAT.machineDark}>
        <boxGeometry args={[w + 0.1, h + 0.1, 0.08]} />
      </mesh>
      <mesh position={[0, h / 2, 0.06]} material={MAT.screen}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[0, 0, 0]} material={MAT.machineDark}>
        <cylinderGeometry args={[0.06, 0.08, 0.6, 8]} />
      </mesh>
    </group>
  );
});

interface PipesProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  length?: number;
  count?: number;
}

/* ---------- Pipe run ---------- */
export const Pipes = memo(function Pipes({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  length = 4,
  count = 3,
}: PipesProps) {
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[0, 0.3 + i * 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow material={MAT.metal}>
          <cylinderGeometry args={[0.08, 0.08, length, 10]} />
        </mesh>
      ))}
    </group>
  );
});
