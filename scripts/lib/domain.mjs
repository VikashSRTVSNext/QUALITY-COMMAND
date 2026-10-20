// The demo's domain vocabulary.
//
// Every list here is taken from the real contract rather than invented: the step
// names are the mart step names the endpoints take, the tile keys are what
// API_KEY_BY_TILE resolves to, the sub_module values are the three the level
// filter actually compares against, and the item codes follow the real
// `NNNNNNA.NNN` shape.
//
// Nothing in this file is rendered directly — it is the input to the generator
// and the lookup table for the handlers. Keeping it in one place is what stops a
// product appearing in the dropdown that has no row in the yield table.


/**
 * Levels are decided by `sub_module`, not by a level column, and the filter
 * compares against exactly these three strings uppercased. Anything else falls
 * into TRX by exclusion — see matchesLevel in productYieldFilter.ts.
 */


/**
 * The product master.
 *
 * Shapes and names follow the real catalogue observed on the running service:
 * dotted item codes, UNIT names without a suffix, TRX/PA names carrying one.
 * Two products deliberately have `target_yield: null` so the `no_target` status
 * path and the "don't render it in the red count" rule are both exercised.
 */
export const PRODUCTS = [
  { item: "475656A.104", product: "AHFII Z", sub_module: "UNIT", target_yield: 0.95, dailyVolume: 24 },
  { item: "476122A.104", product: "AHPMDG_Z", sub_module: "UNIT", target_yield: 0.95, dailyVolume: 168 },
  { item: "475918A.101", product: "AKQZ MAVERICK", sub_module: "UNIT", target_yield: 0.94, dailyVolume: 52 },
  { item: "476708A.101", product: "ARDC", sub_module: "UNIT", target_yield: 0.95, dailyVolume: 6 },
  { item: "474198A.101", product: "AREA", sub_module: "UNIT", target_yield: 0.93, dailyVolume: 64 },
  { item: "476901A.102", product: "ASCG Z", sub_module: "UNIT", target_yield: 0.95, dailyVolume: 142 },
  { item: "477310A.101", product: "AZQJ", sub_module: "UNIT", target_yield: null, dailyVolume: 18 },
  { item: "089338A.112", product: "AHPB TRX", sub_module: "TRX", target_yield: 0.96, dailyVolume: 22 },
  { item: "093447A.105", product: "AKQZ-TRX", sub_module: "TRX", target_yield: 0.96, dailyVolume: 63 },
  { item: "093801A.105", product: "ASCG", sub_module: "TRX", target_yield: 0.95, dailyVolume: 64 },
  { item: "093802A.105", product: "AKNB", sub_module: "TRX", target_yield: 0.95, dailyVolume: 310 },
  { item: "093915B.200", product: "AREA TRX", sub_module: "TRX", target_yield: null, dailyVolume: 41 },
  { item: "094588A.102", product: "AHPMDG Z PA", sub_module: "PA", target_yield: 0.97, dailyVolume: 318 },
  { item: "094855A.102", product: "ARDC_MPA", sub_module: "PA", target_yield: 0.96, dailyVolume: 63 },
  { item: "094832E.102", product: "AREC_PA", sub_module: "PA", target_yield: 0.96, dailyVolume: 9 },
  { item: "094901C.101", product: "ASCG_PA", sub_module: "PA", target_yield: 0.97, dailyVolume: 86 },
  { item: "095120A.103", product: "AKNB PSU", sub_module: "PSU", target_yield: 0.98, dailyVolume: 54 },
];

export const productByItem = (item) =>
  PRODUCTS.find((p) => p.item === item);

/** "AKNB (093802A.105)" — the dropdown label the newer responses carry. */
export const optionLabel = (p) =>
  `${p.product} (${p.item})`;

/**
 * Which KPI cards a product moves. UNIT products move the unit cards, TRX/PA/PSU
 * the module cards. `both` exists in the contract but no demo product uses it.
 */
export const kpiLevelOf = (p) =>
  p.sub_module === "UNIT" ? "unit" : "module";

// ── Process steps ───────────────────────────────────────────────────────────


/** Assembly lines, as `line_steps` names them. */
export const LINES = ["MAC_LINE01", "MAC_LINE02", "MAC_LINE03", "SMT_LINE01", "SMT_LINE02"];

const SMT_LINES = ["SMT_LINE01", "SMT_LINE02"];
const MAC_LINES = ["MAC_LINE01", "MAC_LINE02", "MAC_LINE03"];

/**
 * The twelve Process Performance steps, in the layout's display order.
 *
 * Volumes and the "expect this table to look sparse" notes come from the
 * documented behaviour of each step, so a near-empty burn-in table reads as
 * correct rather than broken.
 */
