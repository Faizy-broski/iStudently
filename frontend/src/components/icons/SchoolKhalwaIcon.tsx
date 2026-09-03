import type { LucideIcon, LucideProps } from 'lucide-react'

// The School Khalwa (formerly "Hifzi") module's nav/branding icon — a
// custom raster image (public/images/read-quran.png), not a Lucide glyph.
// Every call site in sidebar.ts/plugins.ts expects a LucideIcon-shaped
// component (a function taking { className, size, ... } and rendering an
// SVG element) purely so it can be dropped into existing icon slots — none
// of those call sites actually attach a ref, so a plain <img> wrapped in a
// type cast is a safe, pragmatic fit rather than reworking the sidebar's
// icon type to accommodate one raster exception.
function SchoolKhalwaIconComponent({ className, size = 24 }: LucideProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- icon is rendered
    // at many different fixed small sizes across the sidebar/plugin registry
    // via `className`; a plain <img> is simpler and more flexible here than
    // next/image's required width/height or fill modes.
    <img
      src="/images/read-quran.png"
      alt=""
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}

export const SchoolKhalwaIcon = SchoolKhalwaIconComponent as unknown as LucideIcon
