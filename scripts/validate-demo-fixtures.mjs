// Validates the demo fixture set. Runs as the first step of `npm run build:demo`.
//
//   node scripts/validate-demo-fixtures.mjs [--deep]
//
// Dependency-free by design: the repo has no test framework and the brief rules
// out adding one, so this follows the scripts/check-palette.mjs convention —
// plain Node, assert-and-exit-1.
//
// WHAT THIS PROVES
//   - the manifest matches what is on disk
//   - detail rows reconcile with the summaries above them
//   - A + B + C reconciles with the separately-stored D row
//   - percentages are derived from counts, not averaged
//   - status follows the real thresholds, and no_target is never a failure
//   - timestamps fall inside the production day they are filed under
//   - the generator's production-day boundary agrees with the app's
//   - regeneration with the same seed is byte-identical (--deep)
//
// WHAT THIS DOES NOT PROVE
//   It cannot render a React component, so "every screen works" is a browser
//   check, not something this script can claim. Those results are recorded in
//   src/demo/README.md as manual verification.

import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { productionDayOfTs } from "./lib/clock.mjs";

const ROOT = path.resolve("public/demo-data");
const DEEP = process.argv.includes("--deep");

const problems = [];
const notes = [];
let checks = 0;

const fail = (msg) => problems.push(msg);
const ok = () => { checks += 1; };

const check = (condition, msg) => {
  if (condition) ok();
  else fail(msg);
};

const readJson = async (rel) =>
  JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));

/** Within rounding of each other. Percentages are 2dp, so sub-0.01 drift from
 *  integer division is expected and not a fault. */
const near = (a, b, tol = 0.011) =>
  a == null && b == null ? true : Math.abs((a ?? 0) - (b ?? 0)) <= tol;

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 10000) / 100 : null);