export const STEPS = [
  { step: "SPI", tile: "SPI", type: "yield", target: 98, target_unit: "%", target_direction: "higher", dailyVolume: 12450, baseYield: 98.16, drilldown: true, ncLog: false, images: false, lines: SMT_LINES },
  { step: "DPMOI", tile: "DPMOI", type: "dpmo", target: 10, target_unit: "index", target_direction: "lower", dailyVolume: 11800, baseYield: 0, drilldown: false, ncLog: false, images: false, lines: [] },
  { step: "AXI", tile: "AXI - S", type: "yield", target: 98, target_unit: "%", target_direction: "higher", dailyVolume: 11180, baseYield: 98.4, drilldown: true, ncLog: true, images: true, lines: SMT_LINES },
  { step: "SMT_DEFECTS", tile: "SMT DEFECTS @ MFT", type: "failure", target: 1.2, target_unit: "%", target_direction: "lower", dailyVolume: 10900, baseYield: 0, drilldown: true, ncLog: false, images: false, lines: SMT_LINES },
  { step: "THERMAL_AVI", tile: "THERMAL AVI", type: "yield", target: 98, target_unit: "%", target_direction: "higher", dailyVolume: 980, baseYield: 97.45, drilldown: true, ncLog: true, images: true, lines: MAC_LINES },
  { step: "SCREW_DEFECTS", tile: "SCREW DEFECTS", type: "failure", target: 1.0, target_unit: "%", target_direction: "lower", dailyVolume: 960, baseYield: 0, drilldown: false, ncLog: false, images: false, lines: MAC_LINES },
  { step: "OTA_TEST", tile: "OTA", type: "yield", target: 98, target_unit: "%", target_direction: "higher", dailyVolume: 540, baseYield: 98.33, drilldown: true, ncLog: true, images: false, lines: MAC_LINES },
  { step: "RTWP", tile: "RTWP", type: "yield", target: 98, target_unit: "%", target_direction: "higher", dailyVolume: 520, baseYield: 98.46, drilldown: true, ncLog: true, images: false, lines: MAC_LINES },
  // A SAMPLE test, not every unit: a handful of units a day is the correct
  // answer for this step, not a bug.
  { step: "BURN_IN", tile: "BURN-IN - S", type: "yield", target: 99, target_unit: "%", target_direction: "higher", dailyVolume: 6, baseYield: 100, drilldown: true, ncLog: true, images: false, lines: [] },
  { step: "LBTS", tile: "LBTS - S", type: "yield", target: 98, target_unit: "%", target_direction: "higher", dailyVolume: 70, baseYield: 98.69, drilldown: true, ncLog: true, images: false, lines: [] },
  // The highest-volume step: expect the fullest tables in the app.
  { step: "IP", tile: "IP", type: "yield", target: 98, target_unit: "%", target_direction: "higher", dailyVolume: 960, baseYield: 98.43, drilldown: true, ncLog: true, images: false, lines: MAC_LINES },
  { step: "AUTO_OGI", tile: "AUTO OGI", type: "yield", target: 98, target_unit: "%", target_direction: "higher", dailyVolume: 840, baseYield: 98.05, drilldown: true, ncLog: true, images: true, lines: MAC_LINES },
];

export const stepByName = (step) =>
  STEPS.find((s) => s.step === step);

/** Steps reachable from the UNITS / TRX / PA level tabs. Not Process
 *  Performance tiles — these are the first-pass test operations behind the
 *  level tabs, and they own the highest failure volume in the app. */
export const LEVEL_STEPS = [
  { step: "UNIT_TEST", tile: "", type: "yield", target: 95, target_unit: "%", target_direction: "higher", dailyVolume: 480, baseYield: 94.2, drilldown: true, ncLog: true, images: false, lines: MAC_LINES },
  { step: "MODULE_TEST", tile: "", type: "yield", target: 95, target_unit: "%", target_direction: "higher", dailyVolume: 1390, baseYield: 93.2, drilldown: true, ncLog: true, images: false, lines: MAC_LINES },
];

export const ALL_STEPS = [...STEPS, ...LEVEL_STEPS];

/** Steps `line_steps` lists — the cards a line selection actually reaches. */
export const LINE_STEPS = STEPS.filter((s) => s.lines.length > 0).map((s) => s.step);

// ── Testers, defect codes and dispositions ──────────────────────────────────

