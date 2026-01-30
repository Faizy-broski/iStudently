'use client'

import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Clock, Users } from 'lucide-react'
import { format, parseISO, isFuture, isPast, isToday } from 'date-fns'

export default function ParentEventsPage() {
  // Sample events data - in production, this would come from API
  const events = [
    {
      id: '1',
      title: 'Parent-Teacher Meeting',
      description: 'Discuss your child\'s progress with teachers',
      date: '2026-02-05',
      time: '2:00 PM - 5:00 PM',
      location: 'School Auditorium',
      type: 'meeting',
      attendees: 'Parents & Teachers'
    },
    {
      id: '2',
      title: 'Annual Sports Day',
      description: 'Inter-house sports competition and athletic events',
      date: '2026-02-15',
      time: '9:00 AM - 4:00 PM',
      location: 'School Grounds',
      type: 'sports',
      attendees: 'All Students & Parents'
    },
    {
      id: '3',
      title: 'Science Fair',
      description: 'Student projects and experiments showcase',
      date: '2026-02-20',
      time: '10:00 AM - 3:00 PM',
      location: 'Science Block',
      type: 'academic',
      attendees: 'Students & Visitors'
    },
    {
      id: '4',
      title: 'Winter Break Begins',
      description: 'School closes for winter vacation',
      date: '2026-03-01',
      time: 'After school',
      location: 'N/A',
      type: 'holiday',
      attendees: 'All Students'
    },
    {
      id: '5',
      title: 'Mid-term Exams Start',
      description: 'First semester mid-term examinations begin',
      date: '2026-02-10',
      time: '8:00 AM onwards',
      location: 'Classrooms',
      type: 'exam',
      attendees: 'All Students'
    }
  ]

  // Sort events by date
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const upcomingEvents = sortedEvents.filter(e => isFuture(parseISO(e.date)) || isToday(parseISO(e.date)))
  const pastEvents = sortedEvents.filter(e => isPast(parseISO(e.date)) && !isToday(parseISO(e.date)))

  return (
    <ParentDashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">School Events</h2>
          <p className="text-gray-500 mt-1">Stay updated with school activities and events</p>
        </div>

        {/* Upcoming Events */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Upcoming Events</h3>
          {upcomingEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No upcoming events</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Past Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} isPast />
              ))}
            </div>
          </div>
        )}
      </div>
    </ParentDashboardLayout>
  )
}

function EventCard({ event, isPast = false }: { event: any, isPast?: boolean }) {
  const date = parseISO(event.date)
  const today = isToday(date)

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'sports': return 'bg-green-100 text-green-700 border-green-200'
      case 'academic': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'holiday': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'exam': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getEventTypeBadge = (type: string) => {
    switch (type) {
      case 'meeting': return 'Meeting'
      case 'sports': return 'Sports'
      case 'academic': return 'Academic'
      case 'holiday': return 'Holiday'
      case 'exam': return 'Examination'
      default: return 'Event'
    }
  }

  return (
    <Card className={`${today && !isPast ? 'border-2 border-[#57A3CC] bg-blue-50' : ''} ${isPast ? 'grayscale' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{event.title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={getEventTypeColor(event.type)}>
                {getEventTypeBadge(event.type)}
              </Badge>
              {today && !isPast && (
                <Badge className="bg-[#57A3CC]">Today</Badge>
              )}
              {isPast && (
                <Badge variant="outline">Completed</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 mb-4">{event.description}</p>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">
              {format(date, 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">{event.time}</span>
          </div>
          
          {event.location !== 'N/A' && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{event.location}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">{event.attendees}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
