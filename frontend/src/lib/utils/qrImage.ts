import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'

/**
 * Renders `value` as a QR code and returns it as a PNG data URL, for embedding in a PDF.
 * Browser only (draws through a canvas). Includes a white quiet zone so the code still scans
 * when placed on a shaded table row.
 */
export async function qrToPngDataUrl(value: string, px = 256): Promise<string> {
  const markup = renderToStaticMarkup(
    createElement(QRCodeSVG, { value, size: px, level: 'M', marginSize: 2, bgColor: '#ffffff', fgColor: '#000000' })
  )
  // React's SVG output has no XML namespace, and a browser refuses to load an SVG *image*
  // without one (the <img> just fires onerror).
  const svg = markup.includes('xmlns=') ? markup : markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not render QR code'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = px
    canvas.height = px
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, px, px)
    ctx.drawImage(img, 0, 0, px, px)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
