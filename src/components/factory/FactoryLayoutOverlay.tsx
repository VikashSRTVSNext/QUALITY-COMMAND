import React, { useState, useEffect, useRef } from "react";
import { Copy, RotateCcw, CheckCircle2 } from "lucide-react";
import {
  LAYOUT_IMAGE,
  STATUS_CSS,
  STATUS_LABEL,
  ZONE_OVERLAYS,
  ZoneDef,
} from "./zones";

import qualityOgLayout from "../../assets/Quality-OG-Layout.png";

interface FactoryLayoutOverlayProps {
  /** Live zones — same array the 3D twin consumes, statuses fed by the SSE feed. */
  zones: ZoneDef[];
  /**
   * `full` draws the reference callouts (name + status, leader line to the room).
   * `compact` draws the outlines with a small chip at each room's centre, for the
   * dashboard card where a callout would be too small to read.
   */
  variant?: "compact" | "full";
  className?: string;
}

const { w: W, h: H } = LAYOUT_IMAGE;

// Rounded-corner polygon, to match the render's soft neon outlines. Each corner
// is cut back by `r` along both of its edges and bridged with a quadratic curve;
// the cut is clamped to half the shorter edge so tight corners never invert.
const roundedPolygonPath = (pts: [number, number][], r: number): string => {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];

    const lenPrev = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) || 1;
    const lenNext = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1;
    const cut = Math.min(r, lenPrev / 2, lenNext / 2);

    const from: [number, number] = [
      cur[0] + ((prev[0] - cur[0]) / lenPrev) * cut,
      cur[1] + ((prev[1] - cur[1]) / lenPrev) * cut,
    ];
    const to: [number, number] = [
      cur[0] + ((next[0] - cur[0]) / lenNext) * cut,
      cur[1] + ((next[1] - cur[1]) / lenNext) * cut,
    ];

    d += i === 0 ? `M ${from[0]} ${from[1]}` : ` L ${from[0]} ${from[1]}`;
    d += ` Q ${cur[0]} ${cur[1]} ${to[0]} ${to[1]}`;
  }
  return `${d} Z`;
};

const centroid = (pts: [number, number][]): [number, number] => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

