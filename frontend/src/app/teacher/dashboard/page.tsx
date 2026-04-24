"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  BookOpen,
  ClipboardList,
  ArrowRight,
  MapPin,
  GraduationCap,
  Play,
  SkipForward,
  LayoutGrid,
  UserCheck,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import * as timetableApi from "@/lib/api/timetable"
import * as coursesApi from "@/lib/api/courses"
import useSWR from "swr"

// ─── local types ─────────────────────────────────────────────────────────────

interface ScheduleEntry {
  id: string
  period_number: number
  start_time: string
  end_time: string
  subject_name: string | null
  section_name: string | null
  grade_name: string | null
  room_number: string | null
}

interface AttendanceOverviewItem {
  period_number: number
  stats?: {
    total_students?: number
    present?: number
    absent?: number
    late?: number
    percentage?: number
  }
}

interface ClassItem {
  id: string
  subject_name: string
  section_name: string
  grade_name: string
  period_number: number
  start_time: string
  end_time: string
  room_number?: string
  status: "completed" | "in-progress" | "upcoming"
  attendanceMarked?: boolean
  attendanceStats?: {
    present: number
    absent: number
    late: number
    total: number
    percentage: number
  }
}

// ─── component ───────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const router = useRouter()
  const { profile, loading: authLoading, profileFetchPending } = useAuth()
  const { selectedCoursePeriod } = useAcademic()
  const [currentTime, setCurrentTime] = useState(new Date())
  const todayDate = new Date().toISOString().split("T")[0]
  const [staffIdGracePeriod, setStaffIdGracePeriod] = useState(true)

  // ── Grace period for staff_id ──
  useEffect(() => {
    if (profile && !profile.staff_id && staffIdGracePeriod) {
      const timer = setTimeout(() => setStaffIdGracePeriod(false), 3000)
      return () => clearTimeout(timer)
    }
    if (profile?.staff_id) setStaffIdGracePeriod(false)
  }, [profile, profile?.staff_id, staffIdGracePeriod])

  // ── Clock ──
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // ── Students for the sidebar-selected course period ──
  const { data: students, isLoading: studentsLoading } = useSWR(
    selectedCoursePeriod?.id ? `cp-students-${selectedCoursePeriod.id}` : null,
    () => coursesApi.getCoursePeriodStudents(selectedCoursePeriod!.id),
    { revalidateOnFocus: false }
  )

  // ── Today's timetable schedule ──
  const { data: schedule, isLoading: scheduleLoading } = useSWR(
    profile?.staff_id ? `teacher-schedule-${profile.staff_id}-${todayDate}` : null,
    () => timetableApi.getTeacherSchedule(profile!.staff_id!, todayDate),
    { revalidateOnFocus: false, refreshInterval: 300000 }
  )

  const { data: attendanceOverview } = useSWR(
    profile?.staff_id ? `teacher-overview-${profile.staff_id}-${todayDate}` : null,
    () => timetableApi.getTeacherAttendanceOverview(profile!.staff_id!, todayDate),
    { revalidateOnFocus: false }
  )

  // ── Processed today's classes ──
  const processedClasses: ClassItem[] = useMemo(() => {
    if (!schedule) return []
    const nowStr = currentTime.toTimeString().substring(0, 5)

    return (schedule as ScheduleEntry[])
      .map((cls) => {
        let status: ClassItem["status"] = "upcoming"
        if (cls.end_time < nowStr) status = "completed"
        else if (cls.start_time <= nowStr && nowStr < cls.end_time) status = "in-progress"

        const ov = (attendanceOverview as AttendanceOverviewItem[] | undefined)?.find(
          (a) => a.period_number === cls.period_number
        )
        return {
          id: cls.id,
          subject_name: cls.subject_name || "Unknown Subject",
          section_name: cls.section_name || "Unknown Section",
          grade_name: cls.grade_name || "Unknown Grade",
          period_number: cls.period_number,
          start_time: cls.start_time,
          end_time: cls.end_time,
          room_number: cls.room_number || undefined,
          status,
          attendanceMarked: (ov?.stats?.total_students ?? 0) > 0,
          attendanceStats: ov?.stats
            ? {
                present: ov.stats.present || 0,
                absent: ov.stats.absent || 0,
                late: ov.stats.late || 0,
                total: ov.stats.total_students || 0,
                percentage: ov.stats.percentage || 0,
              }
            : undefined,
        }
      })
      .sort((a, b) => a.period_number - b.period_number)
  }, [schedule, attendanceOverview, currentTime])

  const currentClass = useMemo(
    () => processedClasses.find((c) => c.status === "in-progress"),
    [processedClasses]
  )
  const nextClass = useMemo(
    () => processedClasses.find((c) => c.status === "upcoming"),
    [processedClasses]
  )

  const stats = useMemo(() => {
    const completed = processedClasses.filter((c) => c.status === "completed").length
    const withAtt = processedClasses.filter((c) => c.attendanceStats)
    const totalStudents = withAtt.reduce((s, c) => s + (c.attendanceStats?.total || 0), 0)
    const totalPresent = withAtt.reduce(
      (s, c) => s + (c.attendanceStats?.present || 0) + (c.attendanceStats?.late || 0),
      0
    )
    return {
      todayClasses: processedClasses.length,
      completedClasses: completed,
      remainingClasses: processedClasses.filter((c) => c.status === "upcoming").length,
      pendingAttendance: Math.max(0, completed - withAtt.length),
      attendancePercentage:
        totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0,
    }
  }, [processedClasses])

  const navigateToAttendance = (classId?: string) =>
    router.push(classId ? `/teacher/attendance?class=${classId}` : "/teacher/attendance")

  const formatTime = (t?: string) => t?.substring(0, 5) ?? ""

  // ── Guards ──
  if (authLoading || !profile || profileFetchPending || (scheduleLoading && !schedule)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!profile?.staff_id && staffIdGracePeriod) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!profile?.staff_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-center text-lg font-medium">Not authorized as teacher</p>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Please ensure your account has teacher privileges
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">
            Teacher Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {profile?.first_name} {profile?.last_name}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-[#022172]">
            {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <p className="text-xs text-muted-foreground">
            {currentTime.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats.todayClasses}</p>
                <p className="text-xs text-blue-600">Today&apos;s Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{stats.attendancePercentage}%</p>
                <p className="text-xs text-green-600">Attendance Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">{stats.pendingAttendance}</p>
                <p className="text-xs text-orange-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-600 flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats.remainingClasses}</p>
                <p className="text-xs text-purple-600">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Student Roster (driven by sidebar course period selection) ── */}
      <Card className="border-[#022172]/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-[#022172]">
              <BookOpen className="h-5 w-5" />
              {selectedCoursePeriod
                ? (selectedCoursePeriod.short_name || selectedCoursePeriod.title || "Course Period")
                : "Course Period"}
              {selectedCoursePeriod?.course_title &&
                selectedCoursePeriod.course_title !== (selectedCoursePeriod.short_name || selectedCoursePeriod.title) && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    — {selectedCoursePeriod.course_title}
                  </span>
                )}
              {students && selectedCoursePeriod && (
                <Badge variant="secondary" className="ml-1">
                  {students.length} students
                </Badge>
              )}
            </CardTitle>
            {selectedCoursePeriod && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    `/teacher/attendance/take-attendance?course_period_id=${selectedCoursePeriod.id}`
                  )
                }
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Take Attendance
              </Button>
            )}
          </div>
          {selectedCoursePeriod?.section_name && (
            <p className="text-sm text-muted-foreground">
              {selectedCoursePeriod.section_name}
              {selectedCoursePeriod.grade_name && ` — ${selectedCoursePeriod.grade_name}`}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!selectedCoursePeriod ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-25" />
              <p className="font-medium">No course period selected</p>
              <p className="text-sm mt-1">
                Use the sidebar to select an Academic Year, Quarter, and Course Period
              </p>
            </div>
          ) : studentsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !students?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No students enrolled in this course period</p>
            </div>
          ) : (
            <div className="rounded-lg border divide-y max-h-80 overflow-y-auto">
              {students.map((student, idx) => (
                <div
                  key={student.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-[#022172]/10 flex items-center justify-center text-xs font-bold text-[#022172] shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {student.profile?.first_name} {student.profile?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{student.student_number}</p>
                  </div>
                  {student.profile?.email && (
                    <p className="text-xs text-muted-foreground hidden sm:block truncate max-w-[180px]">
                      {student.profile.email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Current Class ── */}
      {currentClass ? (
        <Card className="border-2 border-green-500 shadow-lg overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="h-5 w-5 text-green-600" />
                Current Class
              </CardTitle>
              <Badge className="bg-green-600 text-white animate-pulse">● In Progress</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-3 flex-1">
                <div>
                  <h2 className="text-2xl font-bold text-[#022172]">{currentClass.subject_name}</h2>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Users className="h-4 w-4" />
                    {currentClass.section_name}
                    <span>•</span>
                    <GraduationCap className="h-4 w-4" />
                    {currentClass.grade_name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {formatTime(currentClass.start_time)} – {formatTime(currentClass.end_time)}
                    </span>
                  </div>
                  <Badge variant="outline">Period {currentClass.period_number}</Badge>
                  {currentClass.room_number && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>Room {currentClass.room_number}</span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                onClick={() => navigateToAttendance(currentClass.id)}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white h-16 px-8 text-lg"
              >
                <CheckCircle className="h-6 w-6 mr-2" />
                Mark Attendance
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No class in progress right now</p>
            <p className="text-sm text-muted-foreground mt-2">
              {nextClass
                ? `Next class: ${nextClass.subject_name} at ${formatTime(nextClass.start_time)}`
                : "No more classes today"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Next Class ── */}
      {nextClass && !currentClass && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-lg bg-blue-600 flex flex-col items-center justify-center text-white">
                  <SkipForward className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Class</p>
                  <h3 className="text-xl font-bold">{nextClass.subject_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {nextClass.section_name} • Starts at {formatTime(nextClass.start_time)}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                Period {nextClass.period_number}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Today's Schedule ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today&apos;s Schedule
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push("/teacher/timetable")}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Full Timetable
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {processedClasses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No classes scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {processedClasses.map((cls) => (
                <div
                  key={cls.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                    cls.status === "in-progress"
                      ? "border-green-500 bg-green-50"
                      : cls.status === "completed"
                      ? cls.attendanceMarked
                        ? "border-gray-200 bg-gray-50"
                        : "border-orange-300 bg-orange-50"
                      : "border-blue-200 hover:border-blue-400"
                  }`}
                  onClick={() => navigateToAttendance(cls.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`h-12 w-12 rounded-lg flex flex-col items-center justify-center text-white ${
                        cls.status === "in-progress"
                          ? "bg-green-600"
                          : cls.status === "completed"
                          ? "bg-gray-500"
                          : "bg-blue-600"
                      }`}
                    >
                      <span className="text-xs">P</span>
                      <span className="text-lg font-bold">{cls.period_number}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{cls.subject_name}</h3>
                        {cls.status === "in-progress" && (
                          <Badge className="bg-green-600 text-white text-xs">
                            <span className="animate-pulse mr-1">●</span> Now
                          </Badge>
                        )}
                        {cls.status === "completed" && !cls.attendanceMarked && (
                          <Badge variant="outline" className="border-orange-500 text-orange-600 text-xs">
                            Attendance Pending
                          </Badge>
                        )}
                        {cls.attendanceMarked && (
                          <Badge variant="outline" className="border-green-500 text-green-600 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Marked
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {cls.section_name} • {cls.grade_name}
                      </p>
                      {cls.attendanceStats && (
                        <p className="text-xs text-green-600 mt-1">
                          {cls.attendanceStats.present + cls.attendanceStats.late}/
                          {cls.attendanceStats.total} Present ({cls.attendanceStats.percentage}%)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="font-medium text-sm">
                        {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                      </p>
                      {cls.room_number && (
                        <p className="text-xs text-muted-foreground">Room {cls.room_number}</p>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-green-50 hover:border-green-300"
              onClick={() => navigateToAttendance(currentClass?.id || nextClass?.id)}
            >
              <CheckCircle className="h-6 w-6 text-green-600" />
              <span className="text-sm">Mark Attendance</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
              onClick={() => router.push("/teacher/timetable")}
            >
              <Calendar className="h-6 w-6 text-blue-600" />
              <span className="text-sm">Timetable</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300"
              onClick={() => router.push("/teacher/subjects")}
            >
              <BookOpen className="h-6 w-6 text-purple-600" />
              <span className="text-sm">My Subjects</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-orange-50 hover:border-orange-300"
              onClick={() => router.push("/teacher/assignments")}
            >
              <ClipboardList className="h-6 w-6 text-orange-600" />
              <span className="text-sm">Assignments</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
