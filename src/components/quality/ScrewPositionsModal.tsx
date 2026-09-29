import { useMemo, useState } from "react";
import { isNum } from "../../core/format";
import RankedBarChart from "../charts/RankedBarChart.lazy";
import type { RankedBar } from "../charts/RankedBarChart";
import DrilldownModalShell from "./DrilldownModalShell";
import SortableTh, { type SortState } from "./SortableTh";
import { sortRows } from "./tableSort";
import DateRangeFilter from "./DateRangeFilter";
import { EMPTY_RANGE, type DateRange } from "./dashboardFilters";
import {
  useScrewPositions,
  type ScrewLogRow,
  type ScrewPositionRow,
} from "./useScrewPositions";

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";
const fmtNum = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString("en-US") : "—";

/** "1 screw" / "2 screws". A quiet station is the COMMON case on this screen —
 *  most stations break one or two screws a day — so "1 screws" and "1 fails" are
 *  what a reader sees most of the time, not an edge case worth an "(s)". */
const plural = (v: number | null | undefined, one: string, many?: string) => {
  const word = v === 1 ? one : (many ?? one + "s");
  return `${fmtNum(v)} ${word}`;
};

/** ROBOT_SCREW_01_IN04 -> "Robot Screw - 01". Same rule as the pane behind this
 *  modal, so a station is named identically on both screens. */
const stationLabel = (operation: string) => {
  const m = /^ROBOT_SCREW_(\w+?)(?:_IN04)?$/.exec(operation);
  return m ? `Robot Screw - ${m[1]}` : operation.replace(/_IN04$/, "");
};

const TH =
  "px-2 py-2 text-[9.5px] font-black uppercase tracking-wider text-ink-dim " +
  "whitespace-nowrap sticky top-0 bg-panel z-10 border-b border-line";
const TD = "px-2 py-1.5 whitespace-nowrap";

/** The two check chips are read-only — torque and angle are the only codes the
 *  stations raise, so filtering by one would just hide half the log. */
const CHIP =
  "border text-[9.5px] font-bold px-2 py-0.5 rounded uppercase whitespace-nowrap";
const CHIP_OFF = "bg-page text-ink-dim border-line";

/** Bars in the ranking. The map carries every position, so this only has to
 *  name the ones to look at first — see the note at the chart. */
const WORST_BARS = 6;

const NEUTRAL = "#3987e5";
const WARNING = "#eab308";
const CRITICAL = "#ff4c4c";
const QUIET = "#1e2c3f";

/**
 * Failed screws a position needs before its RATIO is allowed to colour it.
 *
 * Without a floor the ratio is meaningless on a good station. Robot Screw 06
 * broke 7 screws across 35 positions in a day: the mean per position is 0.4%, so
 * every position that failed even ONCE sits at five times the mean and the whole
 * map lit up critical — seven single failures reported as seven fixture faults.
 * A position has to fail a few times before "more than its share" means anything,
 * and until it does the honest colour is the neutral one.
 */
const MIN_SCREWS_TO_RANK = 3;

/**
 * A position's colour, against the STATION'S OWN average position rate.
 *
 * Deliberately not the card's 2% band. That target is a rate over screws driven;
 * a single position is driven once per board, so its rate runs an order of
 * magnitude higher by construction and every position would render critical
 * against it — which says nothing.
 *
 * The question this screen exists to answer is concentration: is one position
 * carrying more than its share? So the baseline is the station's own mean, and
 * the bands read as "about average", "twice average", "worse than that". A
 * station failing evenly across every position shows as a flat blue map, which
 * is the correct answer — that is material or calibration, not a fixture.
 */
const concentrationColour = (
  pct: number | null,
  mean: number | null,
  screws: number,
) => {
  if (!isNum(pct) || pct === 0 || screws === 0) return QUIET;
  if (!isNum(mean) || mean <= 0) return NEUTRAL;
  // Too few to read a ratio off. See MIN_SCREWS_TO_RANK.
  if (screws < MIN_SCREWS_TO_RANK) return NEUTRAL;
  const ratio = pct / mean;
  if (ratio >= 2) return CRITICAL;
  if (ratio >= 1.35) return WARNING;
  return NEUTRAL;
};

