// Output of the infographic pages: browser print (save as PDF, one page per sheet) and PNG at 3× (3369 px wide) as
// single files or one ZIP. Pages are captured from an unscaled copy mounted for the job (see Infographics.tsx).
import { PAGE_H, PAGE_W } from "./palette"

export const STAGE_ID = "jgi-stage"
export const STAGE_ROOT_ID = "jgi-stage-root"
const STYLE_ID = "jgi-print-style"

/** Print rules while the stage is mounted: only the sheets print, one A4 landscape page each. */
export function installPrintStyle() {
  if (document.getElementById(STYLE_ID)) return () => undefined
  const el = document.createElement("style")
  el.id = STYLE_ID
  el.textContent = `
@page { size: A4 landscape; margin: 0; }
#${STAGE_ROOT_ID} { position: fixed; top: 0; left: 0; z-index: -1; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body > *:not(#${STAGE_ROOT_ID}) { display: none !important; }
  #${STAGE_ROOT_ID} { position: static !important; z-index: auto !important; }
  [data-jgi-sheet] { break-after: page; page-break-after: always; }
  [data-jgi-sheet]:last-child { break-after: auto; page-break-after: auto; }
  #${STAGE_ID}, #${STAGE_ID} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`
  document.head.appendChild(el)
  return () => el.remove()
}

export const waitForPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

async function ready() {
  try {
    await document.fonts?.ready
  } catch {
    // Fonts API missing: capture anyway.
  }
  await waitForPaint()
}

export async function sheetToBlob(el: HTMLElement, scale = 3): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas-pro")
  const canvas = await html2canvas(el, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false, width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, windowHeight: PAGE_H, scrollX: 0, scrollY: 0 })
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"))
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "report"

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** One PNG per sheet (a single sheet downloads directly, several go into one ZIP). */
export async function exportImages(stage: HTMLElement, names: string[], zipName: string, onProgress?: (done: number, total: number) => void) {
  const sheets = Array.from(stage.querySelectorAll<HTMLElement>("[data-jgi-sheet]"))
  await ready()
  if (sheets.length === 1) {
    save(await sheetToBlob(sheets[0]), `${safeName(names[0])}.png`)
    onProgress?.(1, 1)
    return
  }
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  const used = new Set<string>()
  for (let i = 0; i < sheets.length; i++) {
    let base = `${String(i + 1).padStart(2, "0")} ${safeName(names[i] ?? `page ${i + 1}`)}`
    while (used.has(base)) base += "_"
    used.add(base)
    zip.file(`${base}.png`, await sheetToBlob(sheets[i]))
    onProgress?.(i + 1, sheets.length)
  }
  save(await zip.generateAsync({ type: "blob" }), `${safeName(zipName)}.zip`)
}

/** Opens the browser print dialog for the mounted stage; resolves when it closes. */
export async function printStage() {
  await ready()
  await new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener("afterprint", done)
      resolve()
    }
    window.addEventListener("afterprint", done)
    window.print()
    // Some browsers don't fire afterprint (print preview in a tab): don't block the UI forever.
    setTimeout(done, 120_000)
  })
}
