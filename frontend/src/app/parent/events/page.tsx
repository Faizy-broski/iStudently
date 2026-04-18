'use client'

import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { getUpcomingEvents, getEvents, type SchoolEvent } from '@/lib/api/events'
import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Calendar, Clock } from 'lucide-react'
import { format, parseISO, isToday, isPast } from 'date-fns'
import { useState } from 'react'

const CATEGORY_COLORS: Record<string, string> = {
  academic: 'bg-purple-100 text-purple-700 border-purple-200',
  holiday: 'bg-orange-100 text-orange-700 border-orange-200',
  exam: 'bg-red-100 text-red-700 border-red-200',
  meeting: 'bg-blue-100 text-blue-700 border-blue-200',
  activity: 'bg-green-100 text-green-700 border-green-200',
  reminder: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

export default function ParentEventsPage() {
  const { user, profile } = useAuth()
  const [showPast, setShowPast] = useState(false)

  const { data: upcomingRes, isLoading } = useSWR(
    user && profile?.role === 'parent' ? ['parent-upcoming-events', user.id] : null,
    () => getUpcomingEvents(30, 'parent'),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const { data: allRes } = useSWR(
    showPast && user ? ['parent-all-events', user.id] : null,
    () => getEvents({ user_role: 'parent', limit: 100 }),
    { revalidateOnFocus: false }
  )

  const upcoming: SchoolEvent[] = upcomingRes?.data || []
  const all: SchoolEvent[] = allRes?.data || []
  const past = all.filter(e => isPast(parseISO(e.start_at)) && !isToday(parseISO(e.start_at)))

  return (
    <ParentDashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">School Events</h2>
          <p className="text-gray-500 mt-1">Stay updated with school activities and events</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No upcoming events</p>
            </CardContent>
          </Card>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-4">Upcoming Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {upcoming.map(event => <EventCard key={event.id} event={event} />)}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Past Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
              {past.map(event => <EventCard key={event.id} event={event} isPast />)}
            </div>
          </div>
        )}
      </div>
    </ParentDashboardLayout>
  )
}

function EventCard({ event, isPast = false }: { event: SchoolEvent; isPast?: boolean }) {
  const start = parseISO(event.start_at)
  const today = isToday(start)
  const colorClass = CATEGORY_COLORS[event.category] || 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <Card className={`${today && !isPast ? 'border-2 border-[#57A3CC] bg-blue-50' : ''} ${isPast ? 'grayscale' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{event.title}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={colorClass}>{event.category}</Badge>
              {today && !isPast && <Badge className="bg-[#57A3CC]">Today</Badge>}
              {isPast && <Badge variant="outline">Completed</Badge>}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {event.description && (
          <p className="text-sm text-gray-700 mb-4">{event.description}</p>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">{format(start, 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">
              {event.is_all_day
                ? 'All day'
                : `${format(start, 'h:mm a')} – ${format(parseISO(event.end_at), 'h:mm a')}`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
