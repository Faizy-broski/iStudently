'use client'

import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Loader2 } from 'lucide-react'

export default function ParentTimetablePage() {
  return (
    <ParentDashboardLayout>
      <TimetableContent />
    </ParentDashboardLayout>
  )
}

function TimetableContent() {
  const { selectedStudent } = useParentDashboard()

  if (!selectedStudent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Please select a student to view timetable</p>
        </CardContent>
      </Card>
    )
  }

  // Sample timetable data - in production, this would come from API
  const timetable = {
    Monday: [
      { subject: 'Mathematics', time: '8:00 AM - 9:00 AM', teacher: 'Mr. Johnson', room: 'Room 101' },
      { subject: 'English', time: '9:00 AM - 10:00 AM', teacher: 'Ms. Davis', room: 'Room 205' },
      { subject: 'Break', time: '10:00 AM - 10:30 AM', isBreak: true },
      { subject: 'Science', time: '10:30 AM - 11:30 AM', teacher: 'Dr. Smith', room: 'Lab 1' },
      { subject: 'History', time: '11:30 AM - 12:30 PM', teacher: 'Mrs. Brown', room: 'Room 302' },
      { subject: 'Lunch', time: '12:30 PM - 1:30 PM', isBreak: true },
      { subject: 'Art', time: '1:30 PM - 2:30 PM', teacher: 'Ms. Wilson', room: 'Art Room' },
    ],
    Tuesday: [
      { subject: 'Science', time: '8:00 AM - 9:00 AM', teacher: 'Dr. Smith', room: 'Lab 1' },
      { subject: 'Mathematics', time: '9:00 AM - 10:00 AM', teacher: 'Mr. Johnson', room: 'Room 101' },
      { subject: 'Break', time: '10:00 AM - 10:30 AM', isBreak: true },
      { subject: 'Physical Education', time: '10:30 AM - 11:30 AM', teacher: 'Coach Miller', room: 'Gym' },
      { subject: 'English', time: '11:30 AM - 12:30 PM', teacher: 'Ms. Davis', room: 'Room 205' },
      { subject: 'Lunch', time: '12:30 PM - 1:30 PM', isBreak: true },
      { subject: 'Computer Science', time: '1:30 PM - 2:30 PM', teacher: 'Mr. Garcia', room: 'Computer Lab' },
    ],
    Wednesday: [
      { subject: 'English', time: '8:00 AM - 9:00 AM', teacher: 'Ms. Davis', room: 'Room 205' },
      { subject: 'History', time: '9:00 AM - 10:00 AM', teacher: 'Mrs. Brown', room: 'Room 302' },
      { subject: 'Break', time: '10:00 AM - 10:30 AM', isBreak: true },
      { subject: 'Mathematics', time: '10:30 AM - 11:30 AM', teacher: 'Mr. Johnson', room: 'Room 101' },
      { subject: 'Music', time: '11:30 AM - 12:30 PM', teacher: 'Ms. Anderson', room: 'Music Room' },
      { subject: 'Lunch', time: '12:30 PM - 1:30 PM', isBreak: true },
      { subject: 'Science', time: '1:30 PM - 2:30 PM', teacher: 'Dr. Smith', room: 'Lab 1' },
    ],
    Thursday: [
      { subject: 'Mathematics', time: '8:00 AM - 9:00 AM', teacher: 'Mr. Johnson', room: 'Room 101' },
      { subject: 'Computer Science', time: '9:00 AM - 10:00 AM', teacher: 'Mr. Garcia', room: 'Computer Lab' },
      { subject: 'Break', time: '10:00 AM - 10:30 AM', isBreak: true },
      { subject: 'English', time: '10:30 AM - 11:30 AM', teacher: 'Ms. Davis', room: 'Room 205' },
      { subject: 'Science', time: '11:30 AM - 12:30 PM', teacher: 'Dr. Smith', room: 'Lab 1' },
      { subject: 'Lunch', time: '12:30 PM - 1:30 PM', isBreak: true },
      { subject: 'Physical Education', time: '1:30 PM - 2:30 PM', teacher: 'Coach Miller', room: 'Gym' },
    ],
    Friday: [
      { subject: 'History', time: '8:00 AM - 9:00 AM', teacher: 'Mrs. Brown', room: 'Room 302' },
      { subject: 'Art', time: '9:00 AM - 10:00 AM', teacher: 'Ms. Wilson', room: 'Art Room' },
      { subject: 'Break', time: '10:00 AM - 10:30 AM', isBreak: true },
      { subject: 'Mathematics', time: '10:30 AM - 11:30 AM', teacher: 'Mr. Johnson', room: 'Room 101' },
      { subject: 'English', time: '11:30 AM - 12:30 PM', teacher: 'Ms. Davis', room: 'Room 205' },
      { subject: 'Lunch', time: '12:30 PM - 1:30 PM', isBreak: true },
      { subject: 'Library Period', time: '1:30 PM - 2:30 PM', teacher: 'Ms. Thompson', room: 'Library' },
    ],
  }

  const days = Object.keys(timetable)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold dark:text-white">Class Timetable</h2>
        <p className="text-gray-500 mt-1">Weekly class schedule</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {days.map((day) => (
          <Card key={day} className={day === today ? 'border-[#57A3CC] border-2 bg-blue-50' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{day}</CardTitle>
                {day === today && (
                  <Badge className="bg-[#57A3CC]">Today</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {timetable[day as keyof typeof timetable].map((period, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg ${
                      period.isBreak 
                        ? 'bg-gray-100 border border-gray-200' 
                        : day === today 
                          ? 'bg-white border border-blue-200' 
                          : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className={`font-semibold text-sm ${period.isBreak ? 'text-gray-600' : ''}`}>
                        {period.subject}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{period.time}</p>
                    {!period.isBreak && (
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>{period.teacher}</p>
                        <p>{period.room}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Reference */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle>Quick Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600 mb-1">School Start</p>
              <p className="font-semibold">8:00 AM</p>
            </div>
            <div>
              <p className="text-gray-600 mb-1">School End</p>
              <p className="font-semibold">2:30 PM</p>
            </div>
            <div>
              <p className="text-gray-600 mb-1">Break Time</p>
              <p className="font-semibold">10:00 - 10:30 AM</p>
            </div>
            <div>
              <p className="text-gray-600 mb-1">Lunch Time</p>
              <p className="font-semibold">12:30 - 1:30 PM</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
