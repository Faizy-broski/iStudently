'use client'

import { useEffect, useState } from 'react'
import { Loader2, ImageOff } from 'lucide-react'
import { getFinaMediaVariantUrl, getRawMediaPreviewUrl, type FinaMediaVariant } from '@/lib/api/fina-media'

interface GatedMediaImageProps {
  mediaId: string
  variant?: FinaMediaVariant
  /** Staff-only pre-confirmation preview (bypasses the consent gate via the
   * dedicated /raw endpoint) — never use for general viewing. */
  raw?: boolean
  alt: string
  className?: string
}

/**
 * Every Al-Fina' image on screen goes through this component — never a
 * plain `<img src="{API_URL}/...">`. The gated endpoints require a Bearer
 * token (which <img> can't send) and return a per-viewer watermarked image,
 * so the bytes are fetched via authenticated JS fetch and rendered as a
 * local object URL, revoked on unmount/prop change to avoid leaking memory.
 */
export function GatedMediaImage({ mediaId, variant = 'md', raw = false, alt, className }: GatedMediaImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let currentUrl: string | null = null
    setLoading(true)
    setFailed(false)

    const load = raw ? getRawMediaPreviewUrl(mediaId) : getFinaMediaVariantUrl(mediaId, variant)
    load.then(({ url, error }) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      if (error || !url) {
        setFailed(true)
        setLoading(false)
        return
      }
      currentUrl = url
      setObjectUrl(url)
      setLoading(false)
    })

    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [mediaId, variant, raw])

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className ?? ''}`}>
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (failed || !objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className ?? ''}`}>
        <ImageOff className="h-5 w-5" />
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element -- object URL, not a
  // remote/static asset; next/image's loader cannot handle blob: URLs.
  return <img src={objectUrl} alt={alt} className={className} />
}
