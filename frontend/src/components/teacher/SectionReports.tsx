"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { BarChart3, Download, Loader2, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getExamResults, getTeacherExams } from '@/lib/api/exams'
import { getAssignmentStats, getTeacherAssignments } from '@/lib/api/assignments'
import { downloadCsv, type CsvCell } from '@/lib/utils/csv'

// Performance (exam results) and assignment (submission) reports for one of the teacher's sections
// over the page's date range. Built from the teacher's own exams and assignments only: the server
// limits both endpoints to the signed-in teacher.

interface Filters {
  teacherId: string | undefined
  sectionId: string
  from: string
  to: string
}

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`)
const mean = (list: number[]) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : null)
const inRange = (date: string | null | undefined, from: string, to: string) => !!date && date.slice(0, 10) >= from && date.slice(0, 10) <= to
const LIMIT = 200

async function loadPerformance({ teacherId, sectionId, from, to }: Filters) {
  const exams = (await getTeacherExams(teacherId!, { section_id: sectionId })).filter((e) => inRange(e.exam_date, from, to))
  const students = new Map<string, { name: string; scores: number[]; absences: number }>()
  const rows = await Promise.all(
    exams.map(async (exam) => {
      const results = await getExamResults(exam.id)
      const scores: number[] = []
      let passed = 0
      for (const r of results) {
        const name = `${r.student?.profile?.first_name ?? ''} ${r.student?.profile?.last_name ?? ''}`.trim()
        const s = students.get(r.student_id) ?? { name: name || r.student?.admission_number || '—', scores: [] as number[], absences: 0 }
        students.set(r.student_id, s)
        if (r.is_absent) {
          s.absences += 1
          continue
        }
        if (r.marks_obtained === null || r.marks_obtained === undefined || !exam.max_marks) continue
        const score = (Number(r.marks_obtained) / Number(exam.max_marks)) * 100
        s.scores.push(score)
        scores.push(score)
        if (Number(r.marks_obtained) >= Number(exam.passing_marks)) passed += 1
      }
      return {
        id: exam.id,
        name: exam.exam_name,
        subject: exam.subject?.name ?? '',
        date: exam.exam_date?.slice(0, 10) ?? '',
        max: exam.max_marks,
        entered: scores.length,
        average: mean(scores),
        passRate: scores.length ? (passed / scores.length) * 100 : null,
      }
    }),
  )
  return {
    exams: rows,
    students: [...students.entries()]
      .map(([id, s]) => ({ id, name: s.name, taken: s.scores.length, absences: s.absences, average: mean(s.scores) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

async function loadAssignments({ teacherId, sectionId, from, to }: Filters) {
  const page = await getTeacherAssignments(teacherId!, { section_id: sectionId, limit: LIMIT })
  const list = (page.data ?? []).filter((a) => inRange(a.due_date, from, to))
  const rows = await Promise.all(
    list.map(async (a) => {
      const stats = await getAssignmentStats(a.id)
      return {
        id: a.id,
        title: a.title,
        subject: a.subject?.name ?? '',
        due: a.due_date?.slice(0, 10) ?? '',
        students: stats.total_students,
        submitted: stats.submitted,
        pending: stats.pending,
        graded: stats.graded,
        completion: stats.total_students ? (stats.submitted / stats.total_students) * 100 : null,
        averageScore: stats.graded ? `${stats.average_score} / ${a.max_score}` : '—',
      }
    }),
  )
  return { rows, truncated: (page.total ?? 0) > LIMIT }
}

function Table({ head, rows }: { head: string[]; rows: CsvCell[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {head.map((h) => (
              <th key={h} className="text-start py-2 pe-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
              {r.map((v, j) => (
                <td key={j} className="py-2 pe-4">{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SectionReports({ sectionName, ...filters }: Filters & { sectionName?: string }) {
  const t = useTranslations('teacherPages.reports')
  const { teacherId, sectionId, from, to } = filters
  const ready = !!teacherId && !!sectionId && !!from && !!to
  const stamp = `${sectionId}|${from}|${to}`
  // A report belongs to the filters it was generated for; changing them hides it.
  const [wanted, setWanted] = useState<{ performance?: string; assignments?: string }>({})
  const showPerf = ready && wanted.performance === stamp
  const showAsg = ready && wanted.assignments === stamp
  const perf = useSWR(showPerf ? ['teacher-performance-report', teacherId, stamp] : null, () => loadPerformance(filters), { revalidateOnFocus: false })
  const asg = useSWR(showAsg ? ['teacher-assignment-report', teacherId, stamp] : null, () => loadAssignments(filters), { revalidateOnFocus: false })

  const examHead = [t('exam'), t('subject'), t('date'), t('maxMarks'), t('resultsEntered'), t('average'), t('passRate')]
  const examRows = (perf.data?.exams ?? []).map((e) => [e.name, e.subject, e.date, e.max, e.entered, pct(e.average), pct(e.passRate)])
  const studentHead = [t('student'), t('examsTaken'), t('absences'), t('average')]
  const studentRows = (perf.data?.students ?? []).map((s) => [s.name, s.taken, s.absences, pct(s.average)])
  const asgHead = [t('assignment'), t('subject'), t('dueDate'), t('students'), t('submitted'), t('pending'), t('graded'), t('completion'), t('averageScore')]
  const asgRows = (asg.data?.rows ?? []).map((a) => [a.title, a.subject, a.due, a.students, a.submitted, a.pending, a.graded, pct(a.completion), a.averageScore])

  const body = (state: { isLoading: boolean; error?: Error; retry: () => void; empty: boolean; emptyText: string }, content: React.ReactNode) =>
    state.isLoading ? (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ) : state.error ? (
      <div className="text-center py-6 space-y-2">
        <p className="text-sm text-red-600">{state.error.message || t('loadFailed')}</p>
        <Button variant="outline" size="sm" onClick={state.retry}>{t('retry')}</Button>
      </div>
    ) : state.empty ? (
      <p className="text-center py-8 text-muted-foreground">{state.emptyText}</p>
    ) : (
      content
    )

  const cards = [
    { key: 'performance' as const, title: t('performanceReport'), desc: t('performanceReportDesc'), icon: TrendingUp, tone: 'bg-green-100 text-green-600' },
    { key: 'assignments' as const, title: t('assignmentReport'), desc: t('assignmentReportDesc'), icon: BarChart3, tone: 'bg-purple-100 text-purple-600' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Card key={c.key} className="p-5">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${c.tone}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{c.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{c.desc}</p>
                <Button size="sm" disabled={!ready} onClick={() => setWanted((w) => ({ ...w, [c.key]: stamp }))}>
                  {t('generate')}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showPerf && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {t('performanceReport')}
              {sectionName ? ` — ${sectionName}` : ''}
            </CardTitle>
            {!!perf.data?.exams.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadCsv(`performance_exams_${from}_${to}.csv`, examHead, examRows)
                  downloadCsv(`performance_students_${from}_${to}.csv`, studentHead, studentRows)
                }}
              >
                <Download className="h-4 w-4 me-2" />
                {t('exportCsv')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {body(
              { isLoading: perf.isLoading, error: perf.error, retry: () => perf.mutate(), empty: !perf.data?.exams.length, emptyText: t('noExamsInPeriod') },
              <div className="space-y-6">
                <Table head={examHead} rows={examRows} />
                {!!studentRows.length && <Table head={studentHead} rows={studentRows} />}
              </div>,
            )}
          </CardContent>
        </Card>
      )}

      {showAsg && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {t('assignmentReport')}
              {sectionName ? ` — ${sectionName}` : ''}
            </CardTitle>
            {!!asgRows.length && (
              <Button variant="outline" size="sm" onClick={() => downloadCsv(`assignments_${from}_${to}.csv`, asgHead, asgRows)}>
                <Download className="h-4 w-4 me-2" />
                {t('exportCsv')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {body(
              { isLoading: asg.isLoading, error: asg.error, retry: () => asg.mutate(), empty: !asgRows.length, emptyText: t('noAssignmentsInPeriod') },
              <div className="space-y-3">
                <Table head={asgHead} rows={asgRows} />
                {asg.data?.truncated && <p className="text-xs text-muted-foreground">{t('listTruncated', { count: LIMIT })}</p>}
              </div>,
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
