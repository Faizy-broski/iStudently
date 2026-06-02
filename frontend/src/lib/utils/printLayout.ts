/**
 * printLayout.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared print-document utility — RosarioSIS-style header / footer applied
 * automatically across every print module.
 *
 * Behaviour
 * ──────────
 * • Opens a new browser tab with an instant, fully-rendered HTML preview.
 * • The preview includes a toolbar with "Print / Save PDF" and "Close" buttons.
 * • The browser's native Print dialog (Ctrl+P / Cmd+P) renders crisp vector
 *   text with proper page-break support — no rasterisation.
 * • If the school has configured custom PDF header / footer HTML (via
 *   Settings → PDF Header Footer), that HTML is resolved and used.
 * • Otherwise, an auto-generated header / footer is produced from the
 *   school / campus data (logo, name, address, phone).
 *
 * Usage
 * ──────────────────────────────────────────────────────────────────────
 *   import { openPrintPreview } from "@/lib/utils/printLayout"
 *
 *   openPrintPreview({
 *     title: "Student Schedule",
 *     bodyHtml,
 *     bodyStyles: MY_CONTENT_STYLES,
 *     school: selectedCampus,
 *     pdfSettings,
 *   })
 */

import type { PdfHeaderFooterSettings } from "@/lib/api/school-settings"

// ─── html2canvas color compatibility ──────────────────────────────────────────

/**
 * html2canvas v1.x does not support modern CSS color functions (oklch, lab, lch).
 * This project uses Tailwind v4 + Shadcn UI which define CSS variables with oklch().
 *
 * Inject this as a <style> tag inside the html2canvas `onclone` callback to
 * replace all oklch-based CSS variables with plain hex equivalents before capture.
 *
 * Usage:
 *   html2canvas(el, { onclone: applyHtml2CanvasColorFix })
 */
