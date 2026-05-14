"use client"

import { useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Loader2, 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  GraduationCap
} from 'lucide-react'
import useSWR from 'swr'
import * as timetableApi from '@/lib/api/timetable'
import * as teachersApi from '@/lib/api/teachers'
import { useRouter } from 'next/navigation'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEK_DAYS = DAYS.slice(0, 6) // Mon-Sat for most schools

interface TimetableEntry {
  id: string
  day_of_week: number
  section_id: string
  subject_id: string
  section?: { name: string; grade_level?: { name: string } }
  subject?: { name: string; code?: string }
  period?: { 
    period_number: number
    start_time: string
    end_time: string
    is_break: boolean
    period_name?: string
  }
  room_number?: string
  section_name?: string
  grade_name?: string
  subject_name?: string
}

interface TimeSlot {
  period_number: number
  start_time: string
  end_time: string
  is_break: boolean
  period_name?: string
}

type WeekMatrix = {
  [day: string]: {
    [periodNum: string]: TimetableEntry | undefined
  }
}

// Color coding for different subjects
const SUBJECT_COLORS = [
  'from-blue-500 to-blue-600',
  'from-green-500 to-green-600',
  'from-purple-500 to-purple-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
  'from-indigo-500 to-indigo-600',
  'from-cyan-500 to-cyan-600',
]