type Props = {
  line: string;
  operation: string;
  /** Null pools every product run at the station. */
  item?: string | null;
  productName?: string | null;
  businessDate?: string | null;
  /** The dashboard's date range when the modal was opened. Seeds the picker
   *  below; the modal then owns its own copy. */
  range?: DateRange | null;
  onClose: () => void;
};

/**
 * Which screw positions failed at one station — level three of the screw card.
 *
 * Level one is the line, level two its stations, and this is the screws
 * themselves. The distinction that drives the whole screen is CONCENTRATION: ten
 * failures spread over ten positions is material or torque calibration, and ten
 * failures on position 7 is a worn bit, a misaligned nest or a blocked feed. The
 * card's single percentage cannot tell those apart, and they go to different
 * people.
 *
 * Two views of the same numbers, because position is an ORDERED dimension and a
 * ranked list throws that ordering away:
 *
 *   The MAP is in board order, every position the master says exists, including
 *   the ones that never failed. Adjacent positions failing together is a corner
 *   of the board lifting — visible here and invisible in a sorted list.
 *
 *   The RANKING is worst-first, which is the order to work in.
 *
 * `screws` is the figure both are sized by, and it reconciles: summing it over
 * every position gives the station's `fail_count` from the table behind this
 * modal. `records` is larger, because one screw failing both the torque and the
 * angle check is two records and one screw.
 */
/** Sortable columns of the failure log. No `#`: that is the row ordinal, so
 *  sorting by it is the unsorted order the header's third click already gives
 *  back -- the same reason UNITS leaves its S.No column alone. */
type LogKey =
  | "sfc"
  | "position"
  | "check"
  | "achieved"
  | "failure_id"
  | "date_time";

