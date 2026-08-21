'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { useCampus } from '@/context/CampusContext'
import { getCoursePeriods, getStudentsForGrades, generateProgressReports } from '@/lib/api/grades'
import { getMarkingPeriods } from '@/lib/api/marking-periods'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, ClipboardList, FileText, Users, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function TeacherProgressReportsPage() {
  const t = useTranslations('teacherPages.progressReports')
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [selectedCPId, setSelectedCPId] = useState('')
  const [selectedMPId, setSelectedMPId] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  const { data: cpData } = useSWR(
    ['teacher-cps', campusId],
    () => getCoursePeriods(campusId),
    { revalidateOnFocus: false }
  )

  const { data: mpData } = useSWR(
    campusId ? ['marking-periods', campusId] : null,
    () => getMarkingPeriods(campusId),
    { revalidateOnFocus: false }
  )

  const { data: studentsData, isLoading: studentsLoading } = useSWR(
    selectedCPId ? ['students-for-cp', selectedCPId] : null,
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
    if (!selectedCPId || selectedStudents.length === 0) return
    setGenerating(true)
    try {
      const res = await generateProgressReports({
        course_period_id: selectedCPId,
        marking_period_id: selectedMPId || undefined,
        student_ids: selectedStudents
      })
      if (res.success) {
        toast.success(t('reportsGenerated', { count: selectedStudents.length }))
      } else {
        toast.error(res.error || t('generateReportsFailed'))
      }
    } catch {
      toast.error(t('generateProgressReportsFailed'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('pageSubtitle')}</p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('classCoursePeriod')}</label>
              <Select value={selectedCPId} onValueChange={v => { setSelectedCPId(v); setSelectedStudents([]) }}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectClass')} />
                </SelectTrigger>
                <SelectContent>
                  {coursePeriods.map((cp: any) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {cp.course?.title || t('unnamedCourse')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('markingPeriodOptional')}</label>
              <Select value={selectedMPId || 'all'} onValueChange={v => setSelectedMPId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('allPeriods')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allPeriods')}</SelectItem>
                  {markingPeriods.map((mp: any) => (
                    <SelectItem key={mp.id} value={mp.id}>{mp.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardContent className="p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4" /> {t('generateReports')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('generateReportsHint')}
            </p>
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!selectedCPId || selectedStudents.length === 0 || generating}
            >
              {generating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('generatingEllipsis')}</>
                : <><ClipboardList className="h-4 w-4 mr-2" /> {t('generateForStudents', { count: selectedStudents.length })}</>
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
              <Users className="h-5 w-5" /> {t('students')}
            </CardTitle>
            {students.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t('selectedCount', { count: selectedStudents.length })}</Badge>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedStudents.length === students.length ? t('deselectAll') : t('selectAll')}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedCPId ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-2" />
              <p>{t('selectClassToSeeStudents')}</p>
            </div>
          ) : studentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-2" />
              <p>{t('noStudentsForClass')}</p>
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
