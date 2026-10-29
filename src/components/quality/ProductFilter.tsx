// Product multi-select for the QCC dashboard.
//
// Two instances edit ONE shared selection: the header pill (every card and the
// yield table) and the yield panel's own pill (same state, the yield table's
// option list). Only the header instance prunes selections the window no longer
// offers — its list is the union across every card, so a product missing from
// it really did not run. The yield table's list is narrower, and letting it
// prune would silently drop a product that ran on, say, SPI but not UNITS.
//
// Selection is by ITEM CODE, which is what ?product= takes — or, from the
// "Product names" group, by product NAME (ARDC), which the API expands to every
// item filed under it so one pick moves the unit, TRX and PA codes together.
// Both are plain ?product= values and live in the same array. The label is shown
// to the user and never sent.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Layers, Package, Search, X } from "lucide-react";
import { isNum } from "../../core/format";
import {
  optionVolume,
  PRODUCT_LEVELS,
  type ProductLevel,
  type ProductNameOption,
  type ProductOption,
} from "./dashboardFilters";
import { matchesSearch } from "./searchMatch";

// Stable default, so the prune effect below does not re-run on every render of
// an instance that offers no names.
const NO_NAMES: ProductNameOption[] = [];

interface ProductFilterProps {
  options: ProductOption[];
  /** Product names offered above the item codes. Omit where the list it
   *  sits on cannot expand names — and leave it off a non-pruning instance
   *  too, since the header one already offers them. */
  productNames?: ProductNameOption[];
  /** Group order for a name's codes; the response's product_levels. */
  productLevels?: ProductLevel[];
  /** Selected item codes and/or product names. Empty = every product, which
   *  is how the endpoint reads an absent `product` parameter. */
  value: string[];
  onChange: (items: string[]) => void;
  optionsState?: "idle" | "loading" | "ready" | "error";
  /** Set while the filter cannot reach the panel it sits on. */
  disabled?: boolean;
  /** Tooltip explaining the disabled state. Required in practice, because a
   *  disabled control with no explanation reads as a bug. */
  disabledReason?: string;
  /** Drop selected items the options no longer list. See the file comment for
   *  why only one instance should. */
  pruneUnavailable?: boolean;
  /** "header" matches the taller pills in the dashboard header. */
  variant?: "panel" | "header";
}

