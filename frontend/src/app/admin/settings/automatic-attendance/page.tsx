'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSchoolSettings, updateSchoolSettings } from '@/lib/api/school-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { UserCheck, Save, Loader2, Clock, CalendarDays, Info, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

const DAY_LABELS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
]

export default function AutomaticAttendancePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [aaEnabled, setAaEnabled] = useState(true)
  const [aaHour, setAaHour] = useState('18:00')
  const [aaDays, setAaDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [absentOnFirstAbsence, setAbsentOnFirstAbsence] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSchoolSettings()
      if (result.success && result.data) {
        setAaEnabled(result.data.auto_attendance_enabled ?? true)
        setAaHour(result.data.auto_attendance_hour ?? '18:00')
        setAaDays(result.data.auto_attendance_days ?? [0, 1, 2, 3, 4])
        setAbsentOnFirstAbsence(result.data.absent_on_first_absence ?? false)
      }
    } catch {
      toast.error('Failed to load settings')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await updateSchoolSettings({
        auto_attendance_enabled: aaEnabled,
        auto_attendance_hour: aaHour,
        auto_attendance_days: aaDays,
        absent_on_first_absence: absentOnFirstAbsence,
      })
      if (result.success) {
        toast.success('Automatic attendance settings saved')
      } else {
        toast.error(result.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }

  const toggleDay = (dayValue: number) => {
    setAaDays(prev =>
      prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue].sort((a, b) => a - b)
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <UserCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Automatic Attendance
          </h1>
          <p className="text-muted-foreground">
            Configure the automatic attendance cron schedule for this campus
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
        <div className="text-sm text-green-800 dark:text-green-300">
          <p className="font-medium">How it works</p>
          <p className="mt-1">
            After the configured hour each school day, the system automatically marks all enrolled
            active students as <strong>Present</strong> for any class where the teacher has not yet
            taken attendance. Only valid school-calendar days are processed. Teachers can still
            override individual records at any time.
          </p>
        </div>
      </div>

      {/* Absent on First Absence banner */}
      <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
        <div className="text-sm text-orange-800 dark:text-orange-300">
          <p className="font-medium">Absent for the Day on First Absence</p>
          <p className="mt-1">
            When enabled, a student is marked <strong>Absent for the whole day</strong> as soon as any
            single Course Period is recorded as Absent — regardless of how many other periods they attended.
            This overrides the default minute-based calculation and applies per campus.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Enable + Hour */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-[#022172]" />
              Attendance Automation
            </CardTitle>
            <CardDescription>
              Enable automatic attendance and set the trigger time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Enable Automatic Attendance</Label>
                <p className="text-sm text-muted-foreground">
                  Auto-mark students as present after the configured hour
                </p>
              </div>
              <Switch checked={aaEnabled} onCheckedChange={setAaEnabled} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-800 dark:bg-orange-950/10">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Absent on First Absence</Label>
                <p className="text-sm text-muted-foreground">
                  Mark the full day absent if any period is absent
                </p>
              </div>
              <Switch checked={absentOnFirstAbsence} onCheckedChange={setAbsentOnFirstAbsence} />
            </div>

            <div className={!aaEnabled ? 'opacity-50 pointer-events-none' : ''}>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Run After Hour
                </Label>
                <Input
                  type="time"
                  value={aaHour}
                  onChange={(e) => setAaHour(e.target.value)}
                  className="w-40"
                />
                <p className="text-xs text-muted-foreground">
                  Attendance is generated once per day after this time (server timezone: Asia/Karachi)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* School Days */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#022172]" />
              School Days
            </CardTitle>
            <CardDescription>
              Days on which automatic attendance should run
            </CardDescription>
          </CardHeader>
          <CardContent className={!aaEnabled ? 'opacity-50 pointer-events-none' : ''}>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAaDays([0, 1, 2, 3, 4])} className="text-xs">
                  Weekdays
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAaDays([0, 1, 2, 3, 4, 5])} className="text-xs">
                  Mon–Sat
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAaDays([])} className="text-xs">
                  Clear
                </Button>
              </div>

              <div className="space-y-3">
                {DAY_LABELS.map((day) => (
                  <div key={day.value} className="flex items-center gap-3">
                    <Checkbox
                      id={`aa-day-${day.value}`}
                      checked={aaDays.includes(day.value)}
                      onCheckedChange={() => toggleDay(day.value)}
                    />
                    <Label htmlFor={`aa-day-${day.value}`} className="cursor-pointer text-sm font-normal">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Only days marked as school days in the attendance calendar are processed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Take Missing Attendance shortcut */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium text-sm">Take Missing Attendance</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manually fill missing attendance for a specific date range
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/attendance/take-missing">
            Open
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white px-8"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
