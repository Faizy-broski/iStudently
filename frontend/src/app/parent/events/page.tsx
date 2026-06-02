'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, BookOpen, FileText, Users, Zap, Bell, Calendar as CalendarIcon, GraduationCap } from 'lucide-react'
import {
  getEventsForRange,
  getCategoryCounts,
  type SchoolEvent,
  type EventCategory,
} from '@/lib/api/events'
import { CalendarGrid } from '@/components/admin/CalendarGrid'
import { EventDetailsDialog } from '@/components/admin/EventDetailsDialog'
import {
  getCalendars,
  getCalendarDays,
  type CalendarDay,
  type AttendanceCalendar,
} from '@/lib/api/attendance-calendars'
import useSWR from 'swr'
import moment from 'moment'

const EVENT_COLORS: Record<EventCategory, string> = {
  academic: '#3b82f6',
  holiday: '#ef4444',
  exam:     '#f59e0b',
  meeting:  '#8b5cf6',
  activity: '#10b981',
  reminder: '#6b7280',
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  academic: 'Academic',
  holiday:  'Holiday',
  exam:     'Exam',
  meeting:  'Meeting',
  activity: 'Activity',
  reminder: 'Reminder',
}

const CATEGORY_ICONS: Record<EventCategory, React.ReactNode> = {
  academic: <BookOpen className="h-4 w-4" />,
  holiday:  <CalendarIcon className="h-4 w-4" />,
  exam:     <FileText className="h-4 w-4" />,
  meeting:  <Users className="h-4 w-4" />,
  activity: <Zap className="h-4 w-4" />,
  reminder: <Bell className="h-4 w-4" />,
}

