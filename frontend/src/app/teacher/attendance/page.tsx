"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Search, 
  Loader2, 
  Save, 
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  RefreshCw,
  UserCheck,
  UserX
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import * as timetableApi from "@/lib/api/timetable"
import { TeacherSchedule } from "@/lib/api/teachers"
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
  const classId = searchParams.get("class")

  const [attendanceData, setAttendanceData] = useState<StudentWithAttendance[]>([])
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | "all">("all")
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [todayDate] = useState(new Date().toISOString().split('T')[0])

  // Fetch today's schedule for class selection
  const { data: schedule, isLoading: scheduleLoading } = useSWR(
    profile?.staff_id ? `teacher-schedule-${profile.staff_id}` : null,
    async () => {
      if (!profile?.staff_id) return []
      return await timetableApi.getTeacherSchedule(profile.staff_id, todayDate)
    },
    { revalidateOnFocus: false }
  )

  const todayClasses = schedule || []

  // Load attendance data function
  const loadAttendanceData = useCallback(async () => {
    try {
      if (!classId) return
      setLoadingAttendance(true)
      
      // Load attendance records for this class today
      const records = await timetableApi.getAttendanceForClass(classId, todayDate)
      
      // Transform records to our component state
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
      
      // Find class info from schedule
      const selectedClass = schedule?.find((s: TeacherSchedule) => s.id === classId)
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
  }, [classId, schedule, todayDate])

  // Fetch attendance data when class is selected
  useEffect(() => {
    if (classId && schedule) {
      loadAttendanceData()
    }
  }, [classId, schedule, loadAttendanceData])

  // Quick toggle - direct status change
  const setStatus = useCallback((studentId: string, newStatus: AttendanceStatus) => {
    setAttendanceData(prev => prev.map(s => 
      s.student_id === studentId 
        ? { ...s, status: newStatus }
        : s
    ))
    setHasChanges(true)
  }, [])

  // Cycle through statuses on tap
  const cycleStatus = useCallback((studentId: string) => {
    setAttendanceData(prev => {
      const student = prev.find(s => s.student_id === studentId)
      if (!student) return prev
      
      // Cycle: present → absent → late → present
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
  }, [])

  // Mark all as present
  const markAllPresent = useCallback(() => {
    setAttendanceData(prev => prev.map(s => ({ ...s, status: "present" as AttendanceStatus })))
    setHasChanges(true)
    toast.success("Marked all students as present")
  }, [])

  // Mark all as absent
  const markAllAbsent = useCallback(() => {
    setAttendanceData(prev => prev.map(s => ({ ...s, status: "absent" as AttendanceStatus })))
    setHasChanges(true)
    toast.info("Marked all students as absent")
  }, [])

  // Save attendance
  const handleSave = async () => {
    try {
      setSaving(true)
      
      if (!classId) {
        toast.error("No class selected")
        return
      }
      
      // Prepare bulk update data
      const updates = attendanceData.map(record => ({
        student_id: record.student_id,
        status: record.status,
        remarks: record.remarks
      }))
      
      await timetableApi.bulkUpdateAttendance(classId, todayDate, updates)
      
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
  const filteredStudents = useMemo(() => {
    return attendanceData.filter(student => {
      const matchesSearch = student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.student_number.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filterStatus === "all" || student.status === filterStatus
      return matchesSearch && matchesFilter
    })
  }, [attendanceData, searchQuery, filterStatus])

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

  // No class selected - show class picker
  if (!classId) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/teacher/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">Mark Attendance</h1>
            <p className="text-muted-foreground mt-1">Select a class from today&apos;s schedule</p>
          </div>
        </div>

        {/* Today's date */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-sm text-blue-700">
                  {todayClasses.length} {todayClasses.length === 1 ? 'class' : 'classes'} scheduled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class List */}
        {todayClasses.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Classes Today</h3>
            <p className="text-muted-foreground">You don&apos;t have any classes scheduled for today.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {todayClasses.map((cls: TeacherSchedule, index: number) => {
              const now = new Date()
              const currentTime = now.toTimeString().split(' ')[0].substring(0, 5)
              const isInProgress = cls.start_time <= currentTime && currentTime < cls.end_time
              const isCompleted = cls.end_time < currentTime
              
              return (
                <Card 
                  key={cls.id || index}
                  className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                    isInProgress ? 'border-green-500 bg-green-50' : 
                    isCompleted ? 'border-gray-300' : 'border-blue-200 hover:border-blue-400'
                  }`}
                  onClick={() => router.push(`/teacher/attendance?class=${cls.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`h-14 w-14 rounded-lg flex flex-col items-center justify-center ${
                          isInProgress ? 'bg-green-600' : 'bg-blue-600'
                        } text-white`}>
                          <span className="text-xs">Period</span>
                          <span className="text-xl font-bold">{cls.period_number}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{cls.subject_name}</h3>
                            {isInProgress && (
                              <Badge className="bg-green-600 text-white">
                                <span className="animate-pulse mr-1">●</span> Now
                              </Badge>
                            )}
                            {isCompleted && (
                              <Badge variant="outline" className="text-gray-500">Completed</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" /> {cls.section_name}
                            </span>
                            <span className="mx-2">•</span>
                            <span>{cls.grade_name}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">
                          {cls.start_time?.substring(0, 5)} - {cls.end_time?.substring(0, 5)}
                        </p>
                        {cls.room_number && (
                          <p className="text-xs text-muted-foreground">Room {cls.room_number}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/teacher/attendance')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">Mark Attendance</h1>
          {classInfo && (
            <p className="text-sm text-muted-foreground">
              {classInfo.subject_name} • {classInfo.section_name} • Period {classInfo.period_number}
            </p>
          )}
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

      {/* Class Info Card */}
      {classInfo && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold">{classInfo.subject_name}</p>
                  <p className="text-sm text-muted-foreground">{classInfo.section_name} - {classInfo.grade_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{classInfo.start_time?.substring(0,5)} - {classInfo.end_time?.substring(0,5)}</p>
                {classInfo.room_number && <p className="text-xs text-muted-foreground">Room {classInfo.room_number}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as AttendanceStatus | "all")} className="w-auto">
          <TabsList className="h-10">
            <TabsTrigger value="all" className="px-3">All</TabsTrigger>
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

      {/* Instruction */}
      <p className="text-xs text-center text-muted-foreground">
        Tap on a student to cycle status: Present → Absent → Late → Present | Or use the quick buttons
      </p>

      {/* Student List */}
      {attendanceData.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-3" />
          <h3 className="font-semibold mb-1">No Students Found</h3>
          <p className="text-sm text-muted-foreground">
            Attendance records may not be generated yet. Please contact admin.
          </p>
        </Card>
      ) : (
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
                    {/* Serial Number */}
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    
                    {/* Student Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{student.student_name}</p>
                      <p className="text-xs text-muted-foreground">{student.student_number}</p>
                    </div>
                    
                    {/* Quick Status Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatus(student.student_id, "present"); }}
                        className={`p-2 rounded-lg transition-colors ${
                          student.status === "present" ? "bg-green-200" : "hover:bg-green-100"
                        }`}
                        title="Mark Present"
                      >
                        <CheckCircle className={`h-5 w-5 ${student.status === "present" ? "text-green-600" : "text-gray-400"}`} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatus(student.student_id, "absent"); }}
                        className={`p-2 rounded-lg transition-colors ${
                          student.status === "absent" ? "bg-red-200" : "hover:bg-red-100"
                        }`}
                        title="Mark Absent"
                      >
                        <XCircle className={`h-5 w-5 ${student.status === "absent" ? "text-red-600" : "text-gray-400"}`} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatus(student.student_id, "late"); }}
                        className={`p-2 rounded-lg transition-colors ${
                          student.status === "late" ? "bg-yellow-200" : "hover:bg-yellow-100"
                        }`}
                        title="Mark Late"
                      >
                        <Clock className={`h-5 w-5 ${student.status === "late" ? "text-yellow-600" : "text-gray-400"}`} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Floating Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg md:max-w-4xl md:mx-auto md:left-auto md:right-auto md:rounded-t-xl">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          style={{ background: hasChanges ? 'var(--gradient-blue)' : undefined }}
          className={`w-full h-12 text-lg font-semibold ${
            hasChanges ? 'text-white shadow-lg' : ''
          }`}
          variant={hasChanges ? "default" : "outline"}
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
