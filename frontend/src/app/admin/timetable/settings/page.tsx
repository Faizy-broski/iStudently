"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Save, Search, SlidersHorizontal, ListChecks } from "lucide-react"
import { useCampus } from "@/context/CampusContext"
import * as teachersApi from "@/lib/api/teachers"
import * as reqApi from "@/lib/api/timetable-requirements"
import type { TimetableGenerationSettings, TeacherSchedulingConstraint } from "@/lib/api/timetable-requirements"

export default function TimetableGenerationSettingsPage() {
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [academicYears, setAcademicYears] = useState<teachersApi.AcademicYear[]>([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("")
  const [teachers, setTeachers] = useState<teachersApi.Staff[]>([])

  const [settings, setSettings] = useState<TimetableGenerationSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const [constraints, setConstraints] = useState<TeacherSchedulingConstraint[]>([])
  const [loadingConstraints, setLoadingConstraints] = useState(false)
  const [search, setSearch] = useState("")
  const [savingTeacherId, setSavingTeacherId] = useState<string | null>(null)

  useEffect(() => {
    teachersApi
      .getAcademicYears()
      .then((years) => {
        setAcademicYears(years)
        const current = years.find((y) => y.is_current)
        if (current) setSelectedAcademicYear(current.id)
      })
      .catch(() => toast.error("Failed to load academic years"))
  }, [])

  useEffect(() => {
    if (!selectedCampus) return
    teachersApi
      .getAllTeachers({ page: 1, limit: 300, campus_id: selectedCampus.id })
      .then((res) => setTeachers(res.data || []))
      .catch(() => {})
  }, [selectedCampus])

  const loadSettings = useCallback(async () => {
    if (!selectedAcademicYear) return
    setLoadingSettings(true)
    try {
      const s = await reqApi.getGenerationSettings(selectedAcademicYear, selectedCampus?.id)
      setSettings(s)
    } catch (error: any) {
      toast.error(error.message || "Failed to load generation settings")
    } finally {
      setLoadingSettings(false)
    }
  }, [selectedAcademicYear, selectedCampus?.id])

  const loadConstraints = useCallback(async () => {
    if (!selectedAcademicYear) return
    setLoadingConstraints(true)
    try {
      const list = await reqApi.listTeacherConstraints(selectedAcademicYear)
      setConstraints(list)
    } catch (error: any) {
      toast.error(error.message || "Failed to load teacher constraints")
    } finally {
      setLoadingConstraints(false)
    }
  }, [selectedAcademicYear])

  useEffect(() => {
    loadSettings()
    loadConstraints()
  }, [loadSettings, loadConstraints])

  const handleSaveSettings = async () => {
    if (!settings || !selectedAcademicYear) return
    setSavingSettings(true)
    try {
      const updated = await reqApi.updateGenerationSettings({
        campus_id: selectedCampus?.id,
        academic_year_id: selectedAcademicYear,
        default_max_periods_per_day: settings.default_max_periods_per_day,
        default_min_gap_between_periods: settings.default_min_gap_between_periods,
        weight_teacher_availability_preferred: settings.weight_teacher_availability_preferred,
        weight_gap_violation: settings.weight_gap_violation,
        weight_daily_load_violation: settings.weight_daily_load_violation,
        weight_double_period_broken: settings.weight_double_period_broken,
        weight_frequency_spread: settings.weight_frequency_spread,
        solver_time_limit_seconds: settings.solver_time_limit_seconds,
      })
      setSettings(updated)
      toast.success("Generation settings saved")
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings")
    } finally {
      setSavingSettings(false)
    }
  }

  // Build a per-teacher row combining existing constraint (if any) with the
  // teacher's identity, so every teacher shows up even before they have a
  // constraint row saved yet.
  const teacherRows = useMemo(() => {
    const byTeacherId = new Map(constraints.map((c) => [c.teacher_id, c]))
    return teachers
      .map((t) => {
        const name = t.profile ? `${t.profile.first_name || ""} ${t.profile.last_name || ""}`.trim() : "Unknown"
        const existing = byTeacherId.get(t.id)
        return {
          teacherId: t.id,
          name,
          max_periods_per_day: existing?.max_periods_per_day ?? null,
          max_periods_per_week: existing?.max_periods_per_week ?? null,
          min_gap_between_periods: existing?.min_gap_between_periods ?? 0,
          max_consecutive_periods: existing?.max_consecutive_periods ?? null,
        }
      })
      .filter((row) => !search.trim() || row.name.toLowerCase().includes(search.trim().toLowerCase()))
  }, [teachers, constraints, search])

  const handleSaveConstraint = async (
    teacherId: string,
    patch: Partial<{
      max_periods_per_day: number | null
      max_periods_per_week: number | null
      min_gap_between_periods: number
      max_consecutive_periods: number | null
    }>
  ) => {
    if (!selectedAcademicYear) return
    const current = teacherRows.find((r) => r.teacherId === teacherId)
    setSavingTeacherId(teacherId)
    try {
      const updated = await reqApi.upsertTeacherConstraints(teacherId, {
        teacher_id: teacherId,
        campus_id: selectedCampus?.id,
        academic_year_id: selectedAcademicYear,
        max_periods_per_day: current?.max_periods_per_day ?? null,
        max_periods_per_week: current?.max_periods_per_week ?? null,
        min_gap_between_periods: current?.min_gap_between_periods ?? 0,
        max_consecutive_periods: current?.max_consecutive_periods ?? null,
        ...patch,
      })
      setConstraints((prev) => {
        const others = prev.filter((c) => c.teacher_id !== teacherId)
        return [...others, updated]
      })
      toast.success("Teacher constraint saved")
    } catch (error: any) {
      toast.error(error.message || "Failed to save teacher constraint")
    } finally {
      setSavingTeacherId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/timetable/requirements">
              <Button variant="ghost" size="sm" className="gap-1 -ml-2">
                <ArrowLeft className="h-4 w-4" /> Back to Requirements
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white">
            Generation Constraints & Settings
          </h1>
          <p className="text-muted-foreground">
            Tune how the solver weighs soft constraints, and set per-teacher load limits.
          </p>
        </div>
        <div className="space-y-1.5 min-w-[200px]">
          <Label className="text-sm">Academic Year</Label>
          <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.name} {y.is_current && "(Current)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Global generation settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" /> Global Generation Settings
          </CardTitle>
          <CardDescription>Defaults and soft-constraint weights used whenever a per-teacher override isn't set.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettings || !settings ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default max periods/day</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.default_max_periods_per_day}
                    onChange={(e) => setSettings({ ...settings, default_max_periods_per_day: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Default min gap between periods</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.default_min_gap_between_periods}
                    onChange={(e) => setSettings({ ...settings, default_min_gap_between_periods: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Solver time limit (seconds)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    value={settings.solver_time_limit_seconds}
                    onChange={(e) => setSettings({ ...settings, solver_time_limit_seconds: parseInt(e.target.value, 10) || 60 })}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">Soft-constraint weights</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Higher weight = the solver tries harder to satisfy this preference, at the cost of others. These never
                  block placement (they're soft), unlike hard constraints such as double-booking.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {([
                    ["weight_teacher_availability_preferred", "Teacher preferred slots"],
                    ["weight_gap_violation", "Gap rule violations"],
                    ["weight_daily_load_violation", "Daily load violations"],
                    ["weight_double_period_broken", "Double-period adjacency"],
                    ["weight_frequency_spread", "Weekly spread (min gap days)"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={settings[key]}
                        onChange={(e) => setSettings({ ...settings, [key]: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-2 bg-[#022172] hover:bg-[#022172]/90 text-white">
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-teacher constraints */}
      <Card>
        <CardHeader className="border-b py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" /> Per-Teacher Constraints
              <Badge variant="secondary">{teacherRows.length}</Badge>
            </CardTitle>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input placeholder="Search teacher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-56" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingConstraints ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium">Teacher</th>
                    <th className="text-left p-2 font-medium">Max/day</th>
                    <th className="text-left p-2 font-medium">Max/week</th>
                    <th className="text-left p-2 font-medium">Min gap</th>
                    <th className="text-left p-2 font-medium">Max consecutive</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherRows.map((row) => (
                    <tr key={row.teacherId} className="border-b hover:bg-muted/20">
                      <td className="p-2 font-medium flex items-center gap-2">
                        {row.name}
                        {savingTeacherId === row.teacherId && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-20"
                          placeholder="Default"
                          defaultValue={row.max_periods_per_day ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : parseInt(e.target.value, 10)
                            if (v !== row.max_periods_per_day) handleSaveConstraint(row.teacherId, { max_periods_per_day: v })
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-20"
                          placeholder="Default"
                          defaultValue={row.max_periods_per_week ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : parseInt(e.target.value, 10)
                            if (v !== row.max_periods_per_week) handleSaveConstraint(row.teacherId, { max_periods_per_week: v })
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20"
                          defaultValue={row.min_gap_between_periods}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10) || 0
                            if (v !== row.min_gap_between_periods) handleSaveConstraint(row.teacherId, { min_gap_between_periods: v })
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-20"
                          placeholder="Default"
                          defaultValue={row.max_consecutive_periods ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : parseInt(e.target.value, 10)
                            if (v !== row.max_consecutive_periods) handleSaveConstraint(row.teacherId, { max_consecutive_periods: v })
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
