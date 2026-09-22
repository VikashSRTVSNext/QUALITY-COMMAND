import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { isNum } from "../../core/format";
import DrilldownModalShell from "./DrilldownModalShell";
import ScrewPositionsModal from "./ScrewPositionsModal";
import { useScrewDefects, type ScrewRow } from "./useScrewDefects";

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";
const fmtNum = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString("en-US") : "—";
/** Screw counts are NUMERIC in the master — one row reads 47.5 — so a bare
 *  toString would print "18" for some rows and "47.5" for others. */
const fmtScrews = (v: number | null | undefined) =>
  isNum(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : "—";

/** ROBOT_SCREW_01_IN04 -> "Robot Screw - 01". Falls back to the raw operation
 *  minus the site suffix, so an operation that stops matching the pattern is
 *  still identifiable rather than blank. */
const stationLabel = (operation: string | null) => {
  if (!operation) return "—";
  const m = /^ROBOT_SCREW_(\w+?)(?:_IN04)?$/.exec(operation);
  return m ? `Robot Screw - ${m[1]}` : operation.replace(/_IN04$/, "");
};

const TH =
  "px-2 py-2 text-[9.5px] font-black uppercase tracking-wider text-ink-dim " +
  "whitespace-nowrap sticky top-0 bg-panel z-10 border-b border-line";
const TD = "px-2 py-1.5 whitespace-nowrap";

/** Against the card's 2% target: at or under is fine, up to 5% is a warning,
 *  past that is a real problem. Same bands gold_sync writes into the mart. */
const rateColour = (pct: number | null) => {
  if (!isNum(pct)) return undefined;
  if (pct <= 2) return "#22c55e";
  if (pct <= 5) return "#eab308";
  return "#ff4c4c";
};

/**
 * Screw defects by line, station and item.
 *
 * The denominator is SCREWS DRIVEN, not boards, which is what makes this table
 * different from every other step tab: a board carrying 18 screws is 18 chances
 * to fail. `Total screws` is `Screws x Passed`, and `Defects %` divides by it.
 *
 * Mirrors the plant's Power BI view column for column, so the two can be read
 * side by side.
 */
export const ScrewDefectsPane = ({
  businessDate,
}: {
  businessDate?: string | null;
}) => {
  const { data, state, error } = useScrewDefects(businessDate);
  // The line whose stations are open in the modal. One at a time, which is what
  // a modal implies -- the trade-off against the accordion this replaced is that
  // two lines can no longer be compared station by station on one screen.
  const [openLine, setOpenLine] = useState<string | null>(null);
  // The station whose screw POSITIONS are open, layered over the station list.
  // Closing it returns to that list rather than dismissing both, so the drill
  // path is walkable in either direction.
  const [openStation, setOpenStation] = useState<ScrewRow | null>(null);

  if (state === "loading") {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
        Loading screw defects…
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-critical">
        {error}
      </div>
    );
  }
  if (!data) return null;

  if (data.rows.length === 0) {
    return (
      <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
        No screws driven on {data.business_date}.
      </div>
    );
  }

  const { totals } = data;

  // Per-line rollup, done here rather than server-side: the endpoint already
  // returns line x station x item and the whole payload is ~16 rows, so a second
  // request would cost more than the group-by.
  //
  // The rate is recomputed from the SUMMED counts, never averaged from the
  // station percentages — those have different denominators, so their mean is not
  // the line's rate.
  const byLine = new Map<
    string,
    { stations: ScrewRow[]; boards: number; screws: number; fails: number }
  >();
  for (const r of data.rows) {
    const key = r.line ?? "(unknown)";
    const g =
      byLine.get(key) ?? { stations: [], boards: 0, screws: 0, fails: 0 };
    g.stations.push(r);
    g.boards += r.boards ?? 0;
    g.screws += r.total_screws ?? 0;
    g.fails += r.fail_count ?? 0;
    byLine.set(key, g);
  }
  // Worst rate first: the line to look at should not need finding.
  const lines = [...byLine.entries()].sort(
    (a, b) =>
      (b[1].screws ? b[1].fails / b[1].screws : 0) -
      (a[1].screws ? a[1].fails / a[1].screws : 0),
  );

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className={`${TH} text-left`}>Line / Station</th>
              <th className={`${TH} text-left`}>Product</th>
              <th className={`${TH} text-right`} title="Screws per board at this station">
                Screws
              </th>
              <th className={`${TH} text-right`} title="Boards through the station">
                Passed
              </th>
              <th className={`${TH} text-right`} title="Screws x Passed — the denominator">
                Total screws
              </th>
              <th className={`${TH} text-right`}>Fails</th>
              <th className={`${TH} text-right`} title="Fails / Total screws">
                Defects %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/45 font-mono">
            {lines.map(([line, g]) => {
              const linePct = g.screws ? (100 * g.fails) / g.screws : null;
              return (
                <tr
                  key={line}
                  className="cursor-pointer hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-info"
                  onClick={() => setOpenLine(line)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenLine(line);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  title={`Open the ${g.stations.length} station(s) on ${line}`}
                >
                  <td className={`${TD} text-left text-white font-bold`}>
                    <span className="inline-flex items-center gap-1.5">
                      {line}
                      <ChevronRight size={12} className="text-ink-dim" />
                    </span>
                  </td>
                  <td className={`${TD} text-left text-ink-dim`}>
                    {g.stations.length} station
                    {g.stations.length === 1 ? "" : "s"}
                  </td>
                  {/* Screws-per-board is a station attribute, not a line one:
                      stations on one line carry 16, 17, 32, 33 screws, so one
                      figure here would be meaningless rather than imprecise. */}
                  <td className={`${TD} text-right text-ink-dim/40`}>&mdash;</td>
                  <td className={`${TD} text-right text-ink-muted tabular-nums`}>
                    {fmtNum(g.boards)}
                  </td>
                  <td className={`${TD} text-right text-white font-bold tabular-nums`}>
                    {fmtNum(g.screws)}
                  </td>
                  <td
                    className={`${TD} text-right tabular-nums font-bold ${
                      g.fails > 0 ? "text-critical" : "text-ink-dim"
                    }`}
                  >
                    {fmtNum(g.fails)}
                  </td>
                  <td
                    className={`${TD} text-right tabular-nums font-black`}
                    style={{ color: rateColour(linePct) }}
                  >
                    {fmtPct(linePct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong bg-page/60 font-mono">
              <td
                className={`${TD} text-left text-[10px] font-black uppercase tracking-wider text-ink-dim`}
                colSpan={3}
              >
                Total
              </td>
              <td className={`${TD} text-right text-white font-bold tabular-nums`}>
                {fmtNum(totals.boards)}
              </td>
              <td className={`${TD} text-right text-white font-bold tabular-nums`}>
                {fmtNum(totals.total_screws)}
              </td>
              <td
                className={`${TD} text-right tabular-nums font-bold ${
                  (totals.fail_count ?? 0) > 0
                    ? "text-critical"
                    : "text-ink-dim"
                }`}
              >
                {fmtNum(totals.fail_count)}
              </td>
              <td
                className={`${TD} text-right tabular-nums font-black`}
                style={{ color: rateColour(totals.defect_pct) }}
              >
                {fmtPct(totals.defect_pct)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* The gap this table exists to expose. An item missing from the master
          has an UNKNOWN screw count, so its boards are absent from the
          denominator while its failures still happen on the floor. Only shown
          when there is a gap — the explanatory footer that used to sit here was
          removed on request. */}
      {data.uncovered.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2.5 border-t border-line bg-page/40 text-[10px] text-ink-dim leading-relaxed">
          <span className="text-warning font-bold">
            {data.uncovered.length} item/station combination(s) are not in Screw
            Master.xlsx
          </span>{" "}
          <span
            title={data.uncovered
              .map(
                (u) =>
                  `${u.line} ${u.operation} ${u.item} — ${u.boards} board(s)`,
              )
              .join("\n")}
            className="underline decoration-dotted cursor-help"
          >
            ({data.uncovered.map((u) => u.item).join(", ")})
          </span>{" "}
          — their screw count is unknown, so those boards are excluded here
          rather than counted as zero.
        </div>
      )}

      {/* Stations for the selected line, in the same shell every process
          drill-down uses. */}
      {openLine &&
        (() => {
          const g = byLine.get(openLine);
          if (!g) return null;
          const linePct = g.screws ? (100 * g.fails) / g.screws : null;
          const spans = g.stations.map((s) => s.total_screws ?? 0);
          return (
            <DrilldownModalShell
              onClose={() => setOpenLine(null)}
              maxWidth="max-w-[1000px]"
              header={
                <>
                  <span className="text-[16px] font-black text-white uppercase tracking-wider truncate">
                    {openLine}
                  </span>
                  <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider whitespace-nowrap">
                    Screw defects &middot; By station
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted whitespace-nowrap">
                    <span className="w-1 h-1 rounded-full bg-ink-dim" />
                    {fmtNum(g.fails)} of {fmtNum(g.screws)} screws
                    <span style={{ color: rateColour(linePct) }}>
                      {fmtPct(linePct)}
                    </span>
                  </span>
                </>
              }
              meta={
                <span className="text-[11px] font-bold text-ink-dim">
                  {data.business_date}
                </span>
              }
            >
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th className={`${TH} text-left`}>Station</th>
                      <th className={`${TH} text-left`}>Product</th>
                      <th className={`${TH} text-right`}>Screws</th>
                      <th className={`${TH} text-right`}>Passed</th>
                      <th className={`${TH} text-right`}>Total screws</th>
                      <th className={`${TH} text-right`}>Fails</th>
                      <th className={`${TH} text-right`}>Defects %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/45 font-mono">
                    {/* Worst first: the station to look at should not need
                        finding. */}
                    {[...g.stations]
                      .sort((a, b) => (b.defect_pct ?? 0) - (a.defect_pct ?? 0))
                      .map((r: ScrewRow) => (
                        <tr
                          key={`${r.operation}-${r.item}`}
                          className="cursor-pointer hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-info"
                          onClick={() => setOpenStation(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOpenStation(r);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          title={`Which screw positions failed at ${stationLabel(r.operation)}`}
                        >
                          <td className={`${TD} text-left text-white font-bold`}>
                            <span className="inline-flex items-center gap-1.5">
                              {stationLabel(r.operation)}
                              <ChevronRight size={12} className="text-ink-dim" />
                            </span>
                          </td>
                          {/* Name over code, matching the products table: two products can
                              share a name, and a supervisor quotes the code to the floor. */}
                          <td className={`${TD} text-left`}>
                            {r.product_name ? (
                              <>
                                <div className="text-white font-bold leading-tight">
                                  {r.product_name}
                                </div>
                                <div className="text-[9.5px] text-ink-dim leading-tight">
                                  {r.item}
                                </div>
                              </>
                            ) : (
                              <span className="text-ink-muted">{r.item ?? "—"}</span>
                            )}
                          </td>
                          <td className={`${TD} text-right text-ink-dim tabular-nums`}>
                            {fmtScrews(r.no_of_screws)}
                          </td>
                          <td className={`${TD} text-right text-ink-muted tabular-nums`}>
                            {fmtNum(r.passed)}
                          </td>
                          <td className={`${TD} text-right text-ink-muted tabular-nums`}>
                            {fmtNum(r.total_screws)}
                          </td>
                          <td
                            className={`${TD} text-right tabular-nums font-bold ${
                              (r.fail_count ?? 0) > 0
                                ? "text-critical"
                                : "text-ink-dim"
                            }`}
                          >
                            {fmtNum(r.fail_count)}
                          </td>
                          <td
                            className={`${TD} text-right tabular-nums font-black`}
                            style={{ color: rateColour(r.defect_pct) }}
                          >
                            {fmtPct(r.defect_pct)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex-shrink-0 px-6 py-2.5 border-t border-line-modal bg-page/40 text-[10px] text-ink-dim leading-relaxed">
                The line rate is recomputed from the summed counts above, never
                averaged from the station percentages &mdash; their denominators
                differ ({fmtNum(Math.min(...spans))} to {fmtNum(Math.max(...spans))}{" "}
                screws), so a mean of them is not this line&apos;s rate.
              </div>
            </DrilldownModalShell>
          );
        })()}

      {/* Level three, rendered AFTER the station list so it stacks over it.
          Closing returns to the stations, which are still mounted behind. */}
      {openStation && (
        <ScrewPositionsModal
          line={openStation.line ?? ""}
          operation={openStation.operation ?? ""}
          item={openStation.item}
          productName={openStation.product_name}
          businessDate={data.business_date}
          onClose={() => setOpenStation(null)}
        />
      )}
    </div>
  );
};

export default ScrewDefectsPane;
