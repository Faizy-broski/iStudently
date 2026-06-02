'use client'

import Image from 'next/image'

interface ProfilePhotoProps {
  /** Image URL — null/undefined shows initials fallback */
  src?: string | null
  /** Used for alt text and to derive initials */
  name?: string | null
  /** Portrait size preset (all maintain 3:4 width:height) */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Additional Tailwind classes applied to the container */
  className?: string
}

const SIZE_MAP = {
  xs: { w: 32,  h: 42,  tw: 'w-8 h-[42px]',    text: 'text-xs' },
  sm: { w: 48,  h: 64,  tw: 'w-12 h-16',        text: 'text-sm' },
  md: { w: 64,  h: 85,  tw: 'w-16 h-[85px]',    text: 'text-base' },
  lg: { w: 80,  h: 107, tw: 'w-20 h-[107px]',   text: 'text-lg' },
  xl: { w: 96,  h: 128, tw: 'w-24 h-32',         text: 'text-2xl' },
} as const

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

/**
 * Portrait rectangular (3:4) profile photo.
 * Replaces circular avatars for student / user card displays.
 */
export function ProfilePhoto({ src, name, size = 'md', className = '' }: ProfilePhotoProps) {
  const { w, h, tw, text } = SIZE_MAP[size]

  return (
    <div
      className={`${tw} shrink-0 rounded-lg overflow-hidden bg-gradient-to-b from-[#57A3CC] to-[#022172] ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt={name || 'Profile photo'}
          width={w}
          height={h}
          className="w-full h-full object-cover"
          unoptimized
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center text-white font-bold ${text}`}>
          {getInitials(name)}
        </div>
      )}
    </div>
  )
}
