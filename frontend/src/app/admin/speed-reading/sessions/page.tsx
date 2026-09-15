'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Mic, MicOff, Eye, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getAuthToken } from '@/lib/api/schools'
import { listSessionLogs, deleteSessionLog, type SessionLog } from '@/lib/api/speed-reading'
import { useAuth } from '@/context/AuthContext'

export default function AdminReadingSessionsPage() {
  const t = useTranslations('speedReading')
  const ts = useTranslations('speedReading.sessions')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const router = useRouter()
  const { profile } = useAuth()
  const [logs, setLogs] = useState<SessionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!profile?.school_id) return
    setLoading(true)
    const token = await getAuthToken()
    const res = await listSessionLogs(token, { page, limit: 20 })
    if (res.success && res.data) {
      setLogs(res.data)
      setTotalPages(res.pagination?.totalPages ?? 1)
      setTotal(res.pagination?.total ?? 0)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.school_id, page])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const token = await getAuthToken()
    await deleteSessionLog(deleteId, token)
    setDeleteId(null)
    setDeleting(false)
    load()
  }

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ts('title')}</h1>
          {!loading && <p className="text-sm text-muted-foreground mt-0.5">{ts('sessionsTotal', { total })}</p>}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{ts('colStudent')}</th>
              <th className="text-left px-4 py-3 font-medium">{ts('colReadingText')}</th>
              <th className="text-left px-4 py-3 font-medium">{ts('colDate')}</th>
              <th className="text-center px-4 py-3 font-medium">{ts('colWpm')}</th>
              <th className="text-center px-4 py-3 font-medium">{ts('colAccuracy')}</th>
              <th className="text-center px-4 py-3 font-medium">{ts('colPoints')}</th>
              <th className="text-center px-4 py-3 font-medium">{ts('colRecording')}</th>
              <th className="text-right px-4 py-3 font-medium">{ts('colAction')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  {t('noSessions')}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {log.student_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">
                    {log.text_title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="secondary">{log.target_wpm}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={log.accuracy_percentage >= 80 ? 'text-green-600 font-medium' : log.accuracy_percentage >= 60 ? 'text-amber-600' : 'text-red-600'}>
                      {log.accuracy_percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    {log.points_earned}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {log.audio_url ? (
                      <Mic className="h-4 w-4 text-green-500 mx-auto" aria-label={ts('hasRecording')} />
                    ) : (
                      <MicOff className="h-4 w-4 text-muted-foreground mx-auto" aria-label={ts('noRecording')} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/admin/speed-reading/sessions/${log.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {ts('review')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(log.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {ts('pageOf', { page, totalPages })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ts('deleteSession')}</AlertDialogTitle>
            <AlertDialogDescription>
              {ts('deleteSessionConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? ts('deleting') : ts('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
