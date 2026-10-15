// Print/PDF layout helpers shared by the app, copied from the web's lib/utils/printLayout.ts
// (pure string functions: header/footer HTML, {school_*} tokens, page CSS). Keep in step with it.

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

// Shared font stack for all popup print/PDF documents. "Noto Sans Arabic" is
// loaded as a webfont (see PDF_FONT_LINK) so Arabic renders correctly even on
// systems without an Arabic-capable system font installed — Segoe UI/Tahoma
// are Windows-only and commonly missing on macOS/Linux, which previously left
// Arabic text falling back to Arial (no Arabic glyphs) or a tofu/mojibake font.
export const PDF_FONT_STACK = "'Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif"
export const PDF_FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700;800&display=swap">'

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
export function buildAutoHeaderHtml(school: PrintSchool, accentColor = DEFAULT_ACCENT, reportLabel = "Student Report"): string {
  const addr = formatAddress(school)
  const logoEl = school.logo_url
    ? `<img src="${school.logo_url}" alt="" crossorigin="anonymous" style="height:68px;width:68px;object-fit:contain;border-radius:6px;flex-shrink:0;" />`
    : `<div style="height:68px;width:68px;display:flex;align-items:center;justify-content:center;background:${accentColor};border-radius:8px;color:#fff;font-size:26px;font-weight:800;flex-shrink:0;">${escapeHtml((school.name || "S").charAt(0).toUpperCase())}</div>`

  const infoLines: string[] = []
  if (addr)         infoLines.push(`<div dir="auto" style="font-size:13px;color:#444;margin-top:4px;line-height:1.4;">${escapeHtml(addr)}</div>`)
  if (school.phone) infoLines.push(`<div dir="auto" style="font-size:13px;color:#444;margin-top:2px;">${escapeHtml(school.phone)}</div>`)

  // No letter-spacing on Arabic-eligible text: non-zero letter-spacing forces
  // Arabic letters into their isolated (unjoined) form even with dir set
  // correctly, producing visibly broken/disconnected script.
  return `<div style="padding:14px 28px 12px;border-bottom:3px solid ${accentColor};display:flex;align-items:center;gap:18px;background:#fff;font-family:${PDF_FONT_STACK};">` +
    logoEl +
    `<div style="flex:1;min-width:0;">` +
      `<div dir="auto" style="font-size:22px;font-weight:800;color:${accentColor};line-height:1.2;">${escapeHtml(school.name || "")}</div>` +
      infoLines.join("") +
    `</div>` +
    `<div dir="auto" style="text-align:right;flex-shrink:0;">` +
      `<div style="font-size:10px;text-transform:uppercase;color:${accentColor};font-weight:700;opacity:0.75;">${escapeHtml(reportLabel)}</div>` +
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

  return `<div dir="auto" style="border-top:2px solid ${accentColor};padding:10px 28px;background:#fff;font-family:${PDF_FONT_STACK};display:flex;justify-content:space-between;align-items:center;">` +
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
/* Screen preview: header/footer flow naturally so they don't overlap content */
.pdf-header { position:relative; width:100%; }
.pdf-footer { position:relative; width:100%; margin-top:24px; }
/* Print: fix header/footer so they repeat on every page */
@media print {
  .pdf-header { position:fixed; top:0; left:0; right:0; z-index:100; }
  .pdf-footer { position:fixed; bottom:0; left:0; right:0; z-index:100; margin-top:0; }
  ${excludePrint ? ".pdf-header, .pdf-footer { display:none !important; }" : ""}
}
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
body { font-family:${PDF_FONT_STACK}; color:#1a1a1a; }
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