export const ProductFilter = ({
  options,
  productNames = NO_NAMES,
  productLevels = PRODUCT_LEVELS,
  value,
  onChange,
  optionsState = "ready",
  disabled = false,
  disabledReason,
  pruneUnavailable = true,
  variant = "panel",
}: ProductFilterProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setSearch("");
  }, [open]);

  /**
   * Drop selections that the current window no longer offers.
   *
   * The options follow the date picker, so a product that ran last week may be
   * absent this week. Left in place it would keep sending a ?product= that
   * matches nothing, and the table would go empty with the cause invisible —
   * the chip would name a product the dropdown no longer lists.
   *
   * Guarded on `options.length` so an in-flight or failed options fetch, which
   * reports an empty list, does not wipe a valid selection.
   */
  useEffect(() => {
    if (!pruneUnavailable) return;
    if (optionsState !== "ready" || options.length === 0) return;
    const available = new Set([
      ...options.map((o) => o.item),
      ...productNames.map((n) => n.product),
      // A code picked under a name's Unit / TRX / PA group.
      ...productNames.flatMap((n) =>
        n.levels ? Object.values(n.levels).flatMap((c) => c ?? []) : [],
      ),
    ]);
    const kept = value.filter((item) => available.has(item));
    if (kept.length !== value.length) onChange(kept);
  }, [options, productNames, optionsState]);

  const filteredNames = useMemo(
    () => productNames.filter((n) => matchesSearch(search, [n.product, ...(n.items ?? [])])),
    [productNames, search],
  );

  // code -> UNIT / TRX / PA, from the names' `levels` (2026-10-28), for an
  // option that does not carry `product_level` itself.
  const levelByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of productNames) {
      for (const [level, codes] of Object.entries(n.levels ?? {})) {
        for (const code of codes ?? []) m.set(code, level);
      }
    }
    return m;
  }, [productNames]);

  const levelOf = (o: ProductOption): string | null => {
    const l = (o.product_level ?? levelByCode.get(o.item) ?? "").toUpperCase();
    return (productLevels as string[]).includes(l) ? l : null;
  };

  const filtered = useMemo(
    () =>
      options.filter((o) =>
        matchesSearch(search, [o.product, o.item, o.label, o.sub_module, levelOf(o)]),
      ),
    // levelOf only reads levelByCode and productLevels.
    [options, search, levelByCode, productLevels],
  );

  /**
   * The item-code list split Unit / TRX / PA, in the response's order, with
   * anything of no known level last under "Other". Volume order is kept
   * inside each group. A list where no code has a level (the yield panel's
   * own pill) renders as one unheaded group, as it always did.
   */
  const levelGroups = useMemo(() => {
    const groups = [...productLevels, null].map((level) => ({
      level,
      items: filtered.filter((o) => levelOf(o) === level),
    }));
    return groups.filter((g) => g.items.length > 0);
  }, [filtered, levelByCode, productLevels]);
  const showLevelHeads = levelGroups.some((g) => g.level !== null);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggle = (item: string) => {
    onChange(
      selectedSet.has(item)
        ? value.filter((v) => v !== item)
        : [...value, item],
    );
  };

  const nameOption = (v: string) => productNames.find((n) => n.product === v);

  const nameOf = (item: string) => {
    const n = nameOption(item);
    if (n) return `${n.product} (all ${n.items.length} items)`;
    const o = options.find((opt) => opt.item === item);
    return o?.label ?? o?.product ?? item;
  };

  const label =
    value.length === 0
      ? "All products"
      : value.length === 1
        ? (options.find((o) => o.item === value[0])?.product ?? value[0])
        : `${value.length} products`;

  const isHeader = variant === "header";
  const active = value.length > 0;

  return (
    <div className="relative shrink-0">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-expanded={open}
        title={
          disabled
            ? disabledReason
            : value.length
              ? value.map(nameOf).join(", ")
              : "Filter by product"
        }
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={`border rounded flex items-center gap-1.5 transition-colors ${
          isHeader
            ? "px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap max-w-[220px]"
            : "px-2 py-0.5 text-[11px] font-bold max-w-[200px]"
        } ${
          disabled
            ? "bg-page border-line text-ink-dim/60 cursor-not-allowed"
            : isHeader && active
              ? "bg-panel border-info/40 text-info cursor-pointer hover:bg-raised"
              : isHeader
                ? "bg-panel border-line-strong text-white cursor-pointer hover:bg-raised"
                : "bg-page border-line text-white cursor-pointer hover:bg-line"
        }`}
      >
        <Package size={11} className="flex-shrink-0 text-ink-dim" />
        <span className="truncate">{label}</span>
        {/* Clearing is on the trigger so a selection can be dropped without
            opening the list, which is the common case once a filter is on. */}
        {!disabled && value.length > 0 && (
          <X
            size={11}
            className="flex-shrink-0 text-ink-dim hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          />
        )}
        {!disabled && value.length === 0 && (
          <ChevronDown
            size={11}
            className={`flex-shrink-0 text-ink-dim transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {open && !disabled && (
        <>
          {/* Full-viewport catcher rather than a blur handler: the panel holds a
              search input, and a blur close would fire the moment it is focused. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute top-full mt-1 w-[280px] bg-panel border border-line-strong rounded-lg shadow-xl shadow-black/50 overflow-hidden z-50 ${
              isHeader ? "right-0" : "left-0"
            }`}
          >
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-line">
              <Search size={11} className="text-ink-dim flex-shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code or level"
                className="bg-transparent text-[11px] text-white outline-none w-full placeholder:text-ink-dim"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {optionsState === "loading" && options.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-ink-dim">
                  Loading products…
                </div>
              ) : optionsState === "error" ? (
                <div className="px-2 py-2 text-[11px] text-critical">
                  Product list unavailable.
                </div>
              ) : filtered.length === 0 && filteredNames.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-ink-dim">
                  {/* An empty list is information, not a fault: this endpoint
                      only offers products that actually ran in the window. */}
                  {options.length === 0
                    ? "No products ran in this window."
                    : "No match."}
                </div>
              ) : (
                <>
                {filteredNames.length > 0 && (
                  <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-wider text-ink-dim">
                    Product names · every item
                  </div>
                )}
                {filteredNames.map((n) => {
                  const on = selectedSet.has(n.product);
                  return (
                    <div
                      key={`name:${n.product}`}
                      onClick={() => toggle(n.product)}
                      title={n.items.join(", ")}
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
                      <Layers size={11} className="flex-shrink-0 text-info" />
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] font-bold truncate">{n.product}</span>
                        <span className="text-[9px] text-ink-dim truncate">
                          {n.items.length} item{n.items.length === 1 ? "" : "s"} · {n.items.join(", ")}
                        </span>
                      </span>
                      <span className="text-[9px] text-ink-dim tabular-nums flex-shrink-0">
                        {isNum(n.done) ? n.done.toLocaleString("en-US") : "—"}
                      </span>
                    </div>
                  );
                })}
                {filteredNames.length > 0 && filtered.length > 0 && (
                  <div className="px-2 pt-2 pb-0.5 text-[9px] font-black uppercase tracking-wider text-ink-dim border-t border-line/60 mt-1">
                    Other item codes
                  </div>
                )}
                {levelGroups.map((g) => (
                  <div key={g.level ?? "other"}>
                  {showLevelHeads && (
                    <div className="px-2 pt-1.5 pb-0.5 text-[8.5px] font-black uppercase tracking-wider text-info/80">
                      {g.level === null ? "Other" : g.level === "UNIT" ? "Unit" : g.level}
                    </div>
                  )}
                {g.items.map((o) => {
                  const on = selectedSet.has(o.item);
                  const volume = optionVolume(o);
                  return (
                    <div
                      key={o.item}
                      onClick={() => toggle(o.item)}
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
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] font-bold truncate">
                          {o.product || o.item}
                        </span>
                        <span className="text-[9px] text-ink-dim truncate">
                          {o.label ?? o.item}
                          {o.sub_module ? ` · ${o.sub_module}` : ""}
                        </span>
                      </span>
                      {/* Volume in the window, so a product with barely any
                          production is recognisable before it is selected. */}
                      <span className="text-[9px] text-ink-dim tabular-nums flex-shrink-0">
                        {isNum(volume) ? volume.toLocaleString("en-US") : "—"}
                      </span>
                    </div>
                  );
                })}
                  </div>
                ))}
                </>
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

export default ProductFilter;