export const ScrewPositionsModal: React.FC<Props> = ({
  line,
  operation,
  item,
  productName,
  businessDate,
  range = null,
  onClose,
}) => {
  /**
   * The window this modal is looking at.
   *
   * Seeded from the dashboard but owned here, so widening the range to see
   * whether a position keeps failing does NOT move the station table underneath
   * it. Same rule as the product drill-down, so both read the same way.
   */
  const [modalRange, setModalRange] = useState<DateRange>(range ?? EMPTY_RANGE);

  /** Column sorting for the failure log. The whole log is already here, so it
   *  sorts client-side like every other unpaginated table. */
  const [logSort, setLogSort] = useState<SortState<LogKey>>({
    key: null,
    order: "asc",
  });

  const { data, state, error } = useScrewPositions({
    line,
    operation,
    item,
    businessDate,
    range: modalRange,
  });

  /** One position's records, filtered client-side — the whole log is already
   *  here, and the breakdowns above must not move when it is picked. */
  const [position, setPosition] = useState<number | null>(null);

  const parent = data?.parent;

  /** The station's mean rate ACROSS POSITIONS — the baseline the map is read
   *  against. Failed screws over (boards x positions), which is the same figure
   *  as the station's screw defect rate when the master count is right. */
  const meanRate = useMemo(() => {
    if (!data || !parent?.boards || !parent.no_of_screws) return null;
    const opportunities = parent.boards * parent.no_of_screws;
    return opportunities ? (100 * data.screws_failed) / opportunities : null;
  }, [data, parent]);

  /** Every position the board HAS, in board order — not just the failed ones.
   *  A clean position is an answer, and leaving it out would make a board with
   *  two bad corners look like a board with two bad screws. */
  const mapCells = useMemo(() => {
    if (!data) return [];
    const byPosition = new Map<number, ScrewPositionRow>(
      data.positions.map((p) => [p.position, p]),
    );
    // The master's count normally, but never fewer than the highest position
    // actually seen: when the two disagree the extra positions are real records
    // and dropping them would hide the disagreement this modal flags.
    const count = Math.max(
      Math.round(parent?.no_of_screws ?? 0),
      data.max_position ?? 0,
    );
    return Array.from({ length: count }, (_, i) => {
      const pos = i + 1;
      return { position: pos, row: byPosition.get(pos) ?? null };
    });
  }, [data, parent]);

  const positionBars = useMemo<RankedBar[]>(() => {
    if (!data) return [];
    return data.positions.map((p) => ({
      key: String(p.position),
      label: `Screw ${p.position}`,
      // Failed SCREWS, the figure that reconciles with the table behind this.
      value: p.screws,
      color: concentrationColour(p.fail_pct, meanRate, p.screws),
      hint:
        `${plural(p.boards, "board")} · ${fmtPct(p.fail_pct)} of boards · ` +
        `${p.torque_fails} torque, ${p.angle_fails} angle`,
    }));
  }, [data, meanRate]);

  /**
   * Is there anything here worth RANKING?
   *
   * A ranked bar is drawn relative to the longest bar, so a station that broke a
   * single screw draws that one screw as a full-width bar — the loudest mark on
   * the screen for the quietest possible result. Robot Screw 05 did exactly that:
   * 1 failed screw in 2,783 drawn as a bar running the whole panel.
   *
   * The floor is the same one the colours use. Below it nothing is distinguishable
   * from ordinary scatter, so there is no order to show and the chart is replaced
   * by a sentence. The map still carries every position, which is where a handful
   * of failures should be read anyway.
   */
  const rankable =
    (data?.positions[0]?.screws ?? 0) >= MIN_SCREWS_TO_RANK &&
    (data?.positions.length ?? 0) > 1;

  const shownLog: ScrewLogRow[] = useMemo(() => {
    if (!data) return [];
    const rows =
      position === null
        ? data.log
        : data.log.filter((r) => r.position === position);
    // Sorted after the position filter, so picking a position on the map and
    // then sorting narrows first and orders second -- the other way round would
    // sort rows that are about to be thrown away.
    return sortRows(rows, logSort, (r, key) => r[key]);
  }, [data, position, logSort]);

  const stationPct =
    parent?.total_screws && isNum(parent.fail_count)
      ? (100 * parent.fail_count) / parent.total_screws
      : null;

  return (
    <DrilldownModalShell
      onClose={onClose}
      busy={state === "loading"}
      // Escape steps back out of a picked position before it closes the modal.
      onBack={position !== null ? () => setPosition(null) : null}
      maxWidth="max-w-[1150px]"
      header={
        <>
          <span className="text-[16px] font-black text-white uppercase tracking-wider truncate">
            {stationLabel(operation)}
          </span>
          <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider whitespace-nowrap">
            {line} · Screw positions
          </span>
          {(productName || item) && (
            <span className="text-[11px] font-mono text-ink-dim truncate">
              {productName ?? item}
            </span>
          )}
          {parent && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-ink-dim" />
              {fmtNum(parent.fail_count)} of {fmtNum(parent.total_screws)} screws
              <span style={{ color: stationPct && stationPct > 2 ? CRITICAL : undefined }}>
                {fmtPct(stationPct)}
              </span>
            </span>
          )}
        </>
      }
      meta={
        <>
          {position !== null && (
            <button
              type="button"
              onClick={() => setPosition(null)}
              className="bg-raised hover:bg-line text-ink-muted hover:text-white border border-line-strong rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              Clear position
            </button>
          )}
          {/* Was a static date label. The same control the dashboard header
              uses, so the range reads and behaves identically in both places —
              and with no range set it still shows the day the data is for,
              which is all the label ever said. */}
          <DateRangeFilter
            value={modalRange}
            onChange={setModalRange}
            appliedLabel={
              modalRange.from || modalRange.to
                ? null
                : (data?.business_date ?? businessDate ?? null)
            }
          />
        </>
      }
    >
      {state === "loading" && !data && (
        <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
          Loading screw positions…
        </div>
      )}
      {state === "error" && (
        <div className="py-16 text-center text-[12px] font-bold text-critical">
          {error}
        </div>
      )}

      {data && state !== "error" && (
        <>
          {/* The master sheet and the failure ids disagree about how many screws
              this board has. Loud, and at the top: every position below is
              derived from the same encoding, so if it is wrong here it is wrong
              throughout. */}
          {data.position_exceeds_master && (
            <div className="flex-shrink-0 px-6 py-2 border-b border-warning/30 bg-warning/[0.07] text-[10px] leading-relaxed">
              <span className="text-warning font-bold">
                Positions run past the master.
              </span>{" "}
              Screw Master.xlsx lists {fmtNum(parent?.no_of_screws)} screws at
              this station, but failures were recorded up to position{" "}
              {data.max_position}. Either the sheet is stale for this item or the
              position encoding does not hold here — treat the positions below
              with care and check the sheet before acting on them.
            </div>
          )}

          {/* Capped, and scrolls internally past that. The log underneath is the
              thing that gets squeezed otherwise: the panel is 88vh, and two
              full-height charts leave it a single visible row on a laptop. */}
          <div className="flex-shrink-0 max-h-[42vh] overflow-y-auto px-6 pt-3 pb-3 border-b border-line/60 bg-page/25">
            {/* items-start, or the shorter column stretches to match the taller
                one and the map sits in a block of dead space.
                lg, not xl: at 1280 these still fit side by side, and stacking
                them is what pushed the log off screen. */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
              {/* ---- the map, in BOARD order ----------------------------
                  Fixed basis rather than an even split: the map only needs the
                  width its cells occupy, and an 18-screw board reads better as
                  two dense rows than one thin line stretched across half the
                  panel. The width it gives up goes to the bars, which are
                  measured by length and so actually use it. */}
              <div className="w-full lg:w-[372px] lg:flex-none">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-2">
                  Position map
                  <span className="ml-2 font-bold normal-case tracking-normal text-ink-dim/70">
                    board order · click to filter the log
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mapCells.map(({ position: pos, row }) => {
                    const colour = concentrationColour(
                      row?.fail_pct ?? 0,
                      meanRate,
                      row?.screws ?? 0,
                    );
                    const picked = position === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        disabled={!row}
                        onClick={() => setPosition(picked ? null : pos)}
                        title={
                          row
                            ? `Screw ${pos} — ${plural(row.screws, "failed screw")} on ` +
                              `${plural(row.boards, "board")}, ${fmtPct(row.fail_pct)} of boards driven · ` +
                              `${row.torque_fails} torque, ${row.angle_fails} angle · ` +
                              `failure ${plural(row.failure_ids.length, "id")} ${row.failure_ids.join(", ")}`
                            : `Screw ${pos} — no failures`
                        }
                        className={`w-[34px] rounded border px-0.5 py-0.5 text-center transition-colors ${
                          row ? "cursor-pointer" : "cursor-default"
                        } ${
                          picked
                            ? "border-white"
                            : "border-line hover:border-line-strong"
                        }`}
                        style={{
                          backgroundColor: row ? `${colour}22` : "transparent",
                          borderColor: picked ? "#ffffff" : undefined,
                        }}
                      >
                        <div className="text-[8.5px] font-bold text-ink-dim leading-none">
                          {pos}
                        </div>
                        <div
                          className="text-[11px] font-black leading-tight tabular-nums"
                          style={{ color: row ? colour : "#3d4c60" }}
                        >
                          {row ? row.screws : "·"}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-[9px] font-bold text-ink-dim">
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ background: NEUTRAL }}
                    />
                    avg
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ background: WARNING }}
                    />
                    1.35x
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ background: CRITICAL }}
                    />
                    2x+
                  </span>
                  <span
                    className="text-ink-dim/70 normal-case underline decoration-dotted cursor-help"
                    title={
                      `Each position is compared with this station's mean of ${fmtPct(meanRate)} ` +
                      `per position. Positions with fewer than ${MIN_SCREWS_TO_RANK} failed screws stay ` +
                      `neutral however high their ratio: on a good station a single failure is ` +
                      `several times the mean, and colouring it would report ordinary scatter as a ` +
                      `fixture fault.`
                    }
                  >
                    vs {fmtPct(meanRate)} mean · {MIN_SCREWS_TO_RANK}+ to rank
                  </span>
                </div>
              </div>

              {/* ---- the ranking, worst first --------------------------- */}
              <div className="flex-1 min-w-0 lg:border-l lg:border-line/60 lg:pl-5">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-dim mb-2">
                  Worst positions
                  <span className="ml-2 font-bold normal-case tracking-normal text-ink-dim/70">
                    {/* The "one well clear of the rest" reading needs a rest to
                        be clear of. With nothing rankable there is no such
                        comparison to invite. */}
                    {rankable
                      ? "one well clear of the rest = a fixture, not the material"
                      : "nothing stands out at this station"}
                    {/* Said out loud, so a truncated ranking cannot be mistaken
                        for the whole story — the map beside it is the whole
                        story. */}
                    {rankable &&
                      positionBars.length > WORST_BARS &&
                      ` · ${WORST_BARS} of ${positionBars.length}, all of them in the map`}
                  </span>
                </div>
                {/* Sliced to WORST_BARS and maxBars set to the same number, so
                    the tail is empty and no "Other" bar is drawn. Both halves of
                    that matter:

                    An "Other" fold is actively misleading here. Screw failures
                    spread fairly evenly across positions — that flatness IS the
                    reading, it means material or calibration rather than a
                    fixture — and against a flat distribution the tail bucket
                    outgrows the real bars: folding 10 of 16 positions drew an
                    "Other" of 34 beside a worst position of 9, inverting the
                    chart's message. Nothing is hidden by dropping it, because
                    the map to the left carries every position already.

                    And the list has to stay short. Recharts thins category
                    labels when rows get tight, so a tall list silently loses the
                    labels that say which bar is which; six rows at 24px keeps
                    every one, and keeps this column the same height as the map.

                    labelWidth fits "Screw 15" on ONE line: at 62 it wrapped, and
                    a wrapped label silently doubles every row's height. */}
                {rankable ? (
                  <RankedBarChart
                    bars={positionBars.slice(0, WORST_BARS)}
                    labelWidth={74}
                    rowHeight={24}
                    maxBars={WORST_BARS}
                    emptyLabel="No screw failures at this station."
                    onBarClick={(key) => {
                      const pos = Number(key);
                      setPosition(position === pos ? null : pos);
                    }}
                  />
                ) : (
                  <div className="text-[11px] text-ink-dim leading-relaxed py-2">
                    {data.screws_failed === 0 ? (
                      "No screw failed at this station on this day."
                    ) : (
                      <>
                        <span className="text-ink-muted font-bold">
                          {plural(data.screws_failed, "failed screw")}
                        </span>{" "}
                        across {plural(data.positions.length, "position")},
                        none reaching the {MIN_SCREWS_TO_RANK} needed to read a
                        concentration. Too few to rank — the map shows where.
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Two checks, two different faults, two different fixes — so the
              split is worth stating even though it is only two numbers.
              OUTSIDE the capped block above, so it stays on screen when the
              charts have to scroll. */}
          <div className="flex-shrink-0 px-6 py-2 border-b border-line/60 bg-page/25">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">
                Check
              </span>
              <span
                className={`${CHIP} ${CHIP_OFF}`}
                title="The driver never reached the required torque."
              >
                Torque
                <span className="ml-1.5 font-mono text-ink-muted">
                  {fmtNum(data.by_check.torque_fails)}
                </span>
              </span>
              <span
                className={`${CHIP} ${CHIP_OFF}`}
                title="The driver turned past the allowed angle — usually a stripped or cross-threaded seat."
              >
                Angle
                <span className="ml-1.5 font-mono text-ink-muted">
                  {fmtNum(data.by_check.angle_fails)}
                </span>
              </span>
              <span className="text-[10px] text-ink-dim ml-2">
                {plural(data.screws_failed, "failed screw")} across{" "}
                {plural(data.boards_affected, "board")} of{" "}
                {fmtNum(parent?.boards)} driven
              </span>
            </div>
          </div>

          {/* ---- the log ---------------------------------------------- */}
          {/* min-h with min-h-0 beside it: the floor guarantees the log is worth
              looking at, and min-h-0 is what lets a flex child scroll at all
              rather than growing to fit its rows. */}
          <div className="flex-1 min-h-0 basis-[220px] overflow-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {/* The ordinal stays a plain header -- see LogKey. */}
                  <th className={`${TH} text-right w-10`}>#</th>
                  <SortableTh
                    column="sfc"
                    label="Board"
                    sort={logSort}
                    onSortChange={setLogSort}
                    className={`${TH} text-left`}
                  />
                  <SortableTh
                    column="position"
                    label="Screw"
                    sort={logSort}
                    onSortChange={setLogSort}
                    align="right"
                    className={`${TH} text-right`}
                  />
                  <SortableTh
                    column="check"
                    label="Check"
                    sort={logSort}
                    onSortChange={setLogSort}
                    className={`${TH} text-left`}
                  />
                  <SortableTh
                    column="achieved"
                    label="Achieved"
                    sort={logSort}
                    onSortChange={setLogSort}
                    align="right"
                    className={`${TH} text-right`}
                    title="What the driver reached. 0 means the screw never bit."
                  />
                  <SortableTh
                    column="failure_id"
                    label="Fail ID"
                    sort={logSort}
                    onSortChange={setLogSort}
                    align="right"
                    className={`${TH} text-right`}
                    title="The raw MES failure id the position is derived from"
                  />
                  <SortableTh
                    column="date_time"
                    label="Time"
                    sort={logSort}
                    onSortChange={setLogSort}
                    className={`${TH} text-left`}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/45 font-mono">
                {shownLog.map((r) => (
                  <tr key={`${r.sfc}-${r.failure_id}`} className="hover:bg-white/[0.03]">
                    <td className={`${TD} text-right text-ink-dim/70 tabular-nums`}>
                      {r.slno}
                    </td>
                    <td className={`${TD} text-left text-white font-bold`}>
                      {r.sfc}
                    </td>
                    <td className={`${TD} text-right text-white font-bold tabular-nums`}>
                      {r.position ?? "—"}
                    </td>
                    <td
                      className={`${TD} text-left font-bold ${
                        r.check === "TORQUE" ? "text-warning" : "text-info"
                      }`}
                    >
                      {r.check}
                    </td>
                    <td
                      className={`${TD} text-right tabular-nums ${
                        r.achieved === 0 ? "text-critical font-bold" : "text-ink-muted"
                      }`}
                      title={r.comment ?? undefined}
                    >
                      {isNum(r.achieved) ? r.achieved.toFixed(2) : "—"}
                    </td>
                    <td className={`${TD} text-right text-ink-dim/70 tabular-nums`}>
                      {r.failure_id}
                    </td>
                    <td className={`${TD} text-left text-ink-dim`}>
                      {r.date_time ? r.date_time.replace("T", " ").slice(0, 19) : "—"}
                    </td>
                  </tr>
                ))}
                {shownLog.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-[11px] font-bold text-ink-dim"
                    >
                      No failed checks in this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Says what the two numbers MEAN, not just what they are.
              "75 record(s) of 75" was both tautological and jargon: "record" is a
              database word for what the floor calls a failed check, and a bare
              "69 failed screws" beside it invited the obvious question — why the
              two disagree — with the answer hidden in a tooltip nobody hovers.
              The rows are checks, the reconciling figure is screws, and the line
              now says so in one breath. */}
          <div className="flex-shrink-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 px-6 py-2 border-t border-line-modal bg-page/40 text-[10px] text-ink-dim">
            {/* Picking a position makes the checks-vs-screws gap LOCAL, so the
                explanation follows it there: position 15's own 10 checks on 9
                screws says it in one line, where repeating the station's totals
                under a single position reads as a non sequitur. */}
            {position !== null ? (
              <>
                <span className="text-ink-muted font-bold">
                  {fmtNum(shownLog.length)} of {fmtNum(data.records)} failed
                  checks, at position {position}
                </span>
                <span>
                  — on{" "}
                  <span className="text-ink-muted font-bold">
                    {plural(
                      data.positions.find((p) => p.position === position)
                        ?.screws,
                      "screw",
                    )}
                  </span>
                  , because a screw that fails both torque and angle is two
                  checks but one screw.
                </span>
              </>
            ) : (
              <>
                <span className="text-ink-muted font-bold">
                  {plural(data.records, "failed check")} on{" "}
                  {plural(data.screws_failed, "screw")}
                </span>
                <span>
                  {/* When the two agree there is nothing to reconcile, and
                      explaining a discrepancy that is not on screen only makes
                      the reader hunt for one. */}
                  {data.records === data.screws_failed
                    ? "— one check each, so this is also the screw count."
                    : "— a screw that fails both torque and angle is two checks but one screw, so the screw count is the figure that matches this station's"}{" "}
                  {data.records !== data.screws_failed && (
                    <>
                      <span className="text-ink-muted font-bold">
                        {plural(parent?.fail_count, "fail")}
                      </span>{" "}
                      in the table behind.
                    </>
                  )}
                </span>
              </>
            )}
            <span className="text-ink-dim/50">·</span>
            <span
              className="underline decoration-dotted cursor-help"
              title={
                "The MES records no screw-position field: ref_des, location and component are " +
                "empty on every screw row. The position is derived from the failure id instead " +
                "— ids run in pairs from 101, one pair per screw, odd = torque and even = angle, " +
                "so id 129 is screw 15's torque check. The raw id is in the log's last column " +
                "so the mapping can be checked rather than trusted."
              }
            >
              screw position is derived from the failure id
            </span>
          </div>
        </>
      )}
    </DrilldownModalShell>
  );
};

export default ScrewPositionsModal;
