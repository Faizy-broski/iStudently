import { useColorScheme } from 'nativewind'

/**
 * Colour tokens from src/global.css, for code that needs a raw value (SVG, icon `color` props,
 * charts, PDF/print HTML, values saved to the server). Prefer Tailwind classes (`bg-brand`) in JSX.
 *
 * Values are read live from NativeWind's CSS variables, so they follow light/dark mode and are
 * never written twice. Access by camelCase name: `colors.brand`, `colors.brandSecondary`, `colors.chart3`.
 */
export type ColorToken =
  | 'brand' | 'brandSecondary' | 'brandAccent'
  | 'gradient1Start' | 'gradient1Mid' | 'gradient1End' | 'gradient2Start' | 'gradient2End'
  | 'background' | 'foreground' | 'card' | 'cardForeground' | 'popover' | 'popoverForeground'
  | 'primary' | 'primaryForeground' | 'secondary' | 'secondaryForeground' | 'muted' | 'mutedForeground'
  | 'accent' | 'accentForeground' | 'destructive' | 'destructiveForeground' | 'success' | 'successForeground'
  | 'warning' | 'warningForeground' | 'info' | 'infoForeground' | 'border' | 'input' | 'ring'
  | 'successSoft' | 'warningSoft' | 'destructiveSoft' | 'infoSoft'
  | 'chart1' | 'chart2' | 'chart3' | 'chart4' | 'chart5' | 'chart6' | 'chart7' | 'chart8'
  | 'printText' | 'printMuted' | 'printBorder' | 'printSurface'
  | 'white' | 'black' | 'overlayLight' | 'overlayLightStrong'
  | 'sidebarPresetDefaultBlue' | 'sidebarPresetDeepNavy' | 'sidebarPresetForestGreen' | 'sidebarPresetBurgundy'
  | 'sidebarPresetCharcoal' | 'sidebarPresetDarkTeal' | 'sidebarPresetRoyalPurple' | 'sidebarPresetSlate'

type Store = Map<string, { get(effect?: unknown): unknown } | unknown>

function store(): Store | undefined {
  return (globalThis as { __css_interop?: { rootVariables?: Store } }).__css_interop?.rootVariables
}

const kebab = (name: string) => `--${name.replace(/([A-Z])/g, '-$1').replace(/([a-z])(\d)/g, '$1-$2').toLowerCase()}`

/** Resolves a CSS variable to its colour string, following `var(--other)` references. */
function resolve(varName: string, depth = 0): string {
  const raw = store()?.get(varName)
  let value = raw && typeof raw === 'object' && 'get' in raw ? (raw as { get(): unknown }).get() : raw
  // `var(--x)` arrives as a runtime descriptor: [{}, 'var', ['--x'], …]
  if (Array.isArray(value) && value[1] === 'var' && Array.isArray(value[2]) && depth < 8) return resolve(String(value[2][0]), depth + 1)
  if (typeof value === 'string') return value
  if (__DEV__) console.warn(`[colors] ${varName} is not defined in src/global.css`)
  return 'transparent'
}

/** Current values (light or dark). Read at use time; don't copy into module-level constants. */
export const colors = new Proxy({} as Record<ColorToken, string>, {
  // Only plain camelCase names are tokens; ignore probes like $$typeof, toJSON, then.
  get: (_target, key) => (typeof key === 'string' && /^[a-z][a-zA-Z0-9]*$/.test(key) && key !== 'toJSON' && key !== 'then' ? resolve(kebab(key)) : undefined),
})

/** Same as `colors`, but re-renders the component when the colour scheme changes. */
export function useColors() {
  useColorScheme()
  return colors
}

/** The 8-colour chart / category palette, in order. */
export function chartPalette(): string[] {
  return [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5, colors.chart6, colors.chart7, colors.chart8]
}
