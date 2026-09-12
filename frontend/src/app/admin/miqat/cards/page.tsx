'use client'

import { useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Search, QrCode as QrCodeIcon, RefreshCw, Printer, Download } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { issueCard, reportCardLost } from '@/lib/api/miqat'
import { getStudents, Student } from '@/lib/api/students'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

export default function MiqatCardsPage() {
  const t = useTranslations('miqat.cards')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const { profile } = useAuth()
  const campusId = useCampus()?.selectedCampus?.id

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const [issuing, setIssuing] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ personId: string; name: string; qrPayload: string; revision: number } | null>(null)
  const [searched, setSearched] = useState(false)
  const qrContainerRef = useRef<HTMLDivElement>(null)

  const handleSearch = async () => {
    if (!profile?.school_id || query.trim().length < 2) return
    setSearching(true)
    setSearched(false)
    try {
      // The backend matches each name field (first/last/father/grandfather)
      // separately with ilike — a full "Ahmed Mohammed bin Saeed"-style
      // typed-in-full-name never matches any single column, so only the
      // first whitespace-separated term is sent (matches how the main
      // Student Info page's own search box behaves, since it hits this
      // same endpoint — see useStudents.ts).
      const firstTerm = query.trim().split(/\s+/)[0]
      const res = await getStudents({ search: firstTerm, campus_id: campusId, limit: 20 })
      setResults(res.success ? res.data || [] : [])
      if (!res.success) toast.error(res.error || t('searchError'))
    } catch {
      toast.error(t('searchError'))
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  const resolveProfileId = (s: Student) => s.profile_id || s.profile?.id || s.id
  const resolveName = (s: Student) => {
    const p = s.profile
    return [p?.first_name, p?.father_name, p?.grandfather_name, p?.last_name].filter(Boolean).join(' ')
  }

  // react-qr-code renders an inline <svg> — converted to a PNG data URL for
  // both print and download, since <svg> alone doesn't reliably rasterize
  // in a print dialog or save as a standalone image file the way <img> does.
  const svgToPngDataUrl = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const svg = qrContainerRef.current?.querySelector('svg')
      if (!svg) return reject(new Error('QR not rendered'))
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = () => {
        const scale = 4 // print/save at higher resolution than the on-screen 200px
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
    if (!issued) return
    try {
      const dataUrl = await svgToPngDataUrl()
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `miqat-card-${issued.personId}.png`
      a.click()
    } catch {
      toast.error(t('downloadError'))
    }
  }

  const handlePrint = async () => {
    if (!issued) return
    try {
      const dataUrl = await svgToPngDataUrl()
      const printWindow = window.open('', '_blank', 'width=420,height=560')
      if (!printWindow) return
      printWindow.document.write(`
        <!doctype html>
        <html dir="${isAr ? 'rtl' : 'ltr'}">
          <head>
            <meta charset="utf-8" />
            <title>${issued.name}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 24px; }
              img { width: 260px; height: 260px; margin: 16px 0; }
              h1 { font-size: 20px; margin: 0; }
              p { color: #555; font-size: 13px; }
            </style>
          </head>
          <body>
            <h1>${issued.name}</h1>
            <img src="${dataUrl}" alt="QR" />
            <p>${t('revisionLabel')}: ${issued.revision}</p>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.onload = () => printWindow.print()
    } catch {
      toast.error(t('printError'))
    }
  }

  const handleIssue = async (student: Student, reissue: boolean) => {
    const token = await getAuthToken()
    if (!token) return
    const personId = resolveProfileId(student)
    setIssuing(personId)
    const res = reissue ? await reportCardLost(personId, token, campusId) : await issueCard(personId, token, campusId)
    setIssuing(null)
    if (res.success && res.data) {
      setIssued({ personId, name: resolveName(student), qrPayload: res.data.qr_payload, revision: res.data.revision })
    } else {
      toast.error(res.error || t('issueError'))
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl" dir={isAr ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('searchPlaceholder')}
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {results.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {results.map((s) => {
                const personId = resolveProfileId(s)
                return (
                  <div key={personId} className="flex items-center justify-between p-3">
                    <span>{resolveName(s)}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={issuing === personId} onClick={() => handleIssue(s, false)}>
                        {issuing === personId ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCodeIcon className="h-4 w-4 me-1" />}
                        {t('issue')}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={issuing === personId} onClick={() => handleIssue(s, true)}>
                        <RefreshCw className="h-4 w-4 me-1" />{t('reissueLost')}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            searched && !searching && (
              <p className="text-sm text-muted-foreground p-2">{t('noResults')}</p>
            )
          )}
        </CardContent>
      </Card>

      {issued && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <h2 className="text-lg font-semibold">{issued.name}</h2>
            <p className="text-sm text-muted-foreground">{t('revisionLabel')}: {issued.revision}</p>
            {/* Rendered entirely client-side (react-qr-code, already a
                dependency) — never sent to a third-party QR rendering
                service, which would leak the signed card payload over the
                network for no reason. */}
            <div ref={qrContainerRef} className="border rounded-lg p-4 bg-white">
              <QRCode value={issued.qrPayload} size={200} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 me-2" />{t('print')}
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 me-2" />{t('download')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-sm">{t('printNotice')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
