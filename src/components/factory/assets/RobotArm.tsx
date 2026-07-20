import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAT } from "../materials";

interface RobotArmProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  phase?: number;
  scale?: number;
}

/**
 * 6-axis style articulated robot: base + shoulder + two arm links + gripper.
 * Continuously rotates on its base and articulates the elbow (useFrame) so each
 * cell looks like it is actively assembling. `phase` desyncs multiple robots.
 */
export const RobotArm = memo(function RobotArm({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  phase = 0,
  scale = 1,
}: RobotArmProps) {
  const yaw = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const fore = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    if (yaw.current) yaw.current.rotation.y = Math.sin(t * 0.5) * 0.9;
    if (upper.current) upper.current.rotation.x = -0.5 + Math.sin(t * 0.8) * 0.25;
    if (fore.current) fore.current.rotation.x = 0.8 + Math.cos(t * 0.8) * 0.35;
  });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* base */}
      <mesh position={[0, 0.15, 0]} castShadow material={MAT.machineDark}>
        <cylinderGeometry args={[0.42, 0.5, 0.3, 16]} />
      </mesh>
      <group ref={yaw} position={[0, 0.3, 0]}>
        {/* shoulder */}
        <mesh position={[0, 0.15, 0]} castShadow material={MAT.robot}>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow material={MAT.robotJoint}>
          <cylinderGeometry args={[0.16, 0.16, 0.6, 12]} />
        </mesh>
        {/* upper arm */}
        <group ref={upper} position={[0, 0.35, 0]}>
          <mesh position={[0, 0.7, 0]} castShadow material={MAT.robot}>
            <boxGeometry args={[0.28, 1.5, 0.28]} />
          </mesh>
          <mesh position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow material={MAT.robotJoint}>
            <cylinderGeometry args={[0.14, 0.14, 0.5, 12]} />
          </mesh>
          {/* forearm */}
          <group ref={fore} position={[0, 1.45, 0]}>
            <mesh position={[0, 0.55, 0]} castShadow material={MAT.robot}>
              <boxGeometry args={[0.22, 1.2, 0.22]} />
            </mesh>
            {/* gripper */}
            <mesh position={[0, 1.2, 0]} castShadow material={MAT.metal}>
              <boxGeometry args={[0.3, 0.18, 0.3]} />
            </mesh>
            <mesh position={[0, 1.32, 0]} material={MAT.ledCyan}>
              <boxGeometry args={[0.1, 0.1, 0.1]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
});

export default RobotArm;
