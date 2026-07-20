import { memo, useMemo } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { MAT } from "./materials";

// Same Nokia wordmark path used in the dashboard header.
const NOKIA_PATH =
  "M164.52 1.70304V54.2969H172.407V1.70304H164.52ZM80.2509 0.804622C64.8848 0.804553 52.9624 11.9886 52.9624 28C52.9624 44.7324 64.8848 55.1957 80.2509 55.1954C95.6171 55.1951 107.564 44.7324 107.539 28C107.517 12.8299 95.6171 0.804691 80.2509 0.804622ZM99.6661 28C99.6661 39.8532 90.9737 47.7084 80.2509 47.7084C69.5282 47.7084 60.8357 39.8532 60.8357 28C60.8357 16.3618 69.5282 8.29171 80.2509 8.29171C90.9737 8.29171 99.6661 16.3618 99.6661 28ZM0 4.74601e-06V54.2969H8.04989V18.4143L49.8817 56V44.7427L0 4.74601e-06ZM113.472 28L142.745 54.297H154.483L125.165 28L154.483 1.70302H142.745L113.472 28ZM238 54.2969H229.323L222.978 42.6502H194.239L187.893 54.2969H179.215L189.724 34.8846H218.851L204.327 7.90705L208.608 0L238 54.2969Z";

const SVG_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 238 56"><path d="${NOKIA_PATH}"/></svg>`;

// Painted-metal floor branding: near-white with a faint blue backlight (kept low
// so it reads as painted apron branding rather than a glowing sign).
const FLOOR_MAT = new THREE.MeshStandardMaterial({
  color: 0xeef3fb,
  emissive: 0x1a4fd6,
  emissiveIntensity: 0.22,
  metalness: 0.25,
  roughness: 0.5,
});

interface NokiaFloorBrandProps {
  position?: [number, number, number];
  width?: number;
}

/**
 * Flat Nokia wordmark painted on the platform apron. Lies in the XZ plane so it
 * stays readable from the top-down camera at every rotation angle — always-on
 * branding for the plant. The SVG path is parsed once, extruded thin, centered,
 * scaled to `width`, then laid flat.
 */
export const NokiaFloorBrand = memo(function NokiaFloorBrand({
  position = [0, 0, 0],
  width = 15,
}: NokiaFloorBrandProps) {
  const { geometry, brandW, brandD } = useMemo(() => {
    const data = new SVGLoader().parse(SVG_MARKUP);
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 2, bevelEnabled: false });
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const w = bb.max.x - bb.min.x;
    const h = bb.max.y - bb.min.y;
    geo.translate(-(bb.min.x + w / 2), -(bb.min.y + h / 2), 0);
    geo.scale(1, -1, 1); // SVG y-down → three y-up
    const s = width / w;
    geo.scale(s, s, s);
    return { geometry: geo, brandW: width, brandD: h * s };
  }, [width]);

  return (
    <group position={position}>
      {/* subtle darker apron tile behind the wordmark for contrast */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={MAT.platform}>
        <planeGeometry args={[brandW + 2.5, brandD + 1.6]} />
      </mesh>
      {/* thin cyan accent lines framing the brand */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.05, (s * (brandD + 1.2)) / 2]} material={MAT.ledCyan}>
          <boxGeometry args={[brandW + 2.5, 0.03, 0.08]} />
        </mesh>
      ))}
      {/* flat wordmark (XY logo plane rotated onto the floor) */}
      <mesh geometry={geometry} material={FLOOR_MAT} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow />
    </group>
  );
});

export default NokiaFloorBrand;
