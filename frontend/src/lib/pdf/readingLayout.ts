/**
 * Pure page fit/zoom math for the e-library PDF reader.
 *
 * Three fit policies, mirroring the classic "fit width / fit height / fit whole
 * page" trio: 'whole' fits by width first and falls back to fitting by height
 * if that would overflow the container vertically, so the full page is always
 * visible (letterboxed) — this is the default since flipbook readers are
 * expected to show a complete page like a real book.
 */

export type FitPolicy = 'width' | 'height' | 'whole'

export interface ResolveFitInput {
  fitPolicy: FitPolicy
  containerWidth: number
  containerHeight: number
  /** Native (unscaled) page dimensions, e.g. from pdf.js's page.getViewport({ scale: 1 }). */
  pageNativeWidth: number
  pageNativeHeight: number
  /** Multiplier applied on top of the fit-policy-computed base size. */
  zoom: number
}

export interface ResolveFitResult {
  renderWidth: number
  renderHeight: number
}

function fitWidth(containerWidth: number, ratio: number) {
  const width = containerWidth
  const height = width / ratio
  return { width, height }
}

function fitHeight(containerHeight: number, ratio: number) {
  const height = containerHeight
  const width = height * ratio
  return { width, height }
}

export function resolveFit({
  fitPolicy,
  containerWidth,
  containerHeight,
  pageNativeWidth,
  pageNativeHeight,
  zoom,
}: ResolveFitInput): ResolveFitResult {
  const ratio = pageNativeWidth > 0 && pageNativeHeight > 0 ? pageNativeWidth / pageNativeHeight : 1 / 1.414

  let base: { width: number; height: number }
  if (fitPolicy === 'width') {
    base = fitWidth(containerWidth, ratio)
  } else if (fitPolicy === 'height') {
    base = fitHeight(containerHeight, ratio)
  } else {
    // 'whole': fit by width, then clamp to height if it overflows.
    base = fitWidth(containerWidth, ratio)
    if (containerHeight > 0 && base.height > containerHeight) {
      base = fitHeight(containerHeight, ratio)
    }
  }

  return {
    renderWidth: Math.max(1, Math.round(base.width * zoom)),
    renderHeight: Math.max(1, Math.round(base.height * zoom)),
  }
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.25

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}
