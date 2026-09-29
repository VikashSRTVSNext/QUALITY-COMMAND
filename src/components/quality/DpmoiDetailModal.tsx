import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Box,
  Cpu,
  Flame,
  Layers,
  Scan,
  Settings,
} from "lucide-react";
import { isNum } from "../../core/format";
import RankedBarChart from "../charts/RankedBarChart.lazy";
import type { RankedBar } from "../charts/RankedBarChart";
import { seriesColor } from "../charts/seriesPalette";
import DrilldownModalShell from "./DrilldownModalShell";
import DateRangeFilter from "./DateRangeFilter";
import { EMPTY_RANGE, type DateRange } from "./dashboardFilters";
import {
  useDpmoiDetail,
  type DpmoiCategory,
  type DpmoiLogRow,
} from "./useDpmoiDetail";

const fmtNum = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString("en-US") : "—";
const fmtIdx = (v: number | null | undefined) =>
  isNum(v) ? v.toFixed(2) : "—";

/** "1 board" / "2 boards". Most rows here are small, so "1 boards" is the common
 *  sight rather than an edge case. */
const plural = (v: number | null | undefined, one: string, many?: string) => {
  const word = v === 1 ? one : (many ?? one + "s");
  return `${fmtNum(v)} ${word}`;
};

/** AOI_TOP_REWORK_IN04 -> "AOI TOP". Same rule as the pane behind this modal. */
const opLabel = (op: string) =>
  op.replace(/_REWORK_IN04$/, "").replace(/_/g, " ");

/**
 * Bars per cut.
 *
 * Each chart is sliced to this AND given the same number as `maxBars`, so the
 * tail is empty and RankedBarChart draws no "Other" bar. That fold is actively
 * misleading on this data: AOI defects often spread thinly across designators,
 * and against a flat distribution the tail bucket outgrows the real bars —
 * 089338A.112's ten designators folded to an "Other" of 4 sitting above a worst
 * designator of 3, which reverses what the chart is for. Nothing is lost, since
 * the table below carries every row and the heading says how many were ranked.
 */
const CUT_BARS = 4;

/** "4 of 7" when a cut is truncated, so a short list is never mistaken for the
 *  whole story. Empty when everything is shown. */
const cutNote = (shown: number, total: number) =>
  total > shown ? `${shown} of ${total}` : "";

/** The card's own bands, so a category reads against the same scale the index
 *  above it does. Lower is better — this is a defect index, not a yield. */
const idxColour = (v: number | null | undefined) => {
  if (!isNum(v)) return undefined;
  if (v <= 2) return "#22c55e";
  if (v <= 10) return "#eab308";
  return "#ff4c4c";
};

/**
 * Card skin for a rate.
 *
 * The point of this screen is that one process is usually the problem and the
 * other two are fine, so the skins are deliberately unequal: the failing card
 * gets a coloured border and a tinted surface, the healthy ones stay quiet with
 * only their number carrying colour. Tinting all three equally would put the
 * three back on a level and hand the reader the scanning job the screen exists
 * to do for them.
 */
const cardSkin = (v: number | null | undefined) => {
  if (!isNum(v)) return "border-line bg-page/40";
  if (v > 10) return "border-critical/45 bg-critical/[0.07]";
  if (v > 2) return "border-warning/35 bg-warning/[0.05]";
  return "border-healthy/25 bg-healthy/[0.04]";
};

const CATEGORY_META: Record<
  string,
  { hint: string; Icon: typeof Flame }
> = {
  solder: { hint: "Paste, stencil and reflow", Icon: Flame },
  placement: { hint: "Feeders, nozzles and placement programs", Icon: Cpu },
  component: { hint: "Handling damage", Icon: Settings },
};

/** One spacing scale for every band, so the sections read as a rhythm rather
 *  than as whatever each one happened to need. */
const BAND = "px-5 py-2.5";

const TH =
  "px-2.5 py-2 text-[9.5px] font-black uppercase tracking-wider text-ink-dim " +
  "whitespace-nowrap sticky top-0 bg-inset z-10 border-b border-line-strong";
const TD = "px-2.5 py-[7px] whitespace-nowrap align-middle";

type Props = {
  item: string;
  operation: string;
  description?: string | null;
  businessDate?: string | null;
  /** The dashboard's date range when the modal was opened. Seeds the picker
   *  below; the modal then owns its own copy. */
  range?: DateRange | null;
  onClose: () => void;
};

