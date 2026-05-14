'use client'

import { useState } from 'react'
import { SetupAssistantPanel } from '@/components/setup-assistant/SetupAssistantPanel'
import { useStudentDashboard, useStudentInfo } from '@/hooks/useStudentDashboard'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import { getUpcomingEvents } from '@/lib/api/events'
import * as academicsApi from '@/lib/api/academics'
import * as mpApi from '@/lib/api/marking-periods'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { 
  Clock, 
  BookOpen, 
  AlertCircle, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  MapPin, 
  GraduationCap, 
  Phone, 
  Mail, 
  Building2,
  ChevronRight,
  Info,
  CheckCircle2
} from 'lucide-react'
import { format, formatDistance, isToday, isTomorrow, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function StudentDashboardPage() {
  const t = useTranslations('dashboard')
  const { overview, isLoading: isDashboardLoading, error: dashboardError } = useStudentDashboard()
  const { studentInfo, isLoading: isInfoLoading } = useStudentInfo()
  const campusContext = useCampus()
  const campus = campusContext?.selectedCampus
  const { selectedAcademicYear, academicYears, selectedQuarter } = useAcademic()
  // Fetch all quarters for the selected year and campus
  const { data: quarters } = useSWR(
    selectedAcademicYear && campus?.id ? ['marking-periods-qtr', selectedAcademicYear, campus.id] : null,
    async () => {
      const all = await mpApi.getMarkingPeriods(campus?.id)
      return all.filter(mp => mp.mp_type === 'QTR' && mp.parent_id === selectedAcademicYear)
    }
  )

  const currentQuarter = selectedQuarter || quarters?.find(q => q.id === localStorage.getItem('selectedQuarterId'))
  const currentYear = academicYears.find(q => q.id === selectedAcademicYear)

  const isLoading = isDashboardLoading || isInfoLoading

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl"></div>
            <div className="h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (dashboardError) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="font-medium text-red-900">{t('error_loading')}</h3>
            <p className="text-sm text-red-700">{dashboardError.message}</p>
          </div>
        </div>
      </div>
    )
  }

  const getAssignmentUrgency = (dueDate: string) => {
    const due = new Date(dueDate)
    if (isToday(due)) return { color: 'red', label: t('urgency.due_today') }
    if (isTomorrow(due)) return { color: 'orange', label: t('urgency.due_tomorrow') }
    return { color: 'blue', label: t('urgency.due_in', { time: formatDistance(due, new Date(), { addSuffix: true }) }) }
  }

  const getTimeStatus = (startTime: string) => {
    const now = new Date()
    const classTime = new Date()
    const [hours, minutes] = startTime.split(':')
    classTime.setHours(parseInt(hours), parseInt(minutes), 0)

    const diffMinutes = Math.floor((classTime.getTime() - now.getTime()) / 60000)
    
    if (diffMinutes < -30) return { status: 'past', text: t('status.completed') }
    if (diffMinutes <= 0) return { status: 'current', text: t('status.in_progress') }
    if (diffMinutes <= 15) return { status: 'soon', text: t('status.starting_soon') }
    return { status: 'upcoming', text: t('status.in_min', { min: diffMinutes }) }
  }

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* Premium Profile Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#022172] to-[#0535B2] p-8 text-white shadow-lg">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-white/20 shadow-xl">
            <AvatarImage src={studentInfo?.profile_photo_url || ''} />
            <AvatarFallback className="bg-[#EEA831] text-white text-2xl font-bold">
              {studentInfo?.first_name?.[0]}{studentInfo?.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold tracking-tight">
              {t('welcome_back', { name: studentInfo?.first_name || 'Student' })}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-3">
              <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-none px-3 py-1 gap-1.5 font-medium">
                <GraduationCap className="h-3.5 w-3.5" />
                {studentInfo?.grade_level_name} — {studentInfo?.section_name}
              </Badge>
              <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-none px-3 py-1 gap-1.5 font-medium">
                <Building2 className="h-3.5 w-3.5" />
                {campus?.name || studentInfo?.school_name}
              </Badge>
              {currentQuarter && (
                <Badge variant="secondary" className="bg-[#EEA831] text-[#022172] hover:bg-[#EEA831]/90 border-none px-3 py-1 font-bold">
                  {currentQuarter.title}
                </Badge>
              )}
            </div>
            <p className="mt-4 text-blue-100/80 text-sm flex items-center justify-center md:justify-start gap-2">
              <Clock className="h-4 w-4" />
              {t('last_login', { date: format(new Date(), 'MMM d, yyyy h:mm a') })}
            </p>
          </div>

          <div className="hidden lg:block bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
            <div className="text-sm text-blue-100/70 mb-1">{t('academic_progress')}</div>
            <div className="text-2xl font-bold text-white mb-2">{overview?.attendanceSummary.percentage}% <span className="text-xs font-normal text-blue-100/50">{t('attendance')}</span></div>
            <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#EEA831] transition-all duration-1000" 
                style={{ width: `${overview?.attendanceSummary.percentage}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      <SetupAssistantPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Schedule & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 flex flex-row items-center justify-between py-4 px-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-[#022172]" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t('schedule.title')}</CardTitle>
                  <p className="text-xs text-gray-500 font-medium">{format(new Date(), 'EEEE, MMMM d')}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[#022172] border-blue-100">
                {t('schedule.classes', { count: overview?.todayTimetable.length || 0 })}
              </Badge>
            </CardHeader>
            <CardContent className="p-6">
              {overview?.todayTimetable && overview.todayTimetable.length > 0 ? (
                <div className="space-y-4">
                  {overview.todayTimetable.map((classItem) => {
                    const timeStatus = getTimeStatus(classItem.start_time)
                    return (
                      <div 
                        key={classItem.id}
                        className={`group relative p-4 rounded-xl border border-gray-100 transition-all hover:shadow-md ${
                          timeStatus.status === 'current' 
                            ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100' 
                            : 'bg-white'
                        }`}
                      >
                        {timeStatus.status === 'current' && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-[#022172] rounded-r-full" />
                        )}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${
                              timeStatus.status === 'current' ? 'bg-[#022172] text-white' : 'bg-gray-100 text-gray-500'
                            }`}>
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{classItem.subject.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {classItem.start_time} - {classItem.end_time}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {t('schedule.room', { number: classItem.room_number })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={
                              timeStatus.status === 'current' ? 'bg-green-500 hover:bg-green-600 border-none' :
                              timeStatus.status === 'soon' ? 'bg-[#EEA831] text-[#022172] hover:bg-[#EEA831]/90 border-none' :
                              timeStatus.status === 'past' ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 border-none' :
                              'bg-blue-100 text-blue-700 hover:bg-blue-200 border-none'
                            }>
                              {timeStatus.text}
                            </Badge>
                            <p className="text-xs text-gray-400 mt-1.5 font-medium">
                              {classItem.teacher.profile.first_name} {classItem.teacher.profile.last_name}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{t('schedule.no_classes')}</h3>
                  <p className="text-sm text-gray-500 mt-1">{t('schedule.free_time')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Academic Hierarchy (Marking Periods) */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 py-4 px-6">
              <CardTitle className="text-lg flex items-center gap-2 text-[#022172]">
                <GraduationCap className="w-5 h-5" />
                {t('academic.hierarchy')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Year */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <Building2 className="w-3.5 h-3.5" />
                    {t('academic.year')}
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <h4 className="font-bold text-[#022172]">{currentYear?.name || t('academic.session')}</h4>
                    <p className="text-[10px] text-blue-600 mt-1 font-medium">
                      {currentYear?.start_date && format(parseISO(currentYear.start_date), 'MMM yyyy')} - {currentYear?.end_date && format(parseISO(currentYear.end_date), 'MMM yyyy')}
                    </p>
                  </div>
                </div>

                {/* Quarter */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {t('academic.quarter')}
                  </div>
                  <div className="p-4 rounded-xl bg-[#EEA831]/10 border border-[#EEA831]/20">
                    <h4 className="font-bold text-[#022172]">{currentQuarter?.title || t('academic.no_quarter')}</h4>
                    <p className="text-[10px] text-[#022172]/60 mt-1 font-medium">
                      {currentQuarter?.start_date && format(parseISO(currentQuarter.start_date), 'MMM d')} - {currentQuarter?.end_date && format(parseISO(currentQuarter.end_date), 'MMM d')}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('academic.grading_status')}
                  </div>
                  <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-green-800">{t('academic.grade_posting')}</span>
                      <Badge variant="secondary" className="bg-green-200 text-green-900 text-[9px] px-1.5 border-none">{t('academic.active')}</Badge>
                    </div>
                    <div className="w-full bg-green-200 h-1 rounded-full overflow-hidden">
                      <div className="bg-green-600 h-full w-[75%]" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Campus Info & Tasks */}
        <div className="space-y-6">
          {/* Campus Info Card (Compact) */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#022172] to-[#0535B2] text-white py-4 px-6">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#EEA831]" />
                {t('campus.details')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border p-2">
                    {campus?.logo_url ? (
                      <img src={campus.logo_url} alt="Campus Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 leading-tight">{campus?.name || studentInfo?.school_name}</h4>
                    <Badge variant="outline" className="mt-1.5 text-[9px] font-bold py-0 h-4 border-blue-100 text-blue-700 bg-blue-50/50">
                      {campus?.short_name || t('campus.active_campus')}
                    </Badge>
                  </div>
                </div>
                
                <Separator className="opacity-50" />
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('campus.address')}</p>
                      <p className="text-[11px] text-gray-600 leading-relaxed font-medium mt-0.5">
                        {campus?.address || studentInfo?.school_address || t('campus.not_provided')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-green-50 rounded-lg shrink-0">
                      <Phone className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('campus.contact')}</p>
                      <p className="text-[11px] text-gray-600 font-medium mt-0.5">{campus?.phone || studentInfo?.school_phone || t('campus.not_provided')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-purple-50 rounded-lg shrink-0">
                      <Mail className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('campus.email')}</p>
                      <p className="text-[11px] text-gray-600 font-medium mt-0.5 truncate">{campus?.contact_email || 'contact@istudents.ly'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-gray-500">{t('campus.principal')}: {campus?.principal_name || 'N/A'}</span>
                </div>
                <Info className="w-3 h-3 text-gray-300" />
              </div>
            </CardContent>
          </Card>

          {/* Due Soon Assignments */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 py-4 flex flex-row items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <CardTitle className="text-lg">{t('assignments.due_soon')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {overview?.dueAssignments && overview.dueAssignments.length > 0 ? (
                <div className="space-y-4">
                  {overview.dueAssignments.map((assignment) => {
                    const urgency = getAssignmentUrgency(assignment.due_date)
                    return (
                      <div 
                        key={assignment.id}
                        className="p-4 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <Badge className={
                              urgency.color === 'red' ? 'bg-red-100 text-red-700 border-none' :
                              urgency.color === 'orange' ? 'bg-orange-100 text-orange-700 border-none' :
                              'bg-blue-100 text-blue-700 border-none'
                            }>
                              {urgency.label}
                            </Badge>
                            <span className="text-xs font-bold text-gray-400">{assignment.max_score} pts</span>
                          </div>
                          <h4 className="font-bold text-gray-900 line-clamp-1">{assignment.title}</h4>
                          <p className="text-xs text-gray-500 mt-1 font-medium">{assignment.subject.name}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs">
                          <span className="text-gray-400">{format(new Date(assignment.due_date), 'MMM d, h:mm a')}</span>
                          {assignment.submission ? (
                            <span className="text-green-600 font-bold flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                              {t('assignments.submitted')}
                            </span>
                          ) : (
                            <span className="text-orange-600 font-bold flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                              {t('assignments.pending')}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6 text-gray-300" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{t('assignments.caught_up')}</h3>
                  <p className="text-xs text-gray-500 mt-1">{t('assignments.no_assignments')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  )
}
