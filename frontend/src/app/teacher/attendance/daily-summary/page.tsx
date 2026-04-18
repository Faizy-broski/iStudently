'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getStaffAttendanceChart } from '@/lib/api/attendance'
import { Loader2, TrendingUp, Calendar, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { format, subDays } from 'date-fns'

export default function TeacherAttendanceChartPage() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })

  // Using strictly scoped Zero-Trust teacher endpoints
  const { data: chartRes, isLoading } = useSWR(
    ['teacher-attendance-chart', dateRange.start, dateRange.end],
    () => getStaffAttendanceChart(dateRange.start, dateRange.end),
    { revalidateOnFocus: false }
  )

  const chartData = chartRes?.data

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Attendance Chart</h1>
          <p className="text-muted-foreground mt-1">View cumulative attendance patterns for students you teach.</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-md shadow-sm border">
          <Calendar className="h-5 w-5 text-muted-foreground ml-2" />
          <Input 
            type="date" 
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="border-0 shadow-none h-8 w-36"
          />
          <span className="text-muted-foreground">to</span>
          <Input 
            type="date" 
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="border-0 shadow-none h-8 w-36"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !chartData || chartData.labels.length === 0 ? (
        <Card>
          <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 pb-2 text-primary/50" />
            <p>No attendance data generated for this timeframe.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
               <CardTitle className="text-lg flex items-center gap-2">
                 <TrendingUp className="h-5 w-5 text-blue-500" /> Overall Daily Present Rates
               </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chartData.labels.map((label, idx) => {
                  const present = chartData.present[idx] || 0;
                  const absent = chartData.absent[idx] || 0;
                  const late = chartData.half_day[idx] || 0;
                  const total = present + absent + late;
                  const percent = total > 0 ? Math.round((present / total) * 100) : 0;

                  return (
                    <div key={label} className="flex items-center gap-4">
                       <div className="w-24 text-sm font-medium text-muted-foreground">
                         {format(new Date(label), 'MMM d, yyyy')}
                       </div>
                       <div className="flex-1 bg-gray-100 h-4 rounded-full overflow-hidden flex">
                         <div style={{ width: `${percent}%` }} className="bg-green-500 h-full" />
                         <div style={{ width: `${(absent/total)*100}%` }} className="bg-red-500 h-full" />
                         <div style={{ width: `${(late/total)*100}%` }} className="bg-yellow-500 h-full" />
                       </div>
                       <div className="w-16 text-right font-bold text-sm">
                         {percent}%
                       </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