/**
 * The AOI defects behind one DPMOI row — level two of the DPMOI card.
 *
 * **The per-category rates are the reason this screen exists.** The index above
 * it divides every defect by the SUMMED opportunities, and the three counts are
 * nothing like each other — a board can carry two million solder opportunities
 * against a few hundred thousand placement ones. A placement problem therefore
 * reaches the card already divided by a denominator that has almost nothing to
 * do with it, and lands looking acceptable. 089338A.112 reads 3.76 overall while
 * its placement rate is 16.75 and its soldering rate is 0.49: same board, same
 * day, and only the blended figure looks fine.
 *
 * The layout follows the question the reader is actually asking, top to bottom:
 * which process is failing (the three rate cards), why (the three cuts), and
 * then which board (the table). Everything above the table is a summary of it.
 *
 * Every cut counts DEFECTS and BOARDS separately — ten tombstones on one board
 * is one bad board, not ten.
 *
 * Picking a category filters the table and the three cuts, client-side. The
 * category rates themselves never move: a figure a slice is measured against
 * must not shift with the slice, which is the rule every drill-down here follows.
 *
 * THE HEIGHT BUDGET IS THE LAYOUT CONSTRAINT. Everything above the table is
 * `flex-shrink-0`, so every pixel spent up there comes straight out of the rows
 * on screen — at 598px of viewport the table had been squeezed to two. The
 * bands are sized to leave it a floor it can actually be read in, and the table
 * body is the only part that scrolls.
 */
