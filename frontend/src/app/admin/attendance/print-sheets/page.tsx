'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import type { CoursePeriodItem } from '@/lib/api/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IconLoader, IconPrinter, IconSearch } from '@tabler/icons-react'
import { toast } from 'sonner'

export default function PrintAttendanceSheetsPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  // Date range
  const now = new Date()
  const [startMonth, setStartMonth] = useState(now.getMonth())
  const [startDay, setStartDay] = useState(1)
  const [startYear, setStartYear] = useState(now.getFullYear())
  const [endMonth, setEndMonth] = useState(now.getMonth())
  const [endDay, setEndDay] = useState(now.getDate())
  const [endYear, setEndYear] = useState(now.getFullYear())

  const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
  const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  const startDaysInMonth = new Date(startYear, startMonth + 1, 0).getDate()
  const endDaysInMonth = new Date(endYear, endMonth + 1, 0).getDate()

  // Options
  const [includeInactive, setIncludeInactive] = useState(false)

  // Course periods
  const [coursePeriods, setCoursePeriods] = useState<CoursePeriodItem[]>([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Load course periods
  const loadCoursePeriods = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const result = await attendanceApi.getCoursePeriods(schoolId, selectedCampus?.id)
      if (result.data) {
        setCoursePeriods(result.data)
        // Select all by default
        setSelectedIds(new Set(result.data.map(cp => cp.id)))
      } else {
        toast.error(result.error || 'Failed to load course periods')
      }
    } catch {
      toast.error('Failed to load course periods')
    } finally {
      setLoading(false)
    }
  }, [schoolId, selectedCampus?.id])

  useEffect(() => {
    loadCoursePeriods()
  }, [loadCoursePeriods])

  // Filtered list
  const filtered = useMemo(() => {
    if (!search.trim()) return coursePeriods
    const q = search.toLowerCase()
    return coursePeriods.filter(cp =>
      cp.label.toLowerCase().includes(q) ||
      cp.teacher_name.toLowerCase().includes(q) ||
      cp.section_name.toLowerCase().includes(q) ||
      cp.subject_name.toLowerCase().includes(q)
    )
  }, [coursePeriods, search])

  // Select all / deselect all (based on filtered)
  const allFilteredSelected = filtered.length > 0 && filtered.every(cp => selectedIds.has(cp.id))

  const toggleSelectAll = () => {
    const newSet = new Set(selectedIds)
    if (allFilteredSelected) {
      filtered.forEach(cp => newSet.delete(cp.id))
    } else {
      filtered.forEach(cp => newSet.add(cp.id))
    }
    setSelectedIds(newSet)
  }

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // Download
  const handleDownload = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one course period')
      return
    }
    if (startDateStr > endDateStr) {
      toast.error('Start date must be before end date')
      return
    }

    setDownloading(true)
    try {
      const blob = await attendanceApi.downloadCoursePeriodSheets({
        school_id: schoolId,
        course_period_ids: Array.from(selectedIds),
        start_date: startDateStr,
        end_date: endDateStr,
        campus_id: selectedCampus?.id,
        include_inactive: includeInactive
      })

      // Trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Attendance_Sheets_${startDateStr}_to_${endDateStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Attendance sheets created for ${selectedIds.size} course period(s)`)
    } catch (err: any) {
      toast.error(err.message || 'Download failed')
    } finally {
      setDownloading(false)
    }
  }, [selectedIds, startDateStr, endDateStr, schoolId, selectedCampus?.id, includeInactive])

  const CreateButton = () => (
    <Button
      onClick={handleDownload}
      disabled={downloading || selectedIds.size === 0}
      className="gap-2"
    >
      {downloading ? (
        <IconLoader className="h-4 w-4 animate-spin" />
      ) : (
        <IconPrinter className="h-4 w-4" />
      )}
      CREATE ATTENDANCE SHEET FOR SELECTED COURSE PERIODS
    </Button>
  )

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Print Attendance Sheets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <div className="flex gap-2">
                <Select value={String(startMonth)} onValueChange={v => setStartMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(startDay)} onValueChange={v => setStartDay(Number(v))}>
                  <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: startDaysInMonth }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(startYear)} onValueChange={v => setStartYear(Number(v))}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <div className="flex gap-2">
                <Select value={String(endMonth)} onValueChange={v => setEndMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(endDay)} onValueChange={v => setEndDay(Number(v))}>
                  <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: endDaysInMonth }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(endYear)} onValueChange={v => setEndYear(Number(v))}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="includeInactive"
              checked={includeInactive}
              onCheckedChange={(checked) => setIncludeInactive(!!checked)}
            />
            <label htmlFor="includeInactive" className="text-sm cursor-pointer">
              Include Inactive Students
            </label>
          </div>

          {/* Top Create Button */}
          <div className="flex justify-end">
            <CreateButton />
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search course periods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Course Period List */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {coursePeriods.length === 0
                ? 'No course periods found. Please set up timetable entries first.'
                : 'No course periods match your search.'}
            </div>
          ) : (
            <div className="border rounded-lg">
              {/* Select All Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({filtered.length} course period{filtered.length !== 1 ? 's' : ''})
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {selectedIds.size} selected
                </span>
              </div>

              {/* Course Period Rows */}
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {filtered.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => toggleOne(cp.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(cp.id)}
                      onCheckedChange={() => toggleOne(cp.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{cp.label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cp.section_name} &middot; {cp.subject_name} &middot; {cp.period_title}
                        {cp.teacher_name && ` — ${cp.teacher_name}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Create Button */}
          {filtered.length > 0 && (
            <div className="flex justify-center pt-2">
              <CreateButton />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
