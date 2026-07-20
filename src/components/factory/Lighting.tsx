import { memo } from "react";
import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { PLATFORM } from "./zones";

/**
 * Cinematic industrial lighting. Uses a procedural Lightformer environment
 * (no external HDR / CDN — safe for an offline control-room display) to give
 * PBR metals realistic reflections, plus a key/fill/rim rig and soft contact
 * shadows grounding the machinery.
 *
 * Why it improves realism: flat lights make low-poly boxes look like toys.
 * Environment reflections + high-contrast key light + grounded contact shadows
 * are what read as "expensive digital twin" (Omniverse / Siemens look).
 */
export const Lighting = memo(function Lighting() {
  return (
    <>
      <hemisphereLight args={[0x9fc4ff, 0x0a0f16, 0.32]} />
      <ambientLight intensity={0.1} />

      {/* Key light — casts the soft shadows */}
      <directionalLight
        position={[26, 40, 18]}
        intensity={1.25}
        color={0xdcecff}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-32, 32, 32, -32, 0.1, 120]} />
      </directionalLight>

      {/* Cool rim light for edge separation */}
      <directionalLight position={[-30, 18, -24]} intensity={0.32} color={0x2dd4ee} />

      {/* Grounding shadow under the whole plant */}
      <ContactShadows
        position={[PLATFORM.cx, 0.02, PLATFORM.cz]}
        scale={Math.max(PLATFORM.w, PLATFORM.d) * 1.3}
        resolution={512}
        blur={2.6}
        opacity={0.5}
        far={20}
        frames={60}
        color={0x000000}
      />

      {/* Procedural studio environment for reflections (no HDR file) */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={0.7} color={0xbfe0ff} position={[0, 24, 0]} scale={[40, 40, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={0.45} color={0x2dd4ee} position={[-24, 10, -10]} scale={[10, 24, 1]} />
        <Lightformer intensity={0.35} color={0x9fc4ff} position={[24, 8, 12]} scale={[10, 20, 1]} />
        <Lightformer intensity={0.3} color={0xffffff} position={[0, 6, 26]} scale={[30, 8, 1]} />
      </Environment>
    </>
  );
});

export default Lighting;
