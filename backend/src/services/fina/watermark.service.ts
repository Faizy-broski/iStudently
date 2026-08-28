import sharp from 'sharp'

/**
 * Dynamic watermark, composed at view time and carrying viewer identity —
 * spec §10. Applied to the STORED pixels via sharp (server-side), never via
 * CSS (which the spec explicitly calls out as removable in DevTools in two
 * seconds). Never persisted — the caller passes a cacheKey scoped to
 * (storageKey, variant, viewerId) and this module holds it in-process for
 * 60s (the spec's own suggested TTL), matching the "generate, serve,
 * discard" instruction without needing Redis.
 *
 * Images only — video watermarking would need frame-by-frame processing
 * (ffmpeg or similar), which this build deliberately doesn't add (see the
 * plan's note on video EXIF/GPS stripping being a documented Phase 1 gap
 * for the same reason). The media controller skips this call for kind='video'.
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
  const tileW = 280
  const tileH = 150
  const cols = Math.ceil(width / tileW) + 2
  const rows = Math.ceil(height / tileH) + 2
  let tiles = ''
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileW - tileW / 2
      const y = r * tileH + tileH / 2
      tiles += `<text x="${x}" y="${y}" font-size="16" font-family="sans-serif" fill="#ffffff" fill-opacity="0.12" transform="rotate(-30 ${x} ${y})">${label}</text>`
    }
  }
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${tiles}</svg>`)
}

export function buildWatermarkText(viewerName: string, viewerId: string, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ')
  return `${viewerName} · #${viewerId.slice(0, 8)} · ${stamp}`
}

export async function getWatermarkedImage(
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
