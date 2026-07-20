import { memo, FC } from "react";
import { ZoneDef, STATUS_HEX } from "./zones";
import { Conveyor } from "./assets/Conveyor";
import { StorageRack } from "./assets/StorageRack";
import { RobotArm } from "./assets/RobotArm";
import { ControlCabinet } from "./assets/ControlCabinet";
import { Machine, InspectionTable, LedScreen, Pipes } from "./assets/Machine";

/* Machine arrangements per zone kind. Local coords are centered on the cell
   (x ∈ ~[-6,6], z ∈ ~[-4.5,4.5]). SMT is fully detailed in Phase 1; the other
   cells get lighter, kind-appropriate placeholders to be built out in Phase 2. */

// ---- SMT: two placement lines, ovens, robots, cabinets, rack, screens ----
const Smt = () => (
  <group>
    {[-3.2, 2.2].map((lx, li) => (
      <group key={li}>
        <Conveyor position={[lx, 0.9, 0]} length={9} width={1.1} speed={1.6} />
        {/* placement / print machines straddling the belt */}
        {[-3, 0, 3].map((z, i) => (
          <Machine key={`m${i}`} position={[lx - 1.5, 0, z]} size={[1.3, 1.5, 1.3]} accent={STATUS_HEX.healthy} />
        ))}
        {/* reflow ovens on the other side */}
        {[-2, 2].map((z, i) => (
          <Machine key={`o${i}`} position={[lx + 1.6, 0, z]} size={[1.5, 1.2, 2.2]} accent={0x2dd4ee} fan={false} />
        ))}
        {/* loader robot at the head of each line */}
        <RobotArm position={[lx, 0, -4.2]} scale={0.7} phase={li * 2} />
      </group>
    ))}
    {/* control cabinets along the back */}
    <ControlCabinet position={[-3, 0, 4.3]} units={3} />
    <ControlCabinet position={[3, 0, 4.3]} units={2} />
    {/* storage rack + screen at the edges */}
    <StorageRack position={[-6, 0, 1]} rotation={[0, Math.PI / 2, 0]} bays={3} levels={3} />
    <LedScreen position={[5.6, 0, -3.5]} rotation={[0, -Math.PI / 4, 0]} size={[1.4, 0.8]} />
    <Pipes position={[0, 0, 5]} length={12} count={3} />
  </group>
);

// ---- MFT: inspection benches + screens ----
const Mft = () => (
  <group>
    {[-3, 0, 3].map((x, i) => (
      <InspectionTable key={i} position={[x, 0, -1]} length={2.6} />
    ))}
    <ControlCabinet position={[0, 0, 4]} units={4} />
    <LedScreen position={[-5, 0, 3]} rotation={[0, Math.PI / 5, 0]} />
    <RobotArm position={[4.5, 0, 2]} scale={0.65} phase={1.3} />
  </group>
);

// ---- Thermal Gel: dispense machines + pipe runs ----
const ThermalGel = () => (
  <group>
    <Conveyor position={[0, 0.9, 0]} length={9} width={1.3} speed={1.1} />
    {[-3, 0, 3].map((z, i) => (
      <Machine key={i} position={[-2, 0, z]} size={[1.4, 1.6, 1.4]} accent={STATUS_HEX.warning} />
    ))}
    <Pipes position={[2.5, 0, 0]} rotation={[0, Math.PI / 2, 0]} length={9} count={4} />
    <ControlCabinet position={[4, 0, -3]} units={2} />
    <LedScreen position={[5, 0, 3]} rotation={[0, -Math.PI / 4, 0]} />
  </group>
);

// ---- RFM: calibration machines + robot ----
const Rfm = () => (
  <group>
    {[-3.5, 0, 3.5].map((x, i) => (
      <Machine key={i} position={[x, 0, -2]} size={[1.5, 1.4, 1.5]} accent={0x2dd4ee} />
    ))}
    <RobotArm position={[-3, 0, 2.5]} scale={0.7} />
    <RobotArm position={[3, 0, 2.5]} scale={0.7} phase={2.1} />
    <ControlCabinet position={[0, 0, 4.2]} units={3} />
    <StorageRack position={[6, 0, 0]} rotation={[0, -Math.PI / 2, 0]} bays={2} levels={3} />
  </group>
);

// ---- Testing: inspection tables + screen wall ----
const Testing = () => (
  <group>
    {[-3.5, -1, 1.5, 4].map((x, i) => (
      <InspectionTable key={i} position={[x, 0, 0]} length={3} />
    ))}
    <LedScreen position={[0, 0, -4.2]} size={[2.2, 1]} />
    <ControlCabinet position={[0, 0, 4.2]} units={4} />
  </group>
);

// ---- Packaging: out-feed conveyor + pallet racks + boxes ----
const Packaging = () => (
  <group>
    <Conveyor position={[-1, 0.9, 0]} length={9} width={1.4} speed={1.9} />
    <StorageRack position={[4, 0, -2]} bays={2} levels={2} />
    <StorageRack position={[4, 0, 2]} bays={2} levels={2} />
    <Machine position={[-4.5, 0, -2]} size={[1.6, 1.5, 1.6]} accent={STATUS_HEX.critical} />
    <Machine position={[-4.5, 0, 2]} size={[1.6, 1.5, 1.6]} accent={STATUS_HEX.critical} />
    <ControlCabinet position={[0, 0, 4.3]} units={2} />
  </group>
);

const ARRANGEMENTS: Record<ZoneDef["kind"], FC> = {
  smt: Smt,
  mft: Mft,
  thermalgel: ThermalGel,
  rfm: Rfm,
  testing: Testing,
  packaging: Packaging,
};

export const ZoneContents = memo(function ZoneContents({ kind }: { kind: ZoneDef["kind"] }) {
  const Arr = ARRANGEMENTS[kind];
  return <Arr />;
});

export default ZoneContents;