export default function ParentEventsPage() {
  const { selectedStudentData, isLoading: studentsLoading } = useParentDashboard()
  const campusId = selectedStudentData?.campus_id

  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'gregorian' | 'hijri'>('gregorian')
  const [gregorianCalendar, setGregorianCalendar] = useState<AttendanceCalendar | null>(null)
  const [hijriCalendar, setHijriCalendar] = useState<AttendanceCalendar | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null)
  const [showEventDetails, setShowEventDetails] = useState(false)

  const monthStr = useMemo(
    () => moment(currentMonth).format('YYYY-MM'),
    [currentMonth]
  )

  // Load attendance calendars
  const { data: allCalendars } = useSWR(
    campusId ? ['parent-calendars', campusId] : null,
    async () => {
      const res = await getCalendars(campusId)
      return res.success && res.data ? res.data : []
    }
  )

  // Set default calendars and jump to start month
  useEffect(() => {
    if (allCalendars && allCalendars.length > 0) {
      const greg = allCalendars.find(c => c.calendar_type === 'gregorian' && c.is_default)
                || allCalendars.find(c => c.calendar_type === 'gregorian')
      const hij  = allCalendars.find(c => c.calendar_type === 'hijri' && c.is_default)
                || allCalendars.find(c => c.calendar_type === 'hijri')
      if (greg) setGregorianCalendar(greg)
      if (hij)  setHijriCalendar(hij)
      const active = activeTab === 'gregorian' ? greg : hij
      if (active?.start_date) {
        const today = new Date();
        const start = new Date(active.start_date);
        const end = active.end_date ? new Date(active.end_date) : null;
        const todayInRange = today >= start && (!end || today <= end);
        setCurrentMonth(todayInRange ? today : start);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCalendars])

  // Load events for the current month
  const category = selectedCategory === 'all' ? undefined : selectedCategory
  const { data: events, isLoading: eventsLoading, isValidating } = useSWR(
    campusId ? ['parent-events', monthStr, category, campusId] : null,
    async () => {
      const start = moment(currentMonth).startOf('month').toISOString()
      const end   = moment(currentMonth).endOf('month').toISOString()
      const res   = await getEventsForRange(start, end, category, 'parent', campusId)
      return res.success && res.data ? res.data : []
    },
    { keepPreviousData: true, revalidateOnFocus: false }
  )

  // Category counts (for stat cards)
  const activeCalendar = activeTab === 'gregorian' ? gregorianCalendar : hijriCalendar
  const { data: categoryCounts } = useSWR(
    campusId ? ['parent-category-counts', campusId, activeCalendar?.start_date, activeCalendar?.end_date] : null,
    async () => {
      const res = await getCategoryCounts(activeCalendar?.start_date, activeCalendar?.end_date, campusId)
      return res.success && res.data ? res.data : null
    },
    { dedupingInterval: 30000, revalidateOnFocus: false }
  )

  const counts = categoryCounts || { academic: 0, holiday: 0, exam: 0, meeting: 0, activity: 0, reminder: 0 }

  // Calendar days for school-day colouring
  function getMonthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end   = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }

  const { data: gregorianDays, isValidating: loadingGregorianDays } = useSWR(
    gregorianCalendar ? ['parent-cal-days-greg', gregorianCalendar.id, monthStr] : null,
    async () => {
      const { start, end } = getMonthRange(currentMonth)
      const res = await getCalendarDays(gregorianCalendar!.id, start, end)
      return res.success && res.data ? res.data : []
    }
  )

  const { data: hijriDays, isValidating: loadingHijriDays } = useSWR(
    hijriCalendar ? ['parent-cal-days-hijri', hijriCalendar.id, monthStr] : null,
    async () => {
      const { start, end } = getMonthRange(currentMonth)
      const res = await getCalendarDays(hijriCalendar!.id, start, end)
      return res.success && res.data ? res.data : []
    }
  )

  if (studentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!selectedStudentData) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a child to view the school calendar.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          School Events &amp; Calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Academic events, holidays, and important dates &mdash;{' '}
          <span className="text-[#022172] dark:text-blue-400 font-medium">{selectedStudentData.campus_name}</span>
        </p>
      </div>

      {/* Category stat cards (click to filter) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.entries(CATEGORY_LABELS) as [EventCategory, string][]).map(([cat, label]) => (
          <Card
            key={cat}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedCategory === cat ? 'ring-2 ring-[#022172]' : ''
            }`}
            onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: EVENT_COLORS[cat] + '20', color: EVENT_COLORS[cat] }}
                >
                  {CATEGORY_ICONS[cat]}
                </div>
                <div>
                  <div className="text-xl font-bold">{counts[cat]}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active filter badge */}
      {selectedCategory !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtering by:</span>
          <Badge
            style={{ backgroundColor: EVENT_COLORS[selectedCategory as EventCategory] }}
            className="text-white cursor-pointer"
            onClick={() => setSelectedCategory('all')}
          >
            {CATEGORY_LABELS[selectedCategory as EventCategory]} ✕
          </Badge>
        </div>
      )}

      {/* Gregorian / Hijri tabs */}
      <Tabs
        defaultValue="gregorian"
        className="w-full"
        onValueChange={(v) => setActiveTab(v as 'gregorian' | 'hijri')}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="gregorian">Gregorian Calendar</TabsTrigger>
          <TabsTrigger value="hijri">Hijri Calendar</TabsTrigger>
        </TabsList>

        {/* ── Gregorian ── */}
        <TabsContent value="gregorian" className="mt-6">
          {eventsLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading calendar…
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {(isValidating || loadingGregorianDays) && (
                <div className="absolute top-2 right-2 z-10">
                  <div className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                      Updating…
                    </div>
                  </div>
                </div>
              )}
              <CalendarGrid
                events={events || []}
                calendarDays={(gregorianDays as CalendarDay[]) || []}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                onEventClick={(event) => { setSelectedEvent(event); setShowEventDetails(true) }}
                calendarType="gregorian"
                calendarStart={gregorianCalendar?.start_date}
                calendarEnd={gregorianCalendar?.end_date}
                weekdays={gregorianCalendar?.weekdays}
              />
            </div>
          )}
        </TabsContent>

        {/* ── Hijri ── */}
        <TabsContent value="hijri" className="mt-6">
          {eventsLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading calendar…
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {(isValidating || loadingHijriDays) && (
                <div className="absolute top-2 right-2 z-10">
                  <div className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                      Updating…
                    </div>
                  </div>
                </div>
              )}
              <CalendarGrid
                events={events || []}
                calendarDays={(hijriDays as CalendarDay[]) || []}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                onEventClick={(event) => { setSelectedEvent(event); setShowEventDetails(true) }}
                calendarType="hijri"
                calendarStart={hijriCalendar?.start_date}
                calendarEnd={hijriCalendar?.end_date}
                weekdays={hijriCalendar?.weekdays}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Event details — read-only (no onEdit / onDelete props) */}
      <EventDetailsDialog
        open={showEventDetails}
        onOpenChange={setShowEventDetails}
        event={selectedEvent}
      />
    </div>
  )
}