export const FactoryLayoutOverlay: React.FC<FactoryLayoutOverlayProps> = ({
  zones,
  variant = "full",
  className = "",
}) => {
  const isFull = variant === "full";

  // State for coordinate editing
  const [overlays, setOverlays] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem("custom_zone_overlays");
    let loaded = ZONE_OVERLAYS;
    if (saved) {
      try {
        loaded = JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved overlays:", e);
      }
    }

    // Auto-repair: ensure coordinates are clamped within the viewBox bounds (W=1477, H=1065)
    const repaired = { ...loaded };
    Object.entries(repaired).forEach(([key, val]) => {
      const repairedZone = { ...val };
      repairedZone.poly = val.poly.map(([px, py]: [number, number]) => [
        Math.max(0, Math.min(px, 1477)),
        Math.max(0, Math.min(py, 1065)),
      ]);
      repairedZone.anchor = [
        Math.max(0, Math.min(val.anchor[0], 1477)),
        Math.max(0, Math.min(val.anchor[1], 1065)),
      ];
      repairedZone.label = [
        Math.max(0, Math.min(val.label[0], 1)),
        Math.max(0, Math.min(val.label[1], 1)),
      ];
      repaired[key] = repairedZone;
    });
    return repaired;
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  // Drag state: type can be "poly", "anchor", or "label"
  const [dragState, setDragState] = useState<{
    zoneId: string;
    type: "poly" | "anchor" | "label";
    index?: number;
  } | null>(null);

  // Selected handle for keyboard nudging
  const [selectedHandle, setSelectedHandle] = useState<{
    zoneId: string;
    type: "poly" | "anchor" | "label";
    index?: number;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // State for creating custom zones
  const [showAddForm, setShowAddForm] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneId, setNewZoneId] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleCreateZone = () => {
    const name = newZoneName.trim();
    const id = newZoneId.trim().toLowerCase();

    if (!name) {
      triggerToast("Please enter a zone name.");
      return;
    }
    if (!id) {
      triggerToast("Please enter a unique zone ID.");
      return;
    }
    if (overlays[id]) {
      triggerToast("A zone with this ID already exists.");
      return;
    }

    const newZoneOverlay = {
      name,
      poly: [
        [600, 450],
        [800, 350],
        [1000, 450],
        [800, 550],
      ] as [number, number][],
      anchor: [800, 450] as [number, number],
      label: [0.5, 0.4] as [number, number],
    };

    const nextOverlays = { ...overlays, [id]: newZoneOverlay };
    setOverlays(nextOverlays);
    localStorage.setItem("custom_zone_overlays", JSON.stringify(nextOverlays));
    window.dispatchEvent(new CustomEvent("custom_zone_overlays_updated", { detail: nextOverlays }));

    setActiveZoneId(id);
    setSelectedHandle(null);
    setShowAddForm(false);
    triggerToast(`Zone "${name}" created!`);
  };

  const handleDeleteZone = () => {
    if (!activeZoneId) return;
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }
    const zoneName = overlays[activeZoneId]?.name || activeZoneId.toUpperCase();
    
    const nextOverlays = { ...overlays };
    delete nextOverlays[activeZoneId];
    setOverlays(nextOverlays);
    localStorage.setItem("custom_zone_overlays", JSON.stringify(nextOverlays));
    window.dispatchEvent(new CustomEvent("custom_zone_overlays_updated", { detail: nextOverlays }));

    setActiveZoneId(zones[0]?.id || null);
    setSelectedHandle(null);
    setShowConfirmDelete(false);
    triggerToast(`Zone "${zoneName}" deleted.`);
  };

  useEffect(() => {
    if (showConfirmDelete) {
      const timer = setTimeout(() => setShowConfirmDelete(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmDelete]);

  // Panel dragging state
  const [panelPos, setPanelPos] = useState({ x: 20, y: 350 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const panelDragOffset = useRef({ x: 0, y: 0 });

  // Update initial panel position on edit mode toggle
  useEffect(() => {
    if (isEditMode && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const initialX = 20;
      // Position near bottom left
      const initialY = Math.max(20, rect.height - 430); 
      setPanelPos({ x: initialX, y: initialY });
    }
  }, [isEditMode]);

  const handlePanelDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ("button" in e && e.button !== 0) return;
    
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    panelDragOffset.current = {
      x: clientX - rect.left - panelPos.x,
      y: clientY - rect.top - panelPos.y,
    };
    setIsDraggingPanel(true);
  };

  useEffect(() => {
    if (!isDraggingPanel) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      let newX = e.clientX - rect.left - panelDragOffset.current.x;
      let newY = e.clientY - rect.top - panelDragOffset.current.y;

      newX = Math.max(0, Math.min(newX, rect.width - 360));
      newY = Math.max(0, Math.min(newY, rect.height - 410));

      setPanelPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingPanel(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPanel]);

  useEffect(() => {
    if (!isDraggingPanel) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      let newX = e.touches[0].clientX - rect.left - panelDragOffset.current.x;
      let newY = e.touches[0].clientY - rect.top - panelDragOffset.current.y;

      newX = Math.max(0, Math.min(newX, rect.width - 360));
      newY = Math.max(0, Math.min(newY, rect.height - 410));

      setPanelPos({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      setIsDraggingPanel(false);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDraggingPanel]);

  // Convert mouse/touch coords to SVG viewBox space (W=1477, H=1065)
  const getSVGCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    return [Math.round(x), Math.round(y)];
  };

  const updateCoordinate = (x: number, y: number) => {
    if (!dragState) return;
    const { zoneId, type, index } = dragState;
    
    // Clamp to SVG bounds
    const cx = Math.max(0, Math.min(x, W));
    const cy = Math.max(0, Math.min(y, H));

    const updatedZone = { ...overlays[zoneId] };
    if (type === "poly" && typeof index === "number") {
      const newPoly = [...updatedZone.poly];
      newPoly[index] = [Math.round(cx), Math.round(cy)];
      updatedZone.poly = newPoly;
    } else if (type === "anchor") {
      updatedZone.anchor = [Math.round(cx), Math.round(cy)];
    } else if (type === "label") {
      const lx = Math.min(Math.max(cx / W, 0), 1);
      const ly = Math.min(Math.max(cy / H, 0), 1);
      updatedZone.label = [parseFloat(lx.toFixed(3)), parseFloat(ly.toFixed(3))];
    }

    const nextOverlays = { ...overlays, [zoneId]: updatedZone };
    setOverlays(nextOverlays);
    localStorage.setItem("custom_zone_overlays", JSON.stringify(nextOverlays));
    window.dispatchEvent(new CustomEvent("custom_zone_overlays_updated", { detail: nextOverlays }));
  };

  const nudgeCoordinate = (dx: number, dy: number) => {
    const active = selectedHandle || dragState;
    if (!active) return;
    const { zoneId, type, index } = active;
    
    const updatedZone = { ...overlays[zoneId] };
    if (type === "poly" && typeof index === "number") {
      const newPoly = [...updatedZone.poly];
      const [cx, cy] = newPoly[index];
      const newX = Math.max(0, Math.min(cx + dx, W));
      const newY = Math.max(0, Math.min(cy + dy, H));
      newPoly[index] = [Math.round(newX), Math.round(newY)];
      updatedZone.poly = newPoly;
    } else if (type === "anchor") {
      const [cx, cy] = updatedZone.anchor;
      const newX = Math.max(0, Math.min(cx + dx, W));
      const newY = Math.max(0, Math.min(cy + dy, H));
      updatedZone.anchor = [Math.round(newX), Math.round(newY)];
    } else if (type === "label") {
      const [clx, cly] = updatedZone.label;
      const currentPxX = clx * W;
      const currentPxY = cly * H;
      const lx = Math.min(Math.max((currentPxX + dx) / W, 0), 1);
      const ly = Math.min(Math.max((currentPxY + dy) / H, 0), 1);
      updatedZone.label = [parseFloat(lx.toFixed(3)), parseFloat(ly.toFixed(3))];
    }

    const nextOverlays = { ...overlays, [zoneId]: updatedZone };
    setOverlays(nextOverlays);
    localStorage.setItem("custom_zone_overlays", JSON.stringify(nextOverlays));
    window.dispatchEvent(new CustomEvent("custom_zone_overlays_updated", { detail: nextOverlays }));
  };

  // Keyboard arrow keys handler for micro-adjustments
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditMode || !selectedHandle) return;
    
    let dx = 0;
    let dy = 0;
    const step = e.shiftKey ? 10 : 1;

    switch (e.key) {
      case "ArrowUp":
        dy = -step;
        break;
      case "ArrowDown":
        dy = step;
        break;
      case "ArrowLeft":
        dx = -step;
        break;
      case "ArrowRight":
        dx = step;
        break;
      case "Escape":
        setSelectedHandle(null);
        return;
      default:
        return;
    }

    e.preventDefault();
    nudgeCoordinate(dx, dy);
  };

  // Handle pointer drag listeners on window so dragging is smooth and never gets lost
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const coords = getSVGCoords(e);
      if (coords) {
        updateCoordinate(coords[0], coords[1]);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState]);

  useEffect(() => {
    if (!dragState) return;

    const handleTouchMove = (e: TouchEvent) => {
      const coords = getSVGCoords(e);
      if (coords) {
        updateCoordinate(coords[0], coords[1]);
      }
    };

    const handleTouchEnd = () => {
      setDragState(null);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [dragState]);

  // Clean up confirm reset state
  useEffect(() => {
    if (showConfirmReset) {
      const timer = setTimeout(() => setShowConfirmReset(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmReset]);

  // Synchronize overlays state across all instances on the page in real-time
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setOverlays(customEvent.detail);
      }
    };

    window.addEventListener("custom_zone_overlays_updated", handleUpdate);
    return () => {
      window.removeEventListener("custom_zone_overlays_updated", handleUpdate);
    };
  }, []);

  const selectHandle = (zoneId: string, type: "poly" | "anchor" | "label", index?: number) => {
    setSelectedHandle({ zoneId, type, index });
    if (wrapperRef.current) {
      wrapperRef.current.focus();
    }
  };

  const getUpdatedConfigJS = () => {
    let output = "export const ZONE_OVERLAYS: Record<string, ZoneOverlay> = {\n";
    Object.entries(overlays).forEach(([key, val]) => {
      output += `  ${key}: {\n`;
      output += `    poly: [\n`;
      val.poly.forEach(([px, py]: [number, number]) => {
        output += `      [${px}, ${py}],\n`;
      });
      output += `    ],\n`;
      output += `    anchor: [${val.anchor[0]}, ${val.anchor[1]}],\n`;
      output += `    label: [${val.label[0]}, ${val.label[1]}],\n`;
      if (val.name) {
        output += `    name: "${val.name}",\n`;
      }
      output += `  },\n`;
    });
    output += "};";
    return output;
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(getUpdatedConfigJS());
    triggerToast("Config JSON copied to clipboard!");
  };

  const handleResetDefaults = () => {
    if (!showConfirmReset) {
      setShowConfirmReset(true);
      return;
    }
    localStorage.removeItem("custom_zone_overlays");
    setOverlays(ZONE_OVERLAYS);
    setSelectedHandle(null);
    setShowConfirmReset(false);
    triggerToast("Reset to initial default coordinates.");
    window.dispatchEvent(new CustomEvent("custom_zone_overlays_updated", { detail: ZONE_OVERLAYS }));
  };

  // Map overlays to include live and custom zones
  const drawn = Object.entries(overlays).map(([id, overlay]) => {
    const liveZone = zones.find((z) => z.id === id);
    const zone: ZoneDef = liveZone || {
      id,
      name: overlay.name || id.toUpperCase(),
      status: "unknown",
      score: 0,
      detail: "Custom zone",
      x: 0,
      z: 0,
      w: 10,
      d: 10,
      kind: "smt",
    };
    return { zone, overlay };
  });

  return (
    // The inner box is locked to the image's aspect ratio, so the SVG (image
    // pixels) and the HTML callouts (fractions of the box) land on the same
    // spot at every display size — no letterbox maths anywhere.
    <div
      ref={wrapperRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`relative flex h-full w-full items-center justify-center outline-none ${className}`}
    >
      {/* Edit Mode Toggle Button */}
      {isFull && (
        <button
          onClick={() => {
            setIsEditMode(!isEditMode);
            if (!isEditMode) {
              setActiveZoneId(zones[0]?.id || null);
            } else {
              setSelectedHandle(null);
            }
          }}
          className={`absolute top-4 right-4 z-40 px-3 py-1.5 rounded-lg border text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-lg select-none outline-none ${
            isEditMode
              ? "bg-[#ef4444] hover:bg-[#dc2626] text-white border-[#f87171] shadow-red-500/20"
              : "bg-[#050d17]/95 hover:bg-[#16254c] text-[#38bdf8] border-[#38bdf8]/30 shadow-[#38bdf8]/10 hover:border-[#38bdf8]/60"
          }`}
        >
          {isEditMode ? "Close Editor" : "Edit Overlay"}
        </button>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[#22c55e] text-white text-[12px] font-bold shadow-lg flex items-center gap-1.5 border border-[#4ade80] animate-bounce">
          <CheckCircle2 size={14} />
          {toastMessage}
        </div>
      )}

      <div
        className="relative max-h-full max-w-full"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <img
          src={qualityOgLayout}
          alt="Quality plant floor layout"
          className="w-full h-full select-none rounded-lg block"
          draggable={false}
        />

        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: isEditMode ? "auto" : "none" }}
        >
          {drawn.map(({ zone, overlay }) => {
            const color = STATUS_CSS[zone.status];
            const [ax, ay] = overlay.anchor;
            return (
              <g key={zone.id}>
                <path
                  d={roundedPolygonPath(overlay.poly, 26)}
                  fill={color}
                  fillOpacity={activeZoneId === zone.id && isEditMode ? 0.15 : 0.07}
                  stroke={color}
                  strokeWidth={activeZoneId === zone.id && isEditMode ? 7 : 5}
                  strokeLinejoin="round"
                  className={zone.status === "critical" && !isEditMode ? "animate-pulse" : ""}
                  onClick={isEditMode ? () => {
                    setActiveZoneId(zone.id);
                    setSelectedHandle(null);
                  } : undefined}
                  style={{
                    cursor: isEditMode ? "pointer" : "default",
                    pointerEvents: isEditMode ? "auto" : "none",
                    filter: `drop-shadow(0 0 8px ${color})`,
                  }}
                />
                {isFull && (
                  <>
                    <line
                      x1={overlay.label[0] * W}
                      y1={overlay.label[1] * H}
                      x2={ax}
                      y2={ay}
                      stroke={color}
                      strokeWidth={3}
                      strokeOpacity={0.9}
                      style={{ pointerEvents: "none" }}
                    />
                    <circle cx={ax} cy={ay} r={8} fill={color} style={{ pointerEvents: "none" }} />
                    <circle cx={ax} cy={ay} r={16} fill={color} fillOpacity={0.25} style={{ pointerEvents: "none" }} />
                  </>
                )}
              </g>
            );
          })}

          {/* Draggable Edit Handles */}
          {isEditMode && activeZoneId && (() => {
            const activeZone = zones.find(z => z.id === activeZoneId);
            if (!activeZone) return null;
            const overlay = overlays[activeZoneId];
            if (!overlay) return null;

            const [lax, lay] = [overlay.label[0] * W, overlay.label[1] * H];

            return (
              <g key={`edit-${activeZoneId}`} style={{ pointerEvents: "auto" }}>
                {/* Connection helper line */}
                <line
                  x1={lax}
                  y1={lay}
                  x2={overlay.anchor[0]}
                  y2={overlay.anchor[1]}
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  strokeDasharray="5,5"
                  opacity={0.85}
                  style={{ pointerEvents: "none" }}
                />

                {/* Polygon Vertices Handles */}
                {overlay.poly.map((pt: [number, number], idx: number) => {
                  const isSelected = selectedHandle?.zoneId === activeZoneId && selectedHandle?.type === "poly" && selectedHandle?.index === idx;
                  return (
                    <g key={`poly-handle-${idx}`}>
                      {/* Interactive click/drag area */}
                      <circle
                        cx={pt[0]}
                        cy={pt[1]}
                        r={16}
                        fill="transparent"
                        className="cursor-move"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDragState({ zoneId: activeZoneId, type: "poly", index: idx });
                          selectHandle(activeZoneId, "poly", idx);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          setDragState({ zoneId: activeZoneId, type: "poly", index: idx });
                          selectHandle(activeZoneId, "poly", idx);
                        }}
                      />
                      {/* Visual node */}
                      <circle
                        cx={pt[0]}
                        cy={pt[1]}
                        r={9}
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth={isSelected ? 3.5 : 1.5}
                        style={{ pointerEvents: "none" }}
                      />
                      <text
                        x={pt[0]}
                        y={pt[1] - 15}
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="black"
                        textAnchor="middle"
                        style={{ pointerEvents: "none", filter: "drop-shadow(0 0 3px rgba(0,0,0,0.9))" }}
                      >
                        P{idx + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Anchor Handle */}
                <g>
                  <circle
                    cx={overlay.anchor[0]}
                    cy={overlay.anchor[1]}
                    r={16}
                    fill="transparent"
                    className="cursor-move"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragState({ zoneId: activeZoneId, type: "anchor" });
                      selectHandle(activeZoneId, "anchor");
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setDragState({ zoneId: activeZoneId, type: "anchor" });
                      selectHandle(activeZoneId, "anchor");
                    }}
                  />
                  <circle
                    cx={overlay.anchor[0]}
                    cy={overlay.anchor[1]}
                    r={9}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth={selectedHandle?.type === "anchor" ? 3.5 : 1.5}
                    style={{ pointerEvents: "none" }}
                  />
                  <text
                    x={overlay.anchor[0]}
                    y={overlay.anchor[1] - 15}
                    fill="#10b981"
                    fontSize="11"
                    fontWeight="black"
                    textAnchor="middle"
                    style={{ pointerEvents: "none", filter: "drop-shadow(0 0 3px rgba(0,0,0,0.9))" }}
                  >
                    Anchor
                  </text>
                </g>

                {/* Label Handle */}
                <g>
                  <circle
                    cx={lax}
                    cy={lay}
                    r={16}
                    fill="transparent"
                    className="cursor-move"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragState({ zoneId: activeZoneId, type: "label" });
                      selectHandle(activeZoneId, "label");
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setDragState({ zoneId: activeZoneId, type: "label" });
                      selectHandle(activeZoneId, "label");
                    }}
                  />
                  <circle
                    cx={lax}
                    cy={lay}
                    r={9}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={selectedHandle?.type === "label" ? 3.5 : 1.5}
                    style={{ pointerEvents: "none" }}
                  />
                  <text
                    x={lax}
                    y={lay - 15}
                    fill="#f59e0b"
                    fontSize="11"
                    fontWeight="black"
                    textAnchor="middle"
                    style={{ pointerEvents: "none", filter: "drop-shadow(0 0 3px rgba(0,0,0,0.9))" }}
                  >
                    Label
                  </text>
                </g>
              </g>
            );
          })()}
        </svg>

        {drawn.map(({ zone, overlay }) => {
          const color = STATUS_CSS[zone.status];
          const [cx, cy] = centroid(overlay.poly);
          const [lx, ly] = isFull ? overlay.label : [cx / W, cy / H];

          // A callout's width is screen px while `label` is a fraction of the
          // box, so centring it lets a narrow viewport push it past the edge.
          // Pinning the box by its outward-facing edge instead keeps it inside
          // at any size, and puts the leader line's root under the box — so the
          // line reads as emerging from the side facing the room.
          const pinRight = isFull && lx > 0.5;
          const pos: React.CSSProperties = isFull
            ? pinRight
              ? { right: `${(1 - lx) * 100}%` }
              : { left: `${lx * 100}%` }
            : { left: `${lx * 100}%`, transform: "translate(-50%, -50%)" };

          return (
            <div
              key={zone.id}
              title={zone.detail}
              className={
                isFull
                  ? "absolute -translate-y-1/2 rounded-lg border-2 bg-[#050d17]/95 px-3.5 py-1.5 transition-shadow"
                  : "absolute flex items-center gap-1 rounded border bg-[#050d17]/90 px-1.5 py-[2px]"
              }
              style={{
                ...pos,
                top: `${ly * 100}%`,
                borderColor: color,
                boxShadow: `0 0 14px ${color}55`,
                pointerEvents: isEditMode ? "none" : "auto",
              }}
            >
              {isFull ? (
                <>
                  <div className="whitespace-nowrap text-[13px] font-black uppercase tracking-wider text-white">
                    {zone.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                    />
                    <span
                      className="whitespace-nowrap text-[12px] font-bold"
                      style={{ color }}
                    >
                      {STATUS_LABEL[zone.status]}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                  <span className="whitespace-nowrap text-[8px] font-black uppercase leading-none tracking-wider text-white">
                    {zone.name}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Control Panel */}
      {isEditMode && (
        <div
          className="absolute z-40 p-4 rounded-xl border border-white/10 bg-[#050d17]/95 backdrop-blur-md shadow-2xl flex flex-col gap-3 font-sans select-none text-white text-[12px] animate-fade-in md:w-[360px]"
          style={{
            left: `${panelPos.x}px`,
            top: `${panelPos.y}px`,
          }}
        >
          <div
            className="flex items-center justify-between border-b border-white/10 pb-2 cursor-grab active:cursor-grabbing"
            onMouseDown={handlePanelDragStart}
            onTouchStart={handlePanelDragStart}
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <span className="h-2 w-2 rounded-full bg-[#38bdf8] animate-pulse" />
              <span className="font-black uppercase tracking-wider text-[#38bdf8]">
                Layout Overlay Editor
              </span>
            </div>
            <span className="text-[9px] text-[#8fa0b5] bg-[#1c2e4a] px-1.5 py-0.5 rounded font-bold pointer-events-none">
              Local Auto-Save
            </span>
          </div>

          {/* Active Zone Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[#8fa0b5] font-black uppercase text-[9px] tracking-wider">
              Selected Zone to Edit:
            </label>
            <div className="flex gap-2">
              <select
                value={activeZoneId || ""}
                onChange={(e) => {
                  setActiveZoneId(e.target.value || null);
                  setSelectedHandle(null);
                }}
                className="flex-1 bg-[#101c2b] border border-white/10 rounded px-2.5 py-1.5 text-white font-bold outline-none cursor-pointer text-[12px] hover:border-white/20 transition-colors"
              >
                <option value="">-- Choose zone or click on plant floor --</option>
                {Object.entries(overlays).map(([id, overlay]) => {
                  const live = zones.find((z) => z.id === id);
                  const displayName = live ? live.name : overlay.name || id.toUpperCase();
                  return (
                    <option key={id} value={id}>
                      {displayName} ({id.toUpperCase()})
                    </option>
                  );
                })}
              </select>
              {activeZoneId && (
                showConfirmDelete ? (
                  <button
                    onClick={handleDeleteZone}
                    className="px-2 py-1.5 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold rounded cursor-pointer transition-colors duration-150 text-[10px] uppercase"
                    title="Click again to confirm delete"
                  >
                    Confirm?
                  </button>
                ) : (
                  <button
                    onClick={handleDeleteZone}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 border border-red-600/30 text-white font-bold rounded cursor-pointer transition-colors duration-150 text-[11px]"
                    title="Delete this zone"
                  >
                    🗑️
                  </button>
                )
              )}
            </div>
          </div>

          {/* Add New Zone Form */}
          {!showAddForm ? (
            <button
              onClick={() => {
                setShowAddForm(true);
                setNewZoneName("");
                setNewZoneId("");
              }}
              className="py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-white/10 text-white font-bold rounded cursor-pointer transition-colors duration-150 text-[11px] uppercase tracking-wider"
            >
              + Create Custom Zone
            </button>
          ) : (
            <div className="flex flex-col gap-2 p-2.5 rounded bg-white/5 border border-white/5">
              <div className="text-[#38bdf8] font-black uppercase text-[9px] tracking-wider">
                Create Custom Zone
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[#8fa0b5] text-[9px] uppercase font-bold">Zone Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Warehouse"
                  value={newZoneName}
                  onChange={(e) => {
                    setNewZoneName(e.target.value);
                    setNewZoneId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                  }}
                  className="bg-[#101c2b] border border-white/10 rounded px-2.5 py-1 text-white outline-none focus:border-[#38bdf8]/50 text-[11px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[#8fa0b5] text-[9px] uppercase font-bold">Zone ID (slug):</label>
                <input
                  type="text"
                  placeholder="e.g. warehouse"
                  value={newZoneId}
                  onChange={(e) => setNewZoneId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, ""))}
                  className="bg-[#101c2b] border border-white/10 rounded px-2.5 py-1 text-white outline-none focus:border-[#38bdf8]/50 text-[11px]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreateZone}
                  className="flex-1 py-1 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded cursor-pointer text-[11px] uppercase"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1 bg-[#475569] hover:bg-[#334155] text-white font-bold rounded cursor-pointer text-[11px] uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-[#8fa0b5] leading-relaxed text-[11px] bg-white/5 p-2.5 rounded border border-white/5">
            <p className="font-black text-white uppercase text-[9px] tracking-wider mb-1">🎮 Control Guide:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1 text-[#a3b3c9]">
              <li>Drag <span className="text-[#38bdf8] font-bold">P1 - P4</span> handles to position corners.</li>
              <li>Drag <span className="text-[#10b981] font-bold">Anchor</span> to connect leader line to room.</li>
              <li>Drag <span className="text-[#f59e0b] font-bold">Label</span> to reposition status box.</li>
              <li>Click a handle & press <span className="text-white bg-white/10 px-1 py-0.5 rounded text-[10px]">↑ ↓ ← →</span> to nudge. Hold <span className="text-white bg-white/10 px-1 py-0.5 rounded text-[10px]">Shift</span> to jump 10px.</li>
            </ul>
          </div>

          {/* Code output display */}
          <div className="flex flex-col gap-1">
            <label className="text-[#8fa0b5] font-black uppercase text-[9px] tracking-wider">
              Updated Config JSON (zones.ts):
            </label>
            <div className="relative">
              <textarea
                readOnly
                value={getUpdatedConfigJS()}
                className="w-full h-24 bg-[#020617] border border-white/5 rounded p-2 font-mono text-[9px] text-[#22c55e] resize-none outline-none cursor-pointer"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="absolute bottom-1 right-2 text-[8px] text-[#8fa0b5] bg-black/50 px-1 rounded pointer-events-none">
                Click to Select
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCopyConfig}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0284c7] hover:bg-[#0369a1] active:bg-[#075985] text-white font-black uppercase tracking-wider rounded cursor-pointer transition-colors duration-150 text-[11px]"
            >
              <Copy size={13} />
              Copy Config
            </button>
            {showConfirmReset ? (
              <button
                onClick={handleResetDefaults}
                className="flex-1 flex items-center justify-center py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-black uppercase tracking-wider rounded cursor-pointer transition-colors duration-150 text-[11px]"
              >
                Confirm Reset?
              </button>
            ) : (
              <button
                onClick={handleResetDefaults}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#334155] hover:bg-[#475569] text-white font-bold rounded cursor-pointer transition-colors duration-150 text-[11px]"
                title="Reset to original default coordinates"
              >
                <RotateCcw size={13} />
                Reset Defaults
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FactoryLayoutOverlay;