export function applyHtml2CanvasColorFix(clonedDoc: Document): void {
  const style = clonedDoc.createElement('style')
  style.textContent = `
/* ── Shadcn / Radix UI CSS variable overrides (oklch → hex) ── */
:root {
  --background: #ffffff !important;
  --foreground: #020817 !important;
  --card: #ffffff !important;
  --card-foreground: #020817 !important;
  --popover: #ffffff !important;
  --popover-foreground: #020817 !important;
  --primary: #1e293b !important;
  --primary-foreground: #f8fafc !important;
  --secondary: #f1f5f9 !important;
  --secondary-foreground: #1e293b !important;
  --muted: #f1f5f9 !important;
  --muted-foreground: #64748b !important;
  --accent: #f1f5f9 !important;
  --accent-foreground: #1e293b !important;
  --destructive: #ef4444 !important;
  --destructive-foreground: #f8fafc !important;
  --border: #e2e8f0 !important;
  --input: #e2e8f0 !important;
  --ring: #94a3b8 !important;
  --chart-1: #e76e50 !important;
  --chart-2: #2a9d8f !important;
  --chart-3: #264653 !important;
  --chart-4: #e9c46a !important;
  --chart-5: #f4a261 !important;
}
/* ── Tailwind v4 color palette (oklch → hex) ── */
:root {
  --color-slate-50:#f8fafc;--color-slate-100:#f1f5f9;--color-slate-200:#e2e8f0;
  --color-slate-300:#cbd5e1;--color-slate-400:#94a3b8;--color-slate-500:#64748b;
  --color-slate-600:#475569;--color-slate-700:#334155;--color-slate-800:#1e293b;
  --color-slate-900:#0f172a;--color-slate-950:#020617;
  --color-gray-50:#f9fafb;--color-gray-100:#f3f4f6;--color-gray-200:#e5e7eb;
  --color-gray-300:#d1d5db;--color-gray-400:#9ca3af;--color-gray-500:#6b7280;
  --color-gray-600:#4b5563;--color-gray-700:#374151;--color-gray-800:#1f2937;
  --color-gray-900:#111827;--color-gray-950:#030712;
  --color-zinc-50:#fafafa;--color-zinc-100:#f4f4f5;--color-zinc-200:#e4e4e7;
  --color-zinc-300:#d4d4d8;--color-zinc-400:#a1a1aa;--color-zinc-500:#71717a;
  --color-zinc-600:#52525b;--color-zinc-700:#3f3f46;--color-zinc-800:#27272a;
  --color-zinc-900:#18181b;--color-zinc-950:#09090b;
  --color-neutral-50:#fafafa;--color-neutral-100:#f5f5f5;--color-neutral-200:#e5e5e5;
  --color-neutral-300:#d4d4d4;--color-neutral-400:#a3a3a3;--color-neutral-500:#737373;
  --color-neutral-600:#525252;--color-neutral-700:#404040;--color-neutral-800:#262626;
  --color-neutral-900:#171717;--color-neutral-950:#0a0a0a;
  --color-stone-50:#fafaf9;--color-stone-100:#f5f5f4;--color-stone-200:#e7e5e4;
  --color-stone-300:#d6d3d1;--color-stone-400:#a8a29e;--color-stone-500:#78716c;
  --color-stone-600:#57534e;--color-stone-700:#44403c;--color-stone-800:#292524;
  --color-stone-900:#1c1917;--color-stone-950:#0c0a09;
  --color-red-50:#fef2f2;--color-red-100:#fee2e2;--color-red-200:#fecaca;
  --color-red-300:#fca5a5;--color-red-400:#f87171;--color-red-500:#ef4444;
  --color-red-600:#dc2626;--color-red-700:#b91c1c;--color-red-800:#991b1b;
  --color-red-900:#7f1d1d;--color-red-950:#450a0a;
  --color-orange-50:#fff7ed;--color-orange-100:#ffedd5;--color-orange-200:#fed7aa;
  --color-orange-300:#fdba74;--color-orange-400:#fb923c;--color-orange-500:#f97316;
  --color-orange-600:#ea580c;--color-orange-700:#c2410c;--color-orange-800:#9a3412;
  --color-orange-900:#7c2d12;--color-orange-950:#431407;
  --color-amber-50:#fffbeb;--color-amber-100:#fef3c7;--color-amber-200:#fde68a;
  --color-amber-300:#fcd34d;--color-amber-400:#fbbf24;--color-amber-500:#f59e0b;
  --color-amber-600:#d97706;--color-amber-700:#b45309;--color-amber-800:#92400e;
  --color-amber-900:#78350f;--color-amber-950:#451a03;
  --color-yellow-50:#fefce8;--color-yellow-100:#fef9c3;--color-yellow-200:#fef08a;
  --color-yellow-300:#fde047;--color-yellow-400:#facc15;--color-yellow-500:#eab308;
  --color-yellow-600:#ca8a04;--color-yellow-700:#a16207;--color-yellow-800:#854d0e;
  --color-yellow-900:#713f12;--color-yellow-950:#422006;
  --color-lime-50:#f7fee7;--color-lime-100:#ecfccb;--color-lime-200:#d9f99d;
  --color-lime-300:#bef264;--color-lime-400:#a3e635;--color-lime-500:#84cc16;
  --color-lime-600:#65a30d;--color-lime-700:#4d7c0f;--color-lime-800:#3f6212;
  --color-lime-900:#365314;--color-lime-950:#1a2e05;
  --color-green-50:#f0fdf4;--color-green-100:#dcfce7;--color-green-200:#bbf7d0;
  --color-green-300:#86efac;--color-green-400:#4ade80;--color-green-500:#22c55e;
  --color-green-600:#16a34a;--color-green-700:#15803d;--color-green-800:#166534;
  --color-green-900:#14532d;--color-green-950:#052e16;
  --color-emerald-50:#ecfdf5;--color-emerald-100:#d1fae5;--color-emerald-200:#a7f3d0;
  --color-emerald-300:#6ee7b7;--color-emerald-400:#34d399;--color-emerald-500:#10b981;
  --color-emerald-600:#059669;--color-emerald-700:#047857;--color-emerald-800:#065f46;
  --color-emerald-900:#064e3b;--color-emerald-950:#022c22;
  --color-teal-50:#f0fdfa;--color-teal-100:#ccfbf1;--color-teal-200:#99f6e4;
  --color-teal-300:#5eead4;--color-teal-400:#2dd4bf;--color-teal-500:#14b8a6;
  --color-teal-600:#0d9488;--color-teal-700:#0f766e;--color-teal-800:#115e59;
  --color-teal-900:#134e4a;--color-teal-950:#042f2e;
  --color-cyan-50:#ecfeff;--color-cyan-100:#cffafe;--color-cyan-200:#a5f3fc;
  --color-cyan-300:#67e8f9;--color-cyan-400:#22d3ee;--color-cyan-500:#06b6d4;
  --color-cyan-600:#0891b2;--color-cyan-700:#0e7490;--color-cyan-800:#155e75;
  --color-cyan-900:#164e63;--color-cyan-950:#083344;
  --color-sky-50:#f0f9ff;--color-sky-100:#e0f2fe;--color-sky-200:#bae6fd;
  --color-sky-300:#7dd3fc;--color-sky-400:#38bdf8;--color-sky-500:#0ea5e9;
  --color-sky-600:#0284c7;--color-sky-700:#0369a1;--color-sky-800:#075985;
  --color-sky-900:#0c4a6e;--color-sky-950:#082f49;
  --color-blue-50:#eff6ff;--color-blue-100:#dbeafe;--color-blue-200:#bfdbfe;
  --color-blue-300:#93c5fd;--color-blue-400:#60a5fa;--color-blue-500:#3b82f6;
  --color-blue-600:#2563eb;--color-blue-700:#1d4ed8;--color-blue-800:#1e40af;
  --color-blue-900:#1e3a8a;--color-blue-950:#172554;
  --color-indigo-50:#eef2ff;--color-indigo-100:#e0e7ff;--color-indigo-200:#c7d2fe;
  --color-indigo-300:#a5b4fc;--color-indigo-400:#818cf8;--color-indigo-500:#6366f1;
  --color-indigo-600:#4f46e5;--color-indigo-700:#4338ca;--color-indigo-800:#3730a3;
  --color-indigo-900:#312e81;--color-indigo-950:#1e1b4b;
  --color-violet-50:#f5f3ff;--color-violet-100:#ede9fe;--color-violet-200:#ddd6fe;
  --color-violet-300:#c4b5fd;--color-violet-400:#a78bfa;--color-violet-500:#8b5cf6;
  --color-violet-600:#7c3aed;--color-violet-700:#6d28d9;--color-violet-800:#5b21b6;
  --color-violet-900:#4c1d95;--color-violet-950:#2e1065;
  --color-purple-50:#faf5ff;--color-purple-100:#f3e8ff;--color-purple-200:#e9d5ff;
  --color-purple-300:#d8b4fe;--color-purple-400:#c084fc;--color-purple-500:#a855f7;
  --color-purple-600:#9333ea;--color-purple-700:#7e22ce;--color-purple-800:#6b21a8;
  --color-purple-900:#581c87;--color-purple-950:#3b0764;
  --color-fuchsia-50:#fdf4ff;--color-fuchsia-100:#fae8ff;--color-fuchsia-200:#f5d0fe;
  --color-fuchsia-300:#f0abfc;--color-fuchsia-400:#e879f9;--color-fuchsia-500:#d946ef;
  --color-fuchsia-600:#c026d3;--color-fuchsia-700:#a21caf;--color-fuchsia-800:#86198f;
  --color-fuchsia-900:#701a75;--color-fuchsia-950:#4a044e;
  --color-pink-50:#fdf2f8;--color-pink-100:#fce7f3;--color-pink-200:#fbcfe8;
  --color-pink-300:#f9a8d4;--color-pink-400:#f472b6;--color-pink-500:#ec4899;
  --color-pink-600:#db2777;--color-pink-700:#be185d;--color-pink-800:#9d174d;
  --color-pink-900:#831843;--color-pink-950:#500724;
  --color-rose-50:#fff1f2;--color-rose-100:#ffe4e6;--color-rose-200:#fecdd3;
  --color-rose-300:#fda4af;--color-rose-400:#fb7185;--color-rose-500:#f43f5e;
  --color-rose-600:#e11d48;--color-rose-700:#be123c;--color-rose-800:#9f1239;
  --color-rose-900:#881337;--color-rose-950:#4c0519;
  --color-white:#ffffff;--color-black:#000000;
}
  `
  clonedDoc.head.appendChild(style)
}

