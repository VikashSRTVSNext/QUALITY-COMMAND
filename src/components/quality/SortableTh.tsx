export type SortOrder = "asc" | "desc";

export interface SortState<K extends string> {
  key: K | null;
  order: SortOrder;
}

interface SortableThProps<K extends string> {
  /** Row field this column sorts on. */
  column: K;
  label: string;
  sort: SortState<K>;
  onSortChange: (next: SortState<K>) => void;
  align?: "left" | "center" | "right";
  /**
   * Replaces the Product Yield header styling entirely.
   *
   * The drill-down tables have their own `TH` class -- different padding, no
   * sticky offset, a border the panel table does not use -- so they pass it
   * here rather than this component growing a variant per table. Alignment
   * still comes from `align`, because the indicator has to sit on the same side
   * as the text.
   */
  className?: string;
  title?: string;
}

// Advances one column through asc -> desc -> unsorted. Returning to unsorted
// matters here: the feed's own order is meaningful (worst yield first), so there
// has to be a way back to it.
const nextSort = <K extends string>(
  prev: SortState<K>,
  column: K,
): SortState<K> => {
  if (prev.key !== column) return { key: column, order: "asc" };
  if (prev.order === "asc") return { key: column, order: "desc" };
  return { key: null, order: "asc" };
};

// A clickable column header with its sort indicator.
export function SortableTh<K extends string>({
  column,
  label,
  sort,
  onSortChange,
  align = "left",
  className,
  title,
}: SortableThProps<K>) {
  const active = sort.key === column;
  const indicator = !active ? " ↕" : sort.order === "asc" ? " ▲" : " ▼";

  const justify =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "";

  const base =
    className ??
    `pb-2 font-black sticky top-0 bg-panel border-b border-line z-10${
      align === "center"
        ? " text-center"
        : align === "right"
          ? " text-right"
          : ""
    }`;

  return (
    <th
      onClick={() => onSortChange(nextSort(sort, column))}
      title={title}
      className={`${base} cursor-pointer select-none hover:text-white transition-colors`}
    >
      <div className={`flex items-center gap-1 ${justify}`}>
        {label}
        <span
          className={`text-[10px] font-black ${active ? "text-white" : "text-white/40"}`}
        >
          {indicator}
        </span>
      </div>
    </th>
  );
}

export default SortableTh;
