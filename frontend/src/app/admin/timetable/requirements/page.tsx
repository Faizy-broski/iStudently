"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Search,
  Trash2,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Settings,
  PlayCircle,
  BookOpen,
  DoorOpen,
} from "lucide-react"
import { useCampus } from "@/context/CampusContext"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import * as teachersApi from "@/lib/api/teachers"
import * as academicsApi from "@/lib/api/academics"
import * as reqApi from "@/lib/api/timetable-requirements"
import type { TimetableRequirement, RoomType } from "@/lib/api/timetable-requirements"

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  classroom: "Classroom",
  lab: "Lab",
  auditorium: "Auditorium",
  library: "Library",
  gym: "Gym",
  office: "Office",
  other: "Other",
}

export default function TimetableRequirementsPage() {
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const { gradeLevels, loading: gradeLevelsLoading } = useGradeLevels()
  const { sections, loading: sectionsLoading } = useSections()

  const [academicYears, setAcademicYears] = useState<teachersApi.AcademicYear[]>([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("")
  const [selectedGrade, setSelectedGrade] = useState("")
  const [selectedSection, setSelectedSection] = useState("")

  const [subjects, setSubjects] = useState<academicsApi.Subject[]>([])
  const [teachers, setTeachers] = useState<teachersApi.Staff[]>([])

  const [requirements, setRequirements] = useState<TimetableRequirement[]>([])
  const [coverage, setCoverage] = useState<reqApi.RequirementCoverageSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPeriods, setBulkPeriods] = useState("")

  // New requirement row state
  const [newSubject, setNewSubject] = useState("")
  const [newTeacher, setNewTeacher] = useState("__any__")
  const [newPeriods, setNewPeriods] = useState("5")
  const [newDouble, setNewDouble] = useState(false)
  const [newRoomType, setNewRoomType] = useState<string>("__none__")
  const [newGapDays, setNewGapDays] = useState("0")
  const [adding, setAdding] = useState(false)

  const filteredSections = useMemo(() => {
    if (!selectedGrade || !selectedCampus) return []
    return sections.filter(
      (s) =>
        s.grade_level_id === selectedGrade &&
        s.is_active &&
        (s.campus_id === selectedCampus.id || s.school_id === selectedCampus.id)
    )
  }, [selectedGrade, selectedCampus, sections])

  const selectedGradeName = gradeLevels.find((g) => g.id === selectedGrade)?.name
  const selectedSectionName = sections.find((s) => s.id === selectedSection)?.name

  // ── Load initial reference data ────────────────────────────────────────
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
    Promise.all([
      academicsApi.getSubjects(selectedGrade || undefined, selectedCampus.id).catch(() => ({ data: [] })),
      teachersApi.getAllTeachers({ page: 1, limit: 300, campus_id: selectedCampus.id }).catch(() => ({ data: [] })),
    ]).then(([subjectsRes, teachersRes]) => {
      setSubjects(subjectsRes.data || [])
      setTeachers(teachersRes.data || [])
    })
  }, [selectedGrade, selectedCampus])

  // Reset section when grade changes
  useEffect(() => {
    setSelectedSection("")
  }, [selectedGrade])

  const loadRequirements = useCallback(async () => {
    if (!selectedSection || !selectedAcademicYear) return
    setLoading(true)
    try {
      const [reqs, cov] = await Promise.all([
        reqApi.listRequirements(selectedAcademicYear, selectedSection),
        reqApi.getCoverage(selectedSection, selectedAcademicYear).catch(() => null),
      ])
      setRequirements(reqs)
      setCoverage(cov)
    } catch (error: any) {
      toast.error(error.message || "Failed to load requirements")
    } finally {
      setLoading(false)
    }
  }, [selectedSection, selectedAcademicYear])

  useEffect(() => {
    loadRequirements()
    setSelectedIds(new Set())
  }, [loadRequirements])

  const filteredRequirements = useMemo(() => {
    if (!search.trim()) return requirements
    const q = search.trim().toLowerCase()
    return requirements.filter(
      (r) =>
        (r.subject_name || "").toLowerCase().includes(q) ||
        (r.teacher_name || "").toLowerCase().includes(q)
    )
  }, [requirements, search])

  const totalRequiredPeriods = requirements.reduce((sum, r) => sum + r.periods_per_week, 0)

  // ── Duplicate detection: same teacher assigned to the same section twice
  // across different subjects at the same weekly load can be a sign of a
  // copy/paste mistake — surface as a soft warning, not a hard block.
  const duplicateTeacherWarning = useMemo(() => {
    const byTeacher = new Map<string, TimetableRequirement[]>()
    requirements
      .filter((r) => r.teacher_id)
      .forEach((r) => {
        const list = byTeacher.get(r.teacher_id as string) || []
        list.push(r)
        byTeacher.set(r.teacher_id as string, list)
      })
    const flagged: string[] = []
    byTeacher.forEach((list, teacherId) => {
      if (list.length > 1) {
        const name = list[0].teacher_name || teacherId
        flagged.push(`${name} is assigned ${list.length} separate subjects in this section — verify this is intended.`)
      }
    })
    return flagged
  }, [requirements])

  const handleAddRequirement = async () => {
    if (!newSubject) {
      toast.error("Select a subject")
      return
    }
    const periods = parseInt(newPeriods, 10)
    if (!periods || periods < 1) {
      toast.error("Periods/week must be at least 1")
      return
    }

    setAdding(true)
    try {
      const created = await reqApi.createRequirement({
        academic_year_id: selectedAcademicYear,
        section_id: selectedSection,
        subject_id: newSubject,
        teacher_id: newTeacher === "__any__" ? null : newTeacher,
        periods_per_week: periods,
        double_period: newDouble,
        preferred_room_type: newRoomType === "__none__" ? null : (newRoomType as RoomType),
        min_gap_days: parseInt(newGapDays, 10) || 0,
      })
      setRequirements((prev) => [...prev, created])
      setNewSubject("")
      setNewTeacher("__any__")
      setNewPeriods("5")
      setNewDouble(false)
      setNewRoomType("__none__")
      setNewGapDays("0")
      toast.success("Requirement added")
      reqApi.getCoverage(selectedSection, selectedAcademicYear).then(setCoverage).catch(() => {})
    } catch (error: any) {
      toast.error(error.message || "Failed to add requirement")
    } finally {
      setAdding(false)
    }
  }

  const handleUpdateRequirement = async (id: string, patch: reqApi.UpdateTimetableRequirementDTO) => {
    // Optimistic update
    setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as TimetableRequirement : r)))
    try {
      await reqApi.updateRequirement(id, patch)
      reqApi.getCoverage(selectedSection, selectedAcademicYear).then(setCoverage).catch(() => {})
    } catch (error: any) {
      toast.error(error.message || "Failed to update requirement")
      loadRequirements()
    }
  }

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm("Delete this requirement? Sections without a matching requirement will not receive generated periods for this subject.")) return
    try {
      await reqApi.deleteRequirement(id)
      setRequirements((prev) => prev.filter((r) => r.id !== id))
      toast.success("Requirement removed")
      reqApi.getCoverage(selectedSection, selectedAcademicYear).then(setCoverage).catch(() => {})
    } catch (error: any) {
      toast.error(error.message || "Failed to delete requirement")
    }
  }

  const handleSeed = async () => {
    if (!selectedAcademicYear) return
    setSeeding(true)
    try {
      const seeded = await reqApi.seedRequirementsFromAssignments(selectedAcademicYear, selectedSection || undefined)
      toast.success(`Seeded ${seeded.length} requirement${seeded.length === 1 ? "" : "s"} from teacher assignments`)
      loadRequirements()
    } catch (error: any) {
      toast.error(error.message || "Failed to seed requirements")
    } finally {
      setSeeding(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRequirements.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredRequirements.map((r) => r.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkSetPeriods = async () => {
    const periods = parseInt(bulkPeriods, 10)
    if (!periods || periods < 1) {
      toast.error("Enter a valid periods/week value")
      return
    }
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    try {
      await Promise.all(ids.map((id) => reqApi.updateRequirement(id, { periods_per_week: periods })))
      setRequirements((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, periods_per_week: periods } : r)))
      toast.success(`Updated periods/week for ${ids.length} requirement${ids.length === 1 ? "" : "s"}`)
      setSelectedIds(new Set())
      setBulkPeriods("")
      reqApi.getCoverage(selectedSection, selectedAcademicYear).then(setCoverage).catch(() => {})
    } catch (error: any) {
      toast.error(error.message || "Bulk update failed")
      loadRequirements()
    }
  }

  const coverageUsed = coverage ? coverage.required_periods_per_week : totalRequiredPeriods
  const coverageAvailable = coverage?.available_periods_per_week

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/timetable">
              <Button variant="ghost" size="sm" className="gap-1 -ml-2">
                <ArrowLeft className="h-4 w-4" /> Back to Timetable
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white">
            Timetable Requirements
          </h1>
          <p className="text-muted-foreground">
            Define how many periods/week each subject needs per section — the generator uses these as its input.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/rooms">
            <Button variant="outline" size="sm">
              <DoorOpen className="h-4 w-4 mr-2" /> Rooms
            </Button>
          </Link>
          <Link href="/admin/timetable/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" /> Constraints & Settings
            </Button>
          </Link>
          <Link href="/admin/timetable/generate">
            <Button size="sm" className="bg-[#022172] hover:bg-[#022172]/90 text-white">
              <PlayCircle className="h-4 w-4 mr-2" /> Generate Timetable
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 min-w-[160px]">
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

            <div className="space-y-1.5 min-w-[160px]">
              <Label className="text-sm">Grade</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels
                    .filter((g) => g.is_active && selectedCampus && (g.campus_id === selectedCampus.id || g.school_id === selectedCampus.id))
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((grade) => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-[180px]">
              <Label className="text-sm">Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding || !selectedAcademicYear} className="gap-2">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Seed from Assignments
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedCampus || gradeLevelsLoading || sectionsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedSection ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ListChecks className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">Select a section to view its requirements</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a grade and section above, or use "Seed from Assignments" to bootstrap requirements for every section at once.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Coverage badge */}
          {coverage && (
            <Alert className={coverage.is_over_capacity ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-50 dark:bg-green-950/20"}>
              {coverage.is_over_capacity ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription className="flex items-center justify-between w-full flex-wrap gap-2">
                <span className={coverage.is_over_capacity ? "text-destructive font-medium" : "text-green-700 dark:text-green-400 font-medium"}>
                  {coverageUsed}/{coverage.available_periods_per_week} periods/week used for {selectedSectionName}
                  {coverage.is_over_capacity && " — over capacity! The generator cannot fit all requirements."}
                </span>
                <Badge variant={coverage.is_over_capacity ? "destructive" : "default"} className={!coverage.is_over_capacity ? "bg-green-600" : ""}>
                  {coverage.requirement_count} requirement{coverage.requirement_count === 1 ? "" : "s"}
                </Badge>
              </AlertDescription>
            </Alert>
          )}

          {duplicateTeacherWarning.length > 0 && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-400 space-y-1">
                {duplicateTeacherWarning.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Add requirement row */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Add Requirement</CardTitle>
              <CardDescription>Subject + teacher + periods/week for {selectedSectionName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Subject *</Label>
                  <Select value={newSubject} onValueChange={setNewSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {s.code ? `(${s.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Teacher</Label>
                  <Select value={newTeacher} onValueChange={setNewTeacher}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any qualified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Unassigned / any qualified</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.profile ? `${t.profile.first_name || ""} ${t.profile.last_name || ""}`.trim() : "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Periods/wk *</Label>
                  <Input type="number" min={1} max={40} value={newPeriods} onChange={(e) => setNewPeriods(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Gap days</Label>
                  <Input type="number" min={0} value={newGapDays} onChange={(e) => setNewGapDays(e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Preferred room type</Label>
                  <Select value={newRoomType} onValueChange={setNewRoomType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any room" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any room</SelectItem>
                      {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Switch checked={newDouble} onCheckedChange={setNewDouble} id="double-period" />
                  <Label htmlFor="double-period" className="text-xs cursor-pointer">
                    Double period (2 consecutive periods per session)
                  </Label>
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button onClick={handleAddRequirement} disabled={adding} className="bg-[#022172] hover:bg-[#022172]/90 text-white gap-2">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Add Requirement
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Requirements table */}
          <Card>
            <CardHeader className="py-3 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <CardTitle className="text-base">
                  Requirements <span className="text-muted-foreground font-normal">({filteredRequirements.length})</span>
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search subject or teacher..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-56"
                    />
                  </div>
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Periods/wk"
                        value={bulkPeriods}
                        onChange={(e) => setBulkPeriods(e.target.value)}
                        className="w-28"
                      />
                      <Button size="sm" variant="outline" onClick={handleBulkSetPeriods}>
                        Set for {selectedIds.size} selected
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : requirements.length === 0 ? (
                <div className="py-16 text-center px-6">
                  <BookOpen className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-medium text-muted-foreground">No requirements defined yet for {selectedSectionName}</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Requirements tell the generator how many periods/week each subject needs. Add one above, or seed
                    them automatically from this section's existing teacher-subject assignments.
                  </p>
                  <Button onClick={handleSeed} disabled={seeding} className="mt-4 gap-2 bg-[#022172] hover:bg-[#022172]/90 text-white">
                    {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Seed from Assignments
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="p-2 w-8">
                          <Checkbox
                            checked={filteredRequirements.length > 0 && selectedIds.size === filteredRequirements.length}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all requirements"
                          />
                        </th>
                        <th className="text-left p-2 font-medium">Subject</th>
                        <th className="text-left p-2 font-medium">Teacher</th>
                        <th className="text-left p-2 font-medium">Periods/wk</th>
                        <th className="text-left p-2 font-medium">Double</th>
                        <th className="text-left p-2 font-medium">Room type</th>
                        <th className="text-left p-2 font-medium">Gap days</th>
                        <th className="text-left p-2 font-medium">Active</th>
                        <th className="p-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequirements.map((req) => (
                        <tr key={req.id} className="border-b hover:bg-muted/20">
                          <td className="p-2">
                            <Checkbox
                              checked={selectedIds.has(req.id)}
                              onCheckedChange={() => toggleSelectOne(req.id)}
                              aria-label={`Select requirement ${req.subject_name}`}
                            />
                          </td>
                          <td className="p-2 font-medium">{req.subject_name || "—"}</td>
                          <td className="p-2">
                            <Select
                              value={req.teacher_id || "__any__"}
                              onValueChange={(v) => handleUpdateRequirement(req.id, { teacher_id: v === "__any__" ? null : v })}
                            >
                              <SelectTrigger className="h-8 w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__any__">Unassigned / any qualified</SelectItem>
                                {teachers.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.profile ? `${t.profile.first_name || ""} ${t.profile.last_name || ""}`.trim() : "Unknown"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={1}
                              max={40}
                              defaultValue={req.periods_per_week}
                              className="h-8 w-20"
                              onBlur={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (v && v !== req.periods_per_week) {
                                  handleUpdateRequirement(req.id, { periods_per_week: v })
                                }
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <Switch
                              checked={req.double_period}
                              onCheckedChange={(v) => handleUpdateRequirement(req.id, { double_period: v })}
                            />
                          </td>
                          <td className="p-2">
                            <Select
                              value={req.preferred_room_type || "__none__"}
                              onValueChange={(v) =>
                                handleUpdateRequirement(req.id, { preferred_room_type: v === "__none__" ? null : (v as RoomType) })
                              }
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Any room</SelectItem>
                                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              defaultValue={req.min_gap_days}
                              className="h-8 w-16"
                              onBlur={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v) && v !== req.min_gap_days) {
                                  handleUpdateRequirement(req.id, { min_gap_days: v })
                                }
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <Switch
                              checked={req.is_active}
                              onCheckedChange={(v) => handleUpdateRequirement(req.id, { is_active: v })}
                            />
                          </td>
                          <td className="p-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteRequirement(req.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
