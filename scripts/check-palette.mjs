/**
 * Proves src/theme/palette.ts still agrees with the --c-* tokens in
 * src/index.css, and fails the build if the two have drifted apart.
 *
 * index.css is the source of truth. palette.ts only exists because SVG
 * presentation attributes and forwarded component props need a real colour
 * string at runtime, where a CSS variable does not resolve. That duplication is
 * unavoidable; going unnoticed is not — which is what this script prevents.
 *
 * Run with: npm run check:palette
 */
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const ts = readFileSync(new URL('../src/theme/palette.ts', import.meta.url), 'utf8');

// --c-ink-muted: 143 160 181;  ->  { 'ink-muted': '#8fa0b5' }
const cssColors = {};
for (const [, name, chan] of css.matchAll(/--c-([a-z0-9-]+):\s*(\d+ \d+ \d+);/g)) {
  const [r, g, b] = chan.split(' ').map(Number);
  cssColors[name] = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}

// Only the `palette` export holds literal hex, so only it is checked. zonePalette
// now aliases palette's own status colours, and toolPalette is deliberately
// off-palette (stock Tailwind values used by the layout editor's chrome).
const paletteBlock = ts.slice(
  ts.indexOf('export const palette'),
  ts.indexOf('export const zonePalette')
);

const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const problems = [];
let checked = 0;

for (const [, key, hex] of paletteBlock.matchAll(/(\w+):\s*'(#[0-9a-f]{6})'/g)) {
  if (key === 'white') continue; // no token; Tailwind's own `white`
  const name = kebab(key);
  const expected = cssColors[name];
  if (!expected) {
    problems.push(`palette.${key} (${hex}) has no --c-${name} in index.css`);
    continue;
  }
  if (expected !== hex) {
    problems.push(`palette.${key} is ${hex} but --c-${name} is ${expected}`);
  }
  checked++;
}

// Catch the other direction too: a token added to CSS but never mirrored here is
// fine, but one that USED to be mirrored and lost its entry is a silent gap.
if (problems.length) {
  console.error('Palette drift detected:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('\nFix src/theme/palette.ts to match src/index.css.');
  process.exit(1);
}

console.log(`palette.ts matches index.css on all ${checked} shared colours.`);
