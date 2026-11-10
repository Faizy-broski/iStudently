/** @type {import('tailwindcss').Config} */
const fs = require('fs');
const path = require('path');
const plugin = require('tailwindcss/plugin');

// Colour tokens come from src/global.css (the only place colour values are written, as hex).
// Every `--name:` there becomes a Tailwind colour `name` (bg-brand, text-chart-3, border-print-border …).
// Tailwind needs RGB channels for opacity modifiers (bg-primary/10), so each token also gets a
// derived `--name-rgb` variable, computed here from the hex value (never written by hand).
const css = fs.readFileSync(path.join(__dirname, 'src/global.css'), 'utf8');
const [lightCss, darkCss = ''] = css.split('.dark:root');
const parse = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const light = parse(lightCss);
const dark = { ...light, ...parse(darkCss) };
const tokens = Object.keys(light).filter((n) => n !== 'radius');

function resolve(vars, name, depth = 0) {
  const v = vars[name];
  const ref = v && v.match(/^var\(--([a-z0-9-]+)\)$/);
  return ref && depth < 8 ? resolve(vars, ref[1], depth + 1) : v;
}
function channels(value) {
  if (!value) return null;
  let m = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
  }
  m = value.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : null;
}
const rgbVars = (vars) => Object.fromEntries(tokens.map((n) => [`--${n}-rgb`, channels(resolve(vars, n))]).filter(([, v]) => v));
// Tokens with their own alpha (rgba overlays) keep the plain variable.
const colors = {
  ...Object.fromEntries(tokens.map((n) => [n, /^rgba\(/i.test(resolve(light, n) || '') ? `var(--${n})` : `rgb(var(--${n}-rgb) / <alpha-value>)`])),
  // `raw-*` classes reference the hex variables themselves, so NativeWind keeps them for `@/lib/colors`.
  ...Object.fromEntries(tokens.map((n) => [`raw-${n}`, `var(--${n})`])),
};

// App font: IBM Plex Sans Arabic (Arabic + Latin), one loaded file per weight (src/app/_layout.tsx).
const FONT = {
  light: 'IBMPlexSansArabic_300Light',
  normal: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
};

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  // NativeWind drops CSS variables no class uses; `@/lib/colors` reads them at runtime, so keep them all.
  safelist: tokens.flatMap((n) => [`bg-${n}`, `bg-raw-${n}`]),
  presets: [require('nativewind/preset')],
  // Weights are separate font files: `font-*` picks the file (see the plugin below), never fontWeight.
  corePlugins: { fontWeight: false },
  theme: {
    // Type scale with line heights roomy enough for Arabic.
    fontSize: {
      '2xs': ['11px', '16px'],
      xs: ['13px', '18px'],
      sm: ['15px', '22px'],
      base: ['16px', '24px'],
      lg: ['18px', '26px'],
      xl: ['21px', '28px'],
      '2xl': ['24px', '32px'],
      '3xl': ['30px', '38px'],
      '4xl': ['36px', '44px'],
      '5xl': ['48px', '56px'],
    },
    extend: {
      colors,
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [FONT.normal],
      },
    },
  },
  plugins: [
    plugin(({ addBase, addUtilities }) => {
      addBase({ ':root': rgbVars(light), '.dark:root': rgbVars(dark) });
      addUtilities(
        Object.fromEntries(
          Object.entries({ light: 'light', normal: 'normal', medium: 'medium', semibold: 'semibold', bold: 'bold', extrabold: 'bold', black: 'bold' }).map(([cls, w]) => [
            `.font-${cls}`,
            { 'font-family': FONT[w], 'font-weight': 'normal' },
          ])
        )
      );
    }),
  ],
};