export const DpmoiDetailModal: React.FC<Props> = ({
  item,
  operation,
  description,
  businessDate,
  range = null,
  onClose,
}) => {
  /**
   * The window this modal is looking at.
   *
   * Seeded from the dashboard but owned here, so narrowing the range inside the
   * drill-down does NOT move the DPMOI table underneath it. Same rule as the
   * product drill-down, so both read the same way.
   */
  const [modalRange, setModalRange] = useState<DateRange>(range ?? EMPTY_RANGE);

  const { data, state, error } = useDpmoiDetail({
    item,
    operation,
    businessDate,
    range: modalRange,
  });

  /** One category's defects. Client-side — the whole log is already here. */
  const [category, setCategory] = useState<string | null>(null);
  /** Table-only machine filter. Scoped to the table because it lives in the
   *  table's toolbar; the rates and the cuts above keep their full figures. */
  const [machine, setMachine] = useState<string>("");

  const parent = data?.parent;

  /** What the CUTS are computed over: the category slice, not the machine one. */
  const categoryLog: DpmoiLogRow[] = useMemo(() => {
    if (!data) return [];
    return category === null
      ? data.log
      : data.log.filter((r) => r.category === category);
  }, [data, category]);

  /** What the TABLE shows: the above, narrowed by the toolbar's machine. */
  const shownLog: DpmoiLogRow[] = useMemo(
    () =>
      machine ? categoryLog.filter((r) => r.resource === machine) : categoryLog,
    [categoryLog, machine],
  );

  /** The two lower cuts, recomputed over the category slice so picking a
   *  category narrows them. Cheap — a day's log for one board is tens of rows,
   *  not thousands — and it keeps the filter honest: the bars can only show what
   *  the selection actually contains. */
  const tally = (key: "ref_des" | "component"): RankedBar[] => {
    const defects = new Map<string, number>();
    const boards = new Map<string, Set<string>>();
    for (const r of categoryLog) {
      const value = r[key];
      if (!value) continue;
      defects.set(value, (defects.get(value) ?? 0) + 1);
      if (!boards.has(value)) boards.set(value, new Set());
      boards.get(value)!.add(r.sfc);
    }
    return [...defects.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, n], i) => ({
        key: value,
        label: value,
        value: n,
        color: seriesColor(i),
        hint: plural(boards.get(value)?.size ?? 0, "board"),
      }));
  };

  const refDesBars = useMemo(() => tally("ref_des"), [categoryLog]);
  const componentBars = useMemo(() => tally("component"), [categoryLog]);

  const ncBars = useMemo<RankedBar[]>(() => {
    if (!data) return [];
    const rows =
      category === null
        ? data.by_nc
        : data.by_nc.filter((n) => n.category === category);
    return rows.map((n, i) => ({
      key: n.nc,
      label: n.nc,
      // DEFECTS, matching the index's own numerator. Boards ride in the tooltip.
      value: n.defects,
      color: seriesColor(i),
      hint: `${n.description ?? "No description in the NC master"} · ${plural(n.boards, "board")}`,
    }));
  }, [data, category]);

  /** One chart card, so the three are structurally identical rather than three
   *  hand-built blocks that drift apart. */
  const cut = (
    Icon: typeof BarChart3,
    title: string,
    note: string,
    bars: RankedBar[],
    labelWidth: number,
    emptyLabel: string,
    titleHint?: string,
  ) => (
    <div className="flex-1 min-w-0 rounded-lg border border-line bg-page/40 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-2" title={titleHint}>
        <Icon size={12} className="text-ink-dim flex-shrink-0" />
        <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-muted truncate">
          {title}
        </span>
        {note && (
          <span className="ml-auto text-[9px] font-bold text-ink-dim whitespace-nowrap">
            {note}
          </span>
        )}
      </div>
      <RankedBarChart
        bars={bars.slice(0, CUT_BARS)}
        labelWidth={labelWidth}
        rowHeight={21}
        maxBars={CUT_BARS}
        emptyLabel={emptyLabel}
      />
    </div>
  );

  return (
    <DrilldownModalShell
      onClose={onClose}
      busy={state === "loading"}
      onBack={category !== null ? () => setCategory(null) : null}
      maxWidth="max-w-[1250px]"
      header={
        <>
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-info/10 border border-info/25 flex-shrink-0">
            <Activity size={15} className="text-info" />
          </span>
          {/* Title on its own line above the metadata: the two used to run
              together on one row, which made the item code compete with the
              product name for the same emphasis. */}
          <span className="flex flex-col min-w-0 leading-tight">
            <span className="text-[15px] font-black text-white uppercase tracking-wide truncate">
              {data?.description ?? description ?? item}
            </span>
            <span className="text-[10px] font-bold text-ink-dim uppercase tracking-wider truncate">
              {opLabel(operation)} · DPMOI ·{" "}
              <span className="font-mono normal-case tracking-normal">
                {item}
              </span>
            </span>
          </span>
          {parent && (
            <span
              className={`flex items-center gap-2 ml-1 px-2.5 py-1 rounded-lg border whitespace-nowrap flex-shrink-0 ${
                (parent.defects_total ?? 0) > 0
                  ? "border-critical/35 bg-critical/[0.08]"
                  : "border-healthy/30 bg-healthy/[0.06]"
              }`}
            >
              {(parent.defects_total ?? 0) > 0 && (
                <AlertTriangle size={12} className="text-critical" />
              )}
              <span className="text-[11px] font-bold text-ink-muted">
                {plural(parent.defects_total, "defect")} on{" "}
                {fmtNum(parent.boards)} boards
              </span>
              <span
                className="text-[12px] font-black tabular-nums"
                style={{ color: idxColour(parent.dpmo) }}
              >
                {fmtIdx(parent.dpmo)} DPMO
              </span>
            </span>
          )}
        </>
      }
      meta={
        // No "Clear category" here any more: the table's own toolbar carries a
        // Reset that clears BOTH filters, and two clear buttons on one screen is
        // the sort of clutter this pass exists to remove. Escape still steps out
        // of a category before it closes the modal, via onBack above.
        <>
          {/* Was a static date chip. The same control the dashboard header
              uses, so the range reads and behaves identically in both places —
              and with no range set it still shows the day the data is for,
              which is all the chip ever said. */}
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
          Loading DPMOI detail…
        </div>
      )}
      {state === "error" && (
        <div className="py-16 text-center text-[12px] font-bold text-critical">
          {error}
        </div>
      )}

      {data && state !== "error" && (
        <>
          {/* ---- 1. which process is failing ---------------------------- */}
          <div className={`flex-shrink-0 ${BAND} pt-2.5`}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">
                DPMO by process
              </span>
              {/* With nothing wrong there is nothing being hidden, and claiming
                  otherwise over three zeros reads as a warning about a board
                  that is fine. */}
              <span className="text-[9.5px] font-bold text-ink-dim/70 truncate">
                {(parent?.defects_total ?? 0) > 0
                  ? `each against its own opportunities — the blended ${fmtIdx(parent?.dpmo)} hides which one is failing`
                  : "each against its own opportunities — nothing was found on this board in this window"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {data.by_category.map((c: DpmoiCategory) => {
                const picked = category === c.category;
                const hasDefects = (c.defects ?? 0) > 0;
                const meta = CATEGORY_META[c.category];
                const Icon = meta?.Icon ?? Box;
                // Selection is a RING on top of the severity skin, not a
                // replacement for it. Swapping the skin out for a neutral
                // highlight meant the failing card stopped looking like the
                // failing card the moment you clicked it — which is exactly when
                // you are looking at it.
                return (
                  <button
                    key={c.category}
                    type="button"
                    disabled={!hasDefects}
                    onClick={() => setCategory(picked ? null : c.category)}
                    title={
                      c.opportunities_per_board
                        ? `${fmtNum(c.defects)} defect(s) over ${fmtNum(c.opportunities)} opportunities ` +
                          `(${fmtNum(c.opportunities_per_board)} per board x ${fmtNum(parent?.boards)} boards)` +
                          (hasDefects ? " — click to filter the table" : "")
                        : "No opportunity count in the master for this category, so no rate can be computed."
                    }
                    className={`text-left rounded-xl border px-3 py-2 transition-colors outline-none ${
                      hasDefects
                        ? "cursor-pointer hover:border-line-strong"
                        : "cursor-default opacity-60"
                    } ${cardSkin(c.dpmo)} ${
                      picked ? "ring-2 ring-inset ring-white/55" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.05] border border-line flex-shrink-0 mt-0.5">
                        <Icon size={13} className="text-ink-muted" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-ink-muted truncate">
                            {c.label}
                          </span>
                          <span className="text-[9.5px] font-bold text-ink-dim whitespace-nowrap">
                            {plural(c.defects, "defect")}
                          </span>
                        </span>
                        <span className="flex items-baseline gap-1.5">
                          <span
                            className="text-[23px] font-black leading-none tabular-nums"
                            style={{ color: idxColour(c.dpmo) }}
                          >
                            {/* Null, not zero. A missing opportunity count means
                                the rate is UNKNOWN, and printing 0.00 would read
                                as a flawless process. */}
                            {c.dpmo === null ? "—" : fmtIdx(c.dpmo)}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-wider text-ink-dim">
                            DPMO
                          </span>
                        </span>
                        {/* Denominator, what the bucket means and what it is made
                            of, on one line. The codes stay visible rather than
                            moving to a tooltip: the mapping repays checking —
                            "Component" is the single code E5, "Mechanical damage"
                            in the NC master, while Missing and Misplaced
                            component sit under Placement. That is the plant's own
                            rule, and printing the codes is what makes it
                            checkable instead of hidden. */}
                        <span className="block text-[9px] text-ink-dim leading-tight mt-1 truncate">
                          {c.opportunities_per_board
                            ? `${fmtNum(c.opportunities_per_board)} opp/board`
                            : "No opportunity count"}
                          <span className="text-ink-dim/70">
                            {" · "}
                            {meta?.hint}
                          </span>
                          {c.codes.length > 0 && (
                            <span className="text-ink-muted">
                              {" · "}
                              {c.codes
                                .map((x) => `${x.nc}×${x.defects}`)
                                .join(" ")}
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {data.opportunities_incomplete && (
              <div className="mt-2 text-[10px] text-warning font-bold">
                Some categories have no opportunity count in the master, so their
                rate is unknown rather than zero — the board's overall index is
                missing the same denominator.
              </div>
            )}
          </div>

          {/* ---- 2. why it is failing ----------------------------------- */}
          <div
            className={`flex-shrink-0 max-h-[30vh] overflow-y-auto ${BAND} pt-0`}
          >
            <div className="flex flex-col lg:flex-row gap-2.5 items-stretch">
              {cut(
                BarChart3,
                "Defects by NC code",
                cutNote(CUT_BARS, ncBars.length),
                ncBars,
                48,
                "No defect codes in this selection.",
              )}
              {cut(
                Scan,
                "By ref des",
                cutNote(CUT_BARS, refDesBars.length),
                refDesBars,
                66,
                "No designators in this selection.",
                "One designator repeating across many boards points at a stencil aperture, a feeder or a nozzle — not at a bad board.",
              )}
              {cut(
                Box,
                "By component",
                cutNote(CUT_BARS, componentBars.length),
                componentBars,
                66,
                "No components in this selection.",
              )}
            </div>
          </div>

          {/* ---- 3. the table's own toolbar ----------------------------- */}
          {/* Its own surface and border, so the jump from summary to detail is
              a visible seam rather than the two running together. */}
          <div
            className={`flex-shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 ${BAND} py-1.5 bg-inset/60 border-y border-line`}
          >
            <span className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim">
              AOI machine
            </span>
            {data.resources.length > 0 ? (
              <select
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
                className="bg-page border border-line-strong rounded-lg pl-2.5 pr-6 py-[3px] text-[11px] font-bold text-white outline-none focus:border-info/60 cursor-pointer"
                title="Narrows the table only. The rates and the cuts above keep their full figures."
              >
                <option value="">
                  {data.resources.length === 1
                    ? data.resources[0].resource
                    : `All machines (${data.resources.length})`}
                </option>
                {data.resources.map((r) => (
                  <option key={r.resource} value={r.resource}>
                    {r.resource} · {r.defects}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] font-bold text-ink-dim">
                No machine recorded on these defects.
              </span>
            )}

            <span className="flex items-center gap-1.5 text-[10px] text-ink-muted">
              <Layers size={12} className="text-ink-dim" />
              {plural(data.boards_affected, "board")} of{" "}
              {fmtNum(parent?.boards)} carried a defect
            </span>

            {(category !== null || machine) && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[10px] font-bold text-info">
                  Showing {fmtNum(shownLog.length)} of{" "}
                  {plural(data.records, "defect")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCategory(null);
                    setMachine("");
                  }}
                  className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-line text-ink-dim hover:bg-line hover:text-white transition-colors"
                >
                  Reset
                </button>
              </span>
            )}
          </div>

          {/* ---- 4. the defects themselves ------------------------------ */}
          {/* The ONLY scrolling region. Its header is sticky, and the footer
              below sits outside it, so neither leaves the screen while the rows
              move. */}
          <div className="flex-1 min-h-[112px] overflow-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className={`${TH} text-right w-10`}>#</th>
                  <th className={`${TH} text-left`}>Board</th>
                  <th className={`${TH} text-left`}>Code</th>
                  <th className={`${TH} text-left`}>Description</th>
                  <th className={`${TH} text-left`}>Ref des</th>
                  <th className={`${TH} text-left`}>Component</th>
                  <th className={`${TH} text-left`}>Machine</th>
                  <th className={`${TH} text-left`}>Time</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {shownLog.map((r) => (
                  <tr
                    key={`${r.sfc}-${r.ref_des}-${r.nc}-${r.slno}`}
                    className="border-b border-line/30 hover:bg-info/[0.06] transition-colors"
                  >
                    <td
                      className={`${TD} text-right text-ink-dim/60 tabular-nums`}
                    >
                      {r.slno}
                    </td>
                    <td className={`${TD} text-left text-white font-bold`}>
                      {r.sfc}
                    </td>
                    <td className={`${TD} text-left`}>
                      {/* One neutral chip, not a colour per code. A colour here
                          would have to mean something, and the only thing it
                          could mean is severity — which these codes do not
                          carry. The category is already on the cards above. */}
                      <span className="inline-block px-1.5 py-0.5 rounded border border-line-strong bg-raised text-white font-bold text-[10px] leading-none">
                        {r.nc ?? "—"}
                      </span>
                    </td>
                    <td className={`${TD} text-left text-ink-secondary`}>
                      {r.nc_description ?? (
                        <span className="text-ink-dim/60">
                          not in the NC master
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-left text-info font-bold`}>
                      {r.ref_des ?? "—"}
                    </td>
                    <td className={`${TD} text-left text-ink-muted`}>
                      {r.component ?? "—"}
                    </td>
                    <td className={`${TD} text-left text-ink-dim`}>
                      {r.resource ?? "—"}
                    </td>
                    <td className={`${TD} text-left text-ink-dim/80`}>
                      {r.date_time
                        ? r.date_time.replace("T", " ").slice(0, 19)
                        : "—"}
                    </td>
                  </tr>
                ))}
                {shownLog.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-[11px] font-bold text-ink-dim"
                    >
                      {data.records === 0
                        ? "No AOI defects on this board in this window — the index above is zero because nothing was found, not because nothing ran."
                        : "No defects in this selection."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ---- 5. the reconciliation line ----------------------------- */}
          <div
            className={`flex-shrink-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 ${BAND} py-2 border-t border-line-modal bg-page/40 text-[10px] text-ink-dim`}
          >
            <span className="text-ink-muted font-bold">
              {category !== null || machine
                ? `${fmtNum(shownLog.length)} of ${plural(data.records, "defect")}`
                : plural(data.records, "defect")}
            </span>
            <span>
              — the same defects the card counted, so this matches the{" "}
              <span className="text-ink-muted font-bold">
                {plural(parent?.defects_total, "defect")}
              </span>{" "}
              on the row behind.
            </span>
            <span className="text-ink-dim/50">·</span>
            <span
              className="underline decoration-dotted cursor-help"
              title={
                "The card divides every defect by the SUM of the three opportunity counts, " +
                "and they differ by an order of magnitude — a board can carry two million " +
                "solder opportunities against a few hundred thousand placement ones. A " +
                "placement problem is therefore divided by a denominator that has little to " +
                "do with it and reads as almost nothing. The three rates above each use their " +
                "own count, which is why they can be far apart while the blended index looks fine."
              }
            >
              Why the three rates differ from the index
            </span>
          </div>
        </>
      )}
    </DrilldownModalShell>
  );
};

export default DpmoiDetailModal;
