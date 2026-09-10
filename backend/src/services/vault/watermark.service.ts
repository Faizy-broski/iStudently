import sharp from 'sharp'

/**
 * Dynamic watermark, composed at view time and carrying viewer identity
 * (spec §4A). Applied to the STORED pixels via sharp (server-side), never
 * via CSS (removable in DevTools in two seconds) — reuses
 * fina/watermark.service.ts's exact SVG-tile-compositing approach. Never
 * persisted: the caller passes a cacheKey scoped to (storageKey, viewerId)
 * and this module holds it in-process for 60s.
 *
 * Images only, matching the approved Phase 1 plan — PDFs are served via
 * signed URL without a baked-in per-view stamp; that needs either
 * server-side rasterization or client-side canvas compositing, deferred to
 * a later phase. The media controller only calls this for image attachments.
 */

interface CacheEntry {
  buffer: Buffer
  contentType: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildWatermarkOverlaySvg(width: number, height: number, text: string): Buffer {
  const label = escapeXml(text)
  const tileW = 320
  const tileH = 160
  const cols = Math.ceil(width / tileW) + 2
  const rows = Math.ceil(height / tileH) + 2
  let tiles = ''
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileW - tileW / 2
      const y = r * tileH + tileH / 2
      tiles += `<text x="${x}" y="${y}" font-size="14" font-family="sans-serif" fill="#ffffff" fill-opacity="0.14" transform="rotate(-30 ${x} ${y})">${label}</text>`
    }
  }
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${tiles}</svg>`)
}

/** Matches the spec's overlay text: "CONFIDENTIAL - Viewed by [Name] - [IP] - [Timestamp UTC]". */
export function buildVaultWatermarkText(viewerName: string, viewerIp: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace('T', ' ').replace('Z', ' UTC')
  return `CONFIDENTIAL - Viewed by ${viewerName} - ${viewerIp} - ${stamp}`
}

export async function getVaultWatermarkedImage(
  cacheKey: string,
  imageBuffer: Buffer,
  watermarkText: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { buffer: cached.buffer, contentType: cached.contentType }
  }

  const image = sharp(imageBuffer)
  const meta = await image.metadata()
  const width = meta.width || 800
  const height = meta.height || 600
  const overlay = buildWatermarkOverlaySvg(width, height, watermarkText)

  const buffer = await image.composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 85 }).toBuffer()
  const result = { buffer, contentType: 'image/jpeg' }

  cache.set(cacheKey, { ...result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}
