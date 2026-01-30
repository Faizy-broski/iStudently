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
  LayoutGrid
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import * as timetableApi from "@/lib/api/timetable"
import useSWR from "swr"

interface DashboardStats {
  todayClasses: number
  completedClasses: number
  remainingClasses: number
  inProgressClasses: number
  totalStudents: number
  attendanceMarked: number
  attendancePercentage: number
  pendingAttendance: number
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
  status: 'completed' | 'in-progress' | 'upcoming'
  attendanceMarked?: boolean
  attendanceStats?: {
    present: number
    absent: number
    late: number
    total: number
    percentage: number
  }
}

export default function TeacherDashboard() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())
  const todayDate = new Date().toISOString().split('T')[0]

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Fetch today's schedule
  const { data: schedule, isLoading: scheduleLoading } = useSWR(
    profile?.staff_id ? `teacher-schedule-${profile.staff_id}-${todayDate}` : null,
    async () => {
      if (!profile?.staff_id) return []
      return await timetableApi.getTeacherSchedule(profile.staff_id, todayDate)
    },
    { 
      revalidateOnFocus: false,
      refreshInterval: 300000 // Refresh every 5 minutes
    }
  )

  // Fetch attendance overview
  const { data: attendanceOverview, isLoading: overviewLoading } = useSWR(
    profile?.staff_id ? `teacher-overview-${profile.staff_id}-${todayDate}` : null,
    async () => {
      if (!profile?.staff_id) return []
      return await timetableApi.getTeacherAttendanceOverview(profile.staff_id, todayDate)
    },
    { revalidateOnFocus: false }
  )

  // Define TeacherSchedule type for local use
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
    }
  }

  // Process classes with status
  const processedClasses: ClassItem[] = useMemo(() => {
    if (!schedule) return []
    
    const currentTimeStr = currentTime.toTimeString().substring(0, 5)
    
    return schedule.map((cls: ScheduleEntry) => {
      let status: ClassItem['status'] = 'upcoming'
      
      if (cls.end_time < currentTimeStr) {
        status = 'completed'
      } else if (cls.start_time <= currentTimeStr && currentTimeStr < cls.end_time) {
        status = 'in-progress'
      }
      
      // Find attendance stats from overview
      const overviewData = attendanceOverview?.find(
        (a: AttendanceOverviewItem) => a.period_number === cls.period_number
      )
      
      return {
        id: cls.id,
        subject_name: cls.subject_name || 'Unknown Subject',
        section_name: cls.section_name || 'Unknown Section',
        grade_name: cls.grade_name || 'Unknown Grade',
        period_number: cls.period_number,
        start_time: cls.start_time,
        end_time: cls.end_time,
        room_number: cls.room_number || undefined,
        status,
        attendanceMarked: (overviewData?.stats?.total_students ?? 0) > 0,
        attendanceStats: overviewData?.stats ? {
          present: overviewData.stats.present || 0,
          absent: overviewData.stats.absent || 0,
          late: overviewData.stats.late || 0,
          total: overviewData.stats.total_students || 0,
          percentage: overviewData.stats.percentage || 0
        } : undefined
      }
    }).sort((a: ClassItem, b: ClassItem) => a.period_number - b.period_number)
  }, [schedule, attendanceOverview, currentTime])

  // Current and next class
  const currentClass = useMemo(() => 
    processedClasses.find(c => c.status === 'in-progress'), 
    [processedClasses]
  )
  
  const nextClass = useMemo(() => 
    processedClasses.find(c => c.status === 'upcoming'), 
    [processedClasses]
  )

  // Stats
  const stats: DashboardStats = useMemo(() => {
    const todayClasses = processedClasses.length
    const completedClasses = processedClasses.filter(c => c.status === 'completed').length
    const inProgressClasses = processedClasses.filter(c => c.status === 'in-progress').length
    const remainingClasses = processedClasses.filter(c => c.status === 'upcoming').length
    
    const classesWithAttendance = processedClasses.filter(c => c.attendanceStats)
    const totalStudents = classesWithAttendance.reduce((sum, c) => sum + (c.attendanceStats?.total || 0), 0)
    const totalPresent = classesWithAttendance.reduce((sum, c) => 
      sum + (c.attendanceStats?.present || 0) + (c.attendanceStats?.late || 0), 0)
    
    const attendanceMarked = classesWithAttendance.length
    const pendingAttendance = completedClasses - attendanceMarked
    const attendancePercentage = totalStudents > 0 
      ? Math.round((totalPresent / totalStudents) * 100) 
      : 0
    
    return {
      todayClasses,
      completedClasses,
      remainingClasses,
      inProgressClasses,
      totalStudents,
      attendanceMarked,
      attendancePercentage,
      pendingAttendance: Math.max(0, pendingAttendance)
    }
  }, [processedClasses])

  const navigateToAttendance = (classId?: string) => {
    if (classId) {
      router.push(`/teacher/attendance?class=${classId}`)
    } else {
      router.push('/teacher/attendance')
    }
  }

  const formatTime = (time?: string) => {
    if (!time) return ''
    return time.substring(0, 5)
  }

  const isLoading = scheduleLoading || overviewLoading

  // Show loading while auth is initializing, profile is not yet loaded, or while fetching initial data
  if (authLoading || !profile || (isLoading && !schedule)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Only show "not authorized" after auth has finished loading AND profile exists but has no staff_id
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
      {/* Header */}
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
            {currentTime.toLocaleTimeString("en-US", { 
              hour: "2-digit", 
              minute: "2-digit" 
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {currentTime.toLocaleDateString("en-US", { 
              weekday: "long", 
              month: "short", 
              day: "numeric" 
            })}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
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

      {/* Current Class - Prominent */}
      {currentClass ? (
        <Card className="border-2 border-green-500 shadow-lg overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="h-5 w-5 text-green-600" />
                Current Class
              </CardTitle>
              <Badge className="bg-green-600 text-white animate-pulse">
                ● In Progress
              </Badge>
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
                      {formatTime(currentClass.start_time)} - {formatTime(currentClass.end_time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Period {currentClass.period_number}</Badge>
                  </div>
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
            <p className="text-lg font-medium text-muted-foreground">
              No class in progress right now
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {nextClass 
                ? `Next class: ${nextClass.subject_name} at ${formatTime(nextClass.start_time)}` 
                : "No more classes today"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Next Class */}
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

      {/* Today's Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today&apos;s Schedule
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/teacher/timetable')}
            >
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
                    cls.status === 'in-progress' 
                      ? 'border-green-500 bg-green-50' 
                      : cls.status === 'completed'
                        ? cls.attendanceMarked 
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-orange-300 bg-orange-50'
                        : 'border-blue-200 hover:border-blue-400'
                  }`}
                  onClick={() => navigateToAttendance(cls.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Period Number */}
                    <div className={`h-12 w-12 rounded-lg flex flex-col items-center justify-center text-white ${
                      cls.status === 'in-progress' ? 'bg-green-600' :
                      cls.status === 'completed' ? 'bg-gray-500' : 'bg-blue-600'
                    }`}>
                      <span className="text-xs">P</span>
                      <span className="text-lg font-bold">{cls.period_number}</span>
                    </div>
                    
                    {/* Class Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{cls.subject_name}</h3>
                        {cls.status === 'in-progress' && (
                          <Badge className="bg-green-600 text-white text-xs">
                            <span className="animate-pulse mr-1">●</span> Now
                          </Badge>
                        )}
                        {cls.status === 'completed' && !cls.attendanceMarked && (
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
                          {cls.attendanceStats.present + cls.attendanceStats.late}/{cls.attendanceStats.total} Present
                          ({cls.attendanceStats.percentage}%)
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Time and Action */}
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="font-medium text-sm">
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
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

      {/* Quick Actions */}
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
              onClick={() => router.push('/teacher/timetable')}
            >
              <Calendar className="h-6 w-6 text-blue-600" />
              <span className="text-sm">Timetable</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300"
              onClick={() => router.push('/teacher/subjects')}
            >
              <BookOpen className="h-6 w-6 text-purple-600" />
              <span className="text-sm">My Subjects</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-orange-50 hover:border-orange-300"
              onClick={() => router.push('/teacher/assignments')}
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
