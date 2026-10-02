'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Loader2, Printer, Download, RefreshCw } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { getCardQrBatch, reportCardLost } from '@/lib/api/miqat'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

interface MiqatCardPanelProps {
  personId: string
  name: string
}

/**
 * The actual Miqat attendance card (HMAC-signed server-side, verified
 * offline by the gate scanner) — distinct from UserQRCode's plain
 * /verify/{id} link QR shown elsewhere on this same page. Surfaces the same
 * issue/reissue flow admin/miqat/cards/page.tsx offers, inline on a
 * student's profile, so viewing or reprinting their card doesn't require a
 * separate trip to that page or to the Advanced Report export.
 *
 * Uses getCardQrBatch (not issueCard) to load: it issues a card lazily only
 * if this person has none yet, and otherwise re-signs the existing one
 * without bumping its revision — exactly the semantics of "show me this
 * student's card," not "issue a new one."
 */
export function MiqatCardPanel({ personId, name }: MiqatCardPanelProps) {
  const t = useTranslations('miqat.cards')
  const campusId = useCampus()?.selectedCampus?.id

  const [loading, setLoading] = useState(true)
  const [qrPayload, setQrPayload] = useState<string | null>(null)
  const [revision, setRevision] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Miqat may simply not be enabled for this school — in that case the
  // panel renders nothing at all rather than an alarming error on every
  // student profile.
  const [moduleDisabled, setModuleDisabled] = useState(false)
  const [reissuing, setReissuing] = useState(false)
  const qrContainerRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const token = await getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }
    const res = await getCardQrBatch([personId], token, campusId)
    setLoading(false)
    if (!res.success || !res.data) {
      if (res.error?.includes('not enabled')) setModuleDisabled(true)
      else setError(res.error || t('issueError'))
      return
    }
    if (res.data.signing_key_error) {
      setError(res.data.signing_key_error)
      return
    }
    const payload = res.data.qr[personId]
    if (payload) setQrPayload(payload)
    else setError(res.data.failed[personId] || t('issueError'))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, campusId])

  // Same SVG->PNG rasterization as admin/miqat/cards/page.tsx — <svg> alone
  // doesn't reliably print or save as a standalone image file.
  const svgToPngDataUrl = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const svg = qrContainerRef.current?.querySelector('svg')
      if (!svg) return reject(new Error('QR not rendered'))
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = () => {
        const scale = 4
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to render QR image'))
      }
      img.src = url
    })
  }

  const handleDownload = async () => {
    try {
      const dataUrl = await svgToPngDataUrl()
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `miqat-card-${personId}.png`
      a.click()
    } catch {
      toast.error(t('downloadError'))
    }
  }

  const handlePrint = async () => {
    try {
      const dataUrl = await svgToPngDataUrl()
      const printWindow = window.open('', '_blank', 'width=420,height=560')
      if (!printWindow) return
      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${name}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
              img { width: 260px; height: 260px; margin: 16px 0; }
              h1 { font-size: 20px; margin: 0; }
              p { color: #555; font-size: 13px; }
            </style>
          </head>
          <body>
            <h1>${name}</h1>
            <img src="${dataUrl}" alt="QR" />
            ${revision != null ? `<p>${t('revisionLabel')}: ${revision}</p>` : ''}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.onload = () => printWindow.print()
    } catch {
      toast.error(t('printError'))
    }
  }

  const handleReissue = async () => {
    const token = await getAuthToken()
    if (!token) return
    setReissuing(true)
    const res = await reportCardLost(personId, token, campusId)
    setReissuing(false)
    if (!res.success || !res.data) {
      toast.error(res.error || t('issueError'))
      return
    }
    if (res.data.signing_key_error) {
      toast.error(res.data.signing_key_error)
      return
    }
    setQrPayload(res.data.qr_payload as string)
    setRevision(res.data.revision)
    setError(null)
    toast.success(t('reissueLost'))
  }

  if (moduleDisabled) return null

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 p-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-1 p-3 max-w-[180px]">
        <p className="text-xs text-red-600 text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={qrContainerRef} className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
        {qrPayload && <QRCode value={qrPayload} size={100} />}
      </div>
      <p className="text-xs text-gray-500 text-center max-w-[160px] truncate">{name}</p>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={handlePrint} title={t('print')}>
          <Printer className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownload} title={t('download')}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" disabled={reissuing} onClick={handleReissue} title={t('reissueLost')}>
          {reissuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
