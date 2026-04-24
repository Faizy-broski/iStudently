'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useCampus } from '@/context/CampusContext'
import { getCalendars, getCalendarDays } from '@/lib/api/attendance-calendars'
import { useEvents } from '@/hooks/useEvents'
import { CalendarGrid } from '@/components/admin/CalendarGrid'
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react'

export default function StudentEventsPage() {
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())

  // Fetch events for CalendarGrid
  const { events, isLoading: eventsLoading } = useEvents({ currentMonth, selectedCategory: 'all' })

  // Fetch calendars for CalendarGrid styling (school days vs holidays)
  const { data: allCalendars } = useSWR(
    campusId ? ["attendance-calendars", campusId] : null,
    async () => {
      const res = await getCalendars(campusId);
      return res.success && res.data ? res.data : [];
    }
  );
  
  const defaultGregorian = allCalendars?.find(c => c.calendar_type === 'gregorian' && c.is_default) || allCalendars?.find(c => c.calendar_type === 'gregorian')

  const { data: calendarDays, isValidating: loadingDays } = useSWR(
    defaultGregorian && currentMonth ? ["calendarDays", defaultGregorian.id, currentMonth.toISOString().slice(0, 7)] : null,
    async () => {
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().slice(0, 10);
      const res = await getCalendarDays(defaultGregorian!.id, start, end);
      return res.success && res.data ? res.data : [];
    }
  );

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#022172] flex items-center gap-3">
          <CalendarIcon className="w-8 h-8" />
          School Calendar
        </h1>
        <p className="text-muted-foreground mt-2">
          View all academic events, holidays, exams, and important dates for the school year.
        </p>
      </div>
      
      {eventsLoading || loadingDays ? (
        <div className="h-[60vh] bg-white rounded-xl border flex flex-col items-center justify-center shadow-sm">
          <Loader2 className="w-8 h-8 text-[#022172] animate-spin" />
          <p className="mt-4 text-sm text-gray-500 font-medium">Loading school calendar...</p>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <CalendarGrid
            events={events}
            calendarDays={calendarDays || []}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            calendarType="gregorian"
            calendarStart={defaultGregorian?.start_date}
            calendarEnd={defaultGregorian?.end_date}
            // By omitting onDateClick and onEventClick, we keep the calendar purely read-only
          />
        </div>
      )}
    </div>
  )
}
