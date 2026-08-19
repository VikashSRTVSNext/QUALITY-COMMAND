/** @type {import('tailwindcss').Config} */

// Every token below reads a CSS variable declared in src/index.css — that file
// is the single source of truth, this one just makes the values reachable as
// utility classes. Because the variables hold space-separated RGB channels, the
// `<alpha-value>` placeholder works, so opacity modifiers do too:
//
//   bg-panel      →  rgb(var(--c-panel) / 1)
//   bg-panel/50   →  rgb(var(--c-panel) / 0.5)
//
// That was the gap that stopped the previous token set from being adopted: it
// duplicated the hex values here, so a colour change had to be swept through
// src/ by hand. Now there is one definition and no sweep.
//
// These additions are deliberately ADDITIVE — no default Tailwind scale is
// overridden — so existing markup renders byte-identically.
const channel = (name) => `rgb(var(${name}) / <alpha-value>)`;

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
        // --- surfaces, darkest to lightest ---
        page:         channel('--c-page'),
        inset:        channel('--c-inset'),
        panel:        channel('--c-panel'),
        raised:       channel('--c-raised'),

        // --- borders (named `line` so they don't collide with border-width
        //     utilities like `border-2`) ---
        line: {
          DEFAULT:    channel('--c-line'),
          strong:     channel('--c-line-strong'),
          modal:      channel('--c-line-modal'),
          soft:       channel('--c-line-soft'),
        },

        // --- text, brightest to dimmest ---
        ink: {
          DEFAULT:    channel('--c-ink'),
          secondary:  channel('--c-ink-secondary'),
          muted:      channel('--c-ink-muted'),
          dim:        channel('--c-ink-dim'),
        },

        // --- status: every range-based judgement on screen ---
        healthy:      channel('--c-healthy'),
        warning:      channel('--c-warning'),
        critical:     channel('--c-critical'),
        unknown:      channel('--c-unknown'),
        info:         channel('--c-info'),

        // --- accents ---
        accent: {
          DEFAULT:    channel('--c-accent'),
          rail:       channel('--c-accent-rail'),
        },
        tab: {
          active:     channel('--c-tab-active'),
          border:     channel('--c-tab-border'),
        },
      },

      // Role-named because this dashboard's whole type range lives between 9px
      // and 42px, where sm/base/lg stop carrying meaning. New names only —
      // Tailwind's text-xs/text-sm/… are untouched.
      fontSize: {
        micro:  'var(--fs-micro)',
        tiny:   'var(--fs-tiny)',
        small:  'var(--fs-small)',
        body:   'var(--fs-body)',
        label:  'var(--fs-label)',
        lead:   'var(--fs-lead)',
        title:  'var(--fs-title)',
        metric: 'var(--fs-metric)',
        hero:   'var(--fs-hero)',
      },

      fontFamily: {
        sans: ['"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
      },

      // Glows derive from the status channels, so a fill and its bloom cannot
      // drift apart — the failure mode the old hand-written rgba() pairs had.
      boxShadow: {
        glowSuccess:  'var(--glow-healthy)',
        glowWarning:  'var(--glow-warning)',
        glowDanger:   'var(--glow-critical)',
        glowInfo:     'var(--glow-info)',
        glowPrimary:  'var(--glow-accent)',
        panel:        'var(--shadow-panel)',
        float:        'var(--shadow-float)',
      },

      // Named stops so stacking is a decision, not an arms race. Numeric
      // z-10/z-40/z-50 still work.
      zIndex: {
        base:    'var(--z-base)',
        raised:  'var(--z-raised)',
        sticky:  'var(--z-sticky)',
        overlay: 'var(--z-overlay)',
        modal:   'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
        toast:   'var(--z-toast)',
      },

      transitionDuration: {
        fast:   'var(--dur-fast)',
        base:   'var(--dur-base)',
        slow:   'var(--dur-slow)',
        slower: 'var(--dur-slower)',
      },

      transitionTimingFunction: {
        'out-soft': 'var(--ease-out)',
        'in-out-soft': 'var(--ease-in-out)',
      },
    },
  },
  plugins: [],
}
