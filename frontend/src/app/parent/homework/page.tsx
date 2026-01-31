'use client'

import { useState, useMemo } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { useHomework } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  BookOpen, 
  Calendar,
  Filter
} from 'lucide-react'
import { StudentSelector } from '@/components/parent/StudentSelector'
import { format, parseISO } from 'date-fns'

const MONTHS = [
  { value: 0, label: 'All Months' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
]

export default function ParentHomeworkPage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = All months
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  const { selectedStudent, students, isLoading: studentsLoading } = useParentDashboard()
  const { homework, isLoading: homeworkLoading, error } = useHomework(90) // Get 90 days of homework

  const student = students.find(s => s.id === selectedStudent)
  const isLoading = studentsLoading || homeworkLoading

  // Categorize homework
  const categorizedHomework = useMemo(() => {
    if (!homework || homework.length === 0) {
      return { pending: [], submitted: [], overdue: [] }
    }

    const now = new Date()
    
    // Filter by month if selected
    let filtered = homework
    if (selectedMonth > 0) {
      filtered = homework.filter((h: any) => {
        const dueDate = new Date(h.due_date)
        return dueDate.getMonth() + 1 === selectedMonth && dueDate.getFullYear() === selectedYear
      })
    }

    const pending = filtered.filter((h: any) => 
      h.status === 'pending'
    )
    const submitted = filtered.filter((h: any) => 
      h.status === 'submitted' || h.status === 'graded'
    )
    const overdue = filtered.filter((h: any) => 
      h.status === 'overdue'
    )

    return { pending, submitted, overdue }
  }, [homework, selectedMonth, selectedYear])

  // Stats
  const stats = {
    pending: categorizedHomework.pending.length,
    submitted: categorizedHomework.submitted.length,
    overdue: categorizedHomework.overdue.length
  }

  const renderHomeworkRow = (hw: any, showStatus = false) => {
    const isOverdue = hw.status === 'pending' && new Date(hw.due_date) < new Date()
    
    return (
      <div 
        key={hw.id} 
        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold truncate">{hw.title}</h4>
              <Badge variant="outline" className="text-xs">{hw.subject}</Badge>
              {showStatus && (
                <Badge 
                  variant={
                    hw.status === 'graded' ? 'default' :
                    hw.status === 'submitted' ? 'secondary' :
                    isOverdue ? 'destructive' : 'outline'
                  }
                >
                  {isOverdue ? 'Overdue' : hw.status}
                </Badge>
              )}
            </div>
            {hw.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{hw.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {format(parseISO(hw.due_date), 'MMM d, yyyy')}
              </span>
              {hw.teacher_name && (
                <span>By: {hw.teacher_name}</span>
              )}
            </div>
          </div>
        </div>
        {hw.marks_obtained !== undefined && hw.marks_obtained !== null && (
          <Badge className="bg-green-500 ml-4">
            {hw.marks_obtained}/{hw.total_marks || 100}
          </Badge>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading homework</h3>
              <p className="text-red-700 dark:text-red-300">{error?.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-8 w-8" />
            Homework
          </h1>
          <p className="text-muted-foreground mt-1">
            {student ? `${student.first_name} ${student.last_name}'s assignments` : 'View assignments and homework status'}
          </p>
        </div>
        <StudentSelector />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full w-fit mx-auto mb-3">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full w-fit mx-auto mb-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.submitted}</p>
            <p className="text-sm text-muted-foreground">Submitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mx-auto mb-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs with Month Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Homework Assignments</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={`${selectedMonth}-${selectedYear}`} 
                onValueChange={(value) => {
                  const [month, year] = value.split('-')
                  setSelectedMonth(parseInt(month))
                  setSelectedYear(parseInt(year))
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(month => (
                    <SelectItem key={month.value} value={`${month.value}-${selectedYear}`}>
                      {month.label} {month.value > 0 ? selectedYear : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending ({stats.pending})
              </TabsTrigger>
              <TabsTrigger value="submitted" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Submitted ({stats.submitted})
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Overdue ({stats.overdue})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {categorizedHomework.pending.length > 0 ? (
                <div className="space-y-3">
                  {categorizedHomework.pending
                    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                    .map((hw: any) => renderHomeworkRow(hw))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">No pending homework!</p>
                  <p className="text-sm">All assignments are up to date</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="submitted">
              {categorizedHomework.submitted.length > 0 ? (
                <div className="space-y-3">
                  {categorizedHomework.submitted
                    .sort((a: any, b: any) => new Date(b.submission_date || b.due_date).getTime() - new Date(a.submission_date || a.due_date).getTime())
                    .map((hw: any) => renderHomeworkRow(hw, true))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">No submitted homework</p>
                  <p className="text-sm">Submissions will appear here</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="overdue">
              {categorizedHomework.overdue.length > 0 ? (
                <div className="space-y-3">
                  {categorizedHomework.overdue
                    .sort((a: any, b: any) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
                    .map((hw: any) => renderHomeworkRow(hw, true))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg text-green-600">No overdue homework!</p>
                  <p className="text-sm">Great job staying on track</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