// ─── School shape ─────────────────────────────────────────────────────────────

export interface PrintSchool {
  name: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  contact_email?: string
  logo_url?: string | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const DEFAULT_ACCENT = "#1e3a5f"

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  )
}

function formatAddress(school: PrintSchool): string {
  const parts: string[] = []
  if (school.address) parts.push(school.address)
  const cityState = [school.city, school.state].filter(Boolean).join(", ")
  if (cityState) parts.push(cityState)
  if (school.zip_code) parts.push(school.zip_code)
  return parts.join(", ")
}

// ─── Auto-generated header / footer ──────────────────────────────────────────

/**
 * Builds the RosarioSIS-style page header HTML.
 * Left: school logo (or coloured initial block).
 * Right of logo: school name (bold, accent colour) + address + phone.
 * Bottom border: 3 px solid accent line.
 */
export function buildAutoHeaderHtml(school: PrintSchool, accentColor = DEFAULT_ACCENT): string {
  const addr = formatAddress(school)
  const logoEl = school.logo_url
    ? `<img src="${school.logo_url}" alt="" style="height:68px;width:68px;object-fit:contain;border-radius:6px;flex-shrink:0;" />`
    : `<div style="height:68px;width:68px;display:flex;align-items:center;justify-content:center;background:${accentColor};border-radius:8px;color:#fff;font-size:26px;font-weight:800;flex-shrink:0;">${escapeHtml((school.name || "S").charAt(0).toUpperCase())}</div>`

  const infoLines: string[] = []
  if (addr)         infoLines.push(`<div style="font-size:13px;color:#444;margin-top:4px;line-height:1.4;">${escapeHtml(addr)}</div>`)
  if (school.phone) infoLines.push(`<div style="font-size:13px;color:#444;margin-top:2px;">${escapeHtml(school.phone)}</div>`)

  return `<div style="padding:14px 28px 12px;border-bottom:3px solid ${accentColor};display:flex;align-items:center;gap:18px;background:#fff;font-family:'Segoe UI',Arial,sans-serif;">` +
    logoEl +
    `<div style="flex:1;min-width:0;">` +
      `<div style="font-size:22px;font-weight:800;color:${accentColor};line-height:1.2;letter-spacing:-0.3px;">${escapeHtml(school.name || "")}</div>` +
      infoLines.join("") +
    `</div>` +
    `<div style="text-align:right;flex-shrink:0;">` +
      `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${accentColor};font-weight:700;opacity:0.75;">Student Report</div>` +
    `</div>` +
  `</div>`
}

