'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getAuthToken } from '@/lib/api/schools'
import { Loader2, Clock } from 'lucide-react'

interface Period {
  id: string
  title: string
  short_name: string
  sort_order: number
  start_time: string
  end_time: string
  length_minutes: number
  block: string
  course_periods_count: number
}

function formatTime12h(time: string): string {
  if (!time) return '—'
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function TeacherPeriodsPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPeriods = useCallback(async () => {
    if (!profile?.school_id) { setLoading(false); return }

    const token = await getAuthToken()
    if (!token) { setLoading(false); return }

    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/periods`)
      if (selectedCampus?.id) url.searchParams.append('campus_id', selectedCampus.id)

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (data.success && data.data) {
        setPeriods(
          data.data.map((p: Period) => ({
            id: p.id,
            title: p.title || '',
            short_name: p.short_name || '',
            sort_order: p.sort_order || 1,
            start_time: p.start_time || '',
            end_time: p.end_time || '',
            length_minutes: p.length_minutes || 0,
            block: p.block || '',
            course_periods_count: p.course_periods_count || 0,
          }))
        )
      }
    } catch {
      // silent — empty state shown
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, selectedCampus?.id])

  useEffect(() => { fetchPeriods() }, [fetchPeriods])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          Periods
        </h1>
        <p className="text-muted-foreground">
          School periods for the current academic year
          {selectedCampus ? ` — ${selectedCampus.name}` : ''}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
        {periods.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">No periods defined for this school yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#022172] uppercase tracking-wider">
                  Short Name
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#022172] uppercase tracking-wider">
                  Order
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#022172] uppercase tracking-wider">
                  Start Time
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#022172] uppercase tracking-wider">
                  End Time
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#022172] uppercase tracking-wider">
                  Length (min)
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#022172] uppercase tracking-wider">
                  Block
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period, idx) => (
                <tr
                  key={period.id}
                  className={`border-b ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}
                >
                  <td className="px-4 py-3 font-medium text-[#008B8B]">{period.title}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{period.short_name || '—'}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{period.sort_order}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {period.start_time ? formatTime12h(period.start_time) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {period.end_time ? formatTime12h(period.end_time) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {period.length_minutes > 0 ? period.length_minutes : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{period.block || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
