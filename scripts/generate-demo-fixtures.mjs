// Generates the demo fixture set into public/demo-data/.
//
//   node scripts/generate-demo-fixtures.mjs [--days 30] [--volume 1] [--seed qcc-demo-v1]
//
//   --days    production days in the scenario (default 30, the picker's ceiling)
//   --volume  multiplier on every per-day board count (default 1). Raise it to
//             stress-test the partitioning; the committed set uses 1.
//   --seed    changes every number deterministically
//   --out     output directory (default public/demo-data)
//
// Determinism: every number comes from a stream keyed by what it describes
// (seed|day|shift|step|item), so adding a product does not move any other
// product's figures and a regeneration with the same seed is byte-identical.
// The validator proves that by regenerating and comparing hashes.
//
// Dates: the scenario is generated against an ANCHOR day (default today) and
// the runtime re-dates it so the last day is always today. See
// src/demo/demoClock.ts for why.
//
// Partitioning: one file per (kind, day) for summaries, and one per
// (step, day[, item]) for detail. Nothing is written as a single big array,
// because the runtime must be able to answer one drill-down without reading the
// rest of the day.

import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ALERT_TEMPLATES,
  ALL_STEPS,
  CAUSE_CATEGORIES,
  COMPONENTS,
  DPMOI_OPERATIONS,
  LEVEL_STEPS,
  LINES,
  LINE_STEPS,
  NC_CODES,
  PRODUCTS,
  REF_DES,
  SCREW_OPERATIONS,
  SHIFT_WEIGHT,
  SMT_NC_CODES,
  SPI_DEFECT_CODES,
  STEPS,
  kpiLevelOf,
  optionLabel,
  screwsFor,
  stepByName,
  testersFor,
} from "./lib/domain.mjs";
import {
  SHIFT_LETTERS,
  SHIFT_MINUTES,
  addDays,
  periodMonthOf,
  timestampIn,
  todayLabel,
} from "./lib/clock.mjs";
import {
  chance,
  float,
  int,
  pick,
  rngFor,
  splitByWeight,
  weighted,
} from "./lib/rng.mjs";

// ── CLI ─────────────────────────────────────────────────────────────────────

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const DAYS = Number(argOf("days", "30"));
const VOLUME = Number(argOf("volume", "1"));
const SEED = argOf("seed", "qcc-demo-v1");
const OUT = path.resolve(argOf("out", "public/demo-data"));
const ANCHOR = argOf("anchor", todayLabel());

const MANIFEST_VERSION = 1;

/** Days oldest-first, ending on the anchor. */
const DAY_LABELS = Array.from({ length: DAYS }, (_, i) =>
  addDays(ANCHOR, -(DAYS - 1 - i)),
);

// ── Writer with accounting ──────────────────────────────────────────────────

const files = [];
const rowCounts = {};
let totalBytes = 0;

const countRows = (kind, n) => {
  rowCounts[kind] = (rowCounts[kind] ?? 0) + n;
};

const write = async (rel, data) => {
  const abs = path.join(OUT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  // No pretty-printing: indentation roughly doubles the on-disk size of a
  // fixture set this shape, and nothing reads these by hand.
  const json = JSON.stringify(data);
  await writeFile(abs, json, "utf8");
  files.push(rel.replace(/\\/g, "/"));
  totalBytes += Buffer.byteLength(json, "utf8");
};

const scaled = (n) => Math.max(1, Math.round(n * VOLUME));

// ── Per-day, per-product yield ──────────────────────────────────────────────

/**
 * Status from the real thresholds: at/above target healthy, within 5 points
 * below warning, further below critical, and `no_target` when the target sheet
 * has no row for the product.
 *
 * `no_target` is NOT a failure — the dashboard is explicitly asked not to count
 * it in the red total, so it must never be emitted as critical.
 */
const yieldStatus = (fpy, targetFraction) => {
  if (targetFraction == null) return "no_target";
  if (fpy == null) return "unknown";
  const target = targetFraction * 100;
  if (fpy >= target) return "healthy";
  return fpy >= target - 5 ? "warning" : "critical";
};

/**
 * Percentage points added to the baseline yield, by shift.
 *
 * A runs best and C worst, which is realistic for a thinner-staffed night
 * shift AND load-bearing for the demo: shift C is also the lowest-volume
 * shift, so a volume-weighted range total now differs measurably from a naive
 * average of the daily percentages. Without this bias the three shifts are
 * statistically identical, the two calculations agree, and the fixtures stop
 * exercising the one arithmetic rule the KPI contract is most emphatic about.
 */
const SHIFT_YIELD_BIAS = { A: 1.1, B: 0.0, C: -3.4 };

const RECOMMENDATIONS = [
  "Failures concentrate on the B shift; check fixture seating.",
  "Performance within expectations.",
  "Retest recovery is high — first-pass contact suspected.",
  "Yield trending down over three days; review solder paste lot.",
  "Volume too low this window to draw a conclusion.",
];

/**
 * One product's figures for one (day, shift).
 *
 * `tested` is split across shifts by fixed weights and the D row is written
 * from the SAME per-shift numbers, so A+B+C reconciles with D exactly. The real
 * backend stores D separately — the UI never sums the shifts — but the counts
 * still have to agree, and a demo that disagreed would look like a backend bug.
 */
const productDay = (product, day) => {
  const rng = rngFor(SEED, "yield", day, product.item);
  const dayTotal = scaled(
    Math.round(product.dailyVolume * float(rng, 0.78, 1.18, 4)),
  );
  // A quiet day now and then, so rows[].days < meta.days is exercised and the
  // "a yield off two days is a weaker signal" badge has something to show.
  const ran = !chance(rng, 0.12);
  if (!ran) return null;

  const perShift = splitByWeight(dayTotal, SHIFT_WEIGHT);
  const shifts = {};
  let dTested = 0;
  let dFailed = 0;
  let dRecovered = 0;

  for (const s of SHIFT_LETTERS) {
    const srng = rngFor(SEED, "yield", day, product.item, s);
    const tested = perShift[s];
    const base = (product.target_yield ?? 0.95) * 100;
    // Per-shift bias: A runs best, C worst. Both realistic (the night shift is
    // thinner-staffed) and necessary — without it the three shift yields are
    // statistically identical, the weighted range total equals the naive mean
    // of the daily percentages, and the demo silently stops demonstrating the
    // one arithmetic rule the KPI contract is most emphatic about.
    const bias = SHIFT_YIELD_BIAS[s];
    // Centred slightly below target so the mix contains healthy, warning and
    // critical rows rather than a wall of green.
    const fpyPct = Math.min(
      99.9,
      Math.max(72, base + bias + float(srng, -3.2, 2.4, 2)),
    );
    const failed = Math.round(tested * (1 - fpyPct / 100));
    const recovered = Math.round(failed * float(srng, 0.55, 0.92, 3));
    shifts[s] = { tested, failed, recovered };
    dTested += tested;
    dFailed += failed;
    dRecovered += recovered;
  }

  shifts.D = { tested: dTested, failed: dFailed, recovered: dRecovered };
  return shifts;
};

/** fpy/spy from counts, so the percentages can never disagree with the rows. */
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 10000) / 100 : null);

