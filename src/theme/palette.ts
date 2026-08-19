/**
 * Palette for JavaScript consumers.
 *
 * src/index.css is the source of truth for colour. Anything that can be styled
 * with a class should use the Tailwind token instead of this file:
 *
 *     bg-panel   text-ink-muted   border-line   fill-healthy
 *
 * This module exists for the places a class cannot reach, where a real colour
 * string is required at runtime:
 *
 *   - SVG presentation attributes — `fill={...}` / `stroke={...}`. CSS custom
 *     properties do NOT resolve in presentation attributes, so `rgb(var(--x))`
 *     renders as nothing there.
 *   - Props passed into a component that forwards them onward, e.g.
 *     <Sparkline stroke={...} />.
 *   - Lookup tables whose values flow into either of the above.
 *
 * The values here MUST match the corresponding --c-* channels in index.css.
 * `npm run check:palette` proves they do and fails if they drift.
 */

export const palette = {
  // --- surfaces --------------------------------------------------------------
  page:          '#030810',
  inset:         '#142337',
  panel:         '#101c2b',
  raised:        '#16253a',

  // --- borders ---------------------------------------------------------------
  line:          '#1c3149',
  lineStrong:    '#26405a',
  lineModal:     '#2b4463',
  lineSoft:      '#3a5a7d',

  // --- text ------------------------------------------------------------------
  ink:           '#f8fafc',
  inkSecondary:  '#c8d6e4',
  inkMuted:      '#8fa0b5',
  inkDim:        '#63788f',

  // --- status ----------------------------------------------------------------
  healthy:       '#22c55e',
  warning:       '#eab308',
  critical:      '#ff4c4c',
  unknown:       '#64748b',
  info:          '#06b6d4',

  // --- accents ---------------------------------------------------------------
  accent:        '#005aff',
  accentRail:    '#0091ff',
  tabActive:     '#1e3a8a',
  tabBorder:     '#3b82f6',

  white:         '#ffffff',
} as const;

/**
 * Status colours for the plant-layout overlay, as real colour strings.
 *
 * Identical to the status colours in `palette` — this alias exists only because
 * these values reach the overlay through SVG `fill`/`stroke` attributes, where a
 * CSS variable does not resolve, so `fill-healthy` is not an option there.
 *
 * Until the 3D digital twin was removed, these were a separate, more saturated
 * set (#2fe0a0 / #f24b5c) tuned for the twin's emissive materials and consumed
 * only by FactoryZone and zoneContents. Both are gone, so the overlay now shares
 * the dashboard's status palette and a warning reads the same yellow everywhere.
 */
export const zonePalette = {
  healthy:       palette.healthy,
  warning:       palette.warning,
  critical:      palette.critical,
  unknown:       palette.unknown,
} as const;

/**
 * Stock Tailwind values used by the plant-layout editor's own chrome. That UI is
 * an internal tool that never adopted the Nokia palette; these are named after
 * the Tailwind colours they are, so it stays obvious they are off-palette.
 */
export const toolPalette = {
  sky400:        '#38bdf8',
  emerald500:    '#10b981',
  amber500:      '#f59e0b',
  red500:        '#ef4444',
  orange500:     '#f97316',
  purple500:     '#a855f7',
} as const;

export type PaletteColor = (typeof palette)[keyof typeof palette];
