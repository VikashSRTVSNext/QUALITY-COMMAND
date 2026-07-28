import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { FactoryScene } from "../factory/FactoryScene";
import { ZONES, STATUS_CSS, STATUS_LABEL, ZoneStatus, ZoneDef } from "../factory/zones";

/* ============================================================
   FACTORY QUALITY TWIN — premium low-poly industrial digital twin.
   React Three Fiber scene (see src/components/factory/*) wrapped with the
   HTML overlay (legend, detail card, preview → maximize).
   Public API unchanged: <FactoryQualityTwin preview onMaximize />.
   ============================================================ */

interface FactoryQualityTwinProps {
  preview?: boolean;
  onMaximize?: () => void;
  zones?: ZoneDef[];
}

const font = "'Segoe UI', system-ui, -apple-system, sans-serif";

export default function FactoryQualityTwin({ preview = false, zones = ZONES }: FactoryQualityTwinProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedZone = zones.find((z) => z.id === selected) || null;

  const handleSelect = (id: string) => {
    if (preview) { return; } // disabled explore view action on preview canvas click
    setSelected((prev) => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        position: "relative", width: "100%",
        height: preview ? "100%" : "100vh", minHeight: preview ? "100%" : 560,
        background: "#060b12", overflow: "hidden", fontFamily: font,
        border: preview ? "none" : "1px solid #1c2a38",
        borderRadius: preview ? 8 : 14, cursor: preview ? "pointer" : "default",
      }}
    >
      <Canvas
        dpr={1}
        camera={{ position: [24, 42, 24], fov: 48, near: 0.5, far: 400 }}
        gl={{ antialias: true, toneMappingExposure: 0.72, powerPreference: "high-performance" }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={["#060b12"]} />
        <Suspense fallback={null}>
          <FactoryScene selected={selected} onSelect={handleSelect} preview={preview} zones={zones} />
        </Suspense>
      </Canvas>

      {/* Header (full mode) */}
      {!preview && (
        <div style={{ position: "absolute", top: 14, left: 18, right: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
          <div>
            <div style={{ color: "#e7eef5", fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Factory Quality Twin
            </div>
            <div style={{ color: "#7f93a6", fontSize: 11.5, marginTop: 3 }}>
              Active Build: X21 · Build 2 &nbsp;·&nbsp; Drag to orbit · Scroll to zoom · Click a zone
            </div>
          </div>
        </div>
      )}

      {/* Preview tag */}
      {preview && (
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(6,10,16,0.75)", backdropFilter: "blur(4px)", padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.15)", pointerEvents: "none" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2dd4ee", boxShadow: "0 0 6px #2dd4ee" }} />
          <span style={{ color: "#7f93a6", fontSize: 10, fontWeight: "bold", letterSpacing: "0.08em" }}>3D DIGITAL TWIN</span>
        </div>
      )}

      {/* Preview click-to-explore overlay commented out for now
      {preview && (
        <div onClick={onMaximize} className="absolute inset-0 bg-transparent hover:bg-[#030712]/20 transition-all duration-300 flex items-center justify-center group">
          <div className="opacity-0 group-hover:opacity-100 bg-[#090f16]/90 border border-[#2dd4ee]/40 text-[#2dd4ee] text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 transition-opacity duration-300">
            <span className="text-[12px]">⛶</span> EXPLORE 3D PLANT FLOOR
          </div>
        </div>
      )}
      */}

      {/* Legend */}
      {!preview && (
        <div style={{ position: "absolute", top: 64, left: 18, background: "rgba(9,15,22,0.85)", border: "1px solid #1c2a38", borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(6px)", pointerEvents: "none" }}>
          <div style={{ color: "#7f93a6", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>Legend</div>
          {(Object.keys(STATUS_CSS) as ZoneStatus[]).map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_CSS[s], boxShadow: `0 0 7px 1px ${STATUS_CSS[s]}` }} />
              <span style={{ color: "#c6d4e2", fontSize: 11.5 }}>{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Detail card */}
      {!preview && selectedZone && (
        <div style={{ position: "absolute", bottom: 16, left: 18, maxWidth: 360, background: "rgba(9,15,22,0.92)", backdropFilter: "blur(8px)", border: `1px solid ${STATUS_CSS[selectedZone.status]}`, borderRadius: 12, padding: "13px 16px", boxShadow: `0 0 26px -6px ${STATUS_CSS[selectedZone.status]}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
            <span style={{ color: "#e7eef5", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em" }}>{selectedZone.name}</span>
            <span style={{ color: STATUS_CSS[selectedZone.status], fontSize: 11.5, fontWeight: 700 }}>
              {STATUS_LABEL[selectedZone.status].toUpperCase()} · {selectedZone.score}
            </span>
          </div>
          <div style={{ color: "#a9bccd", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{selectedZone.detail}</div>
          <button
            onClick={() => setSelected(null)}
            style={{ marginTop: 9, background: "transparent", border: "1px solid #1c2a38", color: "#7f93a6", borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: font }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
