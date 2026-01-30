'use client'

import { useStudentDashboard } from '@/hooks/useStudentDashboard'
import { Clock, BookOpen, AlertCircle, TrendingUp, Calendar } from 'lucide-react'
import { format, formatDistance, isToday, isTomorrow } from 'date-fns'

export default function StudentDashboardPage() {
  const { overview, isLoading, error, refresh } = useStudentDashboard()

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="font-medium text-red-900">Error Loading Dashboard</h3>
            <p className="text-sm text-red-700">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  const getAssignmentUrgency = (dueDate: string) => {
    const due = new Date(dueDate)
    if (isToday(due)) return { color: 'red', label: 'Due Today' }
    if (isTomorrow(due)) return { color: 'orange', label: 'Due Tomorrow' }
    return { color: 'blue', label: formatDistance(due, new Date(), { addSuffix: true }) }
  }

  const getTimeStatus = (startTime: string) => {
    const now = new Date()
    const classTime = new Date()
    const [hours, minutes] = startTime.split(':')
    classTime.setHours(parseInt(hours), parseInt(minutes), 0)

    const diffMinutes = Math.floor((classTime.getTime() - now.getTime()) / 60000)
    
    if (diffMinutes < -30) return { status: 'past', text: 'Completed' }
    if (diffMinutes <= 0) return { status: 'current', text: 'In Progress' }
    if (diffMinutes <= 15) return { status: 'soon', text: 'Starting Soon' }
    return { status: 'upcoming', text: `in ${diffMinutes} min` }
  }

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back!</h1>
        <p className="text-gray-600 mt-1">Here's what's happening today</p>
      </div>

      {/* At a Glance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Timetable */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Today's Schedule</h2>
                <p className="text-blue-100 text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {overview?.todayTimetable && overview.todayTimetable.length > 0 ? (
              <div className="space-y-4">
                {overview.todayTimetable.map((classItem) => {
                  const timeStatus = getTimeStatus(classItem.start_time)
                  return (
                    <div 
                      key={classItem.id}
                      className={`p-4 rounded-lg border-l-4 transition-all ${
                        timeStatus.status === 'current' 
                          ? 'border-green-500 bg-green-50' 
                          : timeStatus.status === 'soon'
                          ? 'border-yellow-500 bg-yellow-50'
                          : timeStatus.status === 'past'
                          ? 'border-gray-300 bg-gray-50 opacity-60'
                          : 'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-gray-900">
                              {classItem.subject.name}
                            </h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              timeStatus.status === 'current'
                                ? 'bg-green-200 text-green-800'
                                : timeStatus.status === 'soon'
                                ? 'bg-yellow-200 text-yellow-800'
                                : timeStatus.status === 'past'
                                ? 'bg-gray-200 text-gray-600'
                                : 'bg-blue-200 text-blue-800'
                            }`}>
                              {timeStatus.text}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mt-1">
                            {classItem.teacher.profile.first_name} {classItem.teacher.profile.last_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">
                              {classItem.start_time} - {classItem.end_time}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Room {classItem.room_number}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No classes scheduled for today</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          {/* Attendance Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900">Your Attendance</h3>
            </div>
            
            <div className="text-center py-4">
              <div className="text-5xl font-bold text-green-600 mb-2">
                {overview?.attendanceSummary.percentage}%
              </div>
              <p className="text-gray-600 text-sm">
                {overview?.attendanceSummary.presentDays} of {overview?.attendanceSummary.totalDays} days present
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Absent:</span>
                <span className="ml-2 font-semibold text-red-600">
                  {overview?.attendanceSummary.absentDays}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Late:</span>
                <span className="ml-2 font-semibold text-orange-600">
                  {overview?.attendanceSummary.lateDays}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Feedback */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900">Recent Feedback</h3>
            </div>

            {overview?.recentFeedback && overview.recentFeedback.length > 0 ? (
              <div className="space-y-3">
                {overview.recentFeedback.map((feedback) => {
                  const percentage = (feedback.marks_obtained / feedback.assignment.max_score) * 100
                  return (
                    <div key={feedback.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {feedback.assignment.subject.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {feedback.assignment.title}
                          </p>
                        </div>
                        <div className={`text-right ${
                          percentage >= 80 ? 'text-green-600' : 
                          percentage >= 60 ? 'text-blue-600' : 
                          'text-orange-600'
                        }`}>
                          <div className="text-lg font-bold">
                            {feedback.marks_obtained}/{feedback.assignment.max_score}
                          </div>
                          <div className="text-xs">
                            {percentage.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      {feedback.feedback && (
                        <p className="text-xs text-gray-600 mt-2 italic">
                          "{feedback.feedback}"
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 text-sm">
                No recent feedback available
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Due Soon Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Due Soon (Next 48 Hours)</h2>
          </div>
        </div>

        <div className="p-6">
          {overview?.dueAssignments && overview.dueAssignments.length > 0 ? (
            <div className="space-y-3">
              {overview.dueAssignments.map((assignment) => {
                const urgency = getAssignmentUrgency(assignment.due_date)
                return (
                  <div 
                    key={assignment.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      urgency.color === 'red' 
                        ? 'border-red-500 bg-red-50' 
                        : urgency.color === 'orange'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-blue-500 bg-blue-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-gray-900">{assignment.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            urgency.color === 'red'
                              ? 'bg-red-200 text-red-900'
                              : urgency.color === 'orange'
                              ? 'bg-orange-200 text-orange-900'
                              : 'bg-blue-200 text-blue-900'
                          }`}>
                            {urgency.label}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mt-1">
                          {assignment.subject.name} • {assignment.teacher.profile.first_name} {assignment.teacher.profile.last_name}
                        </p>
                        {assignment.description && (
                          <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                            {assignment.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm font-medium text-gray-700">
                          {format(new Date(assignment.due_date), 'MMM d, h:mm a')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {assignment.max_score} marks
                        </div>
                        {assignment.submission ? (
                          <div className="mt-2">
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                              Submitted
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                              Not Submitted
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No assignments due in the next 48 hours</p>
              <p className="text-sm mt-1">You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