/**
 * Builds the RosarioSIS-style page footer HTML.
 * Small logo (if available) + school name (bold, accent) + address · phone.
 * Top border: 2 px solid accent line.
 */
export function buildAutoFooterHtml(school: PrintSchool, accentColor = DEFAULT_ACCENT): string {
  const addr  = formatAddress(school)
  const phone = school.phone ? escapeHtml(school.phone) : ''

  const leftHtml =
    `<div style="font-size:13px;font-weight:700;color:${accentColor};line-height:1.3;">${escapeHtml(school.name || "")}</div>` +
    (addr ? `<div style="font-size:11px;color:#555;margin-top:2px;">${escapeHtml(addr)}</div>` : "")

  const rightHtml = phone
    ? `<div style="font-size:12px;color:#555;text-align:right;">${phone}</div>`
    : ""

  return `<div style="border-top:2px solid ${accentColor};padding:10px 28px;background:#fff;font-family:'Segoe UI',Arial,sans-serif;display:flex;justify-content:space-between;align-items:center;">` +
    `<div>${leftHtml}</div>` +
    (rightHtml ? `<div>${rightHtml}</div>` : "") +
  `</div>`
}

// ─── Token resolution ─────────────────────────────────────────────────────────

/**
 * Resolves {school_logo}, {school_name}, {school_address}, {school_phone},
 * {school_email}, {date}, {page_number}, {total_pages} inside user-configured HTML.
 */
