"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { getAuthToken } from "@/lib/api/schools"
import { toast } from "sonner"
import { Plus, Minus, Save, Loader2 } from "lucide-react"
import Link from "next/link"

interface Period {
  id?: string
  title: string
  short_name: string
  sort_order: number
  start_time: string
  end_time: string
  length_minutes: number
  block: string
  course_periods_count?: number
}

function formatTime12h(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function calcLength(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

export default function PeriodsPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const selectedCampus = campusContext?.selectedCampus

  const fetchPeriods = useCallback(async () => {
    if (!profile?.school_id) {
      setLoading(false)
      return
    }

    const token = await getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      // Build URL with campus filter if campus is selected
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/periods`)
      if (selectedCampus?.id) {
        url.searchParams.append('campus_id', selectedCampus.id)
      }

      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await res.json()
      
      if (data.success && data.data) {
        setPeriods(data.data.map((p: any) => ({
          id: p.id,
          title: p.title || p.period_name || '',
          short_name: p.short_name || '',
          sort_order: p.sort_order || p.period_number || 1,
          start_time: p.start_time || '',
          end_time: p.end_time || '',
          length_minutes: p.length_minutes || 0,
          block: p.block || '',
          course_periods_count: p.course_periods_count || 0
        })))
      }
    } catch (error) {
      console.error("Error fetching periods:", error)
      toast.error("Failed to load periods")
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, selectedCampus?.id])

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods])

  const addPeriod = () => {
    const newSortOrder = periods.length > 0 
      ? Math.max(...periods.map(p => p.sort_order)) + 1 
      : 1
    
    setPeriods([
      ...periods,
      {
        title: '',
        short_name: '',
        sort_order: newSortOrder,
        start_time: '',
        end_time: '',
        length_minutes: 0,
        block: '',
        course_periods_count: 0
      }
    ])
  }

  const removePeriod = (index: number) => {
    const period = periods[index]
    if (period.course_periods_count && period.course_periods_count > 0) {
      toast.error(`Cannot delete. This period has ${period.course_periods_count} timetable entries.`)
      return
    }
    setPeriods(periods.filter((_, i) => i !== index))
  }

  const updatePeriod = (index: number, field: keyof Period, value: string | number) => {
    const updated = [...periods]
    updated[index] = { ...updated[index], [field]: value }
    setPeriods(updated)
  }

  const savePeriods = async () => {
    const token = await getAuthToken()
    if (!token) {
      toast.error("Authentication required")
      return
    }

    // Validate periods
    const invalidPeriods = periods.filter(p => !p.title || !p.short_name)
    if (invalidPeriods.length > 0) {
      toast.error("Please fill in title and short name for all periods")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/periods/bulk`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            campus_id: selectedCampus?.id || null,
            periods: periods.map(p => ({
              title: p.title,
              short_name: p.short_name,
              sort_order: p.sort_order,
              start_time: p.start_time || null,
              end_time: p.end_time || null,
              length_minutes: p.start_time && p.end_time ? calcLength(p.start_time, p.end_time) : p.length_minutes,
              block: p.block
            }))
          }),
        }
      )
      const data = await res.json()
      
      if (data.success) {
        toast.success("Periods saved successfully")
        fetchPeriods() // Refresh to get IDs
      } else {
        toast.error(data.error || "Failed to save periods")
      }
    } catch (error) {
      console.error("Error saving periods:", error)
      toast.error("Failed to save periods")
    } finally {
      setSaving(false)
    }
  }

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
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Periods
          </h1>
          <p className="text-muted-foreground">
            Define periods for your timetable{selectedCampus ? ` - ${selectedCampus.name}` : ''}. These will be used when creating schedules.
          </p>
        </div>
        <Link href="/admin/marking-periods">
          <Button variant="outline" size="sm" className="gap-1 text-[#022172]">
            Marking Periods →
          </Button>
        </Link>
      </div>

      {/* Periods Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
              <th className="w-10 px-2 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                Short Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                Sort Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                Start Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                End Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                Length (Min)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                Block
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                Course Periods
              </th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period, index) => (
              <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-2 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                    onClick={() => removePeriod(index)}
                    disabled={period.course_periods_count !== undefined && period.course_periods_count > 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={period.title}
                    onChange={(e) => updatePeriod(index, 'title', e.target.value)}
                    placeholder="Period name"
                    className="h-8 w-full border-0 bg-transparent p-0 focus-visible:ring-0 text-[#008B8B] underline"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={period.short_name}
                    onChange={(e) => updatePeriod(index, 'short_name', e.target.value)}
                    placeholder="Short"
                    className="h-8 w-20 border-0 bg-transparent p-0 focus-visible:ring-0 text-[#008B8B] underline"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    value={period.sort_order}
                    onChange={(e) => updatePeriod(index, 'sort_order', parseInt(e.target.value) || 1)}
                    className="h-8 w-16 border-0 bg-transparent p-0 focus-visible:ring-0 text-[#008B8B] underline"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="time"
                    value={period.start_time}
                    onChange={(e) => updatePeriod(index, 'start_time', e.target.value)}
                    className="h-8 w-28 border-0 bg-transparent p-0 focus-visible:ring-0 text-[#008B8B] underline"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="time"
                    value={period.end_time}
                    onChange={(e) => updatePeriod(index, 'end_time', e.target.value)}
                    className="h-8 w-28 border-0 bg-transparent p-0 focus-visible:ring-0 text-[#008B8B] underline"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <span className="text-sm text-gray-600">
                    {period.start_time && period.end_time
                      ? `${calcLength(period.start_time, period.end_time)}`
                      : period.length_minutes || '—'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={period.block}
                    onChange={(e) => updatePeriod(index, 'block', e.target.value)}
                    placeholder=""
                    className="h-8 w-20 border-0 bg-transparent p-0 focus-visible:ring-0"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  {period.course_periods_count !== undefined && period.course_periods_count > 0 ? (
                    <a 
                      href={`/admin/periods/${encodeURIComponent(period.short_name)}/classes`} 
                      className="text-[#022172] hover:text-[#57A3CC] hover:underline font-medium"
                    >
                      {period.course_periods_count}
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
            {/* Add Row */}
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-2 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                  onClick={addPeriod}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </td>
              <td className="px-4 py-2">
                <Input
                  placeholder="New period..."
                  className="h-8 w-full opacity-50"
                  onFocus={addPeriod}
                  readOnly
                />
              </td>
              <td className="px-4 py-2">
                <Input className="h-8 w-20 opacity-50" disabled />
              </td>
              <td className="px-4 py-2">
                <Input className="h-8 w-16 opacity-50" disabled />
              </td>
              <td className="px-4 py-2">
                <Input className="h-8 w-28 opacity-50" disabled />
              </td>
              <td className="px-4 py-2">
                <Input className="h-8 w-28 opacity-50" disabled />
              </td>
              <td className="px-4 py-2">
                <span className="text-gray-300 text-sm">Auto</span>
              </td>
              <td className="px-4 py-2">
                <Input className="h-8 w-20 opacity-50" disabled />
              </td>
              <td className="px-4 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div className="flex justify-center">
        <Button 
          onClick={savePeriods} 
          disabled={saving || periods.length === 0}
          className="bg-[#008B8B] hover:bg-[#007070] text-white px-8"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              SAVE
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
