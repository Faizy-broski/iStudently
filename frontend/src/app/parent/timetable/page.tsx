'use client'

import { useState, useMemo } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { useTimetable } from '@/hooks/useParentDashboard'
import { 
  Clock, 
  BookOpen, 
  MapPin, 
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { StudentSelector } from '@/components/parent/StudentSelector'

// Days of week constant - Monday = 1, Sunday = 7
const DAYS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday'
}

// Color palette for subjects
const SUBJECT_COLORS = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-cyan-500 to-cyan-600',
  'from-indigo-500 to-indigo-600',
  'from-rose-500 to-rose-600',
  'from-teal-500 to-teal-600',
  'from-amber-500 to-amber-600'
]

// Generate period times for display (8 periods starting at 8 AM)
const PERIODS = Array.from({ length: 8 }, (_, i) => ({
  number: i + 1,
  label: `Period ${i + 1}`,
  time: `${8 + i}:00`
}))

// Helper to get day number from string or number
const getDayNumber = (day: number | string): number => {
  if (typeof day === 'number') return day
  const dayMap: Record<string, number> = {
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
    'friday': 5, 'saturday': 6, 'sunday': 7,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7
  }
  return dayMap[day.toLowerCase()] || 1
}

interface TimetableEntry {
  id: string
  day_of_week: number | string
  start_time?: string
  end_time?: string
  room_number?: string
  period_number?: number
  period_name?: string
  subject_name?: string
  subject_code?: string
  teacher_name?: string
  is_break?: boolean
  subject?: {
    id: string
    name: string
    code?: string
  }
  teacher?: {
    id: string
    profile?: {
      first_name?: string
      last_name?: string
    }
  }
  period?: {
    period_number?: number
    period_name?: string
    start_time?: string
    end_time?: string
  }
}

// Format time from HH:MM:SS to HH:MM AM/PM
const formatTime = (time?: string) => {
  if (!time) return '--:--'
  try {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  } catch {
    return time
  }
}

// Get subject name from entry (handles both flat and nested data)
const getSubjectName = (entry: TimetableEntry): string => {
  return entry.subject_name || entry.subject?.name || 'N/A'
}

// Get subject code from entry
const getSubjectCode = (entry: TimetableEntry): string | undefined => {
  return entry.subject_code || entry.subject?.code
}

// Get teacher name from entry
const getTeacherName = (entry: TimetableEntry): string => {
  if (entry.teacher_name) return entry.teacher_name
  if (entry.teacher?.profile) {
    return `${entry.teacher.profile.first_name || ''} ${entry.teacher.profile.last_name || ''}`.trim() || 'Unassigned'
  }
  return 'Unassigned'
}

// Get period number from entry
const getPeriodNumber = (entry: TimetableEntry): number | undefined => {
  return entry.period_number || entry.period?.period_number
}

// Get start time from entry
const getStartTime = (entry: TimetableEntry): string | undefined => {
  return entry.start_time || entry.period?.start_time
}

// Get end time from entry
const getEndTime = (entry: TimetableEntry): string | undefined => {
  return entry.end_time || entry.period?.end_time
}

// Check if class is currently ongoing
const isCurrentClass = (entry: TimetableEntry) => {
  const now = new Date()
  const currentDay = now.getDay() === 0 ? 7 : now.getDay()
  
  const entryDay = getDayNumber(entry.day_of_week)
  if (entryDay !== currentDay) return false
  
  const startTime = getStartTime(entry)
  const endTime = getEndTime(entry)
  
  if (!startTime || !endTime) return false
  
  const currentTime = now.toTimeString().slice(0, 8)
  return currentTime >= startTime && currentTime <= endTime
}

