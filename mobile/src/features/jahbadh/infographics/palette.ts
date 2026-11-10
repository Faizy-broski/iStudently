// «إنفوجرافيك جهبذ» pages (brief B6-62). The pages are paper: always-light colours from the `--inf-*` tokens in
// src/global.css (never theme-dependent), so the saved image looks like the preview.
import { colors, type ColorToken } from '@/lib/colors';

export const PAGE_W = 1123;
export const PAGE_H = 794;

/** Palette token by short name, e.g. `inf('Ink')`. Read at render time. */
export const inf = (name: string) => colors[`inf${name}` as ColorToken];

const idx = (i: number, n: number) => Math.max(0, Math.min(4, n === 5 ? i : Math.round((i * 4) / Math.max(1, n - 1))));
export const lvColor = (i: number, n: number) => colors[`infL${idx(i, n)}` as ColorToken];
export const lvLight = (i: number, n: number) => colors[`infL${idx(i, n)}l` as ColorToken];

export const round2 = (x: number) => Math.round(x * 100) / 100;

export function niceStep(max: number) {
  const raw = max / 10;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

export const fmtNum = (v: number, pctScale?: boolean) => (pctScale ? `${Math.round(v * 100)}%` : String(Math.round(v * 100) / 100));

export const who = (basic: boolean) => (basic ? 'التلاميذ' : 'الطلاب');
export const one = (basic: boolean) => (basic ? 'تلميذ' : 'طالب');

/** Keeps «71.2%» and «+3.5» in reading order inside Arabic sentences (LRM works on every Android version). */
export const iso = (s: string) => String(s).replace(/([+−-]?\d+(?:\.\d+)?%)/g, '‎$1‎');

/** Font file for a CSS-like weight (Android can't synthesise weights; one loaded file per weight). */
export const plex = (weight: number) =>
  weight >= 700 ? 'IBMPlexSansArabic_700Bold' : weight >= 600 ? 'IBMPlexSansArabic_600SemiBold' : weight >= 500 ? 'IBMPlexSansArabic_500Medium' : 'IBMPlexSansArabic_400Regular';

/** Page identity shown in the header and footer (from the section and the Jahbadh settings). */
export interface PageMeta {
  school: string;
  office: string;
  municipality: string;
  year: string;
  teacher: string;
  principal: string;
  grade: string;
  section: string;
}

export interface PageOptions {
  names: boolean;
  logoUrl: string | null;
}
