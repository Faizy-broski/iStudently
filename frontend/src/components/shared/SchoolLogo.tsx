import type { CSSProperties } from 'react'

export type LogoShape = 'circle' | 'rounded' | 'square' | 'rectangle'

export interface LogoAppearanceInput {
  shape?: LogoShape
  borderWidth?: number
  borderColor?: string
}

/**
 * Shared frame-style logic for a school logo, usable both as a React style
 * object (SchoolLogo below) and by anything else that needs the same frame
 * (e.g. a settings-page live preview). Rectangle uses a wider aspect ratio
 * than the other three shapes; the others are all square frames with
 * different border-radius.
 */
export function getLogoFrameStyle(appearance: LogoAppearanceInput = {}): CSSProperties {
  const { shape = 'circle', borderWidth = 0, borderColor = '#000000' } = appearance

  const borderRadius = shape === 'circle' ? '50%' : shape === 'rounded' ? '16%' : '0'

  return {
    borderRadius,
    border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : undefined,
    overflow: 'hidden',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
}

interface SchoolLogoProps extends LogoAppearanceInput {
  logoUrl?: string | null
  alt: string
  /**
   * Frame width in pixels (height derived: same as width, except rectangle
   * uses width * 0.6). Omit when the caller already wraps this in a
   * fixed-size container (most call sites) — the frame then fills 100% of
   * that container via `className`, matching how those sites already sized
   * their plain <img> before this component existed.
   */
  size?: number
  fallback?: React.ReactNode
  className?: string
}

/**
 * Renders a school's logo inside a frame shaped/bordered per that school's
 * configured appearance (super_admin-controlled, see logo-appearance.service.ts
 * on the backend). The logo image itself is never cropped (object-fit:
 * contain) — the frame just adapts to whatever shape/border the admin picked.
 */
export function SchoolLogo({
  logoUrl, alt, shape = 'circle', borderWidth = 0, borderColor = '#000000', size, fallback, className,
}: SchoolLogoProps) {
  const height = size == null ? undefined : shape === 'rectangle' ? Math.round(size * 0.6) : size

  const frameStyle: CSSProperties = {
    ...getLogoFrameStyle({ shape, borderWidth, borderColor }),
    width: size,
    height,
  }

  return (
    <div style={frameStyle} className={className}>
      {logoUrl ? (
        // Frame dimensions are computed at runtime per school appearance —
        // next/image requires static width/height props that don't fit this
        // dynamic-sizing use case, so a plain <img> is used deliberately here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        fallback
      )}
    </div>
  )
}