export default function TeacherTimetablePage() {
  const { profile } = useAuth()
  const router = useRouter()

  // Fetch academic years
  const { data: academicYears } = useSWR(
    profile?.staff_id ? 'academic-years' : null,
    async () => await teachersApi.getAcademicYears(),
    { revalidateOnFocus: false }
  )

  // Auto-get current academic year
  const currentAcademicYear = useMemo(() => {
    if (!academicYears) return null
    return academicYears.find(y => y.is_current)
  }, [academicYears])

  // Fetch periods
  const { data: periods } = useSWR<teachersApi.Period[]>(
    profile?.staff_id ? 'periods' : null,
    async () => await teachersApi.getPeriods(),
    { revalidateOnFocus: false }
  )

  // Fetch teacher's timetable entries
  const { data: entries, isLoading } = useSWR<TimetableEntry[]>(
    profile?.staff_id && currentAcademicYear 
      ? `teacher-timetable|${profile.staff_id}|${currentAcademicYear.id}` 
      : null,
    async () => {
      if (!profile?.staff_id || !currentAcademicYear) return []
      return await timetableApi.getTeacherTimetable(profile.staff_id, currentAcademicYear.id)
    },
    { revalidateOnFocus: false }
  )

  // Get today's day name - initialize states directly
  const todayDay = useMemo(() => {
    const today = new Date().getDay()
    const dayIndex = today === 0 ? 6 : today - 1
    return DAYS[dayIndex]
  }, [])
  
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const today = new Date().getDay()
    const dayIndex = today === 0 ? 6 : today - 1
    return DAYS[dayIndex]
  })

  // Create subject color map
  const subjectColors = useMemo(() => {
    if (!entries) return new Map<string, string>()
    
    const uniqueSubjects = [...new Set(entries.map(e => e.subject_id))]
    const colorMap = new Map<string, string>()
    
    uniqueSubjects.forEach((subjectId, index) => {
      colorMap.set(subjectId, SUBJECT_COLORS[index % SUBJECT_COLORS.length])
    })
    
    return colorMap
  }, [entries])

  // Transform flat list into grid matrix
  const weekMatrix: WeekMatrix = useMemo(() => {
    if (!entries || !periods) return {}

    const matrix: WeekMatrix = {}
    const timeSlots = periods
      .filter(p => p.is_active)
      .sort((a, b) => a.period_number - b.period_number)

    // Initialize empty matrix
    WEEK_DAYS.forEach(day => {
      matrix[day] = {}
      timeSlots.forEach(slot => {
        matrix[day][slot.period_number.toString()] = undefined
      })
    })

    // Fill matrix with actual entries
    entries.forEach(entry => {
      const dayName = DAYS[entry.day_of_week]
      if (matrix[dayName] && entry.period) {
        matrix[dayName][entry.period.period_number.toString()] = entry
      }
    })

    return matrix
  }, [entries, periods])

  // Get today's/selected day schedule
  const selectedDaySchedule = useMemo(() => {
    if (!entries || !selectedDay) return []
    return entries
      .filter(e => DAYS[e.day_of_week] === selectedDay)
      .sort((a, b) => (a.period?.period_number || 0) - (b.period?.period_number || 0))
  }, [entries, selectedDay])

  // Get unique time slots for grid rows
  const timeSlots: TimeSlot[] = useMemo(() => {
    if (!periods) return []
    return periods
      .filter(p => p.is_active)
      .sort((a, b) => a.period_number - b.period_number)
      .map(p => ({
        period_number: p.period_number,
        start_time: p.start_time,
        end_time: p.end_time,
        is_break: p.is_break || false,
        period_name: p.period_name || undefined
      }))
  }, [periods])

  // Stats
  const stats = useMemo(() => {
    if (!entries) return { totalClasses: 0, uniqueSections: 0, uniqueSubjects: 0, todayClasses: 0 }
    
    const todayEntries = entries.filter(e => DAYS[e.day_of_week] === todayDay && !e.period?.is_break)
    
    return {
      totalClasses: entries.filter(e => !e.period?.is_break).length,
      uniqueSections: new Set(entries.map(e => e.section_id)).size,
      uniqueSubjects: new Set(entries.map(e => e.subject_id)).size,
      todayClasses: todayEntries.length
    }
  }, [entries, todayDay])

  // Navigate to mark attendance
  const goToAttendance = (classId: string) => {
    router.push(`/teacher/attendance?class=${classId}`)
  }

  // Navigate days
  const navigateDay = (direction: 'prev' | 'next') => {
    const currentIndex = WEEK_DAYS.indexOf(selectedDay)
    if (direction === 'prev' && currentIndex > 0) {
      setSelectedDay(WEEK_DAYS[currentIndex - 1])
    } else if (direction === 'next' && currentIndex < WEEK_DAYS.length - 1) {
      setSelectedDay(WEEK_DAYS[currentIndex + 1])
    }
  }

  // Check if current time is in class
  const isCurrentClass = (startTime: string, endTime: string, dayOfWeek: number) => {
    const now = new Date()
    const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1
    const currentTime = now.toTimeString().substring(0, 5)
    
    return currentDayIndex === dayOfWeek && startTime <= currentTime && currentTime < endTime
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">My Timetable</h1>
          <p className="text-muted-foreground mt-1">
            {currentAcademicYear ? `${currentAcademicYear.name} - Your weekly class schedule` : 'Your weekly class schedule'}
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Calendar className="h-4 w-4 mr-2" />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </Badge>
      </div>

      {/* Stats Summary */}
      {entries && entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="py-4 text-center">
              <Calendar className="h-6 w-6 mx-auto text-blue-600 mb-1" />
              <p className="text-2xl font-bold text-blue-700">{stats.totalClasses}</p>
              <p className="text-xs text-blue-600">Classes/Week</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="py-4 text-center">
              <Clock className="h-6 w-6 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-700">{stats.todayClasses}</p>
              <p className="text-xs text-green-600">Today&apos;s Classes</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="py-4 text-center">
              <Users className="h-6 w-6 mx-auto text-purple-600 mb-1" />
              <p className="text-2xl font-bold text-purple-700">{stats.uniqueSections}</p>
              <p className="text-xs text-purple-600">Sections</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="py-4 text-center">
              <BookOpen className="h-6 w-6 mx-auto text-orange-600 mb-1" />
              <p className="text-2xl font-bold text-orange-700">{stats.uniqueSubjects}</p>
              <p className="text-xs text-orange-600">Subjects</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="week" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="week">
            <Calendar className="h-4 w-4 mr-2" />
            Week View
          </TabsTrigger>
          <TabsTrigger value="day">
            <Clock className="h-4 w-4 mr-2" />
            Day View
          </TabsTrigger>
          <TabsTrigger value="list">
            <BookOpen className="h-4 w-4 mr-2" />
            Subject List
          </TabsTrigger>
        </TabsList>

        {/* Week Grid View */}
        <TabsContent value="week" className="mt-0">
          {!entries || entries.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Classes Scheduled</h3>
              <p className="text-muted-foreground">
                Your timetable is empty. Contact admin if this seems incorrect.
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px] border rounded-lg overflow-hidden shadow-sm">
                {/* Header Row */}
                <div className="grid grid-cols-7 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <div className="p-3 font-semibold border-r border-blue-500">Time</div>
                  {WEEK_DAYS.map(day => (
                    <div
                      key={day}
                      className={`p-3 font-semibold border-r border-blue-500 last:border-r-0 text-center ${
                        day === todayDay ? 'bg-white/20' : ''
                      }`}
                    >
                      {day}
                      {day === todayDay && (
                        <Badge className="ml-2 bg-white text-blue-600 text-xs">Today</Badge>
                      )}
                    </div>
                  ))}
                </div>

                {/* Time Slots Rows */}
                {timeSlots.map((slot, idx) => (
                  <div key={idx} className="grid grid-cols-7 border-b last:border-b-0">
                    {/* Time Column */}
                    <div className={`p-3 border-r text-sm ${slot.is_break ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <div className="font-medium">
                        {slot.is_break ? 'Break' : slot.period_name || `Period ${slot.period_number}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {slot.start_time?.substring(0, 5)} - {slot.end_time?.substring(0, 5)}
                      </div>
                    </div>

                    {/* Day Cells */}
                    {WEEK_DAYS.map((day) => {
                      const entry = weekMatrix[day]?.[slot.period_number.toString()]

                      if (slot.is_break) {
                        return (
                          <div key={day} className="p-3 border-r last:border-r-0 bg-amber-50 text-center">
                            <span className="text-xs text-amber-600">☕ Break</span>
                          </div>
                        )
                      }

                      if (!entry) {
                        return (
                          <div key={day} className={`p-3 border-r last:border-r-0 ${day === todayDay ? 'bg-blue-50/30' : 'bg-white'}`}>
                            <span className="text-xs text-gray-300">—</span>
                          </div>
                        )
                      }

                      const colorClass = subjectColors.get(entry.subject_id) || SUBJECT_COLORS[0]
                      const isCurrent = entry.period && isCurrentClass(
                        entry.period.start_time, 
                        entry.period.end_time, 
                        entry.day_of_week
                      )

                      return (
                        <div
                          key={day}
                          className={`p-2 border-r last:border-r-0 ${
                            day === todayDay ? 'bg-blue-50/30' : 'bg-white'
                          } ${isCurrent ? 'ring-2 ring-green-500 ring-inset' : ''}`}
                        >
                          <div 
                            className={`h-full rounded-lg p-2 bg-gradient-to-br ${colorClass} text-white shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
                            onClick={() => goToAttendance(entry.id)}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <span className="font-semibold text-sm truncate flex-1">
                                {entry.subject?.name || entry.subject_name}
                              </span>
                              {isCurrent && (
                                <span className="animate-pulse ml-1">●</span>
                              )}
                            </div>
                            <div className="text-xs opacity-90 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {entry.section?.name || entry.section_name}
                            </div>
                            {entry.room_number && (
                              <div className="text-xs opacity-75 flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {entry.room_number}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Day View */}
        <TabsContent value="day" className="mt-0">
          <div className="space-y-4">
            {/* Day Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDay('prev')}
                disabled={WEEK_DAYS.indexOf(selectedDay) === 0}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <div className="flex gap-2 overflow-x-auto py-2">
                {WEEK_DAYS.map(day => (
                  <Button
                    key={day}
                    variant={selectedDay === day ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDay(day)}
                    className={`min-w-[80px] ${day === todayDay ? 'ring-2 ring-green-500' : ''}`}
                  >
                    {day.substring(0, 3)}
                    {day === todayDay && <span className="ml-1 text-xs">●</span>}
                  </Button>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDay('next')}
                disabled={WEEK_DAYS.indexOf(selectedDay) === WEEK_DAYS.length - 1}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Selected Day Header */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-6 w-6 text-blue-600" />
                    <div>
                      <h2 className="text-xl font-bold text-blue-900">{selectedDay}&apos;s Schedule</h2>
                      <p className="text-sm text-blue-700">
                        {selectedDaySchedule.filter(e => !e.period?.is_break).length} classes scheduled
                      </p>
                    </div>
                  </div>
                  {selectedDay === todayDay && (
                    <Badge className="bg-green-600 text-white">Today</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Day's Classes */}
            {selectedDaySchedule.length === 0 ? (
              <Card className="p-12 text-center">
                <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Classes on {selectedDay}</h3>
                <p className="text-muted-foreground">Enjoy your free day!</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {selectedDaySchedule.map((entry, idx) => {
                  const isBreak = entry.period?.is_break
                  const colorClass = subjectColors.get(entry.subject_id) || SUBJECT_COLORS[0]
                  const isCurrent = entry.period && isCurrentClass(
                    entry.period.start_time,
                    entry.period.end_time,
                    entry.day_of_week
                  )

                  if (isBreak) {
                    return (
                      <Card key={idx} className="p-4 bg-amber-50 border-amber-200 border-dashed">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[60px]">
                            <div className="text-sm text-amber-700">
                              {entry.period?.start_time?.substring(0, 5)}
                            </div>
                            <div className="text-xs text-amber-600">
                              {entry.period?.end_time?.substring(0, 5)}
                            </div>
                          </div>
                          <div className="flex-1 text-center text-amber-700 font-medium">
                            ☕ Break Time
                          </div>
                        </div>
                      </Card>
                    )
                  }

                  return (
                    <Card 
                      key={entry.id} 
                      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${
                        isCurrent ? 'ring-2 ring-green-500' : ''
                      }`}
                      onClick={() => goToAttendance(entry.id)}
                    >
                      <div className={`h-1 bg-gradient-to-r ${colorClass}`} />
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Time */}
                          <div className="text-center min-w-[70px]">
                            <div className="text-lg font-bold text-blue-600">
                              {entry.period?.start_time?.substring(0, 5)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.period?.end_time?.substring(0, 5)}
                            </div>
                            <Badge variant="outline" className="mt-2">
                              P{entry.period?.period_number}
                            </Badge>
                          </div>

                          {/* Details */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-bold">
                                {entry.subject?.name || entry.subject_name}
                              </h3>
                              {isCurrent && (
                                <Badge className="bg-green-600 text-white">
                                  <span className="animate-pulse mr-1">●</span> Now
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {entry.section?.name || entry.section_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <GraduationCap className="h-4 w-4" />
                                {entry.section?.grade_level?.name || entry.grade_name}
                              </span>
                              {entry.room_number && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  Room {entry.room_number}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action */}
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              goToAttendance(entry.id)
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Attendance
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Subject List View */}
        <TabsContent value="list" className="mt-0">
          {entries && entries.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Group entries by subject */}
              {Object.entries(
                entries.reduce((acc, entry) => {
                  const key = entry.subject_id
                  if (!acc[key]) {
                    acc[key] = {
                      subject_name: entry.subject?.name || entry.subject_name || 'Unknown',
                      subject_code: entry.subject?.code,
                      sections: new Set<string>(),
                      total_periods: 0,
                      entries: []
                    }
                  }
                  const sectionName = entry.section?.name || entry.section_name || 'Unknown Section'
                  acc[key].sections.add(sectionName)
                  acc[key].total_periods++
                  acc[key].entries.push(entry)
                  return acc
                }, {} as Record<string, { subject_name: string; subject_code?: string; sections: Set<string>; total_periods: number; entries: TimetableEntry[] }>)
              ).map(([subjectId, data]) => {
                const colorClass = subjectColors.get(subjectId) || SUBJECT_COLORS[0]
                
                return (
                  <Card key={subjectId} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className={`h-2 bg-gradient-to-r ${colorClass}`} />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{data.subject_name}</h3>
                          {data.subject_code && (
                            <Badge variant="outline" className="mt-1">{data.subject_code}</Badge>
                          )}
                        </div>
                        <Badge className={`bg-gradient-to-r ${colorClass} text-white`}>
                          {data.total_periods} periods/week
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Sections: {Array.from(data.sections).join(', ')}</span>
                        </div>
                        
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Schedule:</p>
                          <div className="flex flex-wrap gap-1">
                            {data.entries.slice(0, 5).map((entry, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {DAYS[entry.day_of_week]?.substring(0, 3)} P{entry.period?.period_number}
                              </Badge>
                            ))}
                            {data.entries.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{data.entries.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Subjects Assigned</h3>
              <p className="text-muted-foreground">
                You haven&apos;t been assigned any subjects yet.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
