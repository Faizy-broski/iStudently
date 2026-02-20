"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  Loader2,
  Save,
  BookOpen,
  Calendar,
  RefreshCw,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import * as timetableApi from "@/lib/api/timetable"
import * as academicsApi from "@/lib/api/academics"
import type { TimetableEntry, AttendanceRecord } from "@/lib/api/timetable"

type AttendanceStatus = "present" | "absent" | "late" | "excused"

interface StudentWithAttendance {
  id: string
  student_id: string
  student_name: string
  student_number: string
  status: AttendanceStatus
  remarks?: string
  record_id?: string
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00")
  const jsDay = d.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export default function AdminTakeAttendancePage() {
  useAuth()
  useCampus()

  const { gradeLevels } = useGradeLevels()
  const { sections } = useSections()

  // Date state
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
  const [selectedDate, setSelectedDate] = useState(todayStr)

  // Filter state
  const [selectedGrade, setSelectedGrade] = useState("")
  const [selectedSection, setSelectedSection] = useState("")
  const [selectedSlot, setSelectedSlot] = useState("")

  // Timetable
  const [academicYear, setAcademicYear] = useState<academicsApi.AcademicYear | null>(null)
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([])
  const [loadingTimetable, setLoadingTimetable] = useState(false)

  // Attendance marking state
  const [attendanceData, setAttendanceData] = useState<StudentWithAttendance[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | "all">("all")

  // Filtered sections by grade
  const filteredSections = useMemo(() => {
    if (!selectedGrade) return []
    return sections.filter((s) => s.grade_level_id === selectedGrade && s.is_active)
  }, [sections, selectedGrade])

  // Get timetable slots for selected day
  const daySlots = useMemo(() => {
    const dayOfWeek = getDayOfWeek(selectedDate)
    return timetableEntries
      .filter((e) => e.day_of_week === dayOfWeek)
      .sort((a, b) => (a.period_number || 0) - (b.period_number || 0))
  }, [timetableEntries, selectedDate])

  // Selected timetable entry
  const selectedTimetableEntry = useMemo(() => {
    if (!selectedSlot) return null
    return daySlots.find((e) => e.id === selectedSlot) || null
  }, [daySlots, selectedSlot])

  // Navigate date
  const navigateDate = useCallback(
    (delta: number) => {
      const d = new Date(selectedDate + "T00:00:00")
      d.setDate(d.getDate() + delta)
      setSelectedDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      )
    },
    [selectedDate]
  )

  // Load academic year
  useEffect(() => {
    const load = async () => {
      try {
        const ay = await academicsApi.getCurrentAcademicYear()
        setAcademicYear(ay)
      } catch {
        /* ignore */
      }
    }
    void load()
  }, [])

  // Load timetable when section changes
  useEffect(() => {
    if (!selectedSection || !academicYear?.id) {
      setTimetableEntries([])
      return
    }
    const load = async () => {
      setLoadingTimetable(true)
      try {
        const entries = await timetableApi.getTimetableBySection(selectedSection, academicYear.id)
        setTimetableEntries(entries)
      } catch {
        setTimetableEntries([])
      } finally {
        setLoadingTimetable(false)
      }
    }
    void load()
  }, [selectedSection, academicYear?.id])

  // Load attendance for selected slot
  const loadAttendanceData = useCallback(async () => {
    if (!selectedSlot) return
    setLoadingAttendance(true)
    try {
      const records: AttendanceRecord[] = await timetableApi.getAttendanceForClass(selectedSlot, selectedDate)
      const studentData: StudentWithAttendance[] = records.map((r) => ({
        id: r.id,
        student_id: r.student_id,
        student_name: r.student_name || "Unknown Student",
        student_number: r.student_number || "",
        status: r.status as AttendanceStatus,
        remarks: r.remarks ?? undefined,
        record_id: r.id,
      }))
      setAttendanceData(studentData)
      setHasChanges(false)
    } catch {
      toast.error("Failed to load attendance. Records may not be generated yet.")
      setAttendanceData([])
    } finally {
      setLoadingAttendance(false)
    }
  }, [selectedSlot, selectedDate])

  useEffect(() => {
    if (selectedSlot) {
      void loadAttendanceData()
    } else {
      setAttendanceData([])
    }
  }, [selectedSlot, loadAttendanceData])

  // Reset section/slot when grade changes
  useEffect(() => {
    setSelectedSection("")
    setSelectedSlot("")
  }, [selectedGrade])

  // Reset slot when date changes
  useEffect(() => {
    setSelectedSlot("")
  }, [selectedDate])

  // Toggle status
  const setStatus = useCallback((studentId: string, newStatus: AttendanceStatus) => {
    setAttendanceData((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, status: newStatus } : s))
    )
    setHasChanges(true)
  }, [])

  const cycleStatus = useCallback((studentId: string) => {
    setAttendanceData((prev) => {
      const student = prev.find((s) => s.student_id === studentId)
      if (!student) return prev
      const cycle: Record<AttendanceStatus, AttendanceStatus> = {
        present: "absent",
        absent: "late",
        late: "present",
        excused: "present",
      }
      return prev.map((s) =>
        s.student_id === studentId ? { ...s, status: cycle[s.status] } : s
      )
    })
    setHasChanges(true)
  }, [])

  const markAllPresent = useCallback(() => {
    setAttendanceData((prev) => prev.map((s) => ({ ...s, status: "present" as AttendanceStatus })))
    setHasChanges(true)
    toast.success("Marked all students as present")
  }, [])

  const markAllAbsent = useCallback(() => {
    setAttendanceData((prev) => prev.map((s) => ({ ...s, status: "absent" as AttendanceStatus })))
    setHasChanges(true)
    toast.info("Marked all students as absent")
  }, [])

  const handleSave = async () => {
    if (!selectedSlot) {
      toast.error("No class selected")
      return
    }
    setSaving(true)
    try {
      const updates = attendanceData.map((record) => ({
        student_id: record.student_id,
        status: record.status,
        remarks: record.remarks,
      }))
      await timetableApi.bulkUpdateAttendance(selectedSlot, selectedDate, updates)
      setHasChanges(false)
      toast.success("Attendance saved successfully!")
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to save attendance"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Filter and search
  const filteredStudents = useMemo(() => {
    return attendanceData.filter((student) => {
      const matchesSearch =
        student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.student_number.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filterStatus === "all" || student.status === filterStatus
      return matchesSearch && matchesFilter
    })
  }, [attendanceData, searchQuery, filterStatus])

  // Stats
  const stats = useMemo(
    () => ({
      total: attendanceData.length,
      present: attendanceData.filter((r) => r.status === "present").length,
      absent: attendanceData.filter((r) => r.status === "absent").length,
      late: attendanceData.filter((r) => r.status === "late").length,
      percentage:
        attendanceData.length > 0
          ? Math.round(
              ((attendanceData.filter((r) => r.status === "present" || r.status === "late").length) /
                attendanceData.length) *
                100
            )
          : 0,
    }),
    [attendanceData]
  )

  const getStatusStyles = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return { border: "border-green-500", bg: "bg-green-50" }
      case "absent":
        return { border: "border-red-500", bg: "bg-red-50" }
      case "late":
        return { border: "border-yellow-500", bg: "bg-yellow-50" }
      case "excused":
        return { border: "border-blue-500", bg: "bg-blue-50" }
      default:
        return { border: "border-gray-300", bg: "bg-gray-50" }
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white">Take Attendance</h1>
        <p className="text-muted-foreground mt-1">
          Select a date, grade, section and period to take attendance
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#022172]" />
            Select Class
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm w-full max-w-48 mx-auto block"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(selectedDate)} — {DAY_NAMES[getDayOfWeek(selectedDate)]}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Grade + Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Select Grade" />
              </SelectTrigger>
              <SelectContent>
                {gradeLevels.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedSection}
              onValueChange={(v) => {
                setSelectedSection(v)
                setSelectedSlot("")
              }}
              disabled={!selectedGrade}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Section" />
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

          {/* Timetable Slots */}
          {selectedSection && (
            <div>
              <p className="text-sm font-medium mb-2 text-muted-foreground">
                Timetable Slots for {DAY_NAMES[getDayOfWeek(selectedDate)]}
              </p>
              {loadingTimetable ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading timetable...</span>
                </div>
              ) : daySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No classes scheduled for this day and section.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {daySlots.map((slot) => (
                    <Card
                      key={slot.id}
                      className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                        selectedSlot === slot.id
                          ? "border-[#022172] bg-blue-50"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                      onClick={() => setSelectedSlot(slot.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-lg flex flex-col items-center justify-center text-white ${
                              selectedSlot === slot.id ? "bg-[#022172]" : "bg-blue-600"
                            }`}
                          >
                            <span className="text-[10px]">P</span>
                            <span className="text-sm font-bold leading-none">{slot.period_number}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{slot.subject_name || "—"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {slot.teacher_name || "No teacher"} • {slot.start_time?.substring(0, 5)}-
                              {slot.end_time?.substring(0, 5)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Marking Section */}
      {selectedSlot && (
        <>
          {/* Class Info */}
          {selectedTimetableEntry && (
            <Card className="bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold">{selectedTimetableEntry.subject_name || "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTimetableEntry.section_name} • Period{" "}
                        {selectedTimetableEntry.period_number} •{" "}
                        {selectedTimetableEntry.teacher_name || "No teacher"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {selectedTimetableEntry.start_time?.substring(0, 5)} -{" "}
                      {selectedTimetableEntry.end_time?.substring(0, 5)}
                    </p>
                    <Button variant="outline" size="icon" onClick={loadAttendanceData} title="Refresh">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {loadingAttendance ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : attendanceData.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-3" />
              <h3 className="font-semibold mb-1">No Attendance Records</h3>
              <p className="text-sm text-muted-foreground">
                Attendance records may not be generated for this date yet. Try generating daily attendance
                first.
              </p>
            </Card>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-5 gap-2">
                <Card className="border-gray-200">
                  <CardContent className="py-3 px-2 text-center">
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="py-3 px-2 text-center">
                    <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                    <p className="text-xs text-green-700">Present</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="py-3 px-2 text-center">
                    <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                    <p className="text-xs text-red-700">Absent</p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="py-3 px-2 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
                    <p className="text-xs text-yellow-700">Late</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="py-3 px-2 text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.percentage}%</p>
                    <p className="text-xs text-blue-700">Rate</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={markAllPresent} className="flex-1 sm:flex-none">
                  <UserCheck className="h-4 w-4 mr-1" />
                  All Present
                </Button>
                <Button variant="outline" size="sm" onClick={markAllAbsent} className="flex-1 sm:flex-none">
                  <UserX className="h-4 w-4 mr-1" />
                  All Absent
                </Button>
              </div>

              {/* Search + Filter */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Tabs
                  value={filterStatus}
                  onValueChange={(v) => setFilterStatus(v as AttendanceStatus | "all")}
                  className="w-auto"
                >
                  <TabsList className="h-10">
                    <TabsTrigger value="all" className="px-3">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="present" className="px-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </TabsTrigger>
                    <TabsTrigger value="absent" className="px-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                    </TabsTrigger>
                    <TabsTrigger value="late" className="px-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Tap a student to cycle: Present → Absent → Late | Or use the quick buttons
              </p>

              {/* Student List */}
              <div className="space-y-2">
                {filteredStudents.map((student, index) => {
                  const styles = getStatusStyles(student.status)
                  return (
                    <Card
                      key={student.student_id}
                      className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${styles.border} ${styles.bg}`}
                      onClick={() => cycleStatus(student.student_id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{student.student_name}</p>
                            <p className="text-xs text-muted-foreground">{student.student_number}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setStatus(student.student_id, "present")
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                student.status === "present" ? "bg-green-200" : "hover:bg-green-100"
                              }`}
                              title="Present"
                            >
                              <CheckCircle
                                className={`h-5 w-5 ${
                                  student.status === "present" ? "text-green-600" : "text-gray-400"
                                }`}
                              />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setStatus(student.student_id, "absent")
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                student.status === "absent" ? "bg-red-200" : "hover:bg-red-100"
                              }`}
                              title="Absent"
                            >
                              <XCircle
                                className={`h-5 w-5 ${
                                  student.status === "absent" ? "text-red-600" : "text-gray-400"
                                }`}
                              />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setStatus(student.student_id, "late")
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                student.status === "late" ? "bg-yellow-200" : "hover:bg-yellow-100"
                              }`}
                              title="Late"
                            >
                              <Clock
                                className={`h-5 w-5 ${
                                  student.status === "late" ? "text-yellow-600" : "text-gray-400"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2 pb-4">
                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className={
                    hasChanges
                      ? "bg-linear-to-r from-[#57A3CC] to-[#022172] text-white px-8"
                      : "px-8"
                  }
                  variant={hasChanges ? "default" : "outline"}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : hasChanges ? (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Attendance ({stats.present}P / {stats.absent}A / {stats.late}L)
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      All Changes Saved
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
