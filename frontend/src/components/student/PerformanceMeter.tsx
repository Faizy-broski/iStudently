'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Users, Star, Smile, FileText, Info } from 'lucide-react'
import { usePerformanceMetrics } from '@/hooks/useStudentDashboard'

// Helper to determine color and text based on percentage
const getPerformanceState = (percentage: number) => {
  if (percentage >= 95) return { color: 'bg-blue-600', textColor: 'text-blue-600', text: 'متميز' } // Distinguished
  if (percentage >= 85) return { color: 'bg-green-500', textColor: 'text-green-500', text: 'ممتاز' } // Excellent
  if (percentage >= 75) return { color: 'bg-yellow-500', textColor: 'text-yellow-500', text: 'جيد' } // Good
  if (percentage >= 60) return { color: 'bg-orange-500', textColor: 'text-orange-500', text: 'مقبول' } // Acceptable
  return { color: 'bg-red-500', textColor: 'text-red-500', text: 'يحتاج متابعة' } // Requires Follow-up
}

export function PerformanceMeter() {
  const { metrics, isLoading } = usePerformanceMetrics()

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-md border-none overflow-hidden animate-pulse min-h-[300px]">
        <div className="bg-gray-100 dark:bg-slate-800 h-full w-full" />
      </Card>
    )
  }

  // Fallback if data fails to load
  const data = metrics || { overall: 0, attendance: 0, gradeAverage: 0, behavior: 0, assignments: 0 }
  
  const overallState = getPerformanceState(data.overall)

  return (
    <Card className="rounded-2xl shadow-md border-none overflow-hidden bg-card" dir="rtl">
      <CardHeader className="border-b border-gray-100 dark:border-slate-800 flex flex-row items-center justify-between py-4 px-6 bg-gray-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M12 17v-4" />
              <path d="M8 17v-7" />
              <path d="M16 17v-2" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 tracking-wide font-arabic">
            مؤشر الأداء | Performance Meter
          </h2>
        </div>
        <Info className="w-5 h-5 text-gray-400 dark:text-slate-500" />
      </CardHeader>

      <CardContent className="p-6">
        {/* Hero Score Section */}
        <div className="flex flex-col items-center justify-center mb-8">
          <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-widest">التقييم العام</span>
          <div className="text-6xl font-extrabold text-[#022172] dark:text-white tracking-tighter mb-3">
            {data.overall}%
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-bold bg-opacity-10 ${overallState.textColor} bg-current`}>
            {overallState.text}
          </span>
        </div>

        {/* Master Progress Bar */}
        <div className="relative mb-10 w-full px-2">
          <div className="h-3 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
            {/* Gradient fill matching the state */}
            <div 
              className={`h-full transition-all duration-1000 ease-out rounded-full ${overallState.color}`}
              style={{ width: `${data.overall}%` }}
            />
          </div>
          {/* Custom thumb/indicator */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white dark:bg-slate-900 border-2 rounded-full shadow-sm transition-all duration-1000 ease-out flex items-center justify-center z-10"
            style={{ 
              right: `calc(${data.overall}% - 10px)`, 
              borderColor: overallState.color === 'bg-blue-600' ? '#2563EB' : 
                          overallState.color === 'bg-green-500' ? '#22C55E' : 
                          overallState.color === 'bg-yellow-500' ? '#EAB308' : 
                          overallState.color === 'bg-orange-500' ? '#F97316' : '#EF4444' 
            }}
          />
          {/* Axis Labels */}
          <div className="flex justify-between items-center text-[10px] font-medium text-gray-400 dark:text-slate-500 mt-3 px-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Sub-Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* 1. Attendance */}
          <div className="flex flex-col items-center p-4 rounded-xl border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow bg-white dark:bg-slate-900 relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-2 w-full justify-center">
              <Users className="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" />
              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">الحضور</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{data.attendance}%</span>
            <span className={`text-xs font-semibold mb-3 ${getPerformanceState(data.attendance).textColor}`}>
              {getPerformanceState(data.attendance).text}
            </span>
            <div className="w-16 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${getPerformanceState(data.attendance).color}`}
                style={{ width: `${data.attendance}%` }}
              />
            </div>
          </div>

          {/* 2. Grade Average */}
          <div className="flex flex-col items-center p-4 rounded-xl border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow bg-white dark:bg-slate-900 relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-2 w-full justify-center">
              <Star className="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-yellow-500 transition-colors" />
              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">المعدل</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{data.gradeAverage}%</span>
            <span className={`text-xs font-semibold mb-3 ${getPerformanceState(data.gradeAverage).textColor}`}>
              {getPerformanceState(data.gradeAverage).text}
            </span>
            <div className="w-16 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${getPerformanceState(data.gradeAverage).color}`}
                style={{ width: `${data.gradeAverage}%` }}
              />
            </div>
          </div>

          {/* 3. Behavior */}
          <div className="flex flex-col items-center p-4 rounded-xl border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow bg-white dark:bg-slate-900 relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-2 w-full justify-center">
              <Smile className="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-green-500 transition-colors" />
              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">السلوك</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{data.behavior}%</span>
            <span className={`text-xs font-semibold mb-3 ${getPerformanceState(data.behavior).textColor}`}>
              {getPerformanceState(data.behavior).text}
            </span>
            <div className="w-16 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${getPerformanceState(data.behavior).color}`}
                style={{ width: `${data.behavior}%` }}
              />
            </div>
          </div>

          {/* 4. Assignments */}
          <div className="flex flex-col items-center p-4 rounded-xl border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow bg-white dark:bg-slate-900 relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-2 w-full justify-center">
              <FileText className="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-orange-500 transition-colors" />
              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">الواجبات</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{data.assignments}%</span>
            <span className={`text-xs font-semibold mb-3 ${getPerformanceState(data.assignments).textColor}`}>
              {getPerformanceState(data.assignments).text}
            </span>
            <div className="w-16 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${getPerformanceState(data.assignments).color}`}
                style={{ width: `${data.assignments}%` }}
              />
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}
