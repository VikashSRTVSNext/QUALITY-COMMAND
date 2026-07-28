import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { ZONES, PLATFORM, STATUS_CSS, STATUS_LABEL, ZoneDef } from "./zones";
import { Lighting } from "./Lighting";
import { FactoryPlatform } from "./FactoryPlatform";
import { FactoryZone } from "./FactoryZone";
import { ZoneContents } from "./zoneContents";
import { Truck } from "./assets/Truck";
import { MAT } from "./materials";

/* ---------- loading lane + trucks (one parked, one patrolling) ---------- */
const LANE_Z = PLATFORM.cz + PLATFORM.d / 2 + 3;
const LANE_X0 = PLATFORM.cx - PLATFORM.w / 2 - 4;
const LANE_X1 = PLATFORM.cx + PLATFORM.w / 2 + 3.2; // Right road junction

// Right road boundaries
const ROAD_Z_START = PLATFORM.cz + PLATFORM.d / 2 + 5.5;
const ROAD_Z_END = PLATFORM.cz - PLATFORM.d / 2 - 4;
const ROAD_Z_MID = (ROAD_Z_START + ROAD_Z_END) / 2;
const ROAD_Z_LEN = ROAD_Z_START - ROAD_Z_END;

const LoadingLane = memo(function LoadingLane() {
  const truck = useRef<THREE.Group>(null);
  const segment = useRef(0); // 0 = X travel, 1 = Z travel

  useFrame((_, dt) => {
    if (!truck.current) return;
    
    if (segment.current === 0) {
      // Traveling along X
      truck.current.position.x += dt * 5;
      truck.current.position.z = LANE_Z;
      truck.current.rotation.y = 0; // Face east (+x) due to child Math.PI/2 offset
      
      if (truck.current.position.x >= LANE_X1) {
        truck.current.position.x = LANE_X1;
        segment.current = 1;
      }
    } else {
      // Traveling along Z (going up / north / -z)
      truck.current.position.z -= dt * 5;
      truck.current.position.x = LANE_X1;
      truck.current.rotation.y = Math.PI / 2; // Face north (-z) due to child Math.PI/2 offset
      
      if (truck.current.position.z <= ROAD_Z_END) {
        truck.current.position.z = LANE_Z;
        truck.current.position.x = LANE_X0;
        segment.current = 0;
      }
    }
  });

  const laneLenX = PLATFORM.w + 16;
  const dashes = 16;
  return (
    <group>
      {/* Front road asphalt lane */}
      <mesh position={[PLATFORM.cx, -0.02, LANE_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={MAT.walkway}>
        <planeGeometry args={[laneLenX, 5]} />
      </mesh>
      {/* Front road dashed centre line */}
      {Array.from({ length: dashes }, (_, i) => {
        const x = PLATFORM.cx - laneLenX / 2 + (i + 0.5) * (laneLenX / dashes);
        return (
          <mesh key={i} position={[x, 0.03, LANE_Z]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.roadPaint}>
            <planeGeometry args={[laneLenX / dashes * 0.55, 0.22]} />
          </mesh>
        );
      })}
      {/* Front road solid edge lines */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[PLATFORM.cx, 0.03, LANE_Z + s * 2.2]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.roadPaint}>
          <planeGeometry args={[laneLenX, 0.12]} />
        </mesh>
      ))}

      {/* Right road asphalt lane */}
      <mesh position={[LANE_X1, -0.02, ROAD_Z_MID]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={MAT.walkway}>
        <planeGeometry args={[5, ROAD_Z_LEN]} />
      </mesh>
      {/* Right road dashed centre line */}
      {Array.from({ length: 12 }, (_, i) => {
        const z = ROAD_Z_END + (i + 0.5) * (ROAD_Z_LEN / 12);
        if (z > LANE_Z - 1.5) return null; // Avoid overlapping front road
        return (
          <mesh key={`rz-${i}`} position={[LANE_X1, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.roadPaint}>
            <planeGeometry args={[0.22, (ROAD_Z_LEN / 12) * 0.55]} />
          </mesh>
        );
      })}
      {/* Right road solid edge lines */}
      {[-1, 1].map((s) => (
        <mesh key={`re-${s}`} position={[LANE_X1 + s * 2.2, 0.03, ROAD_Z_MID]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.roadPaint}>
          <planeGeometry args={[0.12, ROAD_Z_LEN]} />
        </mesh>
      ))}

      {/* patrolling truck */}
      <group ref={truck} position={[LANE_X0, 0, LANE_Z]}>
        <Truck rotation={[0, Math.PI / 2, 0]} color={0x2563eb} />
      </group>
      {/* parked truck */}
      <Truck position={[PLATFORM.cx + PLATFORM.w / 2 - 3, 0, LANE_Z]} rotation={[0, Math.PI / 2, 0]} color={0x334760} />
    </group>
  );
});

const OFFSETS: Record<string, { x: number; y: number }> = {
  smt: { x: -135, y: -95 },
  thermalgel: { x: -135, y: -10 },
  testing: { x: -135, y: 75 },
  mft: { x: 135, y: -95 },
  rfm: { x: 135, y: -10 },
  packaging: { x: 135, y: 75 },
};

interface FactorySceneProps {
  selected: string | null;
  onSelect: (id: string) => void;
  preview: boolean;
  zones?: ZoneDef[];
}

export const FactoryScene = memo(function FactoryScene({ selected, onSelect, preview, zones = ZONES }: FactorySceneProps) {
  const spin = useRef<THREE.Group>(null);

  // Disabling automatic continuous rotation to prevent sluggish performance on laptops.
  // useFrame((_, dt) => {
  //   if (spin.current) spin.current.rotation.y += dt * 0.06;
  // });

  return (
    <>
      <Lighting />

      <group ref={spin} position={[PLATFORM.cx, 0, PLATFORM.cz]}>
        <group position={[-PLATFORM.cx, 0, -PLATFORM.cz]}>
          <FactoryPlatform />
          {zones.map((z) => {
            const offset = OFFSETS[z.id] || { x: 0, y: 0 };
            const isLeft = offset.x < 0;
            const connX = isLeft ? offset.x + 50 : offset.x - 50;
            const elbowX = isLeft ? offset.x + 75 : offset.x - 75;
            const connY = offset.y;
            const elbowY = offset.y;

            return (
              <FactoryZone key={z.id} zone={z} selected={selected === z.id} onSelect={onSelect}>
                <ZoneContents kind={z.kind} />
                {/* floating status label with leader lines around the perimeter */}
                <Html position={[0, 1.2, 0]} center distanceFactor={preview ? 32 : 42} zIndexRange={[20, 0]} pointerEvents="none">
                  <div style={{ position: "relative" }}>
                    {/* Leader Line SVG */}
                    <svg
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: 1,
                        height: 1,
                        overflow: "visible",
                        pointerEvents: "none",
                      }}
                    >
                      <polyline
                        points={`0,0 ${elbowX},${elbowY} ${connX},${connY}`}
                        fill="none"
                        stroke={STATUS_CSS[z.status]}
                        strokeWidth={1.5}
                        opacity={0.85}
                      />
                      <circle cx={0} cy={0} r={2.5} fill={STATUS_CSS[z.status]} />
                    </svg>

                    {/* Label Box */}
                    <div
                      style={{
                        position: "absolute",
                        left: offset.x,
                        top: offset.y,
                        transform: "translate(-50%, -50%)",
                        padding: preview ? "6px 12px" : "12px 20px",
                        borderRadius: 8,
                        whiteSpace: "nowrap",
                        background: "rgba(10,16,24,0.92)",
                        backdropFilter: "blur(6px)",
                        border: `1px solid ${selected === z.id ? STATUS_CSS[z.status] : "rgba(255, 255, 255, 0.15)"}`,
                        fontFamily: "'Segoe UI', system-ui, sans-serif",
                        boxShadow: selected === z.id ? `0 0 16px -2px ${STATUS_CSS[z.status]}` : "0 6px 16px -8px #000",
                      }}
                    >
                      <div style={{ color: "#e7eef5", fontSize: preview ? 15 : 18, fontWeight: 800, letterSpacing: "0.06em" }}>{z.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: preview ? 7 : 14, marginTop: preview ? 4 : 14 }}>
                        <span style={{ width: preview ? 8 : 11, height: preview ? 8 : 11, borderRadius: "50%", background: STATUS_CSS[z.status], boxShadow: `0 0 8px ${STATUS_CSS[z.status]}` }} />
                        <span style={{ color: STATUS_CSS[z.status], fontSize: preview ? 12 : 14, fontWeight: 800 }}>{STATUS_LABEL[z.status].toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </Html>
              </FactoryZone>
            );
          })}
          <LoadingLane />
        </group>
      </group>

      {!preview && (
        <OrbitControls
          target={[PLATFORM.cx, 0, PLATFORM.cz]}
          enablePan={false}
          enableZoom
          minDistance={15}
          maxDistance={90}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.3}
        />
      )}
    </>
  );
});

export default FactoryScene;
