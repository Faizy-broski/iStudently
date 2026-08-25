"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Award, Plus, FileText, CheckCircle, Clock, Users } from 'lucide-react'
import { toast } from 'sonner'
import useSWR, { mutate } from 'swr'
import * as examsApi from '@/lib/api/exams'
import * as teachersApi from '@/lib/api/teachers'
import * as academicsApi from '@/lib/api/academics'
import { Exam, ExamResult, TeacherSubjectAssignment, Section, Subject } from '@/types'
import { useTranslations } from 'next-intl'

// SWR fetchers
const examsFetcher = async (url: string) => {
  const [, teacherId] = url.split('|')
  return await examsApi.getTeacherExams(teacherId)
}

const examTypesFetcher = async (url: string) => {
  const [, schoolId] = url.split('|')
  return await examsApi.getExamTypes(schoolId)
}

const teacherAssignmentsFetcher = async () => {
  return await teachersApi.getTeacherAssignments()
}

const sectionsFetcher = async () => {
  const res = await academicsApi.getSections()
  return res.data || []
}

const subjectsFetcher = async () => {
  const res = await academicsApi.getSubjects()
  return res.data || []
}

export default function ExamsPage() {
  const t = useTranslations('teacherPages.exams')
  const { profile } = useAuth()
  
  // Use SWR for data fetching
  const { data: exams, isLoading: loadingExams, mutate: mutateExams } = useSWR<Exam[]>(
    profile?.staff_id ? `teacher-exams|${profile.staff_id}` : null,
    examsFetcher,
    { revalidateOnFocus: false }
  )

  const { data: examTypes } = useSWR<examsApi.ExamType[]>(
    profile?.school_id ? `exam-types|${profile.school_id}` : null,
    examTypesFetcher,
    { revalidateOnFocus: false }
  )

  const { data: teacherAssignments } = useSWR<TeacherSubjectAssignment[]>(
    profile?.staff_id ? 'teacher-assignments' : null,
    teacherAssignmentsFetcher,
    { revalidateOnFocus: false }
  )

  const { data: sections } = useSWR<Section[]>(
    profile?.school_id ? 'sections' : null,
    sectionsFetcher,
    { revalidateOnFocus: false }
  )

  const { data: subjects } = useSWR<Subject[]>(
    profile?.school_id ? 'subjects' : null,
    subjectsFetcher,
    { revalidateOnFocus: false }
  )
  
  // Create exam dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    exam_type_id: '',
    grade_level_id: '',
    section_id: '',
    subject_id: '',
    exam_name: '',
    exam_date: '',
    max_marks: '100',
    passing_marks: '40'
  })
  
  // Grading dialog
  const [isGradingOpen, setIsGradingOpen] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [markingStudent, setMarkingStudent] = useState<ExamResult | null>(null)
  const [marksForm, setMarksForm] = useState({ marks: '', is_absent: false, remarks: '' })

  useEffect(() => {
    if (profile?.staff_id && profile?.school_id) {
      // Data is loaded via SWR
    }
  }, [profile])

  const loadData = async () => {
    // Removed - using SWR now
  }

  const handleCreateExam = async () => {
    if (!profile?.staff_id || !profile?.school_id) return
    if (!createForm.exam_type_id || !createForm.section_id || !createForm.subject_id || !createForm.exam_name) {
      toast.error(t('fillRequiredFields'))
      return
    }

    try {
      const currentYear = new Date().getFullYear()
      const academicYear = await teachersApi.getCurrentAcademicYear()
      
      await examsApi.createExam({
        school_id: profile.school_id,
        teacher_id: profile.staff_id,
        academic_year_id: academicYear.id,
        exam_type_id: createForm.exam_type_id,
        section_id: createForm.section_id,
        subject_id: createForm.subject_id,
        exam_name: createForm.exam_name,
        exam_date: createForm.exam_date || undefined,
        max_marks: parseFloat(createForm.max_marks),
        passing_marks: parseFloat(createForm.passing_marks),
        is_published: true
      })
      
      toast.success(t('examCreated'))
      setIsCreateOpen(false)
      setCreateForm({
        exam_type_id: '',
        section_id: '',
        subject_id: '',
        exam_name: '',
        exam_date: '',
        max_marks: '100',
        passing_marks: '40'
      })
      // Revalidate exams data
      mutateExams()
    } catch (error: any) {
      console.error('Error creating exam:', error)
      toast.error(error.message || t('createExamFailed'))
    }
  }

  const handleOpenGrading = async (exam: Exam) => {
    try {
      setSelectedExam(exam)
      const results = await examsApi.getExamResults(exam.id)
      setExamResults(results)
      setIsGradingOpen(true)
    } catch (error: any) {
      console.error('Error loading exam results:', error)
      toast.error(error.message || t('loadResultsFailed'))
    }
  }

  const handleMarkStudent = (result: ExamResult) => {
    setMarkingStudent(result)
    setMarksForm({
      marks: result.marks_obtained?.toString() || '',
      is_absent: result.is_absent,
      remarks: result.remarks || ''
    })
  }

  const handleSaveMarks = async () => {
    if (!markingStudent || !profile?.id) return
    if (!marksForm.is_absent && !marksForm.marks) {
      toast.error(t('enterMarksOrAbsent'))
      return
    }

    try {
      await examsApi.recordMarks({
        exam_id: selectedExam!.id,
        student_id: markingStudent.student_id,
        marks_obtained: marksForm.is_absent ? undefined : parseFloat(marksForm.marks),
        is_absent: marksForm.is_absent,
        remarks: marksForm.remarks,
        marked_by: profile.id
      })
      
      toast.success(t('marksRecorded'))
      setMarkingStudent(null)
      handleOpenGrading(selectedExam!) // Reload results
    } catch (error: any) {
      console.error('Error recording marks:', error)
      toast.error(error.message || t('recordMarksFailed'))
    }
  }

  const getTeacherGradeLevels = () => {
    const sectionIds = new Set((teacherAssignments || []).map(ta => ta.section_id))
    const teacherSections = (sections || []).filter(s => sectionIds.has(s.id))
    
    // Get unique grade levels
    const uniqueGrades = Array.from(
      new Map(teacherSections.map(s => [s.grade_level_id, s.grade_level])).entries()
    ).map(([id, grade]) => ({ id, name: grade?.name || t('unknown') }))
    
    return uniqueGrades
  }

  const getSectionsForGrade = () => {
    if (!createForm.grade_level_id) return []
    const sectionIds = new Set((teacherAssignments || []).map(ta => ta.section_id))
    return (sections || []).filter(s => 
      s.grade_level_id === createForm.grade_level_id && sectionIds.has(s.id)
    )
  }

  const getAvailableSubjects = () => {
    if (!createForm.section_id) return []
    const assignments = (teacherAssignments || []).filter(ta => ta.section_id === createForm.section_id)
    const subjectIds = new Set(assignments.map(ta => ta.subject_id))
    return (subjects || []).filter(s => subjectIds.has(s.id))
  }

  const stats = {
    total: exams?.length || 0,
    upcoming: exams?.filter(e => !e.is_completed && e.exam_date && new Date(e.exam_date) > new Date()).length || 0,
    completed: exams?.filter(e => e.is_completed).length || 0,
    pending: exams?.filter(e => !e.is_completed).length || 0
  }

  if (loadingExams && !exams) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">{t('pageTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('pageSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/teacher/exams/builder">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Exam Builder & Paper Creator
            </Button>
          </Link>
          <Button
            onClick={() => setIsCreateOpen(true)}
            style={{ background: 'var(--gradient-blue)' }}
            className="text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('createExam')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('totalExams')}</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('upcoming')}</p>
              <p className="text-xl font-bold">{stats.upcoming}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('completed')}</p>
              <p className="text-xl font-bold">{stats.completed}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Award className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('pending')}</p>
              <p className="text-xl font-bold">{stats.pending}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Exams Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">{t('allExams')}</TabsTrigger>
          <TabsTrigger value="upcoming">{t('upcoming')}</TabsTrigger>
          <TabsTrigger value="completed">{t('completed')}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {(exams || []).length === 0 ? (
            <Card className="p-12 text-center">
              <Award className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('noExamsYet')}</h3>
              <p className="text-muted-foreground mb-4">{t('createFirstExamHint')}</p>
              <Button onClick={() => setIsCreateOpen(true)} style={{ background: 'var(--gradient-blue)' }} className="text-white">
                <Plus className="h-4 w-4 mr-2" />
                {t('createExam')}
              </Button>
            </Card>
          ) : (
            (exams || []).map(exam => (
              <Card key={exam.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{exam.exam_name}</h3>
                      {exam.is_completed && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          {t('completed')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{exam.section?.name} - {exam.subject?.name}</span>
                      <span>{exam.exam_type?.name}</span>
                      {exam.exam_date && <span>{new Date(exam.exam_date).toLocaleDateString()}</span>}
                      <span>{t('maxPassLabel', { max: exam.max_marks, pass: exam.passing_marks })}</span>
                    </div>
                  </div>
                  <Button onClick={() => handleOpenGrading(exam)}>
                    <Award className="h-4 w-4 mr-2" />
                    {t('grade')}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-3 mt-4">
          {(exams || []).filter(e => !e.is_completed && e.exam_date && new Date(e.exam_date) > new Date()).map(exam => (
            <Card key={exam.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{exam.exam_name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {exam.section?.name} - {exam.subject?.name} | {exam.exam_date && new Date(exam.exam_date).toLocaleDateString()}
                  </p>
                </div>
                <Button onClick={() => handleOpenGrading(exam)}>{t('grade')}</Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          {(exams || []).filter(e => e.is_completed).map(exam => (
            <Card key={exam.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{exam.exam_name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {exam.section?.name} - {exam.subject?.name}
                  </p>
                </div>
                <Button variant="outline" onClick={() => handleOpenGrading(exam)}>{t('viewResults')}</Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create Exam Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('createNewExam')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('examType')} *</label>
                <Select value={createForm.exam_type_id} onValueChange={(v) => setCreateForm({...createForm, exam_type_id: v})}>
                  <SelectTrigger><SelectValue placeholder={t('selectType')} /></SelectTrigger>
                  <SelectContent>
                    {(examTypes || []).map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t('gradeLevel')} *</label>
                <Select value={createForm.grade_level_id} onValueChange={(v) => setCreateForm({...createForm, grade_level_id: v, section_id: '', subject_id: ''})}>
                  <SelectTrigger><SelectValue placeholder={t('selectGrade')} /></SelectTrigger>
                  <SelectContent>
                    {getTeacherGradeLevels().map(grade => (
                      <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('section')} *</label>
                <Select value={createForm.section_id} onValueChange={(v) => setCreateForm({...createForm, section_id: v, subject_id: ''})} disabled={!createForm.grade_level_id}>
                  <SelectTrigger><SelectValue placeholder={t('selectSection')} /></SelectTrigger>
                  <SelectContent>
                    {getSectionsForGrade().map(section => (
                      <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t('subject')} *</label>
                <Select value={createForm.subject_id} onValueChange={(v) => setCreateForm({...createForm, subject_id: v})} disabled={!createForm.section_id}>
                  <SelectTrigger><SelectValue placeholder={t('selectSubject')} /></SelectTrigger>
                  <SelectContent>
                    {getAvailableSubjects().map(subject => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('examName')} *</label>
              <Input value={createForm.exam_name} onChange={(e) => setCreateForm({...createForm, exam_name: e.target.value})} placeholder={t('examNamePlaceholder')} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('examDate')}</label>
              <Input type="date" value={createForm.exam_date} onChange={(e) => setCreateForm({...createForm, exam_date: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('maxMarks')} *</label>
                <Input type="number" value={createForm.max_marks} onChange={(e) => setCreateForm({...createForm, max_marks: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t('passingMarks')} *</label>
                <Input type="number" value={createForm.passing_marks} onChange={(e) => setCreateForm({...createForm, passing_marks: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleCreateExam} style={{ background: 'var(--gradient-blue)' }} className="text-white">{t('createExam')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grading Dialog */}
      <Dialog open={isGradingOpen} onOpenChange={setIsGradingOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('gradeStudentsTitle', { examName: selectedExam?.exam_name || '' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {examResults.map(result => (
              <Card key={result.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold">
                      {result.student?.profile?.first_name} {result.student?.profile?.last_name}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      {result.is_absent ? (
                        <span className="text-red-600 font-medium">{t('absent')}</span>
                      ) : result.marks_obtained !== null ? (
                        <>
                          <span>{t('marksLabel', { marks: result.marks_obtained, max: selectedExam?.max_marks })}</span>
                          <span>{t('gradeLabel', { grade: result.grade })}</span>
                          <span>{t('percentageLabel', { percentage: result.percentage?.toFixed(2) })}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{t('notGradedYet')}</span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleMarkStudent(result)}>
                    {result.marks_obtained !== null || result.is_absent ? t('edit') : t('mark')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Student Dialog */}
      <Dialog open={!!markingStudent} onOpenChange={() => setMarkingStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('recordMarksTitle', { name: `${markingStudent?.student?.profile?.first_name || ''} ${markingStudent?.student?.profile?.last_name || ''}`.trim() })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="absent"
                checked={marksForm.is_absent}
                onChange={(e) => setMarksForm({...marksForm, is_absent: e.target.checked, marks: ''})}
                className="h-4 w-4"
              />
              <label htmlFor="absent" className="text-sm font-medium">{t('markAsAbsent')}</label>
            </div>
            {!marksForm.is_absent && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('marksObtained')} *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={marksForm.marks}
                  onChange={(e) => setMarksForm({...marksForm, marks: e.target.value})}
                  placeholder={t('outOf', { max: selectedExam?.max_marks })}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('remarks')}</label>
              <Textarea
                value={marksForm.remarks}
                onChange={(e) => setMarksForm({...marksForm, remarks: e.target.value})}
                placeholder={t('optionalFeedback')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkingStudent(null)}>{t('cancel')}</Button>
            <Button onClick={handleSaveMarks} style={{ background: 'var(--gradient-blue)' }} className="text-white">{t('saveMarks')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
