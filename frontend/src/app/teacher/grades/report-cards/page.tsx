'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useCampus } from '@/context/CampusContext'
import { getCoursePeriods, getStudentsForGrades, generateReportCards } from '@/lib/api/grades'
import { getMarkingPeriods } from '@/lib/api/marking-periods'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileText, Users, Award, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function TeacherReportCardsPage() {
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [selectedCPId, setSelectedCPId] = useState('')
  const [selectedMPId, setSelectedMPId] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [includePhoto, setIncludePhoto] = useState(false)

  const { data: cpData } = useSWR(
    ['teacher-cps-rc', campusId],
    () => getCoursePeriods(campusId),
    { revalidateOnFocus: false }
  )

  const { data: mpData } = useSWR(
    campusId ? ['marking-periods-rc', campusId] : null,
    () => getMarkingPeriods(campusId),
    { revalidateOnFocus: false }
  )

  const { data: studentsData, isLoading: studentsLoading } = useSWR(
    selectedCPId ? ['students-rc', selectedCPId] : null,
    () => getStudentsForGrades({ course_period_id: selectedCPId }),
    { revalidateOnFocus: false }
  )

  const coursePeriods = cpData?.data || []
  const markingPeriods = (mpData || []).filter((mp: any) => mp.mp_type === 'QTR' || mp.mp_type === 'SEM')
  const students = studentsData?.data || []

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    setSelectedStudents(prev =>
      prev.length === students.length ? [] : students.map((s: any) => s.id)
    )
  }

  const handleGenerate = async () => {
    if (!selectedMPId || selectedStudents.length === 0) {
      toast.warning('Please select a marking period and at least one student')
      return
    }
    setGenerating(true)
    try {
      const res = await generateReportCards({
        marking_period_id: selectedMPId,
        student_ids: selectedStudents,
        include_student_photo: includePhoto
      })
      if (res.success) {
        toast.success(`Report cards generated for ${selectedStudents.length} student(s)`)
      } else {
        toast.error(res.error || 'Failed to generate report cards')
      }
    } catch {
      toast.error('Failed to generate report cards')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Report Cards</h1>
        <p className="text-muted-foreground mt-1">Generate and review student report cards</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Course Period (optional filter)</label>
              <Select value={selectedCPId || 'all'} onValueChange={v => { setSelectedCPId(v === 'all' ? '' : v); setSelectedStudents([]) }}>
                <SelectTrigger>
                  <SelectValue placeholder="All my classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All my classes</SelectItem>
                  {coursePeriods.map((cp: any) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {cp.course?.title || 'Unnamed Course'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Marking Period <span className="text-red-500">*</span></label>
              <Select value={selectedMPId} onValueChange={setSelectedMPId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select marking period" />
                </SelectTrigger>
                <SelectContent>
                  {markingPeriods.map((mp: any) => (
                    <SelectItem key={mp.id} value={mp.id}>{mp.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="include-photo"
                checked={includePhoto}
                onCheckedChange={v => setIncludePhoto(Boolean(v))}
              />
              <label htmlFor="include-photo" className="text-sm cursor-pointer">Include student photo</label>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardContent className="p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Award className="h-4 w-4" /> Generate Report Cards
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select a marking period and students, then generate their report cards.
            </p>
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!selectedMPId || selectedStudents.length === 0 || generating}
            >
              {generating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                : <><FileText className="h-4 w-4 mr-2" /> Generate for {selectedStudents.length} student(s)</>
              }
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Students
            </CardTitle>
            {students.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedStudents.length} selected</Badge>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedCPId ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2" />
              <p>Select a course period to filter students, or select all below</p>
              <p className="text-xs mt-1">A marking period is required to generate report cards</p>
            </div>
          ) : studentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-2" />
              <p>No students found for this class</p>
            </div>
          ) : (
            <div className="divide-y">
              {students.map((student: any) => (
                <div
                  key={student.id}
                  className="flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/40 px-2 rounded transition-colors"
                  onClick={() => toggleStudent(student.id)}
                >
                  <Checkbox checked={selectedStudents.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} />
                  <div className="flex-1">
                    <p className="font-medium">
                      {student.profile?.last_name}, {student.profile?.first_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{student.student_number}</p>
                  </div>
                  {student.grade_level && (
                    <Badge variant="outline" className="text-xs">{student.grade_level}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
