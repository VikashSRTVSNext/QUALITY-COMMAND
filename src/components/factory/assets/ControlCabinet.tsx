import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAT, PALETTE } from "../materials";

interface ControlCabinetProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  units?: number;
}

/**
 * Electrical / control cabinet row with a blinking status-LED panel.
 * Each LED gets its own lightweight material so they blink out of phase
 * (updated in a single useFrame). Why: idle blinking panels are pure "live plant".
 */
export const ControlCabinet = memo(function ControlCabinet({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  units = 3,
}: ControlCabinetProps) {
  const unitW = 0.9;
  const h = 2.2;
  const totalW = units * unitW;

  // one small emissive material per LED so they can blink independently
  const leds = useMemo(
    () =>
      Array.from({ length: units * 3 }, (_, i) => ({
        mat: new THREE.MeshStandardMaterial({
          color: i % 3 === 0 ? PALETTE.green : i % 3 === 1 ? PALETTE.cyan : PALETTE.amber,
          emissive: i % 3 === 0 ? PALETTE.green : i % 3 === 1 ? PALETTE.cyan : PALETTE.amber,
          emissiveIntensity: 2,
          toneMapped: false,
        }),
        phase: i * 1.7,
        speed: 2 + (i % 4),
      })),
    [units],
  );
  const ledRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    leds.forEach((led, i) => {
      const m = ledRefs.current[i]?.material as THREE.MeshStandardMaterial | undefined;
      if (m) m.emissiveIntensity = 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(t * led.speed + led.phase));
    });
  });

  return (
    <group position={position} rotation={rotation}>
      {/* cabinet bodies */}
      {Array.from({ length: units }, (_, u) => {
        const x = -totalW / 2 + unitW * (u + 0.5);
        return (
          <group key={u}>
            <mesh position={[x, h / 2, 0]} castShadow material={MAT.machine}>
              <boxGeometry args={[unitW * 0.94, h, 0.7]} />
            </mesh>
            {/* door seam */}
            <mesh position={[x, h / 2, 0.36]} material={MAT.machineDark}>
              <boxGeometry args={[unitW * 0.8, h * 0.9, 0.02]} />
            </mesh>
            {/* handle */}
            <mesh position={[x + unitW * 0.3, h / 2, 0.4]} material={MAT.metal}>
              <boxGeometry args={[0.05, 0.35, 0.06]} />
            </mesh>
          </group>
        );
      })}
      {/* LED panel */}
      {leds.map((led, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = -totalW / 2 + unitW * (row + 0.5) - 0.18 + col * 0.18;
        return (
          <mesh
            key={i}
            ref={(el) => { ledRefs.current[i] = el; }}
            position={[x, h - 0.35, 0.38]}
            material={led.mat}
          >
            <boxGeometry args={[0.08, 0.08, 0.04]} />
          </mesh>
        );
      })}
    </group>
  );
});

export default ControlCabinet;
