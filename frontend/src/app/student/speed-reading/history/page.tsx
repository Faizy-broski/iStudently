'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getAuthToken } from '@/lib/api/schools'
import { getStudentLogs, type SessionLog } from '@/lib/api/speed-reading'

export default function StudentReadingHistoryPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<SessionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const token = await getAuthToken()
      const res = await getStudentLogs(token, { page, limit: 20 })
      if (res.success && res.data) {
        setLogs(res.data)
        setTotalPages(res.pagination?.totalPages ?? 1)
        setTotal(res.pagination?.total ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [page])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Reading History</h1>
        {!loading && (
          <p className="text-sm text-muted-foreground mt-0.5">{total} sessions completed</p>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Reading Text</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-center px-4 py-3 font-medium">WPM</th>
              <th className="text-center px-4 py-3 font-medium">Accuracy</th>
              <th className="text-center px-4 py-3 font-medium">Points</th>
              <th className="text-center px-4 py-3 font-medium">Recording</th>
              <th className="text-right px-4 py-3 font-medium">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                  <p className="text-4xl mb-2">📖</p>
                  <p>You haven&apos;t completed any reading sessions yet.</p>
                  <Button
                    className="mt-4"
                    onClick={() => router.push('/student/speed-reading')}
                  >
                    Start Reading
                  </Button>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/student/speed-reading/history/${log.id}`)}
                >
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">
                    {log.text_title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="secondary">{log.target_wpm}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={
                      log.accuracy_percentage >= 80
                        ? 'text-green-600 font-medium'
                        : log.accuracy_percentage >= 60
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }>
                      {log.accuracy_percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    {log.points_earned}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {log.audio_url ? (
                      <Mic className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <MicOff className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Eye className="h-4 w-4 text-muted-foreground ml-auto" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={(e) => { e.stopPropagation(); setPage(p => p - 1) }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={(e) => { e.stopPropagation(); setPage(p => p + 1) }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
