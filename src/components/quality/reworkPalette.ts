/**
 * The rework analysis view's palette, as supplied 2026-10-23 (dark theme).
 *
 * Scoped to the rework view on purpose: the rest of the dashboard keeps the
 * colours in src/index.css / theme/palette.ts, so nothing here is checked by
 * `npm run check:palette` and nothing here should be imported elsewhere.
 */
export const REWORK_SURFACE = {
  /** Behind the whole rework view. */
  background: "#0B1220",
  /** The chart cards. */
  panel: "#111827",
} as const;

/**
 * One colour per cause code, FIXED rather than by rank, so FCR is the same
 * teal on every product and period. Keyed by the API's `category` code; the
 * labels it shows (PP MP/A, PP FILTER, PP ASSY…) are in the comments.
 */
export const REWORK_CATEGORY_COLORS: Record<string, string> = {
  FCR: "#2DD4BF",
  SMT: "#FBBF24",
  PPH: "#38BDF8", // PP MP/A
  PPF: "#F472B6", // PP FILTER
  PPA: "#A3E635", // PP ASSY
  SQA: "#C4B5FD",
  MOD_REJ: "#FB923C",
  UNCATEGORISED: "#64748B",
};

/** A code a newer backend adds before this map knows it. */
export const REWORK_UNKNOWN_CATEGORY = "#94A3B8";

/**
 * Stack colours for an OPEN vocabulary — DPMOI NC codes, which no fixed map
 * can cover. Drawn from the same set as the categories, in an order that keeps
 * neighbouring stack segments warm/cool apart, and assigned by the series'
 * position in the server's (stable, biggest-first) list. Past the last slot a
 * series folds to the "Others" slate rather than reusing a colour.
 */
export const REWORK_SERIES_COLORS = [
  "#2DD4BF",
  "#FBBF24",
  "#38BDF8",
  "#F472B6",
  "#A3E635",
  "#C4B5FD",
  "#FB923C",
] as const;

export const reworkSeriesColor = (i: number): string =>
  REWORK_SERIES_COLORS[i] ?? REWORK_CATEGORY_COLORS.UNCATEGORISED;

/**
 * The paretos, derived from the same set so the two views read as one:
 * vital-few bars in FCR teal, the tail as that teal dimmed, the buckets that
 * are not causes in the Uncategorised slate, and the cumulative line in SMT
 * amber.
 */
export const REWORK_PARETO_COLORS = {
  vital: REWORK_CATEGORY_COLORS.FCR,
  tail: "#0F766E",
  muted: REWORK_CATEGORY_COLORS.UNCATEGORISED,
  line: REWORK_CATEGORY_COLORS.SMT,
  cutoff: REWORK_CATEGORY_COLORS.SMT,
} as const;

/**
 * The weekly yield trend (3.8): passed boards in the pareto's dimmed teal so
 * failed stands out on top, FPY in sky, the target a pale dashed rule, and a
 * week under target in red — the one colour the handoff names.
 */
export const REWORK_YIELD_COLORS = {
  passed: "#0F766E",
  failed: REWORK_CATEGORY_COLORS.MOD_REJ,
  fpy: REWORK_CATEGORY_COLORS.PPH,
  target: "#CBD5E1",
  belowTarget: "#F87171",
} as const;