export function resolvePdfTokens(html: string, school: PrintSchool): string {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })
  const logoHtml = school.logo_url
    ? `<img src="${school.logo_url}" alt="${school.name || ""}" style="height:60px;width:auto;object-fit:contain;vertical-align:middle;" />`
    : ""
  return html
    .replace(/\{school_logo\}/g,    logoHtml)
    .replace(/\{school_name\}/g,    school.name || "")
    .replace(/\{school_address\}/g, formatAddress(school))
    .replace(/\{school_phone\}/g,   school.phone || "")
    .replace(/\{school_email\}/g,   school.contact_email || "")
    .replace(/\{date\}/g,           today)
    .replace(/\{page_number\}/g,    "")
    .replace(/\{total_pages\}/g,    "")
}

// ─── CSS helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the CSS block that positions the fixed header/footer and sets
 * @page margins so content never slides under them.
 */
export function buildPdfLayoutCss(
  marginTop: number,
  marginBottom: number,
  excludePrint: boolean,
): string {
  return `
@page { margin-top:${marginTop}mm; margin-bottom:${marginBottom}mm; margin-left:12mm; margin-right:12mm; }
.pdf-header { position:fixed; top:0; left:0; right:0; z-index:100; }
.pdf-footer { position:fixed; bottom:0; left:0; right:0; z-index:100; }
${excludePrint ? "@media print { .pdf-header, .pdf-footer { display:none !important; } }" : ""}
`
}

/**
 * Shared base styles for ALL popup print documents:
 * – CSS reset
 * – Print colour-accuracy flag
 * – .record-header / .record-subheader for RosarioSIS-style coloured content bands
 */
export const BASE_PRINT_STYLES = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; color:#1a1a1a; }
@media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }

