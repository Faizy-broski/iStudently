"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Save,
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  RefreshCw
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import * as timetableApi from "@/lib/api/timetable"
import { TeacherSchedule } from "@/lib/api/teachers"
import { getMarkingPeriods, type MarkingPeriod } from "@/lib/api/marking-periods"
import { useSearchParams, useRouter } from "next/navigation"
import useSWR from "swr"

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

interface ClassInfo {
  id: string
  subject_name: string
  section_name: string
  grade_name: string
  period_number: number
  start_time: string
  end_time: string
  room_number?: string
}

export default function AttendancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const classId = searchParams.get("class")
  const [selectedClassId, setSelectedClassId] = useState(classId || "")

  const [attendanceData, setAttendanceData] = useState<StudentWithAttendance[]>([])
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [todayDate] = useState(new Date().toISOString().split('T')[0])

  const { data: markingPeriods = [], isLoading: periodsLoading } = useSWR(
    selectedCampus?.id ? ["teacher-marking-periods", selectedCampus.id] : null,
    () => getMarkingPeriods(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  // Fetch today's schedule for class selection
  const { data: schedule, isLoading: scheduleLoading } = useSWR(
    profile?.staff_id && selectedDate ? [`teacher-schedule-${profile.staff_id}`, selectedDate] : null,
    async () => {
      if (!profile?.staff_id || !selectedDate) return []
      return await timetableApi.getTeacherSchedule(profile.staff_id, selectedDate)
    },
    { revalidateOnFocus: false }
  )

  const todayClasses = schedule || []
  const selectedClass = useMemo(
    () => todayClasses.find((s: TeacherSchedule) => s.id === selectedClassId) || null,
    [todayClasses, selectedClassId]
  )

  useEffect(() => {
    if (!selectedClassId && todayClasses.length > 0) {
      setSelectedClassId(todayClasses[0].id)
    } else if (
      selectedClassId &&
      todayClasses.length > 0 &&
      !todayClasses.some((cls) => cls.id === selectedClassId)
    ) {
      setSelectedClassId(todayClasses[0].id)
    }
  }, [todayClasses, selectedClassId])

  useEffect(() => {
    if (selectedClassId) {
      router.replace(`/teacher/attendance/take-attendance?class=${selectedClassId}`)
    }
  }, [selectedClassId, router])

  // Load attendance data function
  const loadAttendanceData = useCallback(async () => {
    try {
      if (!selectedClassId) return
      setLoadingAttendance(true)
      
      // Load attendance records for this class and selected date
      const records = await timetableApi.getAttendanceForClass(selectedClassId, selectedDate)
      
      const studentData: StudentWithAttendance[] = records.map((r) => ({
        id: r.id,
        student_id: r.student_id,
        student_name: r.student_name || "Unknown Student",
        student_number: r.student_number || "",
        status: r.status as AttendanceStatus,
        remarks: r.remarks ?? undefined,
        record_id: r.id
      }))
      
      setAttendanceData(studentData)
      
      if (selectedClass) {
        setClassInfo({
          id: selectedClass.id,
          subject_name: selectedClass.subject_name || "Unknown Subject",
          section_name: selectedClass.section_name || "Unknown Section",
          grade_name: selectedClass.grade_name || "Unknown Grade",
          period_number: selectedClass.period_number,
          start_time: selectedClass.start_time,
          end_time: selectedClass.end_time,
          room_number: selectedClass.room_number || undefined
        })
      }
      
      setHasChanges(false)
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load attendance"
      toast.error(errorMessage)
    } finally {
      setLoadingAttendance(false)
    }
  }, [selectedClassId, selectedDate, selectedClass])

  // Fetch attendance data when class is selected
  useEffect(() => {
    if (selectedClassId && schedule) {
      loadAttendanceData()
    }
  }, [selectedClassId, schedule, selectedDate, loadAttendanceData])

  const selectedMarkingPeriod = useMemo(() => {
    return markingPeriods.find((mp: MarkingPeriod) => {
      if (!mp.start_date || !mp.end_date) return false
      return selectedDate >= mp.start_date && selectedDate <= mp.end_date && (mp.mp_type === "QTR" || mp.mp_type === "PRO")
    })
  }, [markingPeriods, selectedDate])

  const allowEdit = useMemo(() => {
    if (!selectedMarkingPeriod) return false
    if (selectedDate > todayDate) return false
    if (selectedMarkingPeriod.post_start_date && selectedMarkingPeriod.post_end_date) {
      return selectedDate >= selectedMarkingPeriod.post_start_date && selectedDate <= selectedMarkingPeriod.post_end_date
    }
    return true
  }, [selectedMarkingPeriod, selectedDate, todayDate])

  // Quick toggle - direct status change
  const setStatus = useCallback((studentId: string, newStatus: AttendanceStatus) => {
    if (!allowEdit) return
    setAttendanceData(prev => prev.map(s => 
      s.student_id === studentId 
        ? { ...s, status: newStatus }
        : s
    ))
    setHasChanges(true)
  }, [allowEdit])

  // Cycle through statuses on tap
  const cycleStatus = useCallback((studentId: string) => {
    if (!allowEdit) return

    setAttendanceData(prev => {
      const student = prev.find(s => s.student_id === studentId)
      if (!student) return prev
      
      const statusCycle: Record<AttendanceStatus, AttendanceStatus> = {
        "present": "absent",
        "absent": "late",
        "late": "present",
        "excused": "present"
      }
      
      return prev.map(s =>
        s.student_id === studentId
          ? { ...s, status: statusCycle[s.status] }
          : s
      )
    })
    setHasChanges(true)
  }, [allowEdit])

  const updateRemarks = useCallback((studentId: string, remarks: string) => {
    if (!allowEdit) return
    setAttendanceData(prev => prev.map(s =>
      s.student_id === studentId ? { ...s, remarks } : s
    ))
    setHasChanges(true)
  }, [allowEdit])

  // Mark all as present
  const markAllPresent = useCallback(() => {
    if (!allowEdit) return
    setAttendanceData(prev => prev.map(s => ({ ...s, status: "present" as AttendanceStatus })))
    setHasChanges(true)
    toast.success("Marked all students as present")
  }, [allowEdit])

  // Mark all as absent
  const markAllAbsent = useCallback(() => {
    if (!allowEdit) return
    setAttendanceData(prev => prev.map(s => ({ ...s, status: "absent" as AttendanceStatus })))
    setHasChanges(true)
    toast.info("Marked all students as absent")
  }, [allowEdit])

  // Save attendance
  const handleSave = async () => {
    if (!allowEdit) {
      toast.error("Attendance cannot be edited for this date.")
      return
    }

    try {
      setSaving(true)
      
      if (!classId) {
        toast.error("No class selected")
        return
      }
      
      const updates = attendanceData.map(record => ({
        student_id: record.student_id,
        status: record.status,
        remarks: record.remarks
      }))
      
      await timetableApi.bulkUpdateAttendance(classId, selectedDate, updates)
      
      setHasChanges(false)
      toast.success("Attendance saved successfully!")
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save attendance"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  // Filter and search students
  const filteredStudents = useMemo(() => attendanceData, [attendanceData])

  // Stats
  const stats = useMemo(() => ({
    total: attendanceData.length,
    present: attendanceData.filter(r => r.status === "present").length,
    absent: attendanceData.filter(r => r.status === "absent").length,
    late: attendanceData.filter(r => r.status === "late").length,
    percentage: attendanceData.length > 0 
      ? Math.round((attendanceData.filter(r => r.status === "present" || r.status === "late").length / attendanceData.length) * 100)
      : 0
  }), [attendanceData])

  const getStatusStyles = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return { bg: "bg-green-50", border: "border-green-500", text: "text-green-700", badge: "bg-green-100 text-green-700 border-green-200" }
      case "absent":
        return { bg: "bg-red-50", border: "border-red-500", text: "text-red-700", badge: "bg-red-100 text-red-700 border-red-200" }
      case "late":
        return { bg: "bg-yellow-50", border: "border-yellow-500", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700 border-yellow-200" }
      case "excused":
        return { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700", badge: "bg-blue-100 text-blue-700 border-blue-200" }
      default:
        return { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-700", badge: "bg-gray-100" }
    }
  }

  // Loading state
  if (scheduleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Loading attendance data
  if (loadingAttendance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Loading attendance...</p>
        </div>
      </div>
    )
  }

  // Main attendance marking view
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/teacher/attendance/take-attendance')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">Mark Attendance</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose a class and date to update attendance.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={loadAttendanceData}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">Select class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select a class for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</option>
              {todayClasses.map((cls: TeacherSchedule) => (
                <option key={cls.id} value={cls.id}>
                  {`Period ${cls.period_number} — ${cls.subject_name} · ${cls.section_name}`}
                </option>
              ))}
            </select>
          </div>

          {selectedClass && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Current class</p>
              <p className="text-lg font-semibold text-slate-900">{selectedClass.subject_name} • {selectedClass.section_name}</p>
              <p className="text-sm text-slate-500">Period {selectedClass.period_number} · {selectedClass.grade_name}</p>
              <p className="text-sm text-slate-500">{selectedClass.start_time?.substring(0, 5)} - {selectedClass.end_time?.substring(0, 5)}{selectedClass.room_number ? ` · Room ${selectedClass.room_number}` : ''}</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className={`text-sm font-medium ${allowEdit ? 'text-green-700' : 'text-red-700'}`}>
              {allowEdit ? 'Editable attendance' : 'Read-only attendance'}
            </p>
            <p className="text-xs text-slate-500">
              {selectedMarkingPeriod?.post_start_date && selectedMarkingPeriod?.post_end_date
                ? `Posting window: ${selectedMarkingPeriod.post_start_date} to ${selectedMarkingPeriod.post_end_date}`
                : 'Attendance is only editable within the current marking period posting window.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={allowEdit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
              {allowEdit ? 'Edit mode' : 'View only'}
            </Badge>
            {selectedMarkingPeriod && (
              <Badge className="bg-blue-100 text-blue-700">
                {selectedMarkingPeriod.mp_type} period
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards - Compact */}
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Studently ID</th>
              <th className="px-4 py-3 font-semibold">Grade Level</th>
              <th className="px-4 py-3 font-semibold text-center">Absent</th>
              <th className="px-4 py-3 font-semibold text-center">Present</th>
              <th className="px-4 py-3 font-semibold text-center">Tardy</th>
              <th className="px-4 py-3 font-semibold">Teacher Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  No students found. Attendance records may not be generated yet.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, index) => (
                <tr key={student.student_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{student.student_name}</div>
                    <div className="text-xs text-slate-500">#{index + 1}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{student.student_number}</td>
                  <td className="px-4 py-3 text-slate-600">{classInfo?.grade_name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name={`status-${student.student_id}`}
                      checked={student.status === 'absent'}
                      disabled={!allowEdit}
                      onChange={() => setStatus(student.student_id, 'absent')}
                      className="h-4 w-4 text-red-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name={`status-${student.student_id}`}
                      checked={student.status === 'present'}
                      disabled={!allowEdit}
                      onChange={() => setStatus(student.student_id, 'present')}
                      className="h-4 w-4 text-green-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name={`status-${student.student_id}`}
                      checked={student.status === 'late'}
                      disabled={!allowEdit}
                      onChange={() => setStatus(student.student_id, 'late')}
                      className="h-4 w-4 text-yellow-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={student.remarks ?? ''}
                      onChange={(e) => updateRemarks(student.student_id, e.target.value)}
                      disabled={!allowEdit}
                      placeholder="Enter comment"
                      className={`${!allowEdit ? 'opacity-70' : ''}`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-500">
          {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'} found.
        </p>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg md:max-w-4xl md:mx-auto md:left-auto md:right-auto md:rounded-t-xl">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges || !allowEdit}
          style={{ background: hasChanges && allowEdit ? 'var(--gradient-blue)' : undefined }}
          className={`w-full h-12 text-lg font-semibold ${
            hasChanges && allowEdit ? 'text-white shadow-lg' : ''
          }`}
          variant={hasChanges && allowEdit ? "default" : "outline"}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving Attendance...
            </>
          ) : hasChanges ? (
            <>
              <Save className="h-5 w-5 mr-2" />
              Save Attendance ({stats.present} Present, {stats.absent} Absent)
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5 mr-2" />
              All Changes Saved
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
