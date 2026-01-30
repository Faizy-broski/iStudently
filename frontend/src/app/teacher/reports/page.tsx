"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, BarChart3, Download, Calendar, Users, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import useSWR from 'swr'
import * as teachersApi from '@/lib/api/teachers'
import { TeacherSubjectAssignment } from '@/types'

const fetcher = async () => {
  return await teachersApi.getTeacherAssignments()
}

export default function ReportsPage() {
  const { profile } = useAuth()
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  const { data: teacherAssignments, isLoading } = useSWR<TeacherSubjectAssignment[]>(
    profile?.staff_id ? 'teacher-assignments' : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    // Set default date range (current month)
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    setDateRange({
      from: firstDay.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    })
  }, [])

  const uniqueSections = Array.from(new Set((teacherAssignments || []).map(ta => ta.section_id)))
    .map(sectionId => (teacherAssignments || []).find(ta => ta.section_id === sectionId)!)
    .filter(Boolean)

  const handleGenerateReport = (reportType: string) => {
    if (!selectedSection && reportType !== 'all') {
      toast.error('Please select a section')
      return
    }
    
    toast.info(`Generating ${reportType} report... (Feature under development)`)
  }

  if (isLoading && !teacherAssignments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">Class Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate performance and attendance reports for parent-teacher meetings
        </p>
      </div>

      {/* Filters */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4">Report Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Section</label>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a section" />
              </SelectTrigger>
              <SelectContent>
                {uniqueSections.map(assignment => (
                  <SelectItem key={assignment.section_id} value={assignment.section_id}>
                    {assignment.section?.name} ({assignment.section?.grade_level?.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>
      </Card>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Report */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Attendance Report</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Detailed attendance summary with present, absent, and late statistics for selected date range.
              </p>
              <Button
                onClick={() => handleGenerateReport('attendance')}
                className="w-full"
                style={{ background: 'var(--gradient-blue)' }}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Attendance Report
              </Button>
            </div>
          </div>
        </Card>

        {/* Performance Report */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-green-100">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Performance Report</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Academic performance analysis including exam results, grades, and improvement trends.
              </p>
              <Button
                onClick={() => handleGenerateReport('performance')}
                className="w-full"
                style={{ background: 'var(--gradient-blue)' }}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Performance Report
              </Button>
            </div>
          </div>
        </Card>

        {/* Assignment Report */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-purple-100">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Assignment Report</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Assignment submission rates, grades, and completion statistics for the class.
              </p>
              <Button
                onClick={() => handleGenerateReport('assignment')}
                className="w-full"
                style={{ background: 'var(--gradient-blue)' }}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Assignment Report
              </Button>
            </div>
          </div>
        </Card>

        {/* Class Summary Report */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-orange-100">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Class Summary Report</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comprehensive class summary including all metrics for parent-teacher meetings.
              </p>
              <Button
                onClick={() => handleGenerateReport('summary')}
                className="w-full"
                style={{ background: 'var(--gradient-blue)' }}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Class Summary
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex gap-4">
          <BarChart3 className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">About Class Reports</h3>
            <p className="text-sm text-blue-800">
              Class reports provide comprehensive insights into student performance, attendance patterns, and academic progress. 
              These reports are designed for parent-teacher meetings and can be exported in PDF format. 
              Select a section and date range to generate customized reports.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
