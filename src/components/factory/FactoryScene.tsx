import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { ZONES, PLATFORM, STATUS_CSS, STATUS_LABEL } from "./zones";
import { Lighting } from "./Lighting";
import { FactoryPlatform } from "./FactoryPlatform";
import { FactoryZone } from "./FactoryZone";
import { ZoneContents } from "./zoneContents";
import { Truck } from "./assets/Truck";
import { NokiaFloorBrand } from "./NokiaFloorBrand";
import { MAT } from "./materials";

/* ---------- loading lane + trucks (one parked, one patrolling) ---------- */
const LANE_Z = PLATFORM.cz + PLATFORM.d / 2 + 3;
const LANE_X0 = PLATFORM.cx - PLATFORM.w / 2 - 4;
const LANE_X1 = PLATFORM.cx + PLATFORM.w / 2 + 4;

const LoadingLane = memo(function LoadingLane() {
  const truck = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!truck.current) return;
    truck.current.position.x += dt * 3;
    if (truck.current.position.x > LANE_X1) truck.current.position.x = LANE_X0;
  });
  const laneLenX = PLATFORM.w + 16;
  const dashes = 16;
  return (
    <group>
      {/* dark asphalt lane along the front edge */}
      <mesh position={[PLATFORM.cx, -0.02, LANE_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={MAT.walkway}>
        <planeGeometry args={[laneLenX, 5]} />
      </mesh>
      {/* dashed centre line */}
      {Array.from({ length: dashes }, (_, i) => {
        const x = PLATFORM.cx - laneLenX / 2 + (i + 0.5) * (laneLenX / dashes);
        return (
          <mesh key={i} position={[x, 0.03, LANE_Z]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.roadPaint}>
            <planeGeometry args={[laneLenX / dashes * 0.55, 0.22]} />
          </mesh>
        );
      })}
      {/* solid edge lines */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[PLATFORM.cx, 0.03, LANE_Z + s * 2.2]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.roadPaint}>
          <planeGeometry args={[laneLenX, 0.12]} />
        </mesh>
      ))}
      {/* patrolling truck (drives along +x, facing travel direction) */}
      <group ref={truck} position={[LANE_X0, 0, LANE_Z]}>
        <Truck rotation={[0, Math.PI / 2, 0]} color={0x2563eb} />
      </group>
      {/* parked truck */}
      <Truck position={[PLATFORM.cx + PLATFORM.w / 2 - 3, 0, LANE_Z]} rotation={[0, Math.PI / 2, 0]} color={0x334760} />
    </group>
  );
});

interface FactorySceneProps {
  selected: string | null;
  onSelect: (id: string) => void;
  preview: boolean;
}

export const FactoryScene = memo(function FactoryScene({ selected, onSelect, preview }: FactorySceneProps) {
  const spin = useRef<THREE.Group>(null);

  // Continuous slow rotation around the plant (spins the whole factory group).
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.06;
  });

  return (
    <>
      <Lighting />

      <group ref={spin} position={[PLATFORM.cx, 0, PLATFORM.cz]}>
        <group position={[-PLATFORM.cx, 0, -PLATFORM.cz]}>
          <FactoryPlatform />
          {ZONES.map((z) => (
            <FactoryZone key={z.id} zone={z} selected={selected === z.id} onSelect={onSelect}>
              <ZoneContents kind={z.kind} />
              {/* floating status label */}
              <Html position={[0, 4.4, 0]} center distanceFactor={preview ? 26 : 20} zIndexRange={[20, 0]} pointerEvents="none">
                <div
                  style={{
                    padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap",
                    background: "rgba(10,16,24,0.88)", backdropFilter: "blur(6px)",
                    border: `1px solid ${selected === z.id ? STATUS_CSS[z.status] : "#243447"}`,
                    fontFamily: "'Segoe UI', system-ui, sans-serif",
                    boxShadow: selected === z.id ? `0 0 16px -2px ${STATUS_CSS[z.status]}` : "0 6px 16px -8px #000",
                  }}
                >
                  <div style={{ color: "#e7eef5", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em" }}>{z.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_CSS[z.status], boxShadow: `0 0 7px ${STATUS_CSS[z.status]}` }} />
                    <span style={{ color: STATUS_CSS[z.status], fontSize: 11, fontWeight: 700 }}>{STATUS_LABEL[z.status]}</span>
                  </div>
                </div>
              </Html>
            </FactoryZone>
          ))}
          <LoadingLane />
          {/* Nokia branding painted flat on the front apron (always readable top-down) */}
          <NokiaFloorBrand
            position={[PLATFORM.cx, 0.12, PLATFORM.cz + PLATFORM.d / 2 - 2.5]}
            width={15}
          />
        </group>
      </group>

      {!preview && (
        <OrbitControls
          target={[PLATFORM.cx, 0, PLATFORM.cz]}
          enablePan={false}
          enableZoom
          minDistance={28}
          maxDistance={90}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.3}
        />
      )}

      <EffectComposer>
        <Bloom intensity={0.3} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </>
  );
});

export default FactoryScene;
