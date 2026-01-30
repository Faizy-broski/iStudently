'use client'

import { useUpcomingExams } from '@/hooks/useStudentDashboard'
import { GraduationCap, Calendar, Clock, MapPin, FileText, AlertCircle } from 'lucide-react'
import { format, formatDistance, isPast, isToday, isTomorrow } from 'date-fns'

export default function ExamsPage() {
  const { exams, isLoading, error } = useUpcomingExams()

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error loading exams: {error.message}</p>
        </div>
      </div>
    )
  }

  const getExamUrgency = (examDate: string) => {
    const date = new Date(examDate)
    if (isPast(date)) return { color: 'gray', label: 'Completed', urgency: 'low' }
    if (isToday(date)) return { color: 'red', label: 'Today', urgency: 'critical' }
    if (isTomorrow(date)) return { color: 'orange', label: 'Tomorrow', urgency: 'high' }
    
    const daysUntil = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil <= 7) return { color: 'yellow', label: `In ${daysUntil} days`, urgency: 'medium' }
    return { color: 'blue', label: format(date, 'MMM d, yyyy'), urgency: 'low' }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upcoming Exams</h1>
        <p className="text-gray-600 mt-1">Stay prepared for your upcoming examinations</p>
      </div>

      {exams && exams.length > 0 ? (
        <div className="space-y-4">
          {exams.map((exam: any) => {
            const urgency = getExamUrgency(exam.exam_date)
            return (
              <div 
                key={exam.id}
                className={`bg-white rounded-xl border-l-4 shadow-sm hover:shadow-md transition-shadow ${
                  urgency.color === 'red'
                    ? 'border-red-500'
                    : urgency.color === 'orange'
                    ? 'border-orange-500'
                    : urgency.color === 'yellow'
                    ? 'border-yellow-500'
                    : urgency.color === 'gray'
                    ? 'border-gray-300'
                    : 'border-blue-500'
                }`}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <GraduationCap className={`w-6 h-6 ${
                          urgency.color === 'red'
                            ? 'text-red-600'
                            : urgency.color === 'orange'
                            ? 'text-orange-600'
                            : urgency.color === 'yellow'
                            ? 'text-yellow-600'
                            : urgency.color === 'gray'
                            ? 'text-gray-400'
                            : 'text-blue-600'
                        }`} />
                        <h2 className="text-2xl font-bold text-gray-900">{exam.title}</h2>
                      </div>
                      <div className="flex items-center gap-2 text-lg text-gray-700 mb-2">
                        <span className="font-medium">{exam.subject.name}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">{exam.subject.code}</span>
                      </div>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        urgency.color === 'red'
                          ? 'bg-red-100 text-red-800'
                          : urgency.color === 'orange'
                          ? 'bg-orange-100 text-orange-800'
                          : urgency.color === 'yellow'
                          ? 'bg-yellow-100 text-yellow-800'
                          : urgency.color === 'gray'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {urgency.label}
                      </span>
                    </div>

                    <div className={`text-right px-6 py-4 rounded-lg ${
                      urgency.color === 'red'
                        ? 'bg-red-50'
                        : urgency.color === 'orange'
                        ? 'bg-orange-50'
                        : urgency.color === 'yellow'
                        ? 'bg-yellow-50'
                        : 'bg-blue-50'
                    }`}>
                      <div className="text-sm text-gray-600 mb-1">Total Marks</div>
                      <div className={`text-4xl font-bold ${
                        urgency.color === 'red'
                          ? 'text-red-700'
                          : urgency.color === 'orange'
                          ? 'text-orange-700'
                          : urgency.color === 'yellow'
                          ? 'text-yellow-700'
                          : 'text-blue-700'
                      }`}>
                        {exam.total_marks}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Date</div>
                        <div className="font-medium text-gray-900">
                          {format(new Date(exam.exam_date), 'EEEE, MMM d, yyyy')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Time</div>
                        <div className="font-medium text-gray-900">
                          {exam.start_time} - {exam.end_time}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Room</div>
                        <div className="font-medium text-gray-900">
                          {exam.room_number || 'TBA'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {exam.instructions && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900 mb-1">Instructions</h4>
                          <p className="text-sm text-blue-800">{exam.instructions}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Exam Type: <span className="font-medium text-gray-900">{exam.exam_type}</span></span>
                      <span>Section: <span className="font-medium text-gray-900">{exam.section.name}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <GraduationCap className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Upcoming Exams</h3>
          <p className="text-gray-600">You don't have any exams scheduled at the moment</p>
        </div>
      )}

      {/* Preparation Tips */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-purple-600 mt-1" />
          <div>
            <h3 className="font-bold text-purple-900 mb-2">Exam Preparation Tips</h3>
            <ul className="text-purple-800 text-sm space-y-1 list-disc list-inside">
              <li>Start studying early - don't wait until the last minute</li>
              <li>Create a study schedule and stick to it</li>
              <li>Review your class notes and learning materials regularly</li>
              <li>Get enough sleep the night before the exam</li>
              <li>Arrive at the exam room at least 15 minutes early</li>
              <li>Bring all necessary materials (pens, pencils, calculator, etc.)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
