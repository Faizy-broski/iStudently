'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IconLoader, IconRefresh } from '@tabler/icons-react'
import { toast } from 'sonner'

export default function RecalculateDailyAttendancePage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  const now = new Date()
  const [startMonth, setStartMonth] = useState(now.getMonth())
  const [startDay, setStartDay] = useState(now.getDate())
  const [startYear, setStartYear] = useState(now.getFullYear())
  const [endMonth, setEndMonth] = useState(now.getMonth())
  const [endDay, setEndDay] = useState(now.getDate())
  const [endYear, setEndYear] = useState(now.getFullYear())

  const [confirmed, setConfirmed] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const startDaysInMonth = new Date(startYear, startMonth + 1, 0).getDate()
  const endDaysInMonth = new Date(endYear, endMonth + 1, 0).getDate()

  const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
  const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const handleOK = useCallback(async () => {
    if (!schoolId) return
    if (startDateStr > endDateStr) {
      toast.error('Start date must be before end date')
      return
    }

    setCalculating(true)
    try {
      const result = await attendanceApi.recalculateDailyAttendance({
        school_id: schoolId,
        start_date: startDateStr,
        end_date: endDateStr,
        campus_id: selectedCampus?.id
      })

      if (result.data) {
        toast.success(`The Daily Attendance for that timeframe has been recalculated. (${result.data.recalculated} records processed)`)
        setConfirmed(false)
      } else {
        toast.error(result.error || 'Recalculation failed')
      }
    } catch {
      toast.error('Recalculation failed')
    } finally {
      setCalculating(false)
    }
  }, [schoolId, startDateStr, endDateStr, selectedCampus?.id])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Recalculate Daily Attendance</h1>

      <div className="flex justify-center pt-8">
        <Card className="w-full max-w-2xl">
          <CardHeader className="bg-muted/50 border-b">
            <CardTitle className="text-center text-base font-semibold uppercase tracking-wide">
              Confirm
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-8 space-y-6">
            <p className="text-center font-semibold text-base">
              When do you want to recalculate the daily attendance?
            </p>

            {/* Date Range - matching RosarioSIS layout: From [M] [D] [Y] to [M] [D] [Y] */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm font-medium">From</span>
              <Select value={String(startMonth)} onValueChange={v => setStartMonth(Number(v))}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(startDay)} onValueChange={v => setStartDay(Number(v))}>
                <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: startDaysInMonth }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(startYear)} onValueChange={v => setStartYear(Number(v))}>
                <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-sm font-medium">to</span>

              <Select value={String(endMonth)} onValueChange={v => setEndMonth(Number(v))}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(endDay)} onValueChange={v => setEndDay(Number(v))}>
                <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: endDaysInMonth }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(endYear)} onValueChange={v => setEndYear(Number(v))}>
                <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* OK / Cancel buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {calculating ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader className="h-4 w-4 animate-spin" />
                  Calculating...
                </div>
              ) : (
                <>
                  <Button onClick={handleOK} variant="outline" className="min-w-[80px]">
                    <IconRefresh className="h-4 w-4 mr-2" />
                    OK
                  </Button>
                  <Button
                    variant="default"
                    className="min-w-[80px]"
                    onClick={() => window.history.back()}
                  >
                    CANCEL
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