const main = async () => {
  if (!existsSync(ROOT)) {
    console.error(
      `No fixtures at ${path.relative(process.cwd(), ROOT)}.\n` +
        `Run: npm run demo:fixtures`,
    );
    process.exit(1);
  }

  // ── Manifest vs disk ─────────────────────────────────────────────────────
  const manifest = await readJson("manifest.json");
  check(manifest.version === 1, `manifest.version is ${manifest.version}, expected 1`);
  check(typeof manifest.seed === "string" && manifest.seed.length > 0, "manifest.seed missing");
  check(/^\d{4}-\d{2}-\d{2}$/.test(manifest.anchorDate), `bad anchorDate ${manifest.anchorDate}`);
  check(manifest.days.length > 0, "manifest lists no days");

  const walk = async (dir) => {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await walk(abs)));
      else out.push(path.relative(ROOT, abs).replace(/\\/g, "/"));
    }
    return out;
  };
  const onDisk = (await walk(ROOT)).filter((f) => f !== "manifest.json").sort();
  const listed = [...manifest.files].sort();

  const missing = listed.filter((f) => !onDisk.includes(f));
  const extra = onDisk.filter((f) => !listed.includes(f));
  check(missing.length === 0, `manifest lists ${missing.length} file(s) not on disk, e.g. ${missing[0]}`);
  check(extra.length === 0, `${extra.length} file(s) on disk not in the manifest, e.g. ${extra[0]}`);

  let bytes = 0;
  for (const f of onDisk) bytes += (await stat(path.join(ROOT, f))).size;
  notes.push(`${onDisk.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB on disk`);

  // ── The production-day boundary agrees with the app's rule ───────────────
  // Same vectors productionDayOf in dashboardFilters.ts must satisfy. A drift
  // here would file rows outside their own day, which shows up as an empty
  // drill-down rather than an error.
  const vectors = [
    ["2026-09-12T06:15", "2026-09-12"],
    ["2026-09-12T06:14", "2026-09-11"],
    ["2026-09-12T02:00", "2026-09-11"],
    ["2026-09-12T23:59", "2026-09-12"],
    ["2026-09-01T00:00", "2026-08-31"],
  ];
  for (const [input, expected] of vectors) {
    check(
      productionDayOfTs(input) === expected,
      `production-day boundary drift: ${input} -> ${productionDayOfTs(input)}, expected ${expected}`,
    );
  }

  // ── Per-day invariants ───────────────────────────────────────────────────
  let yieldRows = 0;
  let ncRows = 0;

  for (const day of manifest.days) {
    const yieldFixture = await readJson(`summaries/product-yield-${day}.json`);
    const rows = yieldFixture.rows;
    yieldRows += rows.length;

    // Status thresholds, and the no_target rule.
    for (const row of rows) {
      if (row.target_yield == null) {
        check(
          row.status === "no_target",
          `${day} ${row.item} has no target but status "${row.status}" — no_target must not read as a failure`,
        );
        continue;
      }
      const expected =
        row.fpy == null ? "unknown"
          : row.fpy >= row.target_yield ? "healthy"
            : row.fpy >= row.target_yield - 5 ? "warning"
              : "critical";
      check(
        row.status === expected,
        `${day} ${row.item} status "${row.status}" but fpy ${row.fpy} vs target ${row.target_yield} implies "${expected}"`,
      );
      // fpy must be derived from the counts, not stored independently.
      check(
        near(row.fpy, pct(row.tested - row.failed, row.tested)),
        `${day} ${row.item} fpy ${row.fpy} does not match counts (${row.tested - row.failed}/${row.tested})`,
      );
      check(
        row.spy == null || row.fpy == null || row.spy >= row.fpy - 0.011,
        `${day} ${row.item} spy ${row.spy} is below fpy ${row.fpy} — a retest cannot lose a pass`,
      );
    }

    // A + B + C must reconcile with the separately-stored D row.
    const byItem = new Map();
    for (const row of rows) {
      const acc = byItem.get(row.item) ?? { shifts: {}, d: null };
      if (row.shift === "D") acc.d = row;
      else acc.shifts[row.shift] = row;
      byItem.set(row.item, acc);
    }
    for (const [item, { shifts, d }] of byItem) {
      if (!d) continue;
      const sumTested = Object.values(shifts).reduce((a, r) => a + r.tested, 0);
      const sumFailed = Object.values(shifts).reduce((a, r) => a + r.failed, 0);
      check(
        sumTested === d.tested,
        `${day} ${item}: shifts sum to ${sumTested} tested but the D row says ${d.tested}`,
      );
      check(
        sumFailed === d.failed,
        `${day} ${item}: shifts sum to ${sumFailed} failed but the D row says ${d.failed}`,
      );
    }

    // KPI summary must agree with the yield rows it was derived from.
    const kpi = await readJson(`summaries/kpis-${day}.json`);
    const expectUnits = rows
      .filter((r) => r.shift === "D" && r.sub_module === "UNIT")
      .reduce((a, r) => a + r.tested, 0);
    const expectModules = rows
      .filter((r) => r.shift === "D" && r.sub_module !== "UNIT")
      .reduce((a, r) => a + r.tested, 0);
    check(
      kpi.day.units_tested === expectUnits,
      `${day}: KPI units_tested ${kpi.day.units_tested} but the yield rows total ${expectUnits}`,
    );
    check(
      kpi.day.modules_tested === expectModules,
      `${day}: KPI modules_tested ${kpi.day.modules_tested} but the yield rows total ${expectModules}`,
    );
    // Rule 1: the percentage comes from the summed counts.
    check(
      near(kpi.day.fpy_unit, pct(kpi.day.units_passed_fp, kpi.day.units_tested)),
      `${day}: fpy_unit ${kpi.day.fpy_unit} is not units_passed_fp/units_tested`,
    );
    // And it must NOT equal the mean of the three shift percentages, which is
    // the mistake the contract warns about. Skipped when volumes are even
    // enough that the two coincide.
    const shiftFpys = kpi.by_shift.map((s) => s.fpy_unit).filter((v) => typeof v === "number");
    if (shiftFpys.length === 3) {
      const mean = shiftFpys.reduce((a, v) => a + v, 0) / 3;
      if (Math.abs(mean - kpi.day.fpy_unit) > 0.25) ok();
      else notes.push(`${day}: weighted and naive-mean fpy_unit coincide (${kpi.day.fpy_unit}) — not a fault, just an even day`);
    }

    // The newest day must be unaudited: the audit is filed a day late.
    if (day === manifest.anchorDate) {
      check(
        kpi.customer_audit === null,
        `${day} is the newest day but carries an audit score — the audit is signed off the day after`,
      );
    }

    // Process performance: the day row is the sum of the shift rows.
    const pp = await readJson(`summaries/process-performance-${day}.json`);
    for (const [step, payload] of Object.entries(pp.steps)) {
      const sumDone = payload.by_shift.reduce((a, r) => a + (r.done ?? 0), 0);
      check(
        sumDone === payload.day.done,
        `${day} ${step}: shift rows sum to ${sumDone} done but the day row says ${payload.day.done}`,
      );
      // Trend buckets must be shift-tagged or getProcessTrendData discards them.
      const untagged = (payload.trend?.buckets ?? []).filter((b) => !b.shift);
      check(
        untagged.length === 0,
        `${day} ${step}: ${untagged.length} trend bucket(s) have no shift tag and would be dropped by the UI`,
      );
    }

    // Level two reconciles with level one, and timestamps sit in their own day.
    for (const dir of ["AXI", "IP", "UNIT_TEST", "MODULE_TEST"]) {
      const rel = `events/${dir}/defects-${day}.json`;
      if (!onDisk.includes(rel)) continue;
      const defects = await readJson(rel);
      const levelOne = await readJson(`stations/${dir}/products-${day}.json`);
      for (const [item, payload] of Object.entries(defects.byItem)) {
        const row = levelOne.rows.find((r) => r.item === item);
        if (!row) continue;
        check(
          payload.parent.failed === row.failed,
          `${day} ${dir} ${item}: NC log parent says ${payload.parent.failed} failed but the table says ${row.failed}`,
        );
        // Events can exceed failed boards (a retest raises a second record) but
        // must never be fewer.
        check(
          payload.nc_log.length >= row.failed,
          `${day} ${dir} ${item}: ${payload.nc_log.length} NC records for ${row.failed} failed boards`,
        );
        ncRows += payload.nc_log.length;
        for (const entry of payload.nc_log) {
          // NcLogRow calls the failure timestamp `date_time`, not `failed_at`.
          // Asserted by name on purpose: this check is what caught the field
          // being renamed when the fixtures were corrected against the type.
          check(
            productionDayOfTs(entry.date_time) === day,
            `${day} ${dir} ${item}: date_time ${entry.date_time} falls in production day ${productionDayOfTs(entry.date_time)}`,
          );
          check(
            !/[Zz]|[+-]\d{2}:\d{2}$/.test(entry.date_time),
            `${day} ${dir} ${item}: date_time ${entry.date_time} carries a timezone — productionDayOf would reject it`,
          );
          check(
            typeof entry.slno === "number" && entry.slno > 0,
            `${day} ${dir} ${item}: NC row has no slno`,
          );
        }
      }
    }
  }

  notes.push(`${yieldRows.toLocaleString("en-US")} yield rows, ${ncRows.toLocaleString("en-US")} NC records checked`);

  // ── Realtime frames ──────────────────────────────────────────────────────
  const realtime = await readJson("realtime/snapshots.json");
  check(realtime.frames.length > 0, "no snapshot frames");
  for (const stream of ["processPerformance", "productYield", "other"]) {
    const first = realtime.frames.filter((f) => f.stream === stream).sort((a, b) => a.at - b.at)[0];
    check(
      first && first.at === 0,
      `stream "${stream}" has no frame at t=0 — the dashboard would render empty until the first interval`,
    );
  }
  const ordered = realtime.frames.every((f, i, a) => i === 0 || a[i - 1].at <= f.at);
  check(ordered, "snapshot frames are not in chronological order");

  // ── Determinism ──────────────────────────────────────────────────────────
  if (DEEP) {
    const hashOf = async (files) => {
      const h = createHash("sha256");
      for (const f of files) h.update(await readFile(path.join(ROOT, f)));
      return h.digest("hex");
    };
    const before = await hashOf(onDisk);
    execFileSync(
      process.execPath,
      [
        "scripts/generate-demo-fixtures.mjs",
        "--out", "public/demo-data",
        "--seed", manifest.seed,
        "--anchor", manifest.anchorDate,
        "--days", String(manifest.days.length),
      ],
      { stdio: "ignore" },
    );
    const after = await hashOf(onDisk);
    check(
      before === after,
      "regenerating with the same seed produced different bytes — the generator is not deterministic",
    );
    notes.push("determinism: regenerated and compared sha256 over every file");
  } else {
    notes.push("determinism: skipped (run with --deep)");
  }

  // ── Report ───────────────────────────────────────────────────────────────
  for (const n of notes) console.log(`  · ${n}`);

  if (problems.length) {
    console.error(`\nFixture validation FAILED — ${problems.length} problem(s):\n`);
    // Capped: one broken invariant can repeat per day and the first few are
    // enough to identify it.
    for (const p of problems.slice(0, 25)) console.error(`  ✗ ${p}`);
    if (problems.length > 25) console.error(`  … and ${problems.length - 25} more`);
    process.exit(1);
  }

  console.log(`\nDemo fixtures OK — ${checks.toLocaleString("en-US")} assertions passed.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
