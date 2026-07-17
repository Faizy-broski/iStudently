"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  PlayCircle,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Ban,
  RefreshCw,
  ListChecks,
  Download,
  Printer,
} from "lucide-react"
import {
  exportTimetableGridCSV,
  sectionCellLabel,
  teacherCellLabel,
  roomCellLabel,
  printCurrentTimetable,
} from "@/lib/utils/timetable-export"
import { useCampus } from "@/context/CampusContext"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import * as teachersApi from "@/lib/api/teachers"
import * as timetableApi from "@/lib/api/timetable"
import * as reqApi from "@/lib/api/timetable-requirements"
import * as genApi from "@/lib/api/timetable-generation"
import { TimetableBuilder } from "@/components/timetable"
import type { TimetableEntry } from "@/lib/api/timetable"

type WizardStep = "scope" | "generating" | "results" | "review"

interface SectionPreflight {
  sectionId: string
  sectionName: string
  gradeName?: string
  requirementCount: number
  coverage: reqApi.RequirementCoverageSummary | null
}

export default function TimetableGeneratePage() {
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const { gradeLevels } = useGradeLevels()
  const { sections, loading: sectionsLoading } = useSections()

  const [academicYears, setAcademicYears] = useState<teachersApi.AcademicYear[]>([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("")

  const [step, setStep] = useState<WizardStep>("scope")
  const [scope, setScope] = useState<"all" | "sections">("sections")
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())

  const [preflight, setPreflight] = useState<SectionPreflight[]>([])
  const [loadingPreflight, setLoadingPreflight] = useState(false)

  const [starting, setStarting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [periods, setPeriods] = useState<teachersApi.GlobalPeriod[]>([])

  const [sectionEntries, setSectionEntries] = useState<Record<string, TimetableEntry[]>>({})
  const [reviewSectionId, setReviewSectionId] = useState<string | null>(null)
  const [rollingBack, setRollingBack] = useState(false)
  const [exportView, setExportView] = useState<"section" | "teacher" | "room">("section")
  const [exportEntityId, setExportEntityId] = useState<string>("")

  const startTimeRef = useRef<number | null>(null)

  const campusSections = useMemo(() => {
    if (!selectedCampus) return []
    return sections.filter((s) => s.is_active && (s.campus_id === selectedCampus.id || s.school_id === selectedCampus.id))
  }, [sections, selectedCampus])

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
    teachersApi.getGlobalPeriods(selectedCampus.id).then(setPeriods).catch(() => {})
  }, [selectedCampus])

  const sectionsForScope = useMemo(() => {
    if (scope === "all") return campusSections
    return campusSections.filter((s) => selectedSectionIds.has(s.id))
  }, [scope, campusSections, selectedSectionIds])

  const runPreflight = useCallback(async () => {
    if (!selectedAcademicYear) return
    const targetSections = scope === "all" ? campusSections : campusSections.filter((s) => selectedSectionIds.has(s.id))
    if (targetSections.length === 0) {
      setPreflight([])
      return
    }
    setLoadingPreflight(true)
    try {
      const results = await Promise.all(
        targetSections.map(async (s): Promise<SectionPreflight> => {
          const grade = gradeLevels.find((g) => g.id === s.grade_level_id)
          const [reqs, coverage] = await Promise.all([
            reqApi.listRequirements(selectedAcademicYear, s.id).catch(() => []),
            reqApi.getCoverage(s.id, selectedAcademicYear).catch(() => null),
          ])
          return {
            sectionId: s.id,
            sectionName: s.name,
            gradeName: grade?.name,
            requirementCount: reqs.length,
            coverage,
          }
        })
      )
      setPreflight(results)
    } catch (error: any) {
      toast.error("Failed to run pre-flight checks")
    } finally {
      setLoadingPreflight(false)
    }
  }, [selectedAcademicYear, scope, campusSections, selectedSectionIds, gradeLevels])

  useEffect(() => {
    if (step === "scope") runPreflight()
  }, [step, runPreflight])

  const sectionsWithNoRequirements = preflight.filter((p) => p.requirementCount === 0)
  const sectionsOverCapacity = preflight.filter((p) => p.coverage?.is_over_capacity)
  const canGenerate = (scope === "all" || selectedSectionIds.size > 0) && !!selectedAcademicYear

  // ── Start generation ──────────────────────────────────────────────────
  const handleStart = async (force = false) => {
    if (!force && sectionsWithNoRequirements.length > 0) {
      toast.error(
        `${sectionsWithNoRequirements.length} section(s) have zero requirements defined — define requirements first or remove them from scope.`
      )
      return
    }
    setStarting(true)
    try {
      const result = await genApi.startGeneration({
        campus_id: selectedCampus?.id,
        academic_year_id: selectedAcademicYear,
        scope,
        section_ids: scope === "sections" ? Array.from(selectedSectionIds) : undefined,
      })
      setJobId(result.job_id)
      startTimeRef.current = Date.now()
      setStep("generating")
      toast.success("Timetable generation started")
    } catch (error: any) {
      if (error instanceof genApi.GenerationConflictError) {
        toast.error(error.message)
        setJobId(error.existing_job_id)
        startTimeRef.current = Date.now()
        setStep("generating")
      } else {
        toast.error(error.message || "Failed to start generation")
      }
    } finally {
      setStarting(false)
    }
  }

  // ── Poll job status via SWR ───────────────────────────────────────────
  const { data: job, mutate: refreshJob } = useSWR(
    jobId ? ["generation-job", jobId] : null,
    () => genApi.getJobStatus(jobId as string),
    {
      refreshInterval: (latest) =>
        latest && ["completed", "failed", "cancelled"].includes(latest.status) ? 0 : 2000,
      revalidateOnFocus: false,
    }
  )

  useEffect(() => {
    if (!job) return
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      setStep("results")
    }
  }, [job?.status])

  // Elapsed timer while running
  useEffect(() => {
    if (step !== "generating") return
    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [step])

  const handleCancel = async () => {
    if (!jobId) return
    try {
      await genApi.cancelJob(jobId)
      toast.success("Cancellation requested")
      refreshJob()
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel job")
    }
  }

  // ── Review step: load entries for affected sections ──────────────────
  const affectedSectionIds = useMemo(() => {
    if (!job) return []
    if (job.scope === "all") return campusSections.map((s) => s.id)
    return job.section_ids || []
  }, [job, campusSections])

  const loadReviewEntries = useCallback(async () => {
    if (!selectedAcademicYear || affectedSectionIds.length === 0) return
    const results = await Promise.all(
      affectedSectionIds.map((id) =>
        timetableApi
          .getTimetableBySection(id, selectedAcademicYear)
          .then((entries) => ({ id, entries }))
          .catch(() => ({ id, entries: [] as TimetableEntry[] }))
      )
    )
    const map: Record<string, TimetableEntry[]> = {}
    results.forEach(({ id, entries }) => (map[id] = entries))
    setSectionEntries(map)
    if (!reviewSectionId && affectedSectionIds.length > 0) setReviewSectionId(affectedSectionIds[0])
  }, [affectedSectionIds, selectedAcademicYear, reviewSectionId])

  useEffect(() => {
    if (step === "review") loadReviewEntries()
  }, [step, loadReviewEntries])

  const handleRollback = async () => {
    if (!jobId) return
    setRollingBack(true)
    try {
      const result = await genApi.rollbackJob(jobId)
      toast.success(`Rolled back ${result.rolled_back_count} generated entr${result.rolled_back_count === 1 ? "y" : "ies"}`)
      loadReviewEntries()
    } catch (error: any) {
      toast.error(error.message || "Failed to rollback generation")
    } finally {
      setRollingBack(false)
    }
  }

  const toggleSection = (id: string) => {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const resetWizard = () => {
    setStep("scope")
    setJobId(null)
    setElapsedSeconds(0)
    startTimeRef.current = null
  }

  const currentReviewSection = campusSections.find((s) => s.id === reviewSectionId)
  const gradeOf = (sectionId: string) => {
    const s = campusSections.find((x) => x.id === sectionId)
    return gradeLevels.find((g) => g.id === s?.grade_level_id)
  }

  // Flatten all loaded entries (across affected sections) for the
  // per-teacher / per-room export views in the review step.
  const allReviewEntries = useMemo(
    () => Object.values(sectionEntries).flat(),
    [sectionEntries]
  )
  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>()
    allReviewEntries.forEach((e) => {
      if (e.teacher_id) map.set(e.teacher_id, e.teacher_name || e.teacher_id)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [allReviewEntries])
  const roomOptions = useMemo(() => {
    const set = new Set<string>()
    allReviewEntries.forEach((e) => {
      if (e.room_number) set.add(e.room_number)
    })
    return Array.from(set)
  }, [allReviewEntries])

  const handleExportCSV = () => {
    if (exportView === "section" && reviewSectionId) {
      exportTimetableGridCSV({
        title: `Timetable — ${currentReviewSection?.name || ""}`,
        entries: sectionEntries[reviewSectionId] || [],
        periods,
        cellLabel: sectionCellLabel,
        filename: `timetable_${currentReviewSection?.name || "section"}.csv`,
      })
    } else if (exportView === "teacher" && exportEntityId) {
      const teacherName = teacherOptions.find((t) => t.id === exportEntityId)?.name || "teacher"
      exportTimetableGridCSV({
        title: `Teacher Schedule — ${teacherName}`,
        entries: allReviewEntries.filter((e) => e.teacher_id === exportEntityId),
        periods,
        cellLabel: teacherCellLabel,
        filename: `timetable_teacher_${teacherName}.csv`,
      })
    } else if (exportView === "room" && exportEntityId) {
      exportTimetableGridCSV({
        title: `Room Schedule — ${exportEntityId}`,
        entries: allReviewEntries.filter((e) => e.room_number === exportEntityId),
        periods,
        cellLabel: roomCellLabel,
        filename: `timetable_room_${exportEntityId}.csv`,
      })
    } else {
      toast.error("Select what to export first")
    }
  }

  const wizardSteps: { key: WizardStep; label: string }[] = [
    { key: "scope", label: "Scope" },
    { key: "generating", label: "Generating" },
    { key: "results", label: "Results" },
    { key: "review", label: "Review" },
  ]
  const stepIndex = wizardSteps.findIndex((s) => s.key === step)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/timetable">
              <Button variant="ghost" size="sm" className="gap-1 -ml-2">
                <ArrowLeft className="h-4 w-4" /> Back to Timetable
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white">Generate Timetable</h1>
          <p className="text-muted-foreground">Automatically place activities using the FET-style constraint solver.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {wizardSteps.map((s, idx) => {
          const active = step === s.key
          const done = idx < stepIndex
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? "bg-green-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
              {idx < wizardSteps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          )
        })}
      </div>

      {/* STEP 1: Scope */}
      {step === "scope" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4 space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
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

                <div className="space-y-1.5">
                  <Label className="text-sm">Scope</Label>
                  <div className="flex gap-1">
                    <Button
                      variant={scope === "sections" ? "default" : "outline"}
                      size="sm"
                      className={scope === "sections" ? "bg-[#022172] text-white" : ""}
                      onClick={() => setScope("sections")}
                    >
                      Specific sections
                    </Button>
                    <Button
                      variant={scope === "all" ? "default" : "outline"}
                      size="sm"
                      className={scope === "all" ? "bg-[#022172] text-white" : ""}
                      onClick={() => setScope("all")}
                    >
                      All sections
                    </Button>
                  </div>
                </div>
              </div>

              {scope === "sections" && (
                <div>
                  <Label className="text-sm mb-2 block">Select sections ({selectedSectionIds.size} selected)</Label>
                  {sectionsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-md p-3">
                      {campusSections.map((s) => {
                        const grade = gradeLevels.find((g) => g.id === s.grade_level_id)
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={selectedSectionIds.has(s.id)} onCheckedChange={() => toggleSection(s.id)} />
                            <span>
                              {grade?.name} - {s.name}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pre-flight warnings */}
          {loadingPreflight ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Running pre-flight checks...
            </div>
          ) : (
            <>
              {sectionsWithNoRequirements.length > 0 && (
                <Alert className="border-destructive/50 bg-destructive/5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertDescription>
                    <p className="font-medium text-destructive mb-2">
                      {sectionsWithNoRequirements.length} section{sectionsWithNoRequirements.length === 1 ? "" : "s"} have no
                      requirements defined — the generator has nothing to place for them.
                    </p>
                    <div className="space-y-1">
                      {sectionsWithNoRequirements.map((p) => (
                        <div key={p.sectionId} className="flex items-center justify-between text-sm">
                          <span>
                            {p.gradeName} - {p.sectionName}
                          </span>
                          <Link href={`/admin/timetable/requirements?section_id=${p.sectionId}`}>
                            <Button variant="link" size="sm" className="h-auto p-0 text-destructive underline">
                              Define requirements →
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {sectionsOverCapacity.length > 0 && (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    <p className="font-medium text-amber-800 dark:text-amber-400 mb-2">
                      {sectionsOverCapacity.length} section{sectionsOverCapacity.length === 1 ? "" : "s"} require more
                      periods/week than are available — some activities may be left unplaced.
                    </p>
                    <div className="space-y-1">
                      {sectionsOverCapacity.map((p) => (
                        <div key={p.sectionId} className="flex items-center justify-between text-sm">
                          <span>
                            {p.gradeName} - {p.sectionName}: {p.coverage?.required_periods_per_week}/
                            {p.coverage?.available_periods_per_week} periods/week
                          </span>
                          <Link href={`/admin/timetable/requirements?section_id=${p.sectionId}`}>
                            <Button variant="link" size="sm" className="h-auto p-0 text-amber-700 underline">
                              Adjust requirements →
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {preflight.length > 0 && sectionsWithNoRequirements.length === 0 && sectionsOverCapacity.length === 0 && (
                <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    All {preflight.length} section{preflight.length === 1 ? "" : "s"} in scope have requirements within
                    capacity. Ready to generate.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => handleStart(false)}
              disabled={!canGenerate || starting || sectionsWithNoRequirements.length > 0}
              className="gap-2 bg-[#022172] hover:bg-[#022172]/90 text-white"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Generate Timetable
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Generating */}
      {step === "generating" && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center gap-4">
            {job?.status === "running" || job?.status === "queued" || !job ? (
              <>
                <Loader2 className="h-14 w-14 animate-spin text-primary" />
                <p className="font-medium text-lg">{job?.status === "queued" ? "Queued..." : "Solving..."}</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  The solver is placing activities. Progress updates may jump rather than move smoothly — this is
                  expected for the current solver version.
                </p>
                {job && job.total_activities ? (
                  <div className="w-full max-w-sm space-y-1">
                    <Progress value={job.progress_percent} />
                    <p className="text-xs text-center text-muted-foreground">
                      {job.placed_activities ?? 0} / {job.total_activities} activities placed
                    </p>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> Elapsed: {elapsedSeconds}s
                </div>
                <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2">
                  <Ban className="h-4 w-4" /> Cancel
                </Button>
              </>
            ) : (
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Results */}
      {step === "results" && job && (
        <div className="space-y-4">
          {job.status === "failed" ? (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" /> Generation Failed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>{job.error_message || "An unknown error occurred."}</AlertDescription>
                </Alert>
                <Button onClick={resetWizard} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </CardContent>
            </Card>
          ) : job.status === "cancelled" ? (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <Ban className="h-5 w-5" /> Generation Cancelled
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The job was cancelled. Any partial results are shown below and can still be reviewed or rolled back.
                </p>
                <div className="flex gap-2">
                  <Button onClick={resetWizard} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Start Over
                  </Button>
                  <Button onClick={() => setStep("review")} className="gap-2 bg-[#022172] hover:bg-[#022172]/90 text-white">
                    Review Grid <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" /> Generation Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatTile label="Placed" value={job.placed_activities ?? 0} tone="good" />
                  <StatTile label="Unplaced" value={job.unplaced_activities ?? 0} tone={(job.unplaced_activities ?? 0) > 0 ? "warn" : "good"} />
                  <StatTile
                    label="Hard violations"
                    value={job.hard_violations}
                    tone={job.hard_violations > 0 ? "bad" : "good"}
                  />
                  <StatTile label="Soft score" value={job.soft_score ?? 0} tone="neutral" />
                </div>

                {job.hard_violations > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {job.hard_violations} hard constraint violation{job.hard_violations === 1 ? "" : "s"} detected — this
                      indicates a bug in the solver and should never happen. Please report this before trusting the
                      generated grid.
                    </AlertDescription>
                  </Alert>
                )}

                {job.result_summary?.unplaced && job.result_summary.unplaced.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" /> Unplaced Activities
                    </h4>
                    <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                      {job.result_summary.unplaced.map((u, idx) => (
                        <div key={idx} className="p-2 text-sm flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="font-medium">
                              {u.section_name || "Section"} · {u.subject_name || "Subject"}
                              {u.teacher_name ? ` · ${u.teacher_name}` : ""}
                            </span>
                            <p className="text-xs text-muted-foreground">{u.reason}</p>
                          </div>
                          {u.section_id && (
                            <Link href={`/admin/timetable/requirements?section_id=${u.section_id}`}>
                              <Button variant="link" size="sm" className="h-auto p-0 underline">
                                Fix in Requirements →
                              </Button>
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {job.result_summary?.warnings && job.result_summary.warnings.length > 0 && (
                  <Alert>
                    <AlertDescription className="space-y-1">
                      {job.result_summary.warnings.map((w, idx) => (
                        <div key={idx} className="text-sm">
                          {w}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button onClick={resetWizard} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Run Another
                  </Button>
                  <Button onClick={() => setStep("review")} className="gap-2 bg-[#022172] hover:bg-[#022172]/90 text-white">
                    Review Grid <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* STEP 4: Review */}
      {step === "review" && (
        <div className="space-y-4">
          <Card className="no-print">
            <CardContent className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-[220px]">
                <Label className="text-sm">Reviewing Section</Label>
                <Select value={reviewSectionId || ""} onValueChange={setReviewSectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {affectedSectionIds.map((id) => {
                      const s = campusSections.find((x) => x.id === id)
                      const grade = gradeOf(id)
                      return (
                        <SelectItem key={id} value={id}>
                          {grade?.name} - {s?.name || id}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" disabled={!jobId || rollingBack}>
                    {rollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Rollback This Generation
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rollback this generation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete the timetable entries created by this job (excluding any you've since locked).
                      Manually created entries and locked entries are preserved. This cannot be undone from the UI.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRollback} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Rollback
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Export & Print */}
          <Card className="no-print">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Export / Print</CardTitle>
              <CardDescription>Per-section, per-teacher, and per-room views for handouts or printing.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">View</Label>
                <Select value={exportView} onValueChange={(v) => { setExportView(v as any); setExportEntityId("") }}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="section">Section (current)</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {exportView === "teacher" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Teacher</Label>
                  <Select value={exportEntityId} onValueChange={setExportEntityId}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teacherOptions.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {exportView === "room" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Room</Label>
                  <Select value={exportEntityId} onValueChange={setExportEntityId}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={printCurrentTimetable} className="gap-2">
                <Printer className="h-4 w-4" /> Print Current Section
              </Button>
            </CardContent>
          </Card>

          {reviewSectionId && currentReviewSection && (
            <div className="print-area">
              <TimetableBuilder
                sectionId={reviewSectionId}
                sectionName={currentReviewSection.name}
                gradeName={gradeOf(reviewSectionId)?.name}
                gradeId={currentReviewSection.grade_level_id}
                periods={periods}
                entries={sectionEntries[reviewSectionId] || []}
                academicYearId={selectedAcademicYear}
                onEntriesChange={loadReviewEntries}
              />
            </div>
          )}

          <div className="flex justify-end no-print">
            <Button onClick={resetWizard} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Start a New Generation
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" | "warn" | "neutral" }) {
  const toneClasses = {
    good: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-500/30",
    bad: "bg-destructive/5 text-destructive border-destructive/30",
    warn: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
    neutral: "bg-muted/30 text-foreground border-border",
  }[tone]

  return (
    <div className={`rounded-lg border p-3 text-center ${toneClasses}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  )
}
