"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  type Subject,
} from "@/lib/api/academics"
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCoursePeriodsForCourse,
  createCoursePeriod,
  updateCoursePeriod,
  deleteCoursePeriod,
  getGradingScales,
  getSchoolPeriods,
  type Course,
  type CoursePeriod,
  type CreateCoursePeriodDTO,
  type GradingScale,
  type SchoolPeriod,
} from "@/lib/api/grades"
import { getMarkingPeriods, type MarkingPeriod } from "@/lib/api/marking-periods"
import { getClassList, type ClassListResponse } from "@/lib/api/scheduling"
import { getAllTeachers, type Staff } from "@/lib/api/teachers"
import { CalendarDays, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

// ── Types ───────────────────────────────────────────────────────────────

interface CoursePeriodWithSeats extends CoursePeriod {
  title?: string
  short_name?: string
  filled_seats?: number
  total_seats?: number | null
  available_seats?: number | null
  period?: { period_name?: string; period_number?: number } | null
}

// ── Component ───────────────────────────────────────────────────────────

export function Courses() {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id
  const academicYearId = selectedAcademicYear

  // ── Selection state ─────────────────────────────────────────────────
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  // ── Dialog state ────────────────────────────────────────────────────
  const [subjectDialog, setSubjectDialog] = useState<{ open: boolean; mode: "add" | "edit"; subject?: Subject }>({
    open: false,
    mode: "add",
  })
  const [courseDialog, setCourseDialog] = useState<{ open: boolean; mode: "add" | "edit"; course?: Course }>({
    open: false,
    mode: "add",
  })
  const [cpDialog, setCpDialog] = useState<{
    open: boolean
    mode: "add" | "edit"
    cp?: CoursePeriodWithSeats
  }>({ open: false, mode: "add" })

  // ── Delete confirm ──────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    type: "subject" | "course" | "cp"
    id: string
    courseId?: string
    label: string
  } | null>(null)

  // ── Form state ──────────────────────────────────────────────────────
  const [formLoading, setFormLoading] = useState(false)
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "", grade_level_id: "" })
  const [courseForm, setCourseForm] = useState({ title: "", short_name: "" })
  const [cpForm, setCpForm] = useState({
    short_name: "",
    teacher_id: "",
    secondary_teacher_id: "",
    room: "",
    marking_period_id: "",
    period_id: "",
    days: "MTWRF",
    grading_scale_id: "",
    gender_restriction: "N",
    total_seats: "",
    does_honor_roll: true,
    takes_attendance: false,
    calendar_id: "",
    allow_teacher_grade_scale: false,
    credits: "1",
    affects_class_rank: false,
    parent_course_period_id: "",
  })

  // ── Data fetching ───────────────────────────────────────────────────

  const subjectsCacheKey = user ? ["courses-page-subjects"] : null
  const { data: subjectsRes, isLoading: subjectsLoading } = useSWR(
    subjectsCacheKey,
    async () => getSubjects(),
    { revalidateOnFocus: false }
  )

  const coursesCacheKey = user && selectedSubjectId
    ? ["courses-page-courses", campusId, selectedSubjectId]
    : null
  const { data: coursesRes, isLoading: coursesLoading } = useSWR(
    coursesCacheKey,
    async () => getCourses(campusId),
    { revalidateOnFocus: false }
  )

  const cpsCacheKey = user && selectedCourseId
    ? ["courses-page-cps", selectedCourseId]
    : null
  const { data: cpsRes, isLoading: cpsLoading } = useSWR(
    cpsCacheKey,
    async () => getCoursePeriodsForCourse(selectedCourseId!),
    { revalidateOnFocus: false }
  )

  // Seat data for course periods
  const [seatMap, setSeatMap] = useState<Record<string, ClassListResponse>>({})

  const coursePeriods = useMemo<CoursePeriodWithSeats[]>(() => {
    const list = cpsRes?.data || []
    return list.map((cp) => {
      const seats = seatMap[cp.id]
      return {
        ...cp,
        filled_seats: seats?.filled_seats ?? 0,
        total_seats: seats?.total_seats ?? null,
        available_seats:
          seats?.total_seats != null
            ? (seats.total_seats - seats.filled_seats)
            : null,
      }
    })
  }, [cpsRes, seatMap])

  // Fetch seats for each CP when course is selected
  useSWR(
    cpsRes?.data?.length ? ["courses-page-seats", selectedCourseId] : null,
    async () => {
      const cps = cpsRes?.data || []
      const results = await Promise.allSettled(
        cps.map(async (cp) => {
          const cl = await getClassList(cp.id)
          return { id: cp.id, cl }
        })
      )
      const map: Record<string, ClassListResponse> = {}
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value.id] = r.value.cl
      }
      setSeatMap(map)
      return map
    },
    { revalidateOnFocus: false }
  )

  // Teachers list for cp dialog
  const { data: teachersData } = useSWR(
    cpDialog.open ? ["courses-page-teachers", campusId] : null,
    async () => getAllTeachers({ limit: 500, campus_id: campusId }),
    { revalidateOnFocus: false }
  )
  // Grade levels for subject dialog
  const { data: gradesRes } = useSWR(
    subjectDialog.open && campusId ? ["courses-page-grades", campusId] : null,
    async () => {
      const { getGradeLevels } = await import("@/lib/api/academics")
      return getGradeLevels(campusId)
    },
    { revalidateOnFocus: false }
  )

  // Marking periods for cp dialog
  const { data: markingPeriodsData } = useSWR(
    cpDialog.open && campusId ? ["courses-page-mps", campusId] : null,
    async () => getMarkingPeriods(campusId),
    { revalidateOnFocus: false }
  )

  // School periods for cp dialog
  const { data: schoolPeriodsRes } = useSWR(
    cpDialog.open && campusId ? ["courses-page-periods", campusId] : null,
    async () => getSchoolPeriods(campusId),
    { revalidateOnFocus: false }
  )

  // Grading scales for cp dialog
  const { data: gradingScalesRes } = useSWR(
    cpDialog.open && campusId ? ["courses-page-scales", campusId] : null,
    async () => getGradingScales(campusId),
    { revalidateOnFocus: false }
  )

  // ── Derived data ────────────────────────────────────────────────────

  const subjects = useMemo<Subject[]>(() => subjectsRes?.data || [], [subjectsRes])

  const filteredCourses = useMemo<Course[]>(() => {
    if (!selectedSubjectId) return []
    const all = coursesRes?.data || []
    return all.filter((c) => c.subject_id === selectedSubjectId)
  }, [coursesRes, selectedSubjectId])

  const teachers = useMemo<Staff[]>(() => teachersData?.data || [], [teachersData])
  const gradeLevels = useMemo(() => gradesRes?.data || [], [gradesRes])
  const markingPeriods = useMemo<MarkingPeriod[]>(() => markingPeriodsData || [], [markingPeriodsData])
  const schoolPeriods = useMemo<SchoolPeriod[]>(() => schoolPeriodsRes?.data || [], [schoolPeriodsRes])
  const gradingScales = useMemo<GradingScale[]>(() => gradingScalesRes?.data || [], [gradingScalesRes])

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const selectedCourse = filteredCourses.find((c) => c.id === selectedCourseId)

  // ── Selection handlers ──────────────────────────────────────────────

  const handleSelectSubject = useCallback((id: string | null) => {
    setSelectedSubjectId(id)
    setSelectedCourseId(null)
    setSeatMap({})
  }, [])

  const handleSelectCourse = useCallback((id: string | null) => {
    setSelectedCourseId(id)
    setSeatMap({})
  }, [])

  // ── Subject CRUD ────────────────────────────────────────────────────

  const openAddSubject = () => {
    setSubjectForm({ name: "", code: "", grade_level_id: "" })
    setSubjectDialog({ open: true, mode: "add" })
  }

  const openEditSubject = (sub: Subject) => {
    setSubjectForm({ name: sub.name, code: sub.code, grade_level_id: sub.grade_level_id })
    setSubjectDialog({ open: true, mode: "edit", subject: sub })
  }

  const handleSaveSubject = async () => {
    if (!subjectForm.name.trim() || !subjectForm.code.trim() || !subjectForm.grade_level_id) {
      toast.error("Please fill in all required fields")
      return
    }
    setFormLoading(true)
    try {
      if (subjectDialog.mode === "add") {
        const res = await createSubject({
          name: subjectForm.name.trim(),
          code: subjectForm.code.trim(),
          grade_level_id: subjectForm.grade_level_id,
        })
        if (!res.success) throw new Error(res.error)
        toast.success("Subject created")
      } else {
        const res = await updateSubject(subjectDialog.subject!.id, {
          name: subjectForm.name.trim(),
          code: subjectForm.code.trim(),
        })
        if (!res.success) throw new Error(res.error)
        toast.success("Subject updated")
      }
      setSubjectDialog({ open: false, mode: "add" })
      globalMutate(subjectsCacheKey)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save subject")
    } finally {
      setFormLoading(false)
    }
  }

  // ── Course CRUD ─────────────────────────────────────────────────────

  const openAddCourse = () => {
    setCourseForm({ title: "", short_name: "" })
    setCourseDialog({ open: true, mode: "add" })
  }

  const openEditCourse = (course: Course) => {
    setCourseForm({ title: course.title, short_name: course.short_name || "" })
    setCourseDialog({ open: true, mode: "edit", course })
  }

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim()) {
      toast.error("Course title is required")
      return
    }
    if (!selectedSubjectId || !academicYearId) {
      toast.error("Subject and academic year are required")
      return
    }
    setFormLoading(true)
    try {
      if (courseDialog.mode === "add") {
        const res = await createCourse({
          title: courseForm.title.trim(),
          short_name: courseForm.short_name.trim() || undefined,
          subject_id: selectedSubjectId,
          campus_id: campusId,
        } as Partial<Course> & { campus_id?: string })
        if (!res.success) throw new Error(res.error)
        toast.success("Course created")
      } else {
        const res = await updateCourse(courseDialog.course!.id, {
          title: courseForm.title.trim(),
          short_name: courseForm.short_name.trim() || undefined,
        })
        if (!res.success) throw new Error(res.error)
        toast.success("Course updated")
      }
      setCourseDialog({ open: false, mode: "add" })
      globalMutate(coursesCacheKey)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save course")
    } finally {
      setFormLoading(false)
    }
  }

  // ── Course Period CRUD ──────────────────────────────────────────────

  const openAddCP = () => {
    setCpForm({
      short_name: "",
      teacher_id: "",
      secondary_teacher_id: "",
      room: "",
      marking_period_id: "",
      period_id: "",
      days: "MTWRF",
      grading_scale_id: "",
      gender_restriction: "N",
      total_seats: "",
      does_honor_roll: true,
      takes_attendance: false,
      calendar_id: "",
      allow_teacher_grade_scale: false,
      credits: "1",
      affects_class_rank: false,
      parent_course_period_id: "",
    })
    setCpDialog({ open: true, mode: "add" })
  }

  const openEditCP = (cp: CoursePeriodWithSeats) => {
    const cpAny = cp as any
    setCpForm({
      short_name: cp.short_name || "",
      teacher_id: cp.teacher_id || "",
      secondary_teacher_id: cpAny.secondary_teacher_id || "",
      room: cpAny.room || "",
      marking_period_id: cpAny.marking_period_id || "",
      period_id: cpAny.period_id || "",
      days: cpAny.days || "MTWRF",
      grading_scale_id: cpAny.grading_scale_id || "",
      gender_restriction: cpAny.gender_restriction || "N",
      total_seats: cp.total_seats?.toString() || "",
      does_honor_roll: cpAny.does_honor_roll !== false,
      takes_attendance: cpAny.takes_attendance || false,
      calendar_id: cpAny.calendar_id || "",
      allow_teacher_grade_scale: cpAny.allow_teacher_grade_scale || false,
      credits: cpAny.credits?.toString() || "1",
      affects_class_rank: cpAny.affects_class_rank || false,
      parent_course_period_id: cpAny.parent_course_period_id || "",
    })
    setCpDialog({ open: true, mode: "edit", cp })
  }

  const handleSaveCP = async () => {
    if (!selectedCourseId || !academicYearId) {
      toast.error("Course and academic year are required")
      return
    }
    if (!cpForm.teacher_id) {
      toast.error("Teacher is required")
      return
    }
    setFormLoading(true)
    try {
      if (cpDialog.mode === "add") {
        const dto: CreateCoursePeriodDTO = {
          course_id: selectedCourseId,
          teacher_id: cpForm.teacher_id,
          secondary_teacher_id: cpForm.secondary_teacher_id || undefined,
          academic_year_id: academicYearId,
          short_name: cpForm.short_name.trim() || undefined,
          marking_period_id: cpForm.marking_period_id || undefined,
          period_id: cpForm.period_id || undefined,
          room: cpForm.room.trim() || undefined,
          days: cpForm.days || undefined,
          grading_scale_id: cpForm.grading_scale_id || undefined,
          gender_restriction: cpForm.gender_restriction !== "N" ? cpForm.gender_restriction : undefined,
          total_seats: cpForm.total_seats ? parseInt(cpForm.total_seats) : undefined,
          campus_id: campusId,
          does_honor_roll: cpForm.does_honor_roll,
          takes_attendance: cpForm.takes_attendance,
          calendar_id: cpForm.calendar_id || undefined,
          allow_teacher_grade_scale: cpForm.allow_teacher_grade_scale,
          credits: cpForm.credits ? parseFloat(cpForm.credits) : undefined,
          affects_class_rank: cpForm.affects_class_rank,
          parent_course_period_id: cpForm.parent_course_period_id || undefined,
        }
        const res = await createCoursePeriod(selectedCourseId, dto)
        if (!res.success) throw new Error(res.error)
        toast.success("Course period created")
      } else {
        const res = await updateCoursePeriod(selectedCourseId, cpDialog.cp!.id, {
          teacher_id: cpForm.teacher_id,
          secondary_teacher_id: cpForm.secondary_teacher_id || null,
          short_name: cpForm.short_name.trim() || undefined,
          marking_period_id: cpForm.marking_period_id || undefined,
          period_id: cpForm.period_id || undefined,
          room: cpForm.room.trim() || null,
          days: cpForm.days || null,
          grading_scale_id: cpForm.grading_scale_id || undefined,
          gender_restriction: cpForm.gender_restriction !== "N" ? cpForm.gender_restriction : null,
          total_seats: cpForm.total_seats ? parseInt(cpForm.total_seats) : null,
          does_honor_roll: cpForm.does_honor_roll,
          takes_attendance: cpForm.takes_attendance,
          calendar_id: cpForm.calendar_id || null,
          allow_teacher_grade_scale: cpForm.allow_teacher_grade_scale,
          credits: cpForm.credits ? parseFloat(cpForm.credits) : null,
          affects_class_rank: cpForm.affects_class_rank,
          parent_course_period_id: cpForm.parent_course_period_id || null,
        })
        if (!res.success) throw new Error(res.error)
        toast.success("Course period updated")
      }
      setCpDialog({ open: false, mode: "add" })
      globalMutate(cpsCacheKey)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save course period")
    } finally {
      setFormLoading(false)
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setFormLoading(true)
    try {
      if (deleteConfirm.type === "subject") {
        const res = await deleteSubject(deleteConfirm.id)
        if (!res.success) throw new Error(res.error)
        toast.success("Subject deleted")
        if (selectedSubjectId === deleteConfirm.id) handleSelectSubject(null)
        globalMutate(subjectsCacheKey)
      } else if (deleteConfirm.type === "course") {
        const res = await deleteCourse(deleteConfirm.id)
        if (!res.success) throw new Error(res.error)
        toast.success("Course deleted")
        if (selectedCourseId === deleteConfirm.id) handleSelectCourse(null)
        globalMutate(coursesCacheKey)
      } else if (deleteConfirm.type === "cp" && deleteConfirm.courseId) {
        const res = await deleteCoursePeriod(deleteConfirm.courseId, deleteConfirm.id)
        if (!res.success) throw new Error(res.error)
        toast.success("Course period deleted")
        globalMutate(cpsCacheKey)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setFormLoading(false)
      setDeleteConfirm(null)
    }
  }

  // ── Teacher display name helper ─────────────────────────────────────

  const getTeacherName = (cp: CoursePeriodWithSeats) => {
    const t = cp.teacher
    if (!t) return ""
    // Backend may return nested profile or flat first_name/last_name
    const record = t as Record<string, unknown>
    const profile = record.profile as
      | { first_name?: string; last_name?: string }
      | undefined
    if (profile) {
      return [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    }
    if (t.first_name || t.last_name) {
      return [t.first_name, t.last_name].filter(Boolean).join(" ")
    }
    return ""
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Courses</h1>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-muted-foreground">
        <span>Courses</span>
      </div>

      {/* 3-panel layout */}
      <div className="flex gap-0 border rounded-md overflow-hidden">
        {/* ── Panel 1: Subjects ──────────────────────────────────── */}
        <div className="min-w-50 max-w-62.5 border-r bg-background">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b">
            {subjectsLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <>{subjects.length} subject{subjects.length !== 1 ? "s" : ""} found.</>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">
                  Subject
                </th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {subjectsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2" colSpan={2}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : (
                subjects.map((sub) => (
                  <tr
                    key={sub.id}
                    className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${selectedSubjectId === sub.id ? "bg-primary/10 font-medium" : ""
                      }`}
                    onClick={() => handleSelectSubject(sub.id)}
                  >
                    <td className="px-3 py-2 text-primary hover:underline">
                      {sub.name}
                    </td>
                    <td className="px-1 py-2 text-right">
                      <div className="flex gap-0.5 justify-end">
                        <button
                          className="p-1 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditSubject(sub)
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm({
                              open: true,
                              type: "subject",
                              id: sub.id,
                              label: sub.name,
                            })
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {/* Add row */}
              <tr
                className="border-b cursor-pointer hover:bg-muted/50"
                onClick={openAddSubject}
              >
                <td className="px-3 py-2" colSpan={2}>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Panel 2: Courses ───────────────────────────────────── */}
        {selectedSubjectId && (
          <div className="min-w-50 max-w-62.5 border-r bg-background">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {coursesLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <>
                  {filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""} found.
                </>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">
                    Course
                  </th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {coursesLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2" colSpan={2}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredCourses.map((course) => (
                    <tr
                      key={course.id}
                      className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${selectedCourseId === course.id ? "bg-primary/10 font-medium" : ""
                        }`}
                      onClick={() => handleSelectCourse(course.id)}
                    >
                      <td className="px-3 py-2 text-primary hover:underline">
                        {course.title}
                      </td>
                      <td className="px-1 py-2 text-right">
                        <div className="flex gap-0.5 justify-end">
                          <button
                            className="p-1 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditCourse(course)
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="p-1 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm({
                                open: true,
                                type: "course",
                                id: course.id,
                                label: course.title,
                              })
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {/* Add row */}
                <tr
                  className="border-b cursor-pointer hover:bg-muted/50"
                  onClick={openAddCourse}
                >
                  <td className="px-3 py-2" colSpan={2}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Panel 3: Course Periods ─────────────────────────────── */}
        {selectedCourseId && (
          <div className="flex-1 bg-background">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {cpsLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <>
                  {coursePeriods.length} course period{coursePeriods.length !== 1 ? "s" : ""} found.
                </>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">
                    Course Period
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-teal-700">
                    Available Seats
                  </th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {cpsLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2" colSpan={3}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  coursePeriods.map((cp) => {
                    const teacherName = getTeacherName(cp)
                    const displayTitle =
                      cp.title ||
                      [
                        cp.period?.period_name,
                        selectedCourse?.title,
                        teacherName ? `${teacherName}` : null,
                      ]
                        .filter(Boolean)
                        .join(" - ")

                    return (
                      <tr key={cp.id} className="border-b hover:bg-muted/50">
                        <td className="px-3 py-2 text-primary">
                          {displayTitle || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-amber-600">
                          {cp.available_seats != null
                            ? cp.available_seats
                            : cp.total_seats != null
                              ? cp.total_seats - (cp.filled_seats || 0)
                              : "—"}
                        </td>
                        <td className="px-1 py-2 text-right">
                          <div className="flex gap-0.5 justify-end">
                            <button
                              className="p-1 text-muted-foreground hover:text-primary"
                              onClick={() => openEditCP(cp)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="p-1 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setDeleteConfirm({
                                  open: true,
                                  type: "cp",
                                  id: cp.id,
                                  courseId: selectedCourseId!,
                                  label: displayTitle || "this course period",
                                })
                              }
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
                {/* Add row */}
                <tr
                  className="border-b cursor-pointer hover:bg-muted/50"
                  onClick={openAddCP}
                >
                  <td className="px-3 py-2" colSpan={3}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state panels */}
        {!selectedSubjectId && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 bg-muted/10">
            Select a subject to view its courses
          </div>
        )}
        {selectedSubjectId && !selectedCourseId && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 bg-muted/10">
            Select a course to view its periods
          </div>
        )}
      </div>

      {/* ── Subject Dialog ──────────────────────────────────────────── */}
      <Dialog open={subjectDialog.open} onOpenChange={(open) => !open && setSubjectDialog({ open: false, mode: "add" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {subjectDialog.mode === "add" ? "Add Subject" : "Edit Subject"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Grade Level *</Label>
              <Select
                value={subjectForm.grade_level_id}
                onValueChange={(v) => setSubjectForm((f) => ({ ...f, grade_level_id: v }))}
                disabled={subjectDialog.mode === "edit"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade level" />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={subjectForm.name}
                onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={subjectForm.code}
                onChange={(e) => setSubjectForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. MATH"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialog({ open: false, mode: "add" })}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubject} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {subjectDialog.mode === "add" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Course Dialog ───────────────────────────────────────────── */}
      <Dialog open={courseDialog.open} onOpenChange={(open) => !open && setCourseDialog({ open: false, mode: "add" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {courseDialog.mode === "add" ? "Add Course" : "Edit Course"}
              {selectedSubject && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({selectedSubject.name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={courseForm.title}
                onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Mathematics 6"
              />
            </div>
            <div className="space-y-2">
              <Label>Short Name</Label>
              <Input
                value={courseForm.short_name}
                onChange={(e) => setCourseForm((f) => ({ ...f, short_name: e.target.value }))}
                placeholder="e.g. MATH6"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialog({ open: false, mode: "add" })}>
              Cancel
            </Button>
            <Button onClick={handleSaveCourse} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {courseDialog.mode === "add" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Course Period Dialog ─────────────────────────────────────── */}
      <Dialog open={cpDialog.open} onOpenChange={(open) => !open && setCpDialog({ open: false, mode: "add" })}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {cpDialog.mode === "add" ? "Add Course Period" : "Edit Course Period"}
              {selectedCourse && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  for {selectedCourse.title}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {/* Short Name */}
            <div className="space-y-2">
              <Label>Short Name</Label>
              <Input
                value={cpForm.short_name}
                onChange={(e) => setCpForm((f) => ({ ...f, short_name: e.target.value }))}
                placeholder="e.g. MATH6A"
              />
            </div>

            {/* Teacher */}
            <div className="space-y-2">
              <Label>Teacher *</Label>
              <Select
                value={cpForm.teacher_id}
                onValueChange={(v) => setCpForm((f) => ({ ...f, teacher_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="N/A" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => {
                    const name = [t.profile?.first_name, t.profile?.last_name].filter(Boolean).join(" ")
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {name || t.id}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Secondary Teacher */}
            <div className="space-y-2">
              <Label>Secondary Teacher</Label>
              <Select
                value={cpForm.secondary_teacher_id || "none"}
                onValueChange={(v) => setCpForm((f) => ({ ...f, secondary_teacher_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="N/A" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">N/A</SelectItem>
                  {teachers.map((t) => {
                    const name = [t.profile?.first_name, t.profile?.last_name].filter(Boolean).join(" ")
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {name || t.id}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Room (text input, not dropdown) */}
            <div className="space-y-2">
              <Label>Room</Label>
              <Input
                value={cpForm.room}
                onChange={(e) => setCpForm((f) => ({ ...f, room: e.target.value }))}
                placeholder="e.g. 101"
              />
            </div>

            {/* Marking Period */}
            <div className="space-y-2">
              <Label>Marking Period</Label>
              <Select
                value={cpForm.marking_period_id || "none"}
                onValueChange={(v) => setCpForm((f) => ({ ...f, marking_period_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="FY" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">N/A</SelectItem>
                  {markingPeriods.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.title} ({mp.mp_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seats */}
            <div className="space-y-2">
              <Label>Seats</Label>
              <Input
                type="number"
                value={cpForm.total_seats}
                onChange={(e) => setCpForm((f) => ({ ...f, total_seats: e.target.value }))}
                placeholder="e.g. 30"
                min={0}
              />
            </div>

            {/* Period + Meeting Days */}
            <div className="space-y-2 col-span-2">
              <Label>Period</Label>
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <Select
                    value={cpForm.period_id || "none"}
                    onValueChange={(v) => setCpForm((f) => ({ ...f, period_id: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Full Day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Full Day</SelectItem>
                      {schoolPeriods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Meeting Days */}
            <div className="space-y-2 col-span-2">
              <Label>Meeting Days</Label>
              <div className="flex gap-1.5 flex-shrink-0">
                {(["M", "T", "W", "R", "F", "S", "U"] as const).map((day) => {
                  const labels: Record<string, string> = { M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri", S: "Sat", U: "Sun" }
                  const isActive = cpForm.days.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`w-9 h-9 rounded text-xs font-medium border transition-colors ${isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-input hover:bg-muted"
                        }`}
                      onClick={() => {
                        setCpForm((f) => ({
                          ...f,
                          days: isActive
                            ? f.days.replace(day, "")
                            : f.days + day,
                        }))
                      }}
                    >
                      {labels[day]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Takes Attendance */}
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="takes-attendance"
                checked={cpForm.takes_attendance}
                onCheckedChange={(c) => setCpForm((f) => ({ ...f, takes_attendance: c === true }))}
              />
              <Label htmlFor="takes-attendance" className="cursor-pointer">
                Takes Attendance
              </Label>
            </div>

            {/* Calendar */}
            <div className="space-y-2">
              <Label>Calendar</Label>
              <Select
                value={cpForm.calendar_id || "none"}
                onValueChange={(v) => setCpForm((f) => ({ ...f, calendar_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Main" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Main</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grading Scale */}
            <div className="space-y-2">
              <Label>Grading Scale</Label>
              <Select
                value={cpForm.grading_scale_id || "none"}
                onValueChange={(v) => setCpForm((f) => ({ ...f, grading_scale_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not Graded" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Graded</SelectItem>
                  {gradingScales.map((gs) => (
                    <SelectItem key={gs.id} value={gs.id}>
                      {gs.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Allow Teacher Grade Scale */}
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="allow-teacher-grade-scale"
                checked={cpForm.allow_teacher_grade_scale}
                onCheckedChange={(c) => setCpForm((f) => ({ ...f, allow_teacher_grade_scale: c === true }))}
              />
              <Label htmlFor="allow-teacher-grade-scale" className="cursor-pointer">
                Allow Teacher Grade Scale
              </Label>
            </div>

            {/* Credits */}
            <div className="space-y-2">
              <Label>Credits</Label>
              <Input
                type="number"
                value={cpForm.credits}
                onChange={(e) => setCpForm((f) => ({ ...f, credits: e.target.value }))}
                placeholder="1"
                min={0}
                step={0.5}
              />
            </div>

            {/* Affects Class Rank */}
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="affects-class-rank"
                checked={cpForm.affects_class_rank}
                onCheckedChange={(c) => setCpForm((f) => ({ ...f, affects_class_rank: c === true }))}
              />
              <Label htmlFor="affects-class-rank" className="cursor-pointer">
                Affects Class Rank
              </Label>
            </div>

            {/* Affects Honor Roll */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="does-honor-roll"
                checked={cpForm.does_honor_roll}
                onCheckedChange={(c) => setCpForm((f) => ({ ...f, does_honor_roll: c === true }))}
              />
              <Label htmlFor="does-honor-roll" className="cursor-pointer">
                Affects Honor Roll
              </Label>
            </div>

            {/* Gender Restriction */}
            <div className="space-y-2">
              <Label>Gender Restriction</Label>
              <Select
                value={cpForm.gender_restriction}
                onValueChange={(v) => setCpForm((f) => ({ ...f, gender_restriction: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N">None</SelectItem>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Parent Course Period */}
            <div className="space-y-2">
              <Label>Parent Course Period</Label>
              <Select
                value={cpForm.parent_course_period_id || "none"}
                onValueChange={(v) => setCpForm((f) => ({ ...f, parent_course_period_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {coursePeriods
                    .filter((cp) => cpDialog.mode !== "edit" || cp.id !== cpDialog.cp?.id)
                    .map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.short_name || cp.title || cp.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCpDialog({ open: false, mode: "add" })}>
              Cancel
            </Button>
            <Button onClick={handleSaveCP} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cpDialog.mode === "add" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────── */}
      <AlertDialog
        open={deleteConfirm?.open ?? false}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.type === "cp" ? "Course Period" : deleteConfirm?.type === "course" ? "Course" : "Subject"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.label}&quot;? This action cannot be undone.
              {deleteConfirm?.type === "subject" &&
                " All courses and course periods under this subject will also be deleted."}
              {deleteConfirm?.type === "course" &&
                " All course periods under this course will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={formLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={formLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
