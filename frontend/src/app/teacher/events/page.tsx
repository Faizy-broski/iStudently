'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getUpcomingEvents, getEvents, type SchoolEvent } from '@/lib/api/events'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Loader2, Calendar, Clock, ChevronRight } from 'lucide-react'
import { format, parseISO, isToday, isPast } from 'date-fns'

const CATEGORY_COLORS: Record<string, string> = {
  academic: 'bg-purple-100 text-purple-700',
  holiday: 'bg-orange-100 text-orange-700',
  exam: 'bg-red-100 text-red-700',
  meeting: 'bg-blue-100 text-blue-700',
  activity: 'bg-green-100 text-green-700',
  reminder: 'bg-yellow-100 text-yellow-700',
}

export default function TeacherEventsPage() {
  const { user } = useAuth()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [filterCategory, setFilterCategory] = useState('')
  const [showPast, setShowPast] = useState(false)

  const { data: upcomingRes, isLoading } = useSWR(
    user ? ['teacher-upcoming-events', user.id] : null,
    () => getUpcomingEvents(30, 'teacher'),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const { data: allRes, isLoading: loadingAll } = useSWR(
    showPast && user ? ['teacher-all-events', user.id] : null,
    () => getEvents({ user_role: 'teacher', limit: 100, campus_id: campusId }),
    { revalidateOnFocus: false }
  )

  const upcoming = (upcomingRes?.data || []).filter(
    (e: SchoolEvent) => !filterCategory || e.category === filterCategory
  )
  const all: SchoolEvent[] = (allRes?.data || []).filter(
    e => !filterCategory || e.category === filterCategory
  )
  const past = all.filter(e => isPast(parseISO(e.start_at)) && !isToday(parseISO(e.start_at)))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">School Calendar</h1>
          <p className="text-muted-foreground mt-1">View upcoming school events and activities</p>
        </div>
        <Select value={filterCategory || 'all'} onValueChange={v => setFilterCategory(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="academic">Academic</SelectItem>
            <SelectItem value="holiday">Holiday</SelectItem>
            <SelectItem value="exam">Exam</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
            <SelectItem value="reminder">Reminder</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : upcoming.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No upcoming events</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Upcoming Events ({upcoming.length})</h2>
          <div className="grid gap-3">
            {upcoming.map(event => <EventCard key={event.id} event={event} />)}
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setShowPast(v => !v)}>
        {showPast ? 'Hide' : 'Show'} Past Events
        <ChevronRight className={`ml-1 h-4 w-4 transition-transform ${showPast ? 'rotate-90' : ''}`} />
      </Button>

      {showPast && (
        <div className="space-y-3 opacity-70">
          <h2 className="text-lg font-semibold">Past Events</h2>
          {loadingAll ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : past.length === 0 ? (
            <p className="text-muted-foreground text-sm">No past events.</p>
          ) : (
            <div className="grid gap-3">
              {past.map(event => <EventCard key={event.id} event={event} isPast />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EventCard({ event, isPast = false }: { event: SchoolEvent; isPast?: boolean }) {
  const start = parseISO(event.start_at)
  const today = isToday(start)
  const colorClass = CATEGORY_COLORS[event.category] || 'bg-gray-100 text-gray-700'

  return (
    <Card className={today && !isPast ? 'border-2 border-primary' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="min-w-[56px] text-center bg-muted rounded-lg p-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">{format(start, 'MMM')}</p>
            <p className="text-xl font-bold leading-none">{format(start, 'd')}</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold">{event.title}</h3>
              <Badge className={`text-xs ${colorClass}`}>{event.category}</Badge>
              {today && !isPast && <Badge>Today</Badge>}
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {event.is_all_day
                ? 'All day'
                : `${format(start, 'h:mm a')} – ${format(parseISO(event.end_at), 'h:mm a')}`}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
