// Line multi-select for the Process Performance strip.
//
// Lives on the strip, not in the header, because a line reaches only the cards
// in process-filter-options' `line_steps` (AXI, THERMAL_AVI, SCREW_DEFECTS,
// DPMOI today). Every other card is greyed out while a line is selected; see
// ProcessMetricCard's `lineFiltered`.
//
// Values are sent exactly as listed (MAC_LINE02, AOI_7B, SMT, AXI) — no
// normalising, the endpoint matches them verbatim.

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Network, X } from "lucide-react";

interface LineFilterProps {
  options: string[];
  /** Selected lines. Empty = every line, which is how the endpoint reads an
   *  absent `line` parameter. */
  value: string[];
  onChange: (lines: string[]) => void;
  optionsState?: "idle" | "loading" | "ready" | "error";
  /** Steps the line filter reaches, shown in the tooltip so it is clear why
   *  most of the strip greys out. */
  appliesTo?: string[];
}

export const LineFilter = ({
  options,
  value,
  onChange,
  optionsState = "ready",
  appliesTo = [],
}: LineFilterProps) => {
  const [open, setOpen] = useState(false);

  // Same rule as the header's product pill: a line that did not run in the
  // new window would send a ?line= that matches nothing and blank the cards
  // with the cause invisible. Guarded on a non-empty ready list so an
  // in-flight or failed options call cannot wipe a valid selection.
  useEffect(() => {
    if (optionsState !== "ready" || options.length === 0) return;
    const available = new Set(options);
    const kept = value.filter((l) => available.has(l));
    if (kept.length !== value.length) onChange(kept);
  }, [options, optionsState]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const toggle = (line: string) =>
    onChange(
      selectedSet.has(line) ? value.filter((v) => v !== line) : [...value, line],
    );

  const label =
    value.length === 0
      ? "All lines"
      : value.length === 1
        ? value[0]
        : `${value.length} lines`;

  const scope = appliesTo.length
    ? `Applies to ${appliesTo.join(", ")}`
    : "Applies to the line cards only";

  return (
    <div className="relative shrink-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        title={value.length ? `${value.join(", ")} · ${scope}` : scope}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={`border rounded px-2 py-0.5 text-[11px] font-bold flex items-center gap-1.5 transition-colors max-w-[200px] cursor-pointer ${
          value.length
            ? "bg-page border-info/40 text-info hover:bg-line"
            : "bg-page border-line text-white hover:bg-line"
        }`}
      >
        <Network size={11} className="flex-shrink-0 text-ink-dim" />
        <span className="truncate">{label}</span>
        {value.length > 0 ? (
          <X
            size={11}
            className="flex-shrink-0 text-ink-dim hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          />
        ) : (
          <ChevronDown
            size={11}
            className={`flex-shrink-0 text-ink-dim transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-[220px] bg-panel border border-line-strong rounded-lg shadow-xl shadow-black/50 overflow-hidden z-50">
            <div className="px-2 py-1.5 border-b border-line text-[10px] text-ink-dim">
              {scope}
            </div>
            <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
              {optionsState === "loading" && options.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-ink-dim">
                  Loading lines…
                </div>
              ) : optionsState === "error" ? (
                <div className="px-2 py-2 text-[11px] text-critical">
                  Line list unavailable.
                </div>
              ) : options.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-ink-dim">
                  No lines ran in this window.
                </div>
              ) : (
                options.map((line) => {
                  const on = selectedSet.has(line);
                  return (
                    <div
                      key={line}
                      onClick={() => toggle(line)}
                      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
                        on
                          ? "bg-line text-white"
                          : "text-ink-muted hover:bg-tab-active hover:text-white"
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                          on ? "border-line-strong bg-tab-active" : "border-line"
                        }`}
                      >
                        {on && <Check size={9} className="text-white" />}
                      </span>
                      <span className="text-[11px] font-bold truncate">
                        {line}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            {value.length > 0 && (
              <div className="flex items-center justify-between px-2 py-1.5 border-t border-line">
                <span className="text-[10px] text-ink-dim font-bold">
                  {value.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[10px] font-bold uppercase tracking-wide text-ink-dim hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LineFilter;
