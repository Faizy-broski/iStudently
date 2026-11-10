// «إنفوجرافيك جهبذ» pages: identity of the client's offline tool (إنفوجرافيك جهبذ.html). The pages are paper:
// fixed colours (never theme-dependent) and inline styles only, so print and html2canvas-pro save them as they look.

export const PAGE_W = 1123
export const PAGE_H = 794

export const INF = {
  ink: "#0C285C",
  ink2: "#2A3D66",
  slate: "#5A6B8C",
  mute: "#8A97B1",
  hair: "#DFE5EF",
  hairSoft: "#EEF2F8",
  mist: "#F4F7FC",
  paper: "#FFFFFF",
  gold: "#F4B41A",
  goldD: "#B7830A",
  goldL: "#FFF5D9",
  goldLine: "#F1D58A",
  goldText: "#7A5600",
  stable: "#AFBACB",
  silver: "#C9D3E5",
  bronze: "#E8C7A0",
  inkSoftText: "#C9D6EE",
  red: "#E5484D",
  redText: "#B42318",
  redBg: "#FFF7F7",
  redLine: "#F5C6C7",
  green: "#2E9E53",
  greenBg: "#F5FBF6",
  greenLine: "#BFE3CA",
  greenText: "#1E7B34",
  greenSoft: "#E0F2E6",
  blue: "#2F6FDB",
  teal: "#1F9E94",
  orange: "#F08A24",
  naStripeA: "#EEF1F6",
  naStripeB: "#F8FAFD",
} as const

/** Five-level palette: very low … excellent. */
export const LV = ["#E5484D", "#F08A24", "#2F6FDB", "#1F9E94", "#2E9E53"] as const
export const LVL = ["#FDE6E6", "#FDEEDD", "#E3ECFB", "#DDF2F0", "#E0F2E6"] as const

const idx = (i: number, n: number) => (n === 5 ? i : Math.round((i * 4) / Math.max(1, n - 1)))
export const lvColor = (i: number, n: number) => LV[Math.max(0, Math.min(4, idx(i, n)))]
export const lvLight = (i: number, n: number) => LVL[Math.max(0, Math.min(4, idx(i, n)))]

/** Page text uses the app's loaded Arabic font; SVG text needs concrete system families (SVG-as-image can't see web fonts). */
export const FONT_HTML = "var(--font-cairo), Tahoma, 'Segoe UI', Arial, sans-serif"
export const FONT_SVG = "Tahoma, 'Segoe UI', Arial, 'Noto Sans Arabic', sans-serif"

const LRI = "⁦"
const PDI = "⁩"
/** Keeps «71.2%» and «+3.5» in reading order inside Arabic sentences. */
export const iso = (s: string) => String(s).replace(/([+−-]?\d+(?:\.\d+)?%)/g, `${LRI}$1${PDI}`)
export const ltr = (s: string | number) => `${LRI}${s}${PDI}`

export const round2 = (x: number) => Math.round(x * 100) / 100

export function niceStep(max: number) {
  const raw = max / 10
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
}

export const fmtNum = (v: number, pctScale?: boolean) => (pctScale ? `${Math.round(v * 100)}%` : String(Math.round(v * 100) / 100))

export const who = (basic: boolean) => (basic ? "التلاميذ" : "الطلاب")
export const one = (basic: boolean) => (basic ? "تلميذ" : "طالب")

/** Page identity shown in the header and footer (from the section and the Jahbadh settings). */
export interface PageMeta {
  school: string
  office: string
  municipality: string
  year: string
  teacher: string
  principal: string
  grade: string
  section: string
}

export interface PageOptions {
  names: boolean
  logoUrl: string | null
}