/** Test resources per step. The drill-down attributes failures to these. */
export const testersFor = (step) => {
  switch (step) {
    case "SPI": return ["SPI001", "SPI002"];
    case "AXI": return ["AXI001", "AXI002", "AXI003"];
    case "UNIT_TEST": return ["UT01", "UT02", "UT03", "UT04", "UT05"];
    case "MODULE_TEST": return ["MT01", "MT02", "MT03", "MT04"];
    case "OTA_TEST": return ["OTA01", "OTA02"];
    case "RTWP": return ["RTWP01", "RTWP02"];
    case "BURN_IN": return ["BI01"];
    case "LBTS": return ["LBTS01", "LBTS02"];
    case "IP": return ["IP01", "IP02", "IP03"];
    case "AUTO_OGI": return ["OGI01", "OGI02"];
    case "THERMAL_AVI": return ["AVI01", "AVI02"];
    default: return [`${step}01`];
  }
};

/**
 * Disposition categories, as the `category` parameter takes them.
 *
 * Weighted, not uniform: a flat spread makes every cause breakdown look
 * identical and defeats the point of the column.
 */
export const CAUSE_CATEGORIES = [
  ["FCR", 48],
  ["SMT", 18],
  ["PPH", 12],
  ["PPF", 9],
  ["PPA", 7],
  ["SQA", 4],
  ["MOD_REJ", 2],
];

/** NC codes for the MES NC log, weighted so a few dominate the Pareto. */
export const NC_CODES = [
  ["SOLDER_BRIDGE", 42],
  ["COLD_JOINT", 28],
  ["MISSING_COMPONENT", 19],
  ["TOMBSTONE", 14],
  ["INSUFFICIENT_SOLDER", 12],
  ["MISALIGNED", 9],
  ["RF_POWER_LOW", 8],
  ["VSWR_HIGH", 6],
  ["EEPROM_WRITE_FAIL", 4],
  ["CONNECTOR_DAMAGE", 3],
];

/** SMT solder-defect NC codes. Distinct vocabulary from the MES log. */
export const SMT_NC_CODES = [
  ["BRIDGING", 38],
  ["SOLDER_BALL", 24],
  ["INSUFFICIENT", 21],
  ["VOID", 15],
  ["NON_WET", 11],
  ["EXCESS", 8],
];

/** SPI pad-inspection defect codes. */
export const SPI_DEFECT_CODES = [
  ["VOLUME_LOW", 34],
  ["VOLUME_HIGH", 22],
  ["AREA_LOW", 18],
  ["OFFSET_X", 13],
  ["OFFSET_Y", 11],
  ["BRIDGING", 7],
];

/** Reference designators, for the by_ref_des breakdowns. */
export const REF_DES = [
  "R101", "R102", "C204", "C205", "U301", "U302", "L401",
  "J501", "J502", "Q601", "D701", "FL801",
];

/** Component part numbers paired with the designators. */
export const COMPONENTS = [
  "RES-0402-10K", "RES-0402-4K7", "CAP-0603-100N", "CAP-0805-10U",
  "IC-QFN48-RFIC", "IC-BGA256-SOC", "IND-0603-4N7",
  "CON-SMA-F", "CON-B2B-40P", "TRANS-SOT23", "DIODE-SOD123", "FILTER-SAW-2G6",
];

/** DPMOI rework operations, as the detail endpoint takes them. */
export const DPMOI_OPERATIONS = ["AOI_TOP_REWORK_IN04", "AOI_BOT_REWORK_IN04"];

/** Screw-driving stations for the screw-defect breakdown. */
export const SCREW_OPERATIONS = ["SCREW_TOP_IN04", "SCREW_BOT_IN04"];

/** How many screws each product takes, from the screw master. */
export const screwsFor = (item) =>
  10 + (item.charCodeAt(0) % 5) * 2;

// ── Shift weighting ─────────────────────────────────────────────────────────

/**
 * Relative volume per shift. A is the fullest and C the thinnest, which is what
 * makes a weighted range total differ visibly from a naive average of the daily
 * percentages — the distinction the KPI contract is emphatic about.
 */
export const SHIFT_WEIGHT = { A: 0.42, B: 0.37, C: 0.21 };

/** Attention Center alert templates. `severity` is binary in effect: anything
 *  that is not "critical" renders as Risk. */
export const ALERT_TEMPLATES = [
  { title: "SPI volume drift on SMT_LINE01", severity: "critical", impact: "high", unit: "%" },
  { title: "AXI first-pass yield below target", severity: "critical", impact: "high", unit: "%" },
  { title: "Screw torque variance at MAC_LINE02", severity: "warning", impact: "medium", unit: "Nm" },
  { title: "Thermal gel dispense weight low", severity: "warning", impact: "medium", unit: "mg" },
  { title: "RTWP noise floor elevated", severity: "warning", impact: "medium", unit: "dBm" },
  { title: "IP leak test retries rising", severity: "critical", impact: "high", unit: "%" },
  { title: "Reflow zone 4 temperature offset", severity: "warning", impact: "low", unit: "°C" },
];