/* ── RosarioSIS-style coloured record identifier band ── */
.record-header {
  display:flex; justify-content:space-between; align-items:center;
  background:#1e3a5f; color:#fff;
  padding:5px 14px; font-size:13px; font-weight:600;
}
.record-header .rh-right { font-size:11px; font-weight:400; opacity:0.85; }
.record-subheader {
  display:flex; justify-content:space-between; align-items:center;
  background:#e8edf4; color:#1e3a5f;
  padding:3px 14px; font-size:11px; font-weight:500; margin-bottom:8px;
}
`

// ─── Main API ─────────────────────────────────────────────────────────────────

export interface OpenPrintOptions {
  title: string
  bodyHtml: string
  /** Module-specific CSS (schedules, report cards, etc.) */
  bodyStyles: string
  school: PrintSchool
  pdfSettings?: PdfHeaderFooterSettings | null
  /** Defaults to #1e3a5f (dark navy). Only used for auto-generated header/footer. */
  accentColor?: string
  /**
   * Whether the pdf_header_footer plugin is active for this campus.
   * When false, all header/footer branding is suppressed — no auto-generated
   * or custom header/footer is rendered, and page margins are left minimal.
   * Defaults to true for backward compatibility.
   */
  pluginActive?: boolean
  /**
   * When true, generate PDF in A4 landscape orientation (297 × 210 mm).
   * Used by the "Two Copies Landscape" report card layout.
   * Defaults to false (portrait).
   */
  landscape?: boolean
}

/**
 * Minimum safe @page margins for the auto-generated header/footer.
 * Auto header:  logo 52px + padding 20px + border 3px = ~75px ≈ 26mm @72dpi → use 32mm.
 * Auto footer:  logo 36px + padding 12px + border 2px = ~50px ≈ 18mm @72dpi → use 22mm.
 */
const AUTO_MARGIN_TOP    = 32
const AUTO_MARGIN_BOTTOM = 22

/**
 * Opens a new browser window with a fully-formatted print document.
 * Includes a preview toolbar with Print and Close buttons at the top
 * (hidden during actual printing).
 *
 * @deprecated Prefer `openPrintPreview` which has identical behaviour
 * but a clearer name.
 */
export function openPrintWindow(options: OpenPrintOptions): void {
  openPrintPreview(options)
}

/**
 * Opens a new browser tab with an instant HTML preview of the formatted
 * document — including header, footer, and all content.  The user can
 * then use the browser's native Print dialog (Ctrl+P / Cmd+P) to print
 * to paper or "Save as PDF" with full fidelity.
 *
 * This replaces the old html2canvas + jsPDF pipeline which was slow,
 * produced rasterised (blurry) output, and had no preview.
 *
 * Approach inspired by RosarioSIS: generate a self-contained HTML page
 * in a popup/tab and let the browser do the rendering.
 */
export function openPrintPreview(options: OpenPrintOptions): void {
  const {
    title, bodyHtml, bodyStyles, school,
    pdfSettings, accentColor = DEFAULT_ACCENT, pluginActive = true,
  } = options

  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    alert("Please allow popups to print documents.")
    return
  }

  // ── Plugin not active → clean, unbranded document ──────────────────────
  if (!pluginActive) {
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${BASE_PRINT_STYLES}
    @page { margin: 15mm; }
    body { padding: 20px 32px; }
    ${bodyStyles}
    ${PREVIEW_TOOLBAR_STYLES}
  </style>
</head>
<body>
${PREVIEW_TOOLBAR_HTML(title)}
${bodyHtml}
</body>
</html>`)
    printWindow.document.close()
    return
  }

  // ── Plugin active → branded header / footer ────────────────────────────
  const usingCustomHeader = !!pdfSettings?.pdf_header_html
  const usingCustomFooter = !!pdfSettings?.pdf_footer_html
  const excludePrint = (usingCustomHeader || usingCustomFooter) && (pdfSettings?.pdf_exclude_print ?? false)

  const marginTop = usingCustomHeader
    ? (pdfSettings!.pdf_margin_top    ?? 20)
    : Math.max(pdfSettings?.pdf_margin_top    ?? 0, AUTO_MARGIN_TOP)
  const marginBottom = usingCustomFooter
    ? (pdfSettings!.pdf_margin_bottom ?? 18)
    : Math.max(pdfSettings?.pdf_margin_bottom ?? 0, AUTO_MARGIN_BOTTOM)

  const headerHtml = usingCustomHeader
    ? resolvePdfTokens(pdfSettings!.pdf_header_html, school)
    : buildAutoHeaderHtml(school, accentColor)

  const footerHtml = usingCustomFooter
    ? resolvePdfTokens(pdfSettings!.pdf_footer_html, school)
    : buildAutoFooterHtml(school, accentColor)

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${BASE_PRINT_STYLES}
    ${buildPdfLayoutCss(marginTop, marginBottom, excludePrint)}
    body { padding: 20px 32px; }
    ${bodyStyles}
    ${PREVIEW_TOOLBAR_STYLES}
  </style>
