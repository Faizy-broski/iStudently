import puppeteer, { Browser, PDFOptions } from 'puppeteer'

/**
 * Shared headless-Chromium PDF plugin — one place for every module (Hifzi
 * report cards, Fina compliance reports, future Qirtasi/worksheet exports,
 * etc.) to turn a trusted HTML string into a PDF buffer, instead of each
 * service reimplementing browser lifecycle + escaping on its own.
 *
 * A cold Chromium launch is hundreds of ms to a few seconds by itself, so a
 * single browser process is launched lazily and reused across requests —
 * only the (cheap) page is per-render. Relaunched automatically if the
 * shared process has died.
 */

let sharedBrowserPromise: Promise<Browser> | null = null

async function getSharedBrowser(): Promise<Browser> {
  if (sharedBrowserPromise) {
    const browser = await sharedBrowserPromise
    if (browser.connected) return browser
    sharedBrowserPromise = null
  }
  sharedBrowserPromise = puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.HIFZI_PUPPETEER_EXECUTABLE_PATH || process.env.FINA_PUPPETEER_EXECUTABLE_PATH || undefined,
  })
  return sharedBrowserPromise
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/**
 * Renders a trusted HTML string to a PDF buffer via the shared headless
 * Chromium instance. Never pass untrusted/third-party HTML here — callers
 * are expected to build the markup themselves (see escapeHtml for
 * interpolated values).
 */
export async function renderHtmlToPdf(html: string, options?: PDFOptions): Promise<Buffer> {
  const browser = await getSharedBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' }, ...options })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

/** For graceful shutdown / tests — closes the shared browser if one is running. */
export async function closeSharedPdfBrowser(): Promise<void> {
  if (!sharedBrowserPromise) return
  const browser = await sharedBrowserPromise
  sharedBrowserPromise = null
  await browser.close()
}
