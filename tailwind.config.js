/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
      },
      colors: {
        // Quality Command Center palette, taken from the Figma dark theme.
        // These are the source of truth: the page still writes most colours as
        // arbitrary hex literals (bg-[#101c2b]), so when a value changes here it
        // must be swept through src/ as well. Prefer the token form
        // (bg-theme-panelBg) in new markup — it also supports opacity modifiers,
        // which arbitrary CSS variables do not.
        theme: {
          // --- grounds and surfaces, darkest to lightest ---
          // The page itself — the deepest value on screen, so cards read as
          // floating above it rather than sitting flush.
          bg: '#030810',
          // Pills and badges sunk INTO a card (the "1 Critical" chip).
          inset: '#050b12',
          // Table bodies and tab tracks.
          inset2: '#081119',
          // Cards and panels. Figma-exact.
          panelBg: '#101c2b',
          // Gradient tops, hover states, the raised edge of a card.
          panelRaised: '#16253a',

          // --- borders ---
          border: '#1c3149',
          borderStrong: '#26405a',

          // --- text, brightest to dimmest ---
          // Card titles and headline values.
          text: '#f8fafc',
          // Table cells and body copy.
          textSecondary: '#c8d6e4',
          // Column headers and field labels.
          muted: '#8fa0b5',
          // De-emphasised metadata: units, timestamps, footnotes.
          dim: '#63788f',

          // --- accents and status ---
          // success/danger are Figma-confirmed and drive every range-based
          // judgement: gauges, sparklines, status pills, trend arrows. Change
          // them here AND sweep src/ for both the hex and the rgba() glow
          // spellings — a fill and its bloom drifting apart is the usual bug.
          // The blues below are unchanged; they already match the design.
          primary: '#005aff',
          // Group rails above the process cards (SMT blue, RFM green).
          rail: '#0091ff',
          success: '#22c55e',
          warning: '#eab308',
          danger: '#ff4c4c',
          info: '#06b6d4',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glowPrimary: '0 0 15px rgba(0, 90, 255, 0.35)',
        glowSuccess: '0 0 15px rgba(34, 197, 94, 0.35)',
        glowWarning: '0 0 15px rgba(234, 179, 8, 0.35)',
        glowDanger: '0 0 15px rgba(255, 76, 76, 0.5)',
      }
    },
  },
  plugins: [],
}