</head>
<body>
<div class="pdf-header">${headerHtml}</div>
${PREVIEW_TOOLBAR_HTML(title)}
${bodyHtml}
<div class="pdf-footer">${footerHtml}</div>
</body>
</html>`)

  printWindow.document.close()
}

// ── Preview toolbar shown at the top of the new tab (hidden when printing) ──

const PREVIEW_TOOLBAR_STYLES = `
.print-toolbar {
  position: sticky; top: 0; z-index: 9999;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 24px;
  background: #f8f9fb; border-bottom: 1px solid #e2e8f0;
  font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px;
}
.print-toolbar .toolbar-title {
  flex: 1; font-weight: 600; color: #1e3a5f; font-size: 14px;
}
.print-toolbar button {
  padding: 7px 18px; border: none; border-radius: 6px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.print-toolbar .btn-download {
  background: #1e3a5f; color: #fff;
}
.print-toolbar .btn-download:hover { background: #15304f; }
.print-toolbar .btn-download:disabled { background: #6b7280; cursor: not-allowed; }
.print-toolbar .btn-close {
  background: #e2e8f0; color: #334155;
}
.print-toolbar .btn-close:hover { background: #cbd5e1; }
@media print {
  .print-toolbar { display: none !important; }
}
`

function PREVIEW_TOOLBAR_HTML(title: string): string {
  const safeTitle = escapeHtml(title)
  const filenameTitle = title.replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'document'
  return `<div class="print-toolbar">
  <span class="toolbar-title">${safeTitle}</span>
  <button class="btn-download" id="btn-pdf-download">Download PDF</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
<script>
document.getElementById('btn-pdf-download').addEventListener('click', function() {
  var btn = this;
  var toolbar = document.querySelector('.print-toolbar');
  btn.disabled = true;
  btn.textContent = 'Generating\u2026';
  toolbar.style.display = 'none';
  html2canvas(document.body, { scale: 2, useCORS: true, logging: false }).then(function(canvas) {
    toolbar.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Download PDF';
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW = pdf.internal.pageSize.getWidth();
    var pageH = pdf.internal.pageSize.getHeight();
    var imgW = pageW;
    var imgH = (canvas.height * imgW) / canvas.width;
    var imgData = canvas.toDataURL('image/jpeg', 0.92);
    var position = 0;
    var remaining = imgH;
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    remaining -= pageH;
    while (remaining > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
      remaining -= pageH;
    }
    pdf.save('${filenameTitle}.pdf');
  }).catch(function(err) {
    toolbar.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Download PDF';
    alert('Failed to generate PDF: ' + err.message);
  });
});
<\/script>`
}

/**
 * Opens a new browser tab that shows a loading screen, then captures each
 * student page individually (header + page content + footer) and composes them
 * into a multi-page PDF using jsPDF. The tab navigates to the resulting blob
 * URL so the browser renders it in its built-in PDF viewer.
 *
 * Per-element capture strategy:
 *  1. Capture `.pdf-header` once → reuse on every page.
 *  2. Capture `.pdf-footer` once → reuse on every page.
 *  3. Capture each `.print-report > div > div` separately → one PDF page each.
 *  4. Compose: header at top, footer at bottom, content scaled to fit the
 *     remaining vertical space.
 */
export async function openPdfDownload(
  options: OpenPrintOptions,
  _filename?: string,
): Promise<void> {
  const {
    title, bodyHtml, bodyStyles, school,
    pdfSettings, accentColor = DEFAULT_ACCENT, pluginActive = true,
    landscape = false,
  } = options

  // A4 portrait: 794px wide @96dpi (210mm).  A4 landscape: 1123px wide (297mm).
  const captureWidth = landscape ? 1123 : 794

  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    alert("Please allow popups to print documents.")
    return
  }

  // ── Build header / footer HTML ────────────────────────────────────────────
  let headerMarkup = ''
  let footerMarkup = ''
  let layoutCss    = ''

  if (pluginActive) {
    const usingCustomHeader = !!pdfSettings?.pdf_header_html
    const usingCustomFooter = !!pdfSettings?.pdf_footer_html
    const hHtml = usingCustomHeader
      ? resolvePdfTokens(pdfSettings!.pdf_header_html, school)
      : buildAutoHeaderHtml(school, accentColor)
    const fHtml = usingCustomFooter
      ? resolvePdfTokens(pdfSettings!.pdf_footer_html, school)
      : buildAutoFooterHtml(school, accentColor)
    headerMarkup = `<div class="pdf-header">${hHtml}</div>`
    footerMarkup = `<div class="pdf-footer">${fHtml}</div>`
    // Keep header/footer in normal document flow so html2canvas can find them.
    layoutCss = `.pdf-header, .pdf-footer { position: relative !important; width: 100%; }`
  }

  // ── Loading overlay ───────────────────────────────────────────────────────
  const loadingOverlay = `
<div id="_pdf_overlay" style="position:fixed;inset:0;z-index:99999;background:#1e3a5f;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Segoe UI',Arial,sans-serif;gap:16px;">
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
  <div style="font-size:17px;font-weight:600;">Generating PDF&hellip;</div>
  <div style="font-size:13px;opacity:0.65;">Please wait while your document is being prepared</div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
</div>`

  // ── Auto-generate script ──────────────────────────────────────────────────
  // Strategy:
  //   • Capture .pdf-header and .pdf-footer once each.
  //   • Capture every .print-report > div > div (one per student page) in
  //     sequence to avoid memory spikes.
  //   • For each PDF page: stamp header at top, footer at bottom, scale content
  //     to fit the remaining vertical band.
  const autoGenerateScript = `
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
<script>
window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var overlay  = document.getElementById('_pdf_overlay');
    var h2cOpts  = { scale: 2, useCORS: true, logging: false, windowWidth: ${captureWidth},
                     ignoreElements: function(el) { return el.id === '_pdf_overlay'; } };

    var headerEl = document.querySelector('.pdf-header');
    var footerEl = document.querySelector('.pdf-footer');
    var pageEls  = Array.from(document.querySelectorAll('.class-page, .schedule-page, .statement-page, .print-page'));
    if (pageEls.length === 0) {
      pageEls = [document.querySelector('.print-body-content') || document.body];
    }

    function h2c(el) { return html2canvas(el, h2cOpts); }

    // Sequential capture to avoid memory spikes on large reports.
    function seqCapture(els) {
      return els.reduce(function(p, el) {
        return p.then(function(arr) {
          return h2c(el).then(function(c) { arr.push(c); return arr; });
        });
      }, Promise.resolve([]));
    }

    Promise.all([
      headerEl ? h2c(headerEl) : Promise.resolve(null),
      footerEl ? h2c(footerEl) : Promise.resolve(null),
    ]).then(function(hf) {
      return seqCapture(pageEls).then(function(pages) {
        return { hC: hf[0], fC: hf[1], pages: pages };
      });
    }).then(function(d) {
      var jsPDF = window.jspdf.jsPDF;
      var pdf   = new jsPDF({ orientation: '${landscape ? 'landscape' : 'portrait'}', unit: 'mm', format: 'a4' });
      var W     = pdf.internal.pageSize.getWidth();   // portrait: 210mm  landscape: 297mm
      var H     = pdf.internal.pageSize.getHeight();  // portrait: 297mm  landscape: 210mm

      // Heights in mm — preserve aspect ratio, fill full page width.
      var hH = d.hC ? (d.hC.height / d.hC.width) * W : 0;
      var fH = d.fC ? (d.fC.height / d.fC.width) * W : 0;
      var pad        = 5;   // mm gap between header/footer and content
      var contentY   = hH + pad;
      var contentAv  = H - hH - fH - 2 * pad;
      var fY         = H - fH;
      var sideM      = 8;   // mm horizontal margin for content
      var hImg       = d.hC ? d.hC.toDataURL('image/jpeg', 0.95) : null;
      var fImg       = d.fC ? d.fC.toDataURL('image/jpeg', 0.95) : null;

      d.pages.forEach(function(canvas, idx) {
        if (idx > 0) pdf.addPage();

        // Stamp header and footer on every page.
        if (hImg) pdf.addImage(hImg, 'JPEG', 0, 0,  W, hH);
        if (fImg) pdf.addImage(fImg, 'JPEG', 0, fY, W, fH);

        // Scale content to fit the vertical band between header and footer.
        var hasHF = hH > 0 || fH > 0;
        var avail = hasHF ? contentAv  : (H - 2 * pad);
        var cYpos = hasHF ? contentY   : pad;
        var cW    = W - 2 * sideM;
        var cH    = (canvas.height / canvas.width) * cW;
        var cX    = sideM;
        if (cH > avail) {
          cH = avail;
          cW = (canvas.width / canvas.height) * cH;
          cX = (W - cW) / 2;
        }
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', cX, cYpos, cW, cH);
      });

      var blob = pdf.output('blob');
      window.location.href = URL.createObjectURL(blob);
    }).catch(function(err) {
      overlay.innerHTML =
        '<div style="color:#fca5a5;font-size:15px;text-align:center;padding:24px;">'
        + 'Failed to generate PDF:<br>' + err.message + '</div>';
    });
  }, 800);
});
<\/script>`

  // ── Write document ────────────────────────────────────────────────────────
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${BASE_PRINT_STYLES}
    ${layoutCss}
    body { margin: 0; padding: 0; }
    ${bodyStyles}
  </style>
</head>
<body>
${loadingOverlay}
${headerMarkup}
<div class="print-body-content" style="padding: 6px 20px; background: #fff;">${bodyHtml}</div>
${footerMarkup}
${autoGenerateScript}
</body>
</html>`)

  printWindow.document.close()
}
