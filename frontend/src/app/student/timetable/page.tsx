'use client'

import { useState, useMemo } from 'react'
import { useWeeklyTimetable } from '@/hooks/useStudentDashboard'
import { 
  Clock, 
  BookOpen, 
  MapPin, 
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

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

interface TimetableEntry {
  id: string
  day_of_week: number
  start_time?: string
  end_time?: string
  room_number?: string
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

// Check if class is currently ongoing
const isCurrentClass = (entry: TimetableEntry) => {
  const now = new Date()
  const currentDay = now.getDay() === 0 ? 7 : now.getDay()
  
  if (entry.day_of_week !== currentDay) return false
  
  const startTime = entry.start_time || entry.period?.start_time
  const endTime = entry.end_time || entry.period?.end_time
  
  if (!startTime || !endTime) return false
  
  const currentTime = now.toTimeString().slice(0, 8)
  return currentTime >= startTime && currentTime <= endTime
}

export default function StudentTimetablePage() {
  const { timetable, isLoading, error, refresh } = useWeeklyTimetable()
  const [activeView, setActiveView] = useState('week')
  const [selectedDay, setSelectedDay] = useState(() => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day
  })

  // Create a map of subject colors
  const subjectColors = useMemo(() => {
    const entries = timetable as TimetableEntry[]
    const colors = new Map<string, string>()
    const subjects = [...new Set(entries.map(e => e.subject?.id).filter(Boolean))]
    subjects.forEach((subjectId, index) => {
      if (subjectId) {
        colors.set(subjectId, SUBJECT_COLORS[index % SUBJECT_COLORS.length])
      }
    })
    return colors
  }, [timetable])

  // Calculate statistics
  const stats = useMemo(() => {
    const entries = timetable as TimetableEntry[]
    const currentDay = new Date().getDay() === 0 ? 7 : new Date().getDay()
    const todayClasses = entries.filter(e => e.day_of_week === currentDay)
    const uniqueSubjects = new Set(entries.map(e => e.subject?.id))
    
    return {
      totalClasses: entries.length,
      todayClasses: todayClasses.length,
      subjects: uniqueSubjects.size
    }
  }, [timetable])

  // Group timetable by day
  const entriesByDay = useMemo(() => {
    const entries = timetable as TimetableEntry[]
    const grouped: Record<number, TimetableEntry[]> = {}
    
    for (let i = 1; i <= 7; i++) {
      grouped[i] = entries
        .filter(e => e.day_of_week === i)
        .sort((a, b) => {
          const aTime = a.start_time || a.period?.start_time || ''
          const bTime = b.start_time || b.period?.start_time || ''
          return aTime.localeCompare(bTime)
        })
    }
    
    return grouped
  }, [timetable])

  // Get period slot for matrix display
  const getPeriodSlot = (entry: TimetableEntry): number => {
    if (entry.period?.period_number) return entry.period.period_number
    
    const startTime = entry.start_time || entry.period?.start_time
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
              <p className="text-red-700 dark:text-red-300">{error.message}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refresh()}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentDay = new Date().getDay() === 0 ? 7 : new Date().getDay()
  const entries = timetable as TimetableEntry[]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Timetable</h1>
          <p className="text-muted-foreground mt-1">Your complete class schedule for the week</p>
        </div>
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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="week">Week View</TabsTrigger>
          <TabsTrigger value="day">Day View</TabsTrigger>
        </TabsList>

        {/* Week Grid View */}
        <TabsContent value="week" className="mt-4">
          {entries.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Week Matrix Header */}
                <div className="grid grid-cols-8 gap-1 mb-1">
                  <div className="p-2 font-medium text-sm text-center text-muted-foreground">
                    Time
                  </div>
                  {[1, 2, 3, 4, 5, 6, 7].map(day => (
                    <div 
                      key={day}
                      className={`p-2 font-medium text-sm text-center rounded-t-lg ${
                        day === currentDay 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {DAYS[day]?.slice(0, 3)}
                      {day === currentDay && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          Today
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {/* Week Matrix Body */}
                {PERIODS.map(period => (
                  <div key={period.number} className="grid grid-cols-8 gap-1 mb-1">
                    <div className="p-2 text-xs text-center text-muted-foreground bg-muted/50 rounded-l-lg flex flex-col justify-center">
                      <span className="font-medium">P{period.number}</span>
                      <span>{period.time}</span>
                    </div>
                    {[1, 2, 3, 4, 5, 6, 7].map(day => {
                      const entry = entriesByDay[day]?.find(
                        e => getPeriodSlot(e) === period.number
                      )

                      if (!entry) {
                        return (
                          <div 
                            key={`${day}-${period.number}`}
                            className={`p-2 min-h-[60px] rounded-lg border border-dashed ${
                              day === currentDay 
                                ? 'border-primary/30 bg-primary/5' 
                                : 'border-muted'
                            }`}
                          />
                        )
                      }

                      const colorClass = entry.subject?.id 
                        ? subjectColors.get(entry.subject.id) || SUBJECT_COLORS[0]
                        : SUBJECT_COLORS[0]
                      const isCurrent = isCurrentClass(entry)

                      return (
                        <div
                          key={entry.id}
                          className={`p-2 min-h-[60px] rounded-lg text-white bg-gradient-to-br ${colorClass} ${
                            isCurrent ? 'ring-2 ring-offset-2 ring-yellow-400' : ''
                          }`}
                        >
                          <p className="font-semibold text-xs truncate">
                            {entry.subject?.name || 'Unknown'}
                          </p>
                          {entry.subject?.code && (
                            <p className="text-[10px] opacity-80 truncate">
                              {entry.subject.code}
                            </p>
                          )}
                          {entry.room_number && (
                            <p className="text-[10px] opacity-80 mt-1">
                              Room {entry.room_number}
                            </p>
                          )}
                          {isCurrent && (
                            <Badge className="mt-1 bg-yellow-400 text-yellow-900 text-[10px]">
                              Now
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Timetable Found</h3>
              <p className="text-muted-foreground">
                Your timetable has not been set up yet. Please contact your school administrator.
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Day View */}
        <TabsContent value="day" className="mt-4">
          <div className="space-y-4">
            {/* Day Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{DAYS[selectedDay]}</h2>
                {selectedDay === currentDay && (
                  <Badge>Today</Badge>
                )}
                {selectedDay !== currentDay && (
                  <Button variant="ghost" size="sm" onClick={goToToday}>
                    Go to Today
                  </Button>
                )}
              </div>

              <Button variant="outline" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day Classes */}
            {entriesByDay[selectedDay]?.length > 0 ? (
              <div className="space-y-3">
                {entriesByDay[selectedDay].map((entry) => {
                  const colorClass = entry.subject?.id 
                    ? subjectColors.get(entry.subject.id) || SUBJECT_COLORS[0]
                    : SUBJECT_COLORS[0]
                  const isCurrent = isCurrentClass(entry)
                  const startTime = entry.start_time || entry.period?.start_time
                  const endTime = entry.end_time || entry.period?.end_time

                  return (
                    <Card 
                      key={entry.id}
                      className={`overflow-hidden ${isCurrent ? 'ring-2 ring-yellow-400' : ''}`}
                    >
                      <div className={`h-2 bg-gradient-to-r ${colorClass}`} />
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            {/* Subject */}
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg">
                                {entry.subject?.name || 'Unknown Subject'}
                              </h3>
                              {entry.subject?.code && (
                                <Badge variant="outline">{entry.subject.code}</Badge>
                              )}
                              {isCurrent && (
                                <Badge className="bg-yellow-400 text-yellow-900">
                                  Ongoing
                                </Badge>
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTime(startTime)} - {formatTime(endTime)}
                              </span>
                              {entry.teacher?.profile && (
                                <span className="flex items-center gap-1">
                                  <User className="h-4 w-4" />
                                  {entry.teacher.profile.first_name} {entry.teacher.profile.last_name}
                                </span>
                              )}
                              {entry.room_number && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  Room {entry.room_number}
                                </span>
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
                <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Classes on {DAYS[selectedDay]}</h3>
                <p className="text-muted-foreground">
                  You don&apos;t have any classes scheduled for this day.
                </p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
