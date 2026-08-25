import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { isNum } from "../../core/format";
import DrilldownModalShell from "./DrilldownModalShell";
import NcLogTable from "./NcLogTable";
import TesterYieldTable from "./TesterYieldTable";
import { useProductDefects } from "./useProductDefects";
import { useProductTesters } from "./useProductTesters";

type Props = {
  /** Mart step name, e.g. "RTWP" — the endpoint's path segment. */
  step: string;
  /** Item code whose failures this explains. */
  item: string;
  /** Short name from the Target sheet, for the header. Falls back to the code. */
  productName?: string | null;
  /** Production day the parent table is showing, so every level agrees on the
   *  window. */
  businessDate?: string | null;
  onClose: () => void;
};

/** Where in the drill-down we are. A tester selection is what distinguishes the
 *  two: null = the tester list, set = that tester's NC log. */
type Selection = { resource: string | null; category: string | null } | null;

const fmtPct = (v: number | null | undefined) =>
  isNum(v) ? `${v.toFixed(2)}%` : "—";

/**
 * The process drill-down below a product, in two levels.
 *
 *   level 2  which TESTERS make up this product's yield, and what caused the
 *            failures on each  (TesterYieldTable)
 *   level 3  which UNITS are behind one tester, or one cause  (NcLogTable)
 *
 * Level 1 — which products make up a card's yield — is the step tab that opened
 * this, and stays visible behind the backdrop.
 *
 * One modal rather than two because the levels are one question asked at
 * narrowing scope, and a breadcrumb makes the scope explicit; two modals would
 * either stack or lose the trail back. The tables themselves are separate
 * components so neither has to know about the other.
 *
 * Formerly ProcessProductsModal, which showed the level-one product table. That
 * table moved into the step tabs, so this shell was reused rather than left dead.
 */
export const ProductDrilldownModal: React.FC<Props> = ({
  step,
  item,
  productName,
  businessDate,
  onClose,
}) => {
  const [selection, setSelection] = useState<Selection>(null);
  // The plant's two NC-log filters. Off by default: their screen hides later
  // attempts and unverified records, which makes its log shorter than the floor
  // actually is. Held here rather than in the table so they survive stepping back
  // to the tester list and drilling into a different cell.
  const [firstAttemptOnly, setFirstAttemptOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const testers = useProductTesters(step, item, businessDate);
  // The NC log only loads once a tester or cause is chosen. `null` item keeps the
  // hook idle, so opening the modal costs one request rather than two.
  const defects = useProductDefects(
    selection ? step : null,
    selection ? item : null,
    businessDate,
    selection?.resource ?? null,
    selection?.category ?? null,
    firstAttemptOnly ? 1 : null,
    verifiedOnly,
  );


  const totals = testers.data?.totals;

  return (
    <DrilldownModalShell
      onClose={onClose}
      // Escape steps back to the tester list first, and only closes from there.
      onBack={selection ? () => setSelection(null) : null}
      header={
        <>
          {/* The shell already wraps this slot in the flex row, so no container
              here -- one was left behind when this moved onto the shell and left
              the fragment unbalanced. */}
          {/* The product crumb is a button only when there is somewhere to go
                back to, so it never looks interactive while it is the current
                level. */}
            {selection ? (
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="text-[16px] font-black text-ink-muted hover:text-white uppercase tracking-wider truncate cursor-pointer focus-visible:outline focus-visible:outline-1"
                title="Back to the tester list"
              >
                {productName || item}
              </button>
            ) : (
              <span className="text-[16px] font-black text-white uppercase tracking-wider truncate">
                {productName || item}
              </span>
            )}

            <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider whitespace-nowrap">
              {step}
            </span>

            {selection ? (
              <>
                <ChevronRight size={13} className="text-ink-dim flex-shrink-0" />
                <span className="text-[13px] font-bold text-white font-mono whitespace-nowrap">
                  {selection.resource ?? "All testers"}
                </span>
                {selection.category && (
                  <>
                    <ChevronRight
                      size={13}
                      className="text-ink-dim flex-shrink-0"
                    />
                    <span className="text-[12px] font-black text-info uppercase tracking-wider">
                      {selection.category}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-[11px] font-bold text-ink-dim uppercase tracking-wider whitespace-nowrap">
                · By tester
              </span>
            )}

            {productName && !selection && (
              <span className="text-[11px] font-mono text-ink-dim truncate">
                {item}
              </span>
            )}

            {totals && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted whitespace-nowrap">
                <span className="w-1 h-1 rounded-full bg-ink-dim" />
                {totals.failed} of {totals.tested} failed ·{" "}
                {fmtPct(totals.ftpy_pct)}
              </span>
            )}
        </>
      }
      meta={
        <>
          <span className="text-[11px] font-bold text-ink-dim">
            {testers.data?.business_date ?? businessDate ?? ""}
          </span>
          {selection && (
            <button
              onClick={() => setSelection(null)}
              className="bg-raised hover:bg-line text-ink-muted hover:text-white border border-line-strong rounded-lg px-3 py-1.5 text-[12px] font-bold cursor-pointer transition-colors duration-200 outline-none"
            >
              ← Testers
            </button>
          )}
        </>
      }
    >

        {/* ---- level 2: testers ------------------------------------------ */}
        {!selection && (
          <>
            {testers.state === "loading" && (
              <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
                Loading tester breakdown…
              </div>
            )}
            {testers.state === "unsupported" && (
              <div className="py-16 px-8 text-center">
                <div className="text-[12px] font-bold text-warning mb-1.5">
                  No tester breakdown available for {step}
                </div>
                <div className="text-[11px] text-ink-dim max-w-[60ch] mx-auto leading-relaxed">
                  {testers.error}
                </div>
              </div>
            )}
            {testers.state === "error" && (
              <div className="py-16 text-center text-[12px] font-bold text-critical">
                {testers.error}
              </div>
            )}
            {testers.state === "ready" &&
              testers.data &&
              (testers.data.testers.length === 0 ? (
                <div className="py-16 text-center text-[12px] font-bold text-ink-dim">
                  No production for this product on{" "}
                  {testers.data.business_date}.
                </div>
              ) : (
                <TesterYieldTable
                  data={testers.data}
                  onDrill={(resource, category) =>
                    setSelection({ resource, category })
                  }
                />
              ))}
          </>
        )}

        {/* ---- level 3: the NC log --------------------------------------- */}
        {selection && (
          <NcLogTable
            query={defects}
            firstAttemptOnly={firstAttemptOnly}
            onFirstAttemptOnly={setFirstAttemptOnly}
            verifiedOnly={verifiedOnly}
            onVerifiedOnly={setVerifiedOnly}
          />
        )}
    </DrilldownModalShell>
  );
};

export default ProductDrilldownModal;