const yieldRowsFor = (day) => {
  const rows = [];
  let id = 1;
  for (const product of PRODUCTS) {
    const shifts = productDay(product, day);
    if (!shifts) continue;
    for (const s of [...SHIFT_LETTERS, "D"]) {
      const { tested, failed, recovered } = shifts[s];
      if (tested === 0) continue;
      const fpy = pct(tested - failed, tested);
      const spy = pct(tested - failed + recovered, tested);
      const rng = rngFor(SEED, "rec", day, product.item, s);
      rows.push({
        id: id++,
        product: product.product,
        item: product.item,
        sub_module: product.sub_module,
        tested,
        failed,
        fpy,
        spy,
        target_yield: product.target_yield == null ? null : product.target_yield * 100,
        status: yieldStatus(fpy, product.target_yield),
        ai_recommendation: pick(rng, RECOMMENDATIONS),
        shift: s,
      });
    }
  }
  return rows;
};

// ── KPI roll-ups ────────────────────────────────────────────────────────────

/**
 * One day's KPI counts, derived from the SAME per-product rows the yield table
 * shows, so the cards and the table can never disagree.
 *
 * Unit metrics come from sub_module UNIT, module metrics from everything else —
 * the same split the level filter makes.
 */
const kpiCountsFor = (day, rows) => {
  const acc = {};
  for (const s of [...SHIFT_LETTERS, "D"]) {
    acc[s] = {
      units_tested: 0, units_passed_fp: 0, units_recovered: 0,
      modules_tested: 0, modules_passed_fp: 0, modules_recovered: 0,
    };
  }
  for (const row of rows) {
    const isUnit = row.sub_module === "UNIT";
    const a = acc[row.shift];
    if (!a) continue;
    // `recovered` is not on the row (the per-product table stores no recovery
    // count — that is why spy_is_weighted_mean is always true), so it is
    // reconstructed from spy, exactly as the backend does it.
    const recovered = Math.round(((row.spy ?? 0) - (row.fpy ?? 0)) / 100 * row.tested);
    if (isUnit) {
      a.units_tested += row.tested;
      a.units_passed_fp += row.tested - row.failed;
      a.units_recovered += recovered;
    } else {
      a.modules_tested += row.tested;
      a.modules_passed_fp += row.tested - row.failed;
      a.modules_recovered += recovered;
    }
  }
  return acc;
};

const metricsFrom = (c) => ({
  fpy_unit: pct(c.units_passed_fp, c.units_tested),
  spy_unit: pct(c.units_passed_fp + c.units_recovered, c.units_tested),
  fpy_module: pct(c.modules_passed_fp, c.modules_tested),
  spy_module: pct(c.modules_passed_fp + c.modules_recovered, c.modules_tested),
  ...c,
});

/**
 * Customer audit score for a day, or null.
 *
 * The audit is signed off the DAY AFTER the shift it covers, so the newest day
 * in any window is normally unaudited. That is the filing lag, not missing
 * data — and it is why days_reported comes back one short of days_in_range.
 */
const auditFor = (day) => {
  if (day === ANCHOR) return null; // newest day: not yet filed
  const rng = rngFor(SEED, "audit", day);
  return chance(rng, 0.08) ? null : float(rng, 94.2, 99.4, 2);
};

// ── Process performance ─────────────────────────────────────────────────────

const processStepDay = (step, day) => {
  const rng = rngFor(SEED, "pp", day, step.step);
  const dayDone = scaled(Math.round(step.dailyVolume * float(rng, 0.85, 1.12, 4)));
  const perShift = splitByWeight(dayDone, SHIFT_WEIGHT);

  const shiftRows = SHIFT_LETTERS.map((s) => {
    const srng = rngFor(SEED, "pp", day, step.step, s);
    const done = perShift[s];
    if (step.type === "dpmo") {
      // DPMOI carries defects/opportunities/index at the top level, not a yield.
      const opportunities = done * int(srng, 180, 240);
      const defects = Math.round(opportunities * float(srng, 0.000004, 0.000013, 8));
      const index = opportunities > 0
        ? Math.round((defects / opportunities) * 1e6 * 100) / 100
        : null;
      return { shift: s, done, defects, opportunities, index, status: index != null && index <= step.target ? "healthy" : "warning" };
    }
    if (step.type === "failure") {
      const failed = Math.round(done * float(srng, 0.004, 0.019, 5));
      // failure_pct ONLY. The dashboard checks failure_pct before yield_pct and
      // renders whichever it finds first, so a step that published both would
      // make every yield tile take the failure branch and show a blank value.
      return { shift: s, done, ok: done - failed, failed, failure_pct: pct(failed, done), status: pct(failed, done) <= step.target ? "healthy" : "warning" };
    }
    const yieldPct = Math.min(100, Math.max(90, step.baseYield + float(srng, -1.6, 1.1, 2)));
    const ok = Math.round(done * (yieldPct / 100));
    // yield_pct ONLY — see above.
    return { shift: s, done, ok, failed: done - ok, yield_pct: pct(ok, done), status: pct(ok, done) >= step.target ? "healthy" : "warning" };
  });

  // The day row is the sum of the shift rows, recomputed as a percentage once
  // at the end — never the mean of the three shift percentages.
  const sum = (k) => shiftRows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const done = sum("done");
  let dayRow;
  if (step.type === "dpmo") {
    const defects = sum("defects");
    const opportunities = sum("opportunities");
    const index = opportunities > 0 ? Math.round((defects / opportunities) * 1e6 * 100) / 100 : null;
    dayRow = { done, defects, opportunities, index, status: index != null && index <= step.target ? "healthy" : "warning" };
  } else {
    const ok = sum("ok");
    const failed = sum("failed");
    const yield_pct = pct(ok, done);
    const failure_pct = pct(failed, done);
    const pass = step.type === "failure" ? failure_pct <= step.target : yield_pct >= step.target;
    // One metric per step, matching the shift rows above.
    dayRow = step.type === "failure"
      ? { done, ok, failed, failure_pct, status: pass ? "healthy" : "warning" }
      : { done, ok, failed, yield_pct, status: pass ? "healthy" : "warning" };
  }

  // Trend buckets must be TAGGED WITH A SHIFT or getProcessTrendData discards
  // them whenever a shift is selected.
  const metric = step.type === "failure" ? "failure_pct" : step.type === "dpmo" ? "index" : "yield_pct";
  const buckets = [];
  for (const s of SHIFT_LETTERS) {
    const srng = rngFor(SEED, "trend", day, step.step, s);
    const basis = shiftRows.find((r) => r.shift === s)?.[metric] ?? null;
    for (let i = 0; i < 4; i++) {
      buckets.push({
        shift: s,
        index: i,
        label: `${s}${i + 1}`,
        [metric]: basis == null ? null : Math.round((basis + float(srng, -0.8, 0.8, 2)) * 100) / 100,
      });
    }
  }

  return {
    target: step.target,
    target_unit: step.target_unit,
    target_direction: step.target_direction,
    no_data: false,
    day: dayRow,
    by_shift: shiftRows,
    trend: { metric, buckets },
    ...(step.type === "dpmo"
      ? { defects: dayRow.defects, opportunities: dayRow.opportunities, index: dayRow.index }
      : {}),
  };
};

const processPerformanceFor = (day) => {
  const steps = {};
  for (const step of STEPS) steps[step.step] = processStepDay(step, day);
  return steps;
};

// ── Level-one per-product breakdown per step ────────────────────────────────