export default function ParentTimetablePage() {
  const { selectedStudent, students, isLoading: studentsLoading } = useParentDashboard()
  const { timetable: rawTimetable, isLoading: timetableLoading, error, refresh } = useTimetable()
  const [activeView, setActiveView] = useState('week')
  const [selectedDay, setSelectedDay] = useState(() => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day
  })

  const student = students.find(s => s.id === selectedStudent)
  const timetable = (rawTimetable || []) as TimetableEntry[]
  const isLoading = studentsLoading || timetableLoading

  // Create a map of subject colors
  const subjectColors = useMemo(() => {
    const colors = new Map<string, string>()
    const subjects = [...new Set(timetable.map(e => getSubjectName(e)).filter(Boolean))]
    subjects.forEach((subjectName, index) => {
      if (subjectName && subjectName !== 'N/A') {
        colors.set(subjectName, SUBJECT_COLORS[index % SUBJECT_COLORS.length])
      }
    })
    return colors
  }, [timetable])

  // Calculate statistics
  const stats = useMemo(() => {
    const currentDay = new Date().getDay() === 0 ? 7 : new Date().getDay()
    const todayClasses = timetable.filter(e => getDayNumber(e.day_of_week) === currentDay && !e.is_break)
    const uniqueSubjects = new Set(timetable.filter(e => !e.is_break).map(e => getSubjectName(e)))
    
    return {
      totalClasses: timetable.filter(e => !e.is_break).length,
      todayClasses: todayClasses.length,
      subjects: uniqueSubjects.size
    }
  }, [timetable])

  // Group timetable by day
  const entriesByDay = useMemo(() => {
    const grouped: Record<number, TimetableEntry[]> = {}
    
    for (let i = 1; i <= 7; i++) {
      grouped[i] = timetable
        .filter(e => getDayNumber(e.day_of_week) === i)
        .sort((a, b) => {
          const aTime = getStartTime(a) || ''
          const bTime = getStartTime(b) || ''
          return aTime.localeCompare(bTime)
        })
    }
    
    return grouped
  }, [timetable])

  // Get period slot for matrix display
  const getPeriodSlot = (entry: TimetableEntry): number => {
    const periodNum = getPeriodNumber(entry)
    if (periodNum) return periodNum
    
    const startTime = getStartTime(entry)
    if (!startTime) return 1
    
    const hour = parseInt(startTime.split(':')[0])
    return Math.max(1, Math.min(8, hour - 7))
  }

  // Navigate days
  const goToPreviousDay = () => {
    setSelectedDay(prev => prev === 1 ? 7 : prev - 1)
  }

  const goToNextDay = () => {
    setSelectedDay(prev => prev === 7 ? 1 : prev + 1)
  }

  const goToToday = () => {
    const day = new Date().getDay()
    setSelectedDay(day === 0 ? 7 : day)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading timetable</h3>
              <p className="text-red-700 dark:text-red-300">{error?.message}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refresh()}
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentDay = new Date().getDay() === 0 ? 7 : new Date().getDay()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Timetable</h1>
          <p className="text-muted-foreground mt-1">
            {student ? `${student.first_name} ${student.last_name}'s class schedule` : 'View class schedule for the week'}
          </p>
        </div>
        <StudentSelector />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{stats.totalClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Classes</p>
                <p className="text-2xl font-bold">{stats.todayClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subjects</p>
                <p className="text-2xl font-bold">{stats.subjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timetable Views */}
      <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="week">Week View</TabsTrigger>
          <TabsTrigger value="day">Day View</TabsTrigger>
        </TabsList>

        {/* Week View */}
        <TabsContent value="week">
          <Card>
            <CardContent className="p-4">
              {timetable.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-30" />
                  <p className="text-lg text-muted-foreground">No timetable found</p>
                  <p className="text-sm text-muted-foreground">The class schedule will appear here once set up</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header Row - Days */}
                    <div className="grid grid-cols-8 gap-2 mb-2">
                      <div className="p-2 font-semibold text-center text-sm text-muted-foreground">Period</div>
                      {[1, 2, 3, 4, 5, 6, 7].map(day => (
                        <div 
                          key={day} 
                          className={`p-2 font-semibold text-center rounded-lg ${
                            day === currentDay 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}
                        >
                          {DAYS[day]}
                        </div>
                      ))}
                    </div>

                    {/* Period Rows */}
                    {PERIODS.map(period => (
                      <div key={period.number} className="grid grid-cols-8 gap-2 mb-2">
                        {/* Period Label */}
                        <div className="p-2 text-center text-sm">
                          <div className="font-semibold">P{period.number}</div>
                          <div className="text-xs text-muted-foreground">{period.time}</div>
                        </div>

                        {/* Days */}
                        {[1, 2, 3, 4, 5, 6, 7].map(day => {
                          const entry = entriesByDay[day]?.find(e => getPeriodSlot(e) === period.number)
                          
                          if (!entry) {
                            return (
                              <div 
                                key={day} 
                                className="p-2 min-h-[60px] rounded-lg border border-dashed border-muted-foreground/20 flex items-center justify-center"
                              >
                                <span className="text-xs text-muted-foreground">-</span>
                              </div>
                            )
                          }

                          if (entry.is_break) {
                            return (
                              <div 
                                key={day}
                                className="p-2 min-h-[60px] rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"
                              >
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                  Break
                                </span>
                              </div>
                            )
                          }

                          const colorClass = subjectColors.get(getSubjectName(entry)) || SUBJECT_COLORS[0]
                          const isCurrent = isCurrentClass(entry)

                          return (
                            <div 
                              key={day}
                              className={`p-2 min-h-[60px] rounded-lg text-white bg-gradient-to-br ${colorClass} ${
                                isCurrent ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="font-semibold text-xs truncate flex-1">
                                  {getSubjectName(entry)}
                                </div>
                                {isCurrent && (
                                  <Badge className="bg-yellow-400 text-yellow-900 text-[10px] px-1">
                                    Now
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] opacity-90 mt-1 truncate">
                                {getTeacherName(entry)}
                              </div>
                              {entry.room_number && (
                                <div className="text-[10px] opacity-75 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {entry.room_number}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Day View */}
        <TabsContent value="day">
          <Card>
            <CardContent className="p-4">
              {/* Day Navigation */}
              <div className="flex items-center justify-between mb-6">
                <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <h3 className="text-xl font-bold">{DAYS[selectedDay]}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedDay === currentDay ? "Today" : ""}
                  </p>
                </div>
                <Button variant="outline" size="icon" onClick={goToNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {selectedDay !== currentDay && (
                <div className="flex justify-center mb-4">
                  <Button variant="ghost" size="sm" onClick={goToToday}>
                    Go to Today
                  </Button>
                </div>
              )}

              {/* Day's Classes */}
              {entriesByDay[selectedDay]?.length > 0 ? (
                <div className="space-y-3">
                  {entriesByDay[selectedDay].map((entry: TimetableEntry) => {
                    const colorClass = subjectColors.get(getSubjectName(entry)) || SUBJECT_COLORS[0]
                    const isCurrent = isCurrentClass(entry)

                    if (entry.is_break) {
                      return (
                        <Card key={entry.id} className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
                          <CardContent className="p-4 flex items-center justify-center">
                            <span className="font-medium text-amber-700 dark:text-amber-300">
                              ☕ Break Time
                            </span>
                          </CardContent>
                        </Card>
                      )
                    }

                    return (
                      <Card 
                        key={entry.id} 
                        className={`overflow-hidden ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                      >
                        <div className={`h-2 bg-gradient-to-r ${colorClass}`} />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-bold text-lg">{getSubjectName(entry)}</h4>
                                {getSubjectCode(entry) && (
                                  <Badge variant="outline">{getSubjectCode(entry)}</Badge>
                                )}
                                {isCurrent && (
                                  <Badge className="bg-green-500">In Progress</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {formatTime(getStartTime(entry))} - {formatTime(getEndTime(entry))}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-4 w-4" />
                                  {getTeacherName(entry)}
                                </span>
                                {entry.room_number && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {entry.room_number}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary" className="text-lg font-bold">
                                P{getPeriodNumber(entry) || '?'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-30" />
                  <p className="text-lg text-muted-foreground">No classes scheduled</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedDay === 6 || selectedDay === 7 ? 'Enjoy your weekend!' : 'No classes for this day'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
