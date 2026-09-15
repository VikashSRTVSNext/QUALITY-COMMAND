// The Product Yield panel's step tabs, and the map from a Process Performance
// tile to the tab it opens.
//
// Kept apart from ProductYieldPanel so ProcessMetricCard can ask "which tab am
// I?" without importing the panel (which would be a cycle: the panel renders
// tables that share helpers with the card).

// Sentinel for the screw-defects tab. Not a mart process_step, so it is kept
// distinct from the names the per-product endpoint accepts.
export const SCREW_DEFECTS_TAB = "__SCREW_DEFECTS__";
// Same reasoning: DPMOI's denominator is OPPORTUNITIES (solder joints, components,
// placements), so /process/{step}/products cannot answer it either.
export const DPMOI_TAB = "__DPMOI__";
// SMT DEFECTS @ MFT is not built from the production log either, so it has no
// per-product endpoint yet. Its tab shows a placeholder pane until the API
// exists; the sentinel keeps it off the process-step path.
//
// SPI used to have a sentinel here for the same reason. It no longer does:
// /process/SPI/products answers with the same keys as every other step, so SPI
// is a real process step at level one. Only its level TWO differs (pads, not
// non-conformance records), which is why it gets its own pane and modal.
export const SMT_DEFECTS_TAB = "__SMT_DEFECTS__";

// The process steps that can be shown as a tab, in process order.
//
// `label` is what the tile calls it, `step` is the mart name the endpoint takes
// (or a sentinel above for the tabs that have their own pane).
export const STEP_TABS: { label: string; step: string }[] = [
  { label: "SPI", step: "SPI" },
  { label: "AXI-S", step: "AXI" },
  // Placeholder — no endpoint yet, see SMT_DEFECTS_TAB.
  { label: "SMT DEFECTS @ MFT", step: SMT_DEFECTS_TAB },
  { label: "THERMAL AVI", step: "THERMAL_AVI" },
  { label: "BURN-IN-S", step: "BURN_IN" },
  { label: "LBTS-S", step: "LBTS" },
  { label: "RTWP", step: "RTWP" },
  { label: "IP", step: "IP" },
  { label: "OTA", step: "OTA_TEST" },
  { label: "AUTO OGI", step: "AUTO_OGI" },
  // NOT a PROCESS_STEPS entry, and it cannot be one: its denominator is SCREWS
  // DRIVEN rather than boards, so /process/{step}/products cannot answer it. The
  // sentinel routes to its own pane and endpoint.
  { label: "SCREW DEFECTS", step: SCREW_DEFECTS_TAB },
  { label: "DPMOI", step: DPMOI_TAB },
];

// Feed `process_performance[].name` -> the tab a click on that tile opens.
//
// Keys are the feed's names, NOT the display titles: the dashboard renames a few
// tiles (AXI - S -> AXI-S, THERMAL AVI -> THERMAL GEL AVI) but the card is
// handed the feed item, so `item.name` is what it has to look up.
//
// The FPY/SPY UNIT and MODULE tiles are KPI cards, not process cards, so they
// never reach this map — they stay inert on purpose.
const TAB_BY_TILE: Record<string, string> = {
  SPI: "SPI",
  DPMOI: DPMOI_TAB,
  "AXI - S": "AXI",
  "SMT DEFECTS @ MFT": SMT_DEFECTS_TAB,
  "THERMAL AVI": "THERMAL_AVI",
  "SCREW DEFECTS": SCREW_DEFECTS_TAB,
  OTA: "OTA_TEST",
  RTWP: "RTWP",
  "BURN-IN - S": "BURN_IN",
  "LBTS - S": "LBTS",
  IP: "IP",
  "AUTO OGI": "AUTO_OGI",
};

/** The Product Yield tab for a Process Performance tile, or null if the tile
 *  has none (which makes it non-clickable). */
export const yieldTabForTile = (tileName: string): string | null =>
  TAB_BY_TILE[tileName] ?? null;

/** A request from outside the panel to show one step tab. `nonce` changes on
 *  every request so clicking the same tile twice re-selects the tab after the
 *  user has moved off it. */
export interface YieldStepRequest {
  step: string;
  nonce: number;
}