const stepProductsFor = (step, day) => {
  // Which products run a step: UNIT_TEST sees units, MODULE_TEST sees modules,
  // SMT/RFM steps see everything. Keeps the drill-down consistent with the
  // level tab that opened it.
  const eligible = PRODUCTS.filter((p) =>
    step.step === "UNIT_TEST" ? p.sub_module === "UNIT"
      : step.step === "MODULE_TEST" ? p.sub_module !== "UNIT"
        : true,
  );

  const rows = [];
  for (const p of eligible) {
    const rng = rngFor(SEED, "stepprod", day, step.step, p.item);
    if (chance(rng, 0.15)) continue;
    const share = p.dailyVolume / PRODUCTS.reduce((a, q) => a + q.dailyVolume, 0);
    const done = scaled(Math.max(1, Math.round(step.dailyVolume * share * float(rng, 0.7, 1.3, 4))));
    const boards = done + int(rng, 0, 3);
    if (step.type === "failure" || step.step === "SMT_DEFECTS") {
      const failed = Math.round(done * float(rng, 0.004, 0.022, 5));
      rows.push({
        item: p.item, product_name: p.product, boards, done,
        ok: done - failed, failed,
        yield_pct: pct(done - failed, done), failure_pct: pct(failed, done),
        meets_target: pct(failed, done) <= step.target,
        // Defect RECORDS, not boards: several bad joints on one board is one
        // failed board and several records. SMT_DEFECTS only.
        ...(step.step === "SMT_DEFECTS" ? { defect_records: failed + int(rng, 0, failed) } : {}),
      });
    } else {
      const yieldPct = Math.min(100, Math.max(80, step.baseYield + float(rng, -4, 1.5, 2)));
      const ok = Math.round(done * (yieldPct / 100));
      rows.push({
        item: p.item, product_name: p.product, boards, done, ok,
        failed: done - ok,
        yield_pct: pct(ok, done), failure_pct: pct(done - ok, done),
        meets_target: pct(ok, done) >= step.target,
      });
    }
  }

  const sum = (k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const done = sum("done");
  const ok = sum("ok");
  const failed = sum("failed");

  const card = SHIFT_LETTERS.map((s) => {
    const srng = rngFor(SEED, "stepcard", day, step.step, s);
    const sdone = Math.round(done * SHIFT_WEIGHT[s]);
    const sfailed = Math.round(failed * SHIFT_WEIGHT[s] * float(srng, 0.8, 1.2, 3));
    return {
      shift: s, done: sdone, ok: sdone - sfailed, failed: sfailed,
      yield_pct: pct(sdone - sfailed, sdone), failure_pct: pct(sfailed, sdone),
      status: "healthy",
    };
  });

  return {
    step: step.step,
    metric: step.type === "failure" ? "failure" : "yield",
    business_date: day,
    shift: null,
    operations: { like: `${step.step}%` },
    target: step.target,
    target_unit: step.target_unit,
    target_direction: step.target_direction,
    meets_target: step.type === "failure" ? pct(failed, done) <= step.target : pct(ok, done) >= step.target,
    sort: step.type === "failure" ? "failure" : "yield",
    page: 1,
    page_size: 12,
    total_products: rows.length,
    total_pages: Math.max(1, Math.ceil(rows.length / 12)),
    totals: {
      products: rows.length, boards: sum("boards"), done, ok, failed,
      yield_pct: pct(ok, done), failure_pct: pct(failed, done),
    },
    unattributed: null,
    card,
    rows,
  };
};

// ── Level two: NC log, SMT log, SPI pad log, testers ────────────────────────

/** Operator dispositions, as the comment column actually reads. */
const DISPOSITIONS = [
  "Retest (False failure)",
  "Filter Replaced(Retested OK)",
  "Connector re-seated",
  "Reflowed joint, retested OK",
  "Component replaced",
  "Scrapped - MOD REJ",
];

/** NC code descriptions, for the nc_description column. */
const NC_DESCRIPTIONS = {
  SOLDER_BRIDGE: "Solder bridge between adjacent pads",
  COLD_JOINT: "Cold / dull solder joint",
  MISSING_COMPONENT: "Component absent from pad",
  TOMBSTONE: "Component lifted at one end",
  INSUFFICIENT_SOLDER: "Insufficient solder volume",
  MISALIGNED: "Component offset beyond tolerance",
  RF_POWER_LOW: "RF output power below limit",
  VSWR_HIGH: "VSWR above limit",
  EEPROM_WRITE_FAIL: "EEPROM write verification failed",
  CONNECTOR_DAMAGE: "Connector pin damage",
};

/**
 * The NC log behind one product at one step — level two.
 *
 * Field names follow NcLogRow and ProductDefectsResponse exactly. They are NOT
 * the names used elsewhere in the API: the log calls the timestamp `date_time`
 * and the code `nc`, carries `slno` for the row number, and reports
 * `undispositioned` / `carried_over` as {events, units} objects rather than
 * plain counts. Shaping this from memory instead of from the type is what
 * produced a table of blank cells on the first attempt.
 *
 * `failedBoards` comes from the level-one row this log sits under, so the log
 * reconciles with the table that opened it. Deriving the event count from its
 * own formula produced ten times the step's actual failures — the log said
 * 2,000 bad boards where the table said 180.
 *
 * Events can exceed boards: a board retested twice raises two records.
 */
const ncLogFor = (step, day, item, doneBoards, failedBoards) => {
  const product = PRODUCTS.find((p) => p.item === item);
  const rng = rngFor(SEED, "nc", day, step.step, item);
  const events = failedBoards <= 0
    ? 0
    : failedBoards + Math.round(failedBoards * float(rng, 0, 0.25, 3));

  const log = [];
  const byCategory = {};
  const uncategorised = {};
  const unitsSeen = new Set();
  let undispositionedEvents = 0;
  const undispositionedUnits = new Set();
  let carriedEvents = 0;
  const carriedUnits = new Set();

  for (let i = 0; i < events; i++) {
    const erng = rngFor(SEED, "nc", day, step.step, item, i);
    const shift = pick(erng, SHIFT_LETTERS);
    const minute = int(erng, 0, SHIFT_MINUTES - 1);
    const failedAt = timestampIn(day, shift, minute, int(erng, 0, 59));
    // Disposition lands later than the failure. AXI's arrive a median of three
    // days after, RTWP's in under half an hour — so the same-day cause columns
    // being empty for AXI is correct, not a gap.
    const lagMin = step.step === "AXI" ? int(erng, 1440, 5760) : int(erng, 8, 180);
    const category = step.step === "AUTO_OGI"
      ? "FCR" // every failure here disposes as FCR: a one-column breakdown by nature
      : step.step === "THERMAL_AVI"
        ? null // no verified row for this step carries a category
        : weighted(erng, CAUSE_CATEGORIES);
    const sfc = `24${int(erng, 10000000, 99999999)}`;
    const nc = weighted(erng, NC_CODES);
    // A few rows belong to an earlier day's first pass. Real rework, excluded
    // from `categories` and `parent`, listed so the log matches MES row-for-row.
    const firstPass = !chance(erng, 0.06);
    // Verified dispositions are the only ones that can appear in a cause
    // column; the rest are the reason the columns can be short of the failures.
    const verified = chance(erng, 0.86);
    const refIdx = int(erng, 0, REF_DES.length - 1);

    unitsSeen.add(sfc);
    if (!firstPass) {
      carriedEvents += 1;
      carriedUnits.add(sfc);
    } else if (!verified) {
      undispositionedEvents += 1;
      undispositionedUnits.add(sfc);
    } else if (category) {
      byCategory[category] = (byCategory[category] ?? 0) + 1;
    } else {
      uncategorised[nc] = (uncategorised[nc] ?? 0) + 1;
    }

    log.push({
      slno: i + 1,
      first_pass_unit: firstPass,
      sfc,
      date_time: failedAt,
      verified_state: verified ? "VERIFIED" : "PENDING",
      failure_id: `F${int(erng, 1000000, 9999999)}`,
      nc,
      nc_description: NC_DESCRIPTIONS[nc] ?? null,
      category: verified ? category : null,
      nc_closed_by: verified ? `OP${int(erng, 100, 999)}` : null,
      ref_des: REF_DES[refIdx],
      component: COMPONENTS[refIdx],
      item,
      resource: pick(erng, testersFor(step.step)),
      times_processed: chance(erng, 0.82) ? 1 : int(erng, 2, 3),
      comment: verified ? pick(erng, DISPOSITIONS) : null,
      failure_comments: `POS: ${int(erng, 1, 8)} MeasID: ${int(erng, 10, 90)} HI: ${int(erng, -110, -80)} LO: ${int(erng, -130, -110)}`,
      disposition_time: verified ? timestampIn(day, shift, minute + lagMin, 0) : null,
    });
  }

  log.sort((a, b) => (a.date_time ?? "").localeCompare(b.date_time ?? ""));
  // Renumber after sorting: slno is the row number the operator reads, so it
  // has to follow the displayed order, not the generation order.
  log.forEach((row, i) => { row.slno = i + 1; });

  const okBoards = doneBoards - failedBoards;
  return {
    step: step.step,
    item,
    product_name: product?.product ?? item,
    business_date: day,
    window: { from: day, to: day },
    operations: {
      test: [`${step.step}_TEST_IN04`],
      rework: [`${step.step}_REWORK_IN04`],
    },
    parent: {
      boards: doneBoards,
      done: doneBoards,
      ok: okBoards,
      failed: failedBoards,
      yield_pct: pct(okBoards, doneBoards),
    },
    categories: CAUSE_CATEGORIES.map(([code]) => ({
      code,
      label: CAUSE_LABELS[code] ?? code,
      units: byCategory[code] ?? 0,
      pct_of_done: pct(byCategory[code] ?? 0, doneBoards),
    })),
    uncategorised: Object.entries(uncategorised).map(([nc, units]) => ({ nc, units })),
    undispositioned: { events: undispositionedEvents, units: undispositionedUnits.size },
    carried_over: { events: carriedEvents, units: carriedUnits.size },
    nc_log_events: log.length,
    selection: { units: unitsSeen.size, events: log.length },
    nc_log: log,
    filter: { resource: null, category: null, times_processed: null, verified_only: false },
  };
};

const smtDefectsFor = (day, item, boardsFailed, records) => {
  const product = PRODUCTS.find((p) => p.item === item);
  const log = [];
  const boardsSeen = new Set();
  // Boards per key must be DISTINCT boards for that key, not the running total
  // of every board seen so far — the earlier version assigned the global count
  // to each bucket, so every row in the breakdown claimed the same board count.
  const byNc = {}, byRef = {}, byComp = {}, byRes = {};
  const tally = (map, key, board, extra) => {
    map[key] = map[key] ?? { records: 0, boards: new Set(), ...extra };
    map[key].records += 1;
    map[key].boards.add(board);
  };

  for (let i = 0; i < records; i++) {
    const erng = rngFor(SEED, "smt", day, item, i);
    const shift = pick(erng, SHIFT_LETTERS);
    const sfc = `24${int(erng, 10000000, 99999999)}`;
    boardsSeen.add(sfc);
    const nc = weighted(erng, SMT_NC_CODES);
    const refIdx = int(erng, 0, REF_DES.length - 1);
    const resource = `MFT0${int(erng, 1, 3)}`;
    const verified = chance(erng, 0.9);
    tally(byNc, nc, sfc, { description: `Solder defect: ${nc.toLowerCase().replace(/_/g, " ")}` });
    tally(byRef, REF_DES[refIdx], sfc);
    tally(byComp, COMPONENTS[refIdx], sfc);
    tally(byRes, resource, sfc);
    log.push({
      slno: i + 1,
      sfc,
      date_time: timestampIn(day, shift, int(erng, 0, SHIFT_MINUTES - 1), int(erng, 0, 59)),
      verified_state: verified ? "VERIFIED" : "PENDING",
      failure_id: `S${int(erng, 1000000, 9999999)}`,
      nc,
      nc_description: `Solder defect: ${nc.toLowerCase().replace(/_/g, " ")}`,
      category: "SMT",
      nc_closed_by: verified ? `OP${int(erng, 100, 999)}` : null,
      ref_des: REF_DES[refIdx],
      component: COMPONENTS[refIdx],
      item,
      operation: "SMT_DEFECTS_MFT_IN04",
      resource,
      times_processed: chance(erng, 0.9) ? 1 : 2,
      comment: verified ? pick(erng, DISPOSITIONS) : null,
      failure_comments: `Pad ${REF_DES[refIdx]} measured outside tolerance`,
    });
  }
  log.sort((a, b) => (a.date_time ?? "").localeCompare(b.date_time ?? ""));
  log.forEach((row, i) => { row.slno = i + 1; });

  // Counted = { records, boards } — Sets collapsed to their size here.
  const asList = (map, keyName) =>
    Object.entries(map)
      .map(([key, v]) => ({
        [keyName]: key,
        records: v.records,
        boards: v.boards.size,
        ...(v.description ? { description: v.description } : {}),
      }))
      .sort((a, b) => b.records - a.records);

  const okBoards = Math.max(0, (product?.dailyVolume ?? 0) - boardsFailed);
  return {
    step: "SMT_DEFECTS",
    item,
    product_name: product?.product ?? item,
    business_date: day,
    site_code: "IN04",
    window: { from: day, to: day },
    filters: { resource: null, nc: null, times_processed: null },
    parent: {
      boards: boardsFailed + okBoards,
      done: boardsFailed + okBoards,
      ok: okBoards,
      failed: boardsFailed,
      // Defect RECORDS, not boards: several bad joints on one board is one
      // failed board and several records.
      defect_records: records,
      failure_pct: pct(boardsFailed, boardsFailed + okBoards),
    },
    boards: boardsSeen.size,
    records: log.length,
    by_nc: asList(byNc, "nc"),
    by_ref_des: asList(byRef, "ref_des"),
    by_component: asList(byComp, "component"),
    resources: asList(byRes, "resource"),
    // Master-data gaps, reported per column rather than as one number: each
    // needs a different person to fix.
    missing: { ref_des: 0, component: 0, resource: 0, nc_description: 0 },
    log_records: log.length,
    log,
  };
};

/** SPI defect-code display labels. The vocabulary comes from the machine, so
 *  the label is carried rather than derived in the UI. */
const SPI_LABELS = {
  VOLUME_LOW: "Insufficient volume",
  VOLUME_HIGH: "Excessive volume",
  AREA_LOW: "Insufficient area",
  OFFSET_X: "Offset in X",
  OFFSET_Y: "Offset in Y",
  BRIDGING: "Bridging",
};

/**
 * SPI pad inspection — level two for SPI.
 *
 * A different shape from every other step's level two, and the one most easily
 * got wrong: `pads` and `boards` are DIFFERENT UNITS and must never be added.
 * Eleven bad pads of the same fault is ONE failed board, not eleven.
 *
 * Field names follow SpiPadRow / SpiDefectsResponse: the pad log calls the
 * machine `tester_id` (not `resource`), carries `slno`, and reports the
 * measurement as bare `volume`/`area`/`offset_x` percentages of the programmed
 * target with no unit.
 */
const spiDefectsFor = (day, item, boardsFailed) => {
  const product = PRODUCTS.find((p) => p.item === item);
  const rng = rngFor(SEED, "spi", day, item);
  // Several bad pads land on one board, so pads exceed failed boards.
  const pads = boardsFailed <= 0
    ? 0
    : boardsFailed + Math.round(boardsFailed * float(rng, 0.2, 1.6, 3));
  const padLog = [];
  const boardPads = new Map();
  const byCode = {}, byComp = {}, byTester = {}, bySide = {};
  let released = 0;

  for (let i = 0; i < pads; i++) {
    const erng = rngFor(SEED, "spi", day, item, i);
    const shift = pick(erng, SHIFT_LETTERS);
    // Pads cluster onto a smaller set of boards, which is the whole point of
    // the pads-vs-boards distinction.
    const boardIdx = int(erng, 0, Math.max(0, boardsFailed - 1));
    const sfc = `24${10000000 + boardIdx * 137 + (hashBoard(day, item) % 1000)}`;
    const code = weighted(erng, SPI_DEFECT_CODES);
    const refIdx = int(erng, 0, REF_DES.length - 1);
    const side = chance(erng, 0.6) ? "T" : "B";
    const tester = `SPI00${int(erng, 1, 2)}`;
    // Flagged by the machine, then released by an operator. Stays in the log
    // but is NOT in `defects`, which is why the table and the chart above it
    // can legitimately disagree.
    const cleared = chance(erng, 0.08);
    if (cleared) released += 1;

    boardPads.set(sfc, (boardPads.get(sfc) ?? 0) + 1);
    const bump = (map, key) => {
      map[key] = map[key] ?? { pads: 0, boards: new Set(), defects: new Set() };
      map[key].pads += 1;
      map[key].boards.add(sfc);
      map[key].defects.add(code);
    };
    if (!cleared) bump(byCode, code);
    bump(byComp, COMPONENTS[refIdx]);
    bump(byTester, tester);
    bump(bySide, side);

    padLog.push({
      slno: i + 1,
      sfc,
      pcb_side: side,
      tester_id: tester,
      pad_id: int(erng, 1, 9999),
      component: COMPONENTS[refIdx],
      pin: `${int(erng, 1, 48)}`,
      result_name: cleared ? "RELEASED" : "NG",
      defect_result_name: code,
      cleared,
      // Percentage of the programmed target: 100 nominal, 164 over-printed,
      // 26 starved. The source documents no unit.
      volume: float(erng, 26, 168, 1),
      height: float(erng, 40, 160, 1),
      area: float(erng, 42, 155, 1),
      offset_x: float(erng, -45, 45, 1),
      offset_y: float(erng, -45, 45, 1),
      pos_x: float(erng, 0, 280, 2),
      pos_y: float(erng, 0, 190, 2),
      // Pad geometry in microns, not millimetres: the viewer renders
      // `pad_width × pad_height` as whole numbers, so sub-millimetre values
      // display as "0 × 0".
      pad_width: int(erng, 200, 1800),
      pad_height: int(erng, 200, 1400),
      panel_result_name: "NG",
      panel_defect_result_name: code,
      board_time: timestampIn(day, shift, int(erng, 0, SHIFT_MINUTES - 1), int(erng, 0, 59)),
    });
  }
  padLog.sort((a, b) => (a.board_time ?? "").localeCompare(b.board_time ?? ""));
  padLog.forEach((row, i) => { row.slno = i + 1; });

  const okBoards = Math.max(0, (product?.dailyVolume ?? 0) - boardsFailed);
  const failedBoardCount = boardPads.size;

  return {
    step: "SPI",
    item,
    product_name: product?.product ?? item,
    business_date: day,
    parent: {
      boards: failedBoardCount + okBoards,
      ok: okBoards,
      failed: failedBoardCount,
      yield_pct: pct(okBoards, failedBoardCount + okBoards),
    },
    selection: { boards: failedBoardCount, pads: padLog.length },
    defects: Object.entries(byCode)
      .map(([code, v]) => ({
        code,
        label: SPI_LABELS[code] ?? code,
        pads: v.pads,
        boards: v.boards.size,
        pct_of_failed_boards: pct(v.boards.size, failedBoardCount),
      }))
      .sort((a, b) => b.pads - a.pads),
    components: Object.entries(byComp)
      .map(([component, v]) => ({
        component,
        pads: v.pads,
        boards: v.boards.size,
        defects: [...v.defects],
      }))
      .sort((a, b) => b.pads - a.pads),
    testers: Object.entries(byTester).map(([tester_id, v]) => ({ tester_id, pads: v.pads })),
    sides: Object.entries(bySide).map(([pcb_side, v]) => ({ pcb_side, pads: v.pads })),
    released,
    // NG boards with no pad rows at all — real failures the source cannot
    // explain. Surfaced rather than swallowed.
    unexplained: { boards: 0, sfcs: [] },
    duplicate_source_rows: 0,
    boards: [...boardPads.entries()].map(([sfc, padCount]) => {
      const first = padLog.find((p) => p.sfc === sfc);
      return {
        sfc,
        board_time: first?.board_time ?? null,
        panel_barcode: `${item}S${sfc}P1L1`,
        process_lot: `L${sfc.slice(-4)}`,
        tester_id: first?.tester_id ?? null,
        pads: padCount,
      };
    }),
    pad_log: padLog,
  };
};

/** Stable per-(day,item) board-number offset, so SFCs differ between products
 *  without being random. */
const hashBoard = (day, item) => {
  let h = 0;
  for (const ch of `${day}${item}`) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
};

/** Cause column headings, as the plant's report names them. */
const CAUSE_LABELS = {
  FCR: "FCR", SMT: "SMT", PPH: "PPH", PPF: "PPF",
  PPA: "PPA", SQA: "SQA", MOD_REJ: "MOD REJ",
};

/**
 * Tester attribution for one product at one step.
 *
 * Field names follow ProductTestersResponse exactly — `tested`/`ftp`/`failed`/
 * `ftpy_pct`, not the done/ok/yield_pct used elsewhere in the API. The table
 * reads its cause COLUMNS from `totals.causes`, so that array must exist even
 * when every count in it is zero, or the header renders nothing and the
 * component throws on `causes.length`.
 *
 * `doneBoards` / `failedBoards` come from the level-one row, so the tester rows
 * sum back to the table above them.
 *
 * The totals row is deliberately NOT the sum of the tester rows for the cause
 * and unit counts: a unit that ran three machines counts at each of them (right
 * for a tester) but is one unit for the product. The yield columns DO sum.
 */
const testersForItem = (step, day, item, doneBoards, failedBoards) => {
  const product = PRODUCTS.find((p) => p.item === item);
  const resources = testersFor(step.step);
  const perDone = splitByWeight(
    doneBoards,
    Object.fromEntries(resources.map((r, i) => [r, 1 + ((i * 7) % 5) / 10])),
  );
  const perFailed = splitByWeight(
    failedBoards,
    Object.fromEntries(resources.map((r, i) => [r, 1 + ((i * 3) % 4) / 10])),
  );

  /** Verified cause split for a failure count, honouring each step's quirks. */
  const causesFor = (failed, keyParts) =>
    CAUSE_CATEGORIES.map(([code]) => {
      const units =
        // THERMAL_AVI's cause columns are always zero (no verified row carries
        // a category) and AUTO_OGI's are FCR-only. Reproduced, not smoothed:
        // an empty breakdown beside a real failure count is what the floor
        // actually sees while a review is outstanding.
        step.step === "THERMAL_AVI"
          ? 0
          : step.step === "AUTO_OGI" && code !== "FCR"
            ? 0
            : Math.round(
                failed *
                  float(rngFor(SEED, "cause", day, step.step, item, ...keyParts, code), 0, 0.3, 3),
              );
      return {
        code,
        label: CAUSE_LABELS[code] ?? code,
        units,
        pct_of_tested: null,
      };
    });

  const testers = resources.map((resource) => {
    const tested = perDone[resource] ?? 0;
    const failed = Math.min(tested, perFailed[resource] ?? 0);
    const shiftTested = splitByWeight(tested, SHIFT_WEIGHT);
    const shiftFailed = splitByWeight(failed, SHIFT_WEIGHT);
    const shifts = {};
    for (const s of SHIFT_LETTERS) {
      const st = shiftTested[s];
      const sf = Math.min(st, shiftFailed[s]);
      shifts[s] = { tested: st, ftp: st - sf, failed: sf, ftpy_pct: pct(st - sf, st) };
    }
    const causes = causesFor(failed, [resource]);
    const verified = causes.reduce((a, c) => a + c.units, 0);
    const pending = Math.max(0, Math.min(failed - verified, Math.round(failed * 0.3)));
    return {
      resource,
      tested,
      ftp: tested - failed,
      failed,
      ftpy_pct: pct(tested - failed, tested),
      shifts,
      causes: causes.map((c) => ({ ...c, pct_of_tested: pct(c.units, tested) })),
      uncaused_units: Math.max(0, failed - verified),
      pending_units: pending,
      undispositioned_units: Math.max(0, failed - verified - pending),
    };
  });

  const sum = (k) => testers.reduce((a, t) => a + (t[k] ?? 0), 0);
  const tested = sum("tested");
  // Distinct units for the product, which is why this is its own draw rather
  // than a sum of the rows.
  const totalCauses = causesFor(failedBoards, ["TOTAL"]).map((c) => ({
    ...c,
    pct_of_tested: pct(c.units, tested),
  }));
  const verifiedUnits = totalCauses.reduce((a, c) => a + c.units, 0);
  const pendingUnits = Math.max(
    0,
    Math.min(failedBoards - verifiedUnits, Math.round(failedBoards * 0.28)),
  );
  const unmapped = failedBoards > 20 ? 1 : 0;
  return {
    step: step.step,
    item,
    product_name: product?.product ?? item,
    business_date: day,
    parent: { item, product_name: product?.product ?? item, step: step.step, business_date: day },
    operations: {
      test: [`${step.step}_TEST_IN04`],
      rework: [`${step.step}_REWORK_IN04`],
    },
    testers,
    totals: {
      tested,
      ftp: sum("ftp"),
      failed: sum("failed"),
      ftpy_pct: pct(sum("ftp"), tested),
      causes: totalCauses,
      uncaused_units: Math.max(0, failedBoards - verifiedUnits),
      verified_units: verifiedUnits,
      pending_units: pendingUnits,
      undispositioned_units: Math.max(0, failedBoards - verifiedUnits - pendingUnits - unmapped),
      unmapped_units: unmapped,
      failed_units: failedBoards,
    },
    cause_rule: "verified NC dispositions within the production day",
  };
};

// ── DPMOI and screw defects ─────────────────────────────────────────────────

const dpmoiFor = (day) => {
  const rows = [];
  for (const p of PRODUCTS) {
    const rng = rngFor(SEED, "dpmoi", day, p.item);
    if (chance(rng, 0.2)) continue;
    for (const operation of DPMOI_OPERATIONS) {
      const orng = rngFor(SEED, "dpmoi", day, p.item, operation);
      const boards = scaled(Math.round(p.dailyVolume * float(orng, 0.6, 1.1, 4)));
      const opportunities = boards * int(orng, 180, 240);
      const defects = Math.round(opportunities * float(orng, 0.000003, 0.000014, 8));
      rows.push({
        item: p.item, product_name: p.product, operation,
        boards, defects, opportunities,
        index: opportunities > 0 ? Math.round((defects / opportunities) * 1e6 * 100) / 100 : null,
      });
    }
  }
  const sum = (k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const defects = sum("defects"), opportunities = sum("opportunities");
  return {
    rows,
    totals: {
      boards: sum("boards"), defects, opportunities,
      index: opportunities > 0 ? Math.round((defects / opportunities) * 1e6 * 100) / 100 : null,
    },
    missing_opportunities: [],
    operations: { in: DPMOI_OPERATIONS },
    range: { from: day, to: day },
    shift: null,
  };
};

const screwDefectsFor = (day) => {
  const rows = [];
  for (const line of LINES.filter((l) => l.startsWith("MAC"))) {
    for (const operation of SCREW_OPERATIONS) {
      for (const p of PRODUCTS.filter((q) => q.sub_module === "UNIT")) {
        const rng = rngFor(SEED, "screw", day, line, operation, p.item);
        if (chance(rng, 0.3)) continue;
        const boards = scaled(Math.round(p.dailyVolume * float(rng, 0.4, 0.9, 4)));
        const screws = boards * screwsFor(p.item);
        const failed = Math.round(screws * float(rng, 0.0008, 0.012, 6));
        rows.push({
          line, operation, item: p.item, product_name: p.product,
          boards, screws_driven: screws, screws_failed: failed,
          no_of_screws: screwsFor(p.item),
          failure_pct: pct(failed, screws),
        });
      }
    }
  }
  const sum = (k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  return {
    rows,
    totals: {
      boards: sum("boards"), screws_driven: sum("screws_driven"),
      screws_failed: sum("screws_failed"),
      failure_pct: pct(sum("screws_failed"), sum("screws_driven")),
    },
    uncovered: [],
    operations: { in: SCREW_OPERATIONS },
    range: { from: day, to: day },
    shift: null,
  };
};

// ── Alerts, safety, ERI, recommendations ────────────────────────────────────

const attentionFor = (day) => {
  const rng = rngFor(SEED, "alerts", day);
  const n = int(rng, 3, 6);
  const alerts = [];
  for (let i = 0; i < n; i++) {
    const t = ALERT_TEMPLATES[(i + day.charCodeAt(9)) % ALERT_TEMPLATES.length];
    const arng = rngFor(SEED, "alerts", day, i);
    const target = float(arng, 95, 99, 2);
    const current = Math.round((target - float(arng, 0.4, 5.5, 2)) * 100) / 100;
    alerts.push({
      id: `${day}-alert-${i + 1}`,
      entity_ref: `${day}-alert-${i + 1}`,
      title: t.title,
      age_minutes: int(arng, 4, 460),
      current_value: current,
      target_value: target,
      unit: t.unit,
      deviation: Math.round((current - target) * 100) / 100,
      severity: t.severity,
      impact: t.impact,
      ai_recommendation: "Check the station log for the preceding hour and confirm the fixture seating.",
    });
  }
  return { alerts };
};

const safetyFixture = () => {
  const periods = DAY_LABELS.filter((_, i) => i % 5 === 0).map((day, i) => {
    const rng = rngFor(SEED, "safety", day);
    return {
      period: periodMonthOf(day) + `-${i}`,
      period_code: `P${`${i + 1}`.padStart(2, "0")}`,
      incident: int(rng, 0, 2),
      near_miss: int(rng, 0, 6),
    };
  });
  const last = periods[periods.length - 1] ?? { incident: 0, near_miss: 0 };
  return {
    current: {
      incident: last.incident, near_miss: last.near_miss,
      incident_target: 0, near_miss_target: 4,
    },
    periods,
  };
};

const eriFixture = () => {
  const rng = rngFor(SEED, "eri");
  const deliveries = int(rng, 18000, 26000);
  const returns = int(rng, 40, 190);
  const eri = Math.round((returns / deliveries) * 1e6) / 100;
  return {
    eri: {
      period: periodMonthOf(ANCHOR),
      fiscal_year: Number(ANCHOR.slice(0, 4)),
      period_code: `P${ANCHOR.slice(5, 7)}`,
      period_num: Number(ANCHOR.slice(5, 7)),
      period_start: `${ANCHOR.slice(0, 7)}-01`,
      period_end: ANCHOR,
      deliveries, returns,
      eri_pct: eri,
      target_pct: 10,
      status: eri <= 10 ? "healthy" : eri <= 12 ? "at_risk" : "critical",
    },
    customer_complaints: {
      latest: { count: int(rng, 1, 7) },
      months: DAY_LABELS.filter((_, i) => i % 6 === 0).map((day) => ({
        period_month: periodMonthOf(day),
        count: int(rngFor(SEED, "complaints", day), 0, 9),
      })),
    },
  };
};

const yieldRecommendationFixture = () => ({
  plan_month: periodMonthOf(ANCHOR),
  plan_available: true,
  products: PRODUCTS.map((p) => {
    const rng = rngFor(SEED, "yr", p.item);
    const planned = p.sub_module === "UNIT" ? scaled(p.dailyVolume * 24) : null;
    const tested = scaled(Math.round(p.dailyVolume * float(rng, 12, 20, 3)));
    const current = float(rng, 0.88, 0.985, 4);
    const target = p.target_yield;
    const remaining = planned == null ? null : Math.max(0, planned - tested);
    const required = target == null || remaining == null || remaining === 0
      ? null
      : Math.min(1, Math.max(0, float(rng, 0.9, 1.0, 4)));
    const best = float(rng, 0.95, 0.995, 4);
    const achievability = target == null ? "NOT_APPLICABLE"
      : current >= target ? "ACHIEVED"
        : required != null && required > best ? "UNLIKELY"
          : required != null ? "ACHIEVABLE" : "NOT_ACHIEVABLE";
    return {
      product: p.product, item: p.item,
      tested_quantity: tested,
      planned_quantity: planned,
      remaining_quantity: remaining,
      current_yield: current,
      target_yield: target,
      required_future_yield: required,
      best_historical_yield: best,
      mathematical_status: required == null ? "n/a" : required <= 1 ? "possible" : "impossible",
      historical_status: required != null && required > best ? "unprecedented" : "within record",
      achievability,
      recommendation: null,
    };
  }),
});

// ── SSE snapshot frames ─────────────────────────────────────────────────────

/**
 * Frames replayed by the simulator, in order.
 *
 * Frame 0 of each stream is the first paint, so every panel has data before any
 * interval fires. Later frames nudge the live figures so the dashboard visibly
 * moves without the numbers wandering away from the fixtures.
 */
const realtimeFor = (day, rows, kpiAcc, processSteps, latestAudit, hftpy, shopFloor, attention, safety, eri, ci) => {
  const meta = {
    shift: { name: "Full Day", start: "06:15 AM", end: "06:15 AM" },
    status: "ONLINE",
  };
  // The audit is a PLANT score signed off the day after the shift it covers, so
  // today's is never filed yet. The live card therefore carries the newest
  // score that EXISTS, not today's.
  //
  // It has to be present: QualityLayout falls back to 0 for a KPI it cannot
  // find, and a Customer Quality Audit reading 0.0% against a target of 100%
  // looks like a catastrophic failure rather than a missing figure.
  const kpiDay = { ...metricsFrom(kpiAcc.D), customer_audit: latestAudit };
  const frames = [
    { stream: "productYield", at: 0, payload: { meta, product_yield: { rows } } },
    { stream: "processPerformance", at: 0, payload: { meta, process_performance: processSteps } },
    {
      stream: "other", at: 0,
      payload: {
        meta,
        kpis: {
          day: kpiDay,
          by_shift: SHIFT_LETTERS.map((s) => ({ shift: s, ...metricsFrom(kpiAcc[s]) })),
          delta_vs_yesterday: { fpy_unit: 0.4, spy_unit: -0.2, fpy_module: 0.9, spy_module: 0.1, customer_audit: 0.3 },
          trend: {
            buckets: SHIFT_LETTERS.flatMap((s) =>
              [0, 1].map((i) => ({
                shift: s, index: i,
                today: metricsFrom(kpiAcc[s]),
                yesterday: metricsFrom(kpiAcc[s]),
              })),
            ),
          },
        },
        hftpy, shop_floor: shopFloor, attention, safety,
        sustainability: ci.sustainability,
        customer_complaints: eri.customer_complaints,
        eri: eri.eri,
        ci: { months: ci.months },
      },
    },
  ];

  // Three nudges per stream, 6s apart at 1x. Enough to prove the stream is live
  // without the tiles churning.
  for (let i = 1; i <= 3; i++) {
    const rng = rngFor(SEED, "sse", day, i);
    frames.push({
      stream: "processPerformance",
      at: i * 6000,
      payload: { meta, process_performance: processSteps },
    });
    frames.push({
      stream: "other",
      at: i * 6000 + 1500,
      payload: {
        meta,
        kpis: {
          day: {
            ...kpiDay,
            fpy_unit: Math.round((kpiDay.fpy_unit + float(rng, -0.25, 0.25, 2)) * 100) / 100,
          },
          by_shift: SHIFT_LETTERS.map((s) => ({ shift: s, ...metricsFrom(kpiAcc[s]) })),
        },
        attention,
      },
    });
  }

  frames.sort((a, b) => a.at - b.at);
  return { frames };
};

// ── Main ────────────────────────────────────────────────────────────────────

const main = async () => {
  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const perDayRows = new Map();
  const perDayKpi = new Map();

  for (const day of DAY_LABELS) {
    // Product yield + the KPI counts derived from the SAME rows.
    const rows = yieldRowsFor(day);
    perDayRows.set(day, rows);
    const acc = kpiCountsFor(day, rows);
    perDayKpi.set(day, acc);

    await write(`summaries/product-yield-${day}.json`, { rows });
    countRows("product_yield", rows.length);

    await write(`summaries/kpis-${day}.json`, {
      business_date: day,
      by_shift: SHIFT_LETTERS.map((s) => ({ shift: s, ...metricsFrom(acc[s]) })),
      day: metricsFrom(acc.D),
      customer_audit: auditFor(day),
    });
    countRows("kpi_days", 1);

    // Process performance.
    const steps = processPerformanceFor(day);
    await write(`summaries/process-performance-${day}.json`, { steps });
    countRows("process_steps", Object.keys(steps).length);

    // Trend buckets are already inside the per-step payload; the hourly
    // partition carries the same buckets alone so a sparkline refresh does not
    // pull the whole strip.
    await write(`hourly/process-trend-${day}.json`, {
      steps: Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v.trend])),
    });

    // Dropdown options, from the products that actually ran.
    const ranItems = [...new Set(rows.map((r) => r.item))];
    await write(`summaries/products-${day}.json`, {
      products: ranItems.map((item) => {
        const p = PRODUCTS.find((q) => q.item === item);
        const d = rows.find((r) => r.item === item && r.shift === "D");
        return {
          item, product: p.product, label: optionLabel(p),
          sub_module: p.sub_module, tested: d?.tested ?? 0,
          level: kpiLevelOf(p),
        };
      }).sort((a, b) => a.product.localeCompare(b.product)),
    });
    countRows("product_options", ranItems.length);

    // Level-one breakdowns per step. Kept in memory for this day because every
    // level-two payload below is derived from them.
    const stepRows = new Map();
    for (const step of ALL_STEPS) {
      if (!step.drilldown) continue;
      const payload = stepProductsFor(step, day);
      stepRows.set(step.step, payload.rows);
      await write(`stations/${step.step}/products-${day}.json`, payload);
      countRows("step_products", payload.rows.length);
    }

    // Level two, grouped per (step, day) and keyed by item.
    //
    // Not one file per item: that produced ~9,000 tiny files for a 30-day set,
    // which is slow to clone, slow to copy into dist, and buys nothing — a
    // step's whole-day log is ~100 rows, so the partition is already small.
    // One request per (step, day) still means a drill-down never reads another
    // step's data.
    //
    // Every level-two payload is derived from the level-one rows above it, so
    // the log and the table it opened from always agree.
    for (const step of ALL_STEPS) {
      if (!step.ncLog) continue;
      const levelOne = stepRows.get(step.step) ?? [];
      const defectsByItem = {};
      const testersByItem = {};
      for (const row of levelOne) {
        const nc = ncLogFor(step, day, row.item, row.done, row.failed);
        defectsByItem[row.item] = nc;
        countRows("nc_log", nc.nc_log.length);
        const t = testersForItem(step, day, row.item, row.done, row.failed);
        testersByItem[row.item] = t;
        countRows("testers", t.testers.length);
      }
      await write(`events/${step.step}/defects-${day}.json`, { byItem: defectsByItem });
      await write(`stations/${step.step}/testers-${day}.json`, { byItem: testersByItem });
    }

    const smtByItem = {};
    for (const row of stepRows.get("SMT_DEFECTS") ?? []) {
      const smt = smtDefectsFor(day, row.item, row.failed, row.defect_records ?? row.failed);
      smtByItem[row.item] = smt;
      countRows("smt_log", smt.log.length);
    }
    await write(`events/SMT_DEFECTS/defects-${day}.json`, { byItem: smtByItem });

    const spiByItem = {};
    for (const row of stepRows.get("SPI") ?? []) {
      const spi = spiDefectsFor(day, row.item, row.failed);
      spiByItem[row.item] = spi;
      countRows("spi_pad_log", spi.pad_log.length);
    }
    await write(`events/SPI/defects-${day}.json`, { byItem: spiByItem });

    const dpmoi = dpmoiFor(day);
    await write(`events/dpmoi/${day}.json`, dpmoi);
    countRows("dpmoi", dpmoi.rows.length);

    const screw = screwDefectsFor(day);
    await write(`events/screw-defects/${day}.json`, screw);
    countRows("screw_defects", screw.rows.length);

    const attention = attentionFor(day);
    await write(`events/attention-${day}.json`, attention);
    countRows("alerts", attention.alerts.length);
  }

  // Single-file fixtures.
  await write("summaries/safety.json", safetyFixture());
  const eri = eriFixture();
  await write("summaries/eri.json", eri);
  await write("summaries/yield-recommendation.json", yieldRecommendationFixture());

  // Process filter options: one entry per card plus "KPI" for the four FPY/SPY
  // cards. Products here are the ones that ran on the anchor day.
  const anchorRows = perDayRows.get(ANCHOR) ?? [];
  const anchorItems = [...new Set(anchorRows.map((r) => r.item))];
  const optionFor = (item, volumeKey) => {
    const p = PRODUCTS.find((q) => q.item === item);
    const d = anchorRows.find((r) => r.item === item && r.shift === "D");
    return {
      item, product: p.product, label: optionLabel(p),
      sub_module: p.sub_module, [volumeKey]: d?.tested ?? 0,
      level: kpiLevelOf(p),
    };
  };
  await write("summaries/process-filter-options.json", {
    site_code: "IN04",
    line_steps: LINE_STEPS,
    steps: {
      KPI: { products: anchorItems.map((i) => optionFor(i, "done")), lines: [] },
      ...Object.fromEntries(
        STEPS.map((s) => [
          s.step,
          {
            products: anchorItems
              .filter((i) => {
                const p = PRODUCTS.find((q) => q.item === i);
                return s.step === "SCREW_DEFECTS" ? p.sub_module === "UNIT" : true;
              })
              .map((i) => optionFor(i, "done")),
            lines: s.lines,
          },
        ]),
      ),
    },
  });

  // Alert acknowledgement: one token that opens a live form, one already acked.
  await write("events/alerts-ack.json", {
    "demo-token-open": {
      can_reply: true,
      ack_state: "open",
      title: "SPI volume drift on SMT_LINE01",
      detail_lines: [
        { label: "Station", value: "SPI001" },
        { label: "Line", value: "SMT_LINE01" },
        { label: "Current", value: "94.10%" },
        { label: "Target", value: "98.00%" },
      ],
      comment_max_length: 500,
      snooze_min: 1,
      snooze_max: 7,
      deadline_at: `${ANCHOR}T18:00:00`,
    },
    "demo-token-acked": {
      can_reply: false,
      ack_state: "acknowledged",
      title: "AXI first-pass yield below target",
      detail_lines: [{ label: "Station", value: "AXI002" }],
      comment_max_length: 500,
      snooze_min: 1,
      snooze_max: 7,
      deadline_at: `${ANCHOR}T12:00:00`,
    },
  });

  // Realtime frames for the anchor day only: the snapshot is always "today".
  const ciRng = rngFor(SEED, "ci");
  const ci = {
    months: DAY_LABELS.filter((_, i) => i % 6 === 0).map((day) => ({
      label: periodMonthOf(day),
      period_month: periodMonthOf(day),
      lean_savings: int(rngFor(SEED, "ci", day), 180000, 920000),
      kaizen: int(rngFor(SEED, "ci", day, "k"), 3, 24),
    })),
    sustainability: {
      green_energy_pct: { value: float(ciRng, 58, 78, 1) },
      co2_emission_tco2: {
        value: float(ciRng, 1050, 1480, 1),
        trend: DAY_LABELS.slice(-7).map((d) => float(rngFor(SEED, "co2", d), 1020, 1500, 1)),
        trend_labels: DAY_LABELS.slice(-7).map((d) => d.slice(5)),
      },
    },
  };
  const hftpyRng = rngFor(SEED, "hftpy", ANCHOR);
  const actual = float(hftpyRng, 88, 95, 1);
  const projection = Math.round((actual + float(hftpyRng, 0.5, 3.2, 1)) * 10) / 10;
  await write(
    "realtime/snapshots.json",
    realtimeFor(
      ANCHOR,
      perDayRows.get(ANCHOR) ?? [],
      perDayKpi.get(ANCHOR),
      processPerformanceFor(ANCHOR),
      // Newest audited day, walking back from the anchor. Today is unaudited by
      // design, so this is normally yesterday.
      DAY_LABELS.map(auditFor).filter((s) => s != null).slice(-1)[0] ?? null,
      {
        actual_pct: actual,
        projection_pct: projection,
        delta_vs_projection: Math.round((actual - projection) * 10) / 10,
        projection_is_hardcoded: false,
      },
      { temp_c: float(rngFor(SEED, "sf", ANCHOR), 21.8, 24.4, 1), humidity_pct: float(rngFor(SEED, "sf2", ANCHOR), 49, 55, 1), hour_of_day: 11 },
      attentionFor(ANCHOR),
      { accident: { value: 0, trend: [0, 0, 0] }, near_miss: { value: int(rngFor(SEED, "nm"), 1, 5), trend: [2, 3, 2] } },
      eri,
      ci,
    ),
  );

  const totalRows = Object.values(rowCounts).reduce((a, n) => a + n, 0);
  await write("manifest.json", {
    version: MANIFEST_VERSION,
    seed: SEED,
    anchorDate: ANCHOR,
    days: DAY_LABELS,
    files: files.filter((f) => f !== "manifest.json").sort(),
    stats: { rows: rowCounts, totalRows, bytes: totalBytes },
  });

  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(`demo fixtures -> ${path.relative(process.cwd(), OUT)}`);
  console.log(`  days ${DAYS}  volume x${VOLUME}  seed "${SEED}"  anchor ${ANCHOR}`);
  console.log(`  ${files.length} files, ${totalRows.toLocaleString("en-US")} rows, ${mb} MB`);
  for (const [k, v] of Object.entries(rowCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(18)} ${v.toLocaleString("en-US")}`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
