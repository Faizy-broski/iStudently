"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Search, Loader2, Download, BookOpen, ChevronLeft } from "lucide-react"
import * as teacherApi from "@/lib/api/teachers"
import * as timetableApi from "@/lib/api/timetable"
import * as eeApi from "@/lib/api/entry-exit"
import type { Staff, TimetableEntry } from "@/lib/api/teachers"
import type { AttendanceRecord } from "@/lib/api/timetable"
import type { Checkpoint } from "@/types"

interface EveningLeave {
  id: string
  student_id: string
  authorized_return_time: string
}

interface EntryExitRecord {
  id: string
  person_id: string
  recorded_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dateToJsDay(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getDay() // 0=Sun, 1=Mon..
}

// Our timetable uses 0=Mon, 1=Tue ... 6=Sun (DayOfWeek from teachers.ts)
function jsDateToTimetableDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

function teacherName(t: Staff) {
  const p = t.profile
  return p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : t.employee_number
}

type AttendanceStatus = "absent" | "present" | "late"

interface StudentRow {
  student_id: string
  student_name: string
  student_number: string
  status: AttendanceStatus
  remarks: string
  record_id?: string
}

// A unique course as seen by the teacher (section + subject combo from timetable)
interface CourseOption {
  key: string // section_id|subject_id
  label: string // e.g. "Math6A"
  sectionId: string
  subjectId: string
  gradeName: string
  entries: TimetableEntry[]
}

// ─── Radio button ─────────────────────────────────────────────────────────────

function RadioDot({
  checked,
  color,
  onClick,
}: {
  checked: boolean
  color: "pink" | "blue" | "gray"
  onClick: () => void
}) {
  const ring =
    color === "pink"
      ? "border-red-400 bg-red-50"
      : color === "blue"
      ? "border-blue-500 bg-blue-50"
      : "border-gray-300 bg-white"
  const dot =
    color === "pink" ? "bg-red-400" : color === "blue" ? "bg-blue-500" : "bg-gray-400"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${ring}`}
    >
      {checked && <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EETakeAttendancePage() {
  const t = useTranslations("school.entry_exit.take_attendance")
  const { profile } = useAuth()
  const schoolId = profile?.school_id || ""
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  // View state
  const [view, setView] = useState<"teachers" | "attendance">("teachers")
  const [selectedTeacher, setSelectedTeacher] = useState<Staff | null>(null)

  // Teacher list
  const [teachers, setTeachers] = useState<Staff[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const [teacherSearch, setTeacherSearch] = useState("")

  // Timetable / courses
  const [academicYearId, setAcademicYearId] = useState("")
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([])
  const [loadingTimetable, setLoadingTimetable] = useState(false)
  const [selectedCourseKey, setSelectedCourseKey] = useState("")

  // Attendance config
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [checkpointId, setCheckpointId] = useState("all")
  const [recordType, setRecordType] = useState<"ENTRY" | "EXIT">("ENTRY")
  const [date, setDate] = useState(todayStr())
  const [periodEntryId, setPeriodEntryId] = useState("")

  // Student attendance rows
  const [rows, setRows] = useState<StudentRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)

  // Evening leaves + EE records (for EL + Time columns)
  const [eveningLeaves, setEveningLeaves] = useState<EveningLeave[]>([])
  const [eeRecords, setEeRecords] = useState<EntryExitRecord[]>([])

  // Save
  const [saving, setSaving] = useState(false)

  // ── Load teachers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return
    setLoadingTeachers(true)
    Promise.all([
      teacherApi.getAllTeachers({ limit: 1000, campus_id: campusId }),
      teacherApi.getCurrentAcademicYear(),
      eeApi.getCheckpoints(schoolId),
    ])
      .then(([t, ay, cps]) => {
        setTeachers(t.data)
        if (ay) setAcademicYearId(ay.id)
        setCheckpoints(cps)
      })
      .catch(() => toast.error(t("msg_error_load")))
      .finally(() => setLoadingTeachers(false))
  }, [schoolId, campusId])

  // ── Load teacher timetable ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTeacher || !academicYearId) return
    setLoadingTimetable(true)
    timetableApi
      .getTimetableByTeacher(selectedTeacher.id, academicYearId)
      .then(setTimetableEntries)
      .catch(() => toast.error(t("msg_error_timetable")))
      .finally(() => setLoadingTimetable(false))
  }, [selectedTeacher, academicYearId])

  // ── Derived: courses this teacher teaches ────────────────────────────────
  const courseOptions = useMemo((): CourseOption[] => {
    const map = new Map<string, CourseOption>()
    for (const e of timetableEntries) {
      const k = `${e.section_id}|${e.subject_id}`
      if (!map.has(k)) {
        const sectionName = e.section_name || e.section?.name || ""
        const subjectName = e.subject_name || e.subject?.name || ""
        const gradeName =
          e.grade_name ||
          (e.section as { grade?: { name: string }; grade_level?: { name: string } } | undefined)?.grade?.name ||
          (e.section as { grade?: { name: string }; grade_level?: { name: string } } | undefined)?.grade_level?.name ||
          ""
        map.set(k, {
          key: k,
          label: subjectName ? `${subjectName} (${sectionName})` : sectionName,
          sectionId: e.section_id,
          subjectId: e.subject_id,
          gradeName,
          entries: [],
        })
      }
      map.get(k)!.entries.push(e)
    }
    return [...map.values()]
  }, [timetableEntries])

  // ── Derived: period options for selected course + date ───────────────────
  const selectedCourse = useMemo(
    () => courseOptions.find((c) => c.key === selectedCourseKey) ?? null,
    [courseOptions, selectedCourseKey],
  )

  const periodOptions = useMemo(() => {
    if (!selectedCourse) return []
    const dow = jsDateToTimetableDay(dateToJsDay(date))
    // Prefer entries matching the current day-of-week
    const dayEntries = selectedCourse.entries.filter((e) => e.day_of_week === dow)
    if (dayEntries.length > 0) return dayEntries
    // Fallback: all entries
    return selectedCourse.entries
  }, [selectedCourse, date])

  // Auto-pick first period when options change
  useEffect(() => {
    if (periodOptions.length > 0) {
      setPeriodEntryId(periodOptions[0].id)
    } else {
      setPeriodEntryId("")
    }
  }, [periodOptions])

  // ── Load attendance when entry + date ready ───────────────────────────────
  const loadAttendance = useCallback(async () => {
    if (!periodEntryId) { setRows([]); return }
    setLoadingRows(true)
    try {
      const records: AttendanceRecord[] = await timetableApi.getAttendanceForClass(periodEntryId, date)
      setRows(
        records.map((r) => ({
          student_id: r.student_id,
          student_name: r.student_name || r.student_id.slice(0, 8),
          student_number: r.student_number || "",
          status: (r.status === "late" ? "late" : r.status === "present" ? "present" : "absent") as AttendanceStatus,
          remarks: r.remarks ?? "",
          record_id: r.id,
        }))
      )
    } catch {
      // attendance records may not be generated yet
      toast.info(t("msg_no_records_found"))
      setRows([])
    } finally {
      setLoadingRows(false)
    }
  }, [periodEntryId, date])

  useEffect(() => { void loadAttendance() }, [loadAttendance])

  // ── Load evening leaves + EE records ─────────────────────────────────────
  useEffect(() => {
    if (!schoolId || !periodEntryId) return
    eeApi.getEveningLeaves({ school_id: schoolId, date })
      .then(setEveningLeaves)
      .catch(() => {})

    if (checkpointId && checkpointId !== "all") {
      eeApi.getRecords({
        school_id: schoolId,
        checkpoint_id: checkpointId,
        person_type: "STUDENT",
        date_from: date,
        date_to: date,
      })
        .then(setEeRecords)
        .catch(() => {})
    }
  }, [schoolId, periodEntryId, date, checkpointId])

  // ── Row helpers ───────────────────────────────────────────────────────────
  function setRowStatus(studentId: string, status: AttendanceStatus) {
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, status } : r))
    )
  }

  function setRowRemarks(studentId: string, remarks: string) {
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, remarks } : r))
    )
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!periodEntryId) { toast.error(t("msg_error_no_class")); return }
    if (rows.length === 0) { toast.error(t("msg_error_no_students")); return }
    setSaving(true)
    try {
      await timetableApi.bulkUpdateAttendance(
        periodEntryId,
        date,
        rows.map((r) => ({
          student_id: r.student_id,
          status: r.status,
          remarks: r.remarks || undefined,
        }))
      )
      // Create E/E records for PRESENT students if checkpoint selected
      if (checkpointId && checkpointId !== "all") {
        const presentIds = rows.filter((r) => r.status === "present").map((r) => r.student_id)
        if (presentIds.length > 0) {
          await eeApi.createBulkRecords({
            school_id: schoolId,
            checkpoint_id: checkpointId,
            person_ids: presentIds,
            person_type: "STUDENT",
            record_type: recordType,
          })
        }
      }
      toast.success(t("msg_success_saved"))
    } catch (err: unknown) {
      toast.error((err as Error).message || t("msg_error_save"))
    } finally {
      setSaving(false)
    }
  }

  // ── Select teacher ────────────────────────────────────────────────────────
  function selectTeacher(t: Staff) {
    setSelectedTeacher(t)
    setSelectedCourseKey("")
    setRows([])
    setView("attendance")
  }

  // ── Filtered teachers ─────────────────────────────────────────────────────
  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.toLowerCase()
    if (!q) return teachers
    return teachers.filter(
      (t) =>
        teacherName(t).toLowerCase().includes(q) ||
        (t.employee_number || "").toLowerCase().includes(q)
    )
  }, [teachers, teacherSearch])

  // ── Period display info ───────────────────────────────────────────────────
  const selectedEntry = useMemo(
    () => periodOptions.find((e) => e.id === periodEntryId) ?? null,
    [periodOptions, periodEntryId],
  )
  const periodLabel = selectedEntry
    ? selectedEntry.period?.period_number
      ? `${t("label_period")} ${selectedEntry.period.period_number}`
      : selectedEntry.start_time
      ? `${selectedEntry.start_time.slice(0, 5)}–${(selectedEntry.end_time ?? "").slice(0, 5)}`
      : t("label_period")
    : t("label_period")

  const courseInfoLabel = useMemo(() => {
    if (!selectedCourse || !selectedEntry) return ""
    return `${periodLabel} - ${selectedCourse.label} - ${selectedTeacher ? teacherName(selectedTeacher) : ""}`
  }, [selectedCourse, selectedEntry, periodLabel, selectedTeacher])

  // ── Render ────────────────────────────────────────────────────────────────

  // ── View 1: Teacher list ──────────────────────────────────────────────────
  if (view === "teachers") {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("page_title")}
          </h1>
        </div>

        {/* Profile badge */}
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{t("label_profile")}:</span> {t("option_teacher")}
        </p>

        {/* Count + search */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {loadingTeachers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="font-medium text-foreground">{t("stat_teachers_found", { count: filteredTeachers.length })}</span>
                <Download className="h-4 w-4 cursor-pointer hover:text-foreground" />
              </>
            )}
          </div>
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder={t("toolbar_search")}
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="border-0 shadow-sm overflow-hidden">
          {loadingTeachers ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("msg_no_teachers")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="text-xs font-semibold text-blue-600 uppercase">{t("table_col_teacher")}</TableHead>
                  <TableHead className="text-xs font-semibold text-blue-600 uppercase">{t("table_col_id")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/20 border-t"
                    onClick={() => selectTeacher(t)}
                  >
                    <TableCell className="text-sm text-blue-600 hover:underline font-medium py-3">
                      {teacherName(t)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3">
                      {t.employee_number || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    )
  }

  // ── View 2: Attendance ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setView("teachers"); setSelectedTeacher(null) }}
          className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0 hover:bg-red-600 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("page_title")}
        </h1>
      </div>

      {/* Course dropdown */}
      {loadingTimetable ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("msg_loading_courses")}
        </div>
      ) : (
        <Select value={selectedCourseKey} onValueChange={setSelectedCourseKey}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder={t("placeholder_select_course")} />
          </SelectTrigger>
          <SelectContent>
            {courseOptions.length === 0 ? (
              <SelectItem value="__none__" disabled>{t("msg_no_courses")}</SelectItem>
            ) : (
              courseOptions.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {selectedCourseKey && (
        <>
          <div className="border-t pt-4 space-y-4">
            {/* Sub-heading */}
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                <BookOpen className="h-3.5 w-3.5 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">{t("subheading_take_attendance")}</h2>
            </div>

            {/* Course info */}
            {courseInfoLabel && (
              <p className="text-sm font-medium text-muted-foreground">{courseInfoLabel}</p>
            )}

            {/* Checkpoint + Type */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t("label_checkpoint")}:</span>
                <Select value={checkpointId} onValueChange={setCheckpointId}>
                  <SelectTrigger className="w-36 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {checkpoints.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm font-medium">{t("label_type")}:</span>
                <Select value={recordType} onValueChange={(v) => setRecordType(v as "ENTRY" | "EXIT")}>
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRY">{t("type_entry")}</SelectItem>
                    <SelectItem value="EXIT">{t("type_exit")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Period dropdown */}
            {periodOptions.length > 1 && (
              <div className="flex items-center gap-2">
                <Select value={periodEntryId} onValueChange={setPeriodEntryId}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.period
                          ? `${t("label_period")} ${e.period.period_number} (${e.period.start_time?.slice(0, 5) ?? ""}–${e.period.end_time?.slice(0, 5) ?? ""})`
                          : `${e.start_time?.slice(0, 5) ?? ""}–${e.end_time?.slice(0, 5) ?? ""}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {periodOptions.length === 1 && (
              <div>
                <Select value={periodEntryId} onValueChange={setPeriodEntryId}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.period
                          ? `${t("label_period")} ${e.period.period_number} (${e.period.start_time?.slice(0, 5) ?? ""}–${e.period.end_time?.slice(0, 5) ?? ""})`
                          : `${e.start_time?.slice(0, 5) ?? ""}–${e.end_time?.slice(0, 5) ?? ""}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date + Save */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 w-40 text-sm"
                />
                {rows.length > 0 && (
                  <span className="text-sm text-green-600 font-medium">
                    {t("msg_can_edit")}
                  </span>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || rows.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-6"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t("btn_save")}
              </Button>
            </div>

            {/* ATTENDANCE sub-heading */}
            <div className="border-t pt-4">
              <p className="text-center text-sm font-semibold tracking-widest text-blue-600 uppercase pb-2">
                {t("label_attendance")}
              </p>

              {/* Student count */}
              {!loadingRows && rows.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <span className="font-medium text-foreground">{t("stat_students_found", { count: rows.length })}</span>
                  <Download className="h-4 w-4 cursor-pointer hover:text-foreground" />
                </div>
              )}

              {/* Student table */}
              {loadingRows ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {t("msg_no_records")}{" "}
                  {!periodEntryId && t("msg_select_prompt")}
                </div>
              ) : (
                <Card className="border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-white border-b">
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase min-w-40">{t("table_col_student")}</TableHead>
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase">{t("table_col_employee_id")}</TableHead>
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase">{t("table_col_grade")}</TableHead>
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase text-center">{t("status_absent")}</TableHead>
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase text-center">{t("status_present")}</TableHead>
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase text-center">{t("status_late")}</TableHead>
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase min-w-36">{t("table_col_comment")}</TableHead>
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase text-center">{t("table_col_evening_leave")}</TableHead>
                          <TableHead className="text-xs font-semibold text-blue-600 uppercase text-center">{t("table_col_time")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const el = eveningLeaves.find((e) => e.student_id === row.student_id)
                          const eeRec = eeRecords.find((r) => r.person_id === row.student_id)
                          const gradeName = selectedCourse?.gradeName || "—"

                          return (
                            <TableRow
                              key={row.student_id}
                              className={`border-t transition-colors ${
                                row.status === "absent"
                                  ? "bg-red-50/40"
                                  : row.status === "present"
                                  ? "bg-white"
                                  : "bg-amber-50/30"
                              }`}
                            >
                              <TableCell className="text-sm font-medium py-3">{row.student_name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground py-3">{row.student_number || "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground py-3">{gradeName}</TableCell>

                              {/* Absent */}
                              <TableCell className="text-center py-3">
                                <div className="flex justify-center">
                                  <RadioDot
                                    checked={row.status === "absent"}
                                    color="pink"
                                    onClick={() => setRowStatus(row.student_id, "absent")}
                                  />
                                </div>
                              </TableCell>

                              {/* Present */}
                              <TableCell className="text-center py-3">
                                <div className="flex justify-center">
                                  <RadioDot
                                    checked={row.status === "present"}
                                    color="blue"
                                    onClick={() => setRowStatus(row.student_id, "present")}
                                  />
                                </div>
                              </TableCell>

                              {/* Tardy */}
                              <TableCell className="text-center py-3">
                                <div className="flex justify-center">
                                  <RadioDot
                                    checked={row.status === "late"}
                                    color="gray"
                                    onClick={() => setRowStatus(row.student_id, "late")}
                                  />
                                </div>
                              </TableCell>

                              {/* Teacher comment */}
                              <TableCell className="py-2">
                                <Input
                                  className="h-7 text-xs w-full min-w-28"
                                  value={row.remarks}
                                  onChange={(e) => setRowRemarks(row.student_id, e.target.value)}
                                />
                              </TableCell>

                              {/* Evening Leave */}
                              <TableCell className="text-center py-3 text-sm">
                                {el ? (
                                  <span className="text-purple-600 font-medium text-xs">
                                    {el.authorized_return_time?.slice(0, 5) ?? t("label_yes")}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>

                              {/* Time (last EE record) */}
                              <TableCell className="text-center py-3 text-sm">
                                {eeRec ? (
                                  <span className="text-xs font-medium">
                                    {new Date(eeRec.recorded_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Bottom save */}
          {rows.length > 0 && (
            <div className="flex justify-center pt-2 pb-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-10"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t("btn_save")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
