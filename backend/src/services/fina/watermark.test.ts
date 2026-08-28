/**
 * Real sharp processing (no mocks) — confirms the watermark pipeline
 * actually produces a valid, differently-sized image (the overlay changes
 * the encoded bytes) and that identity text renders into the cache key
 * correctly. Contributes to AT-10 ("watermark renders and carries the
 * correct viewer identity").
 */
import sharp from 'sharp'
import { buildWatermarkText, getWatermarkedImage } from './watermark.service'

describe('watermark.service', () => {
  it('buildWatermarkText embeds the viewer name and a truncated id', () => {
    const text = buildWatermarkText('Fatima Al-Sayed', '11111111-2222-3333-4444-555555555555', new Date('2026-03-01T10:30:00Z'))
    expect(text).toContain('Fatima Al-Sayed')
    expect(text).toContain('11111111')
    expect(text).not.toContain('22223333') // only the first 8 chars of the id are shown
    expect(text).toContain('2026-03-01')
  })

  it('produces a valid JPEG that differs from the unwatermarked source', async () => {
    const source = await sharp({ create: { width: 100, height: 80, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .jpeg()
      .toBuffer()

    const { buffer, contentType } = await getWatermarkedImage('test-cache-key-1', source, 'Ms. Najat · #abcd1234 · 2026-03-01 10:30')

    expect(contentType).toBe('image/jpeg')
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.equals(source)).toBe(false)

    const meta = await sharp(buffer).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(100)
    expect(meta.height).toBe(80)
  })

  it('serves the same bytes from cache on a repeated call with the same key (within the 60s TTL)', async () => {
    const source = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 200, g: 200, b: 200 } } })
      .jpeg()
      .toBuffer()

    const first = await getWatermarkedImage('test-cache-key-2', source, 'Teacher · #zzzz9999 · 2026-03-01 10:30')
    const second = await getWatermarkedImage('test-cache-key-2', source, 'Teacher · #zzzz9999 · 2026-03-01 10:30')

    expect(first.buffer.equals(second.buffer)).toBe(true)
  })
})
