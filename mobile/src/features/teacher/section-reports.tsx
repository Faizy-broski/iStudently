import { BarChart3, FileSpreadsheet, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import useSWR from 'swr';

import { IconTile, RowItem, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { exportCsv, type ExportColumn } from '@/features/admin/table-export';
import { exams, homework } from '@/lib/api';
import { unwrap, type ApiError } from '@/lib/data';

// Performance (exam results) and assignment (submission) reports for one of the teacher's sections
// over a date range (web: components/teacher/SectionReports). The server limits both endpoints to
// the signed-in teacher's own exams and assignments.

interface Filters {
  teacherId: string | null;
  sectionId: string;
  from: string;
  to: string;
}

const LIMIT = 200;
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);
const mean = (list: number[]) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : null);
const inRange = (date: string | null | undefined, from: string, to: string) => !!date && date.slice(0, 10) >= from && date.slice(0, 10) <= to;

async function loadPerformance(teacherId: string, sectionId: string, from: string, to: string) {
  const list = unwrap(await exams.teacherExams(teacherId, { section_id: sectionId })).filter((e) => inRange(e.exam_date, from, to));
  const students = new Map<string, { name: string; scores: number[]; absences: number }>();
  const rows = await Promise.all(
    list.map(async (exam) => {
      const results = unwrap(await exams.results(exam.id));
      const scores: number[] = [];
      let passed = 0;
      for (const r of results) {
        const name = `${r.student?.profile?.first_name ?? ''} ${r.student?.profile?.last_name ?? ''}`.trim();
        const s = students.get(r.student_id) ?? { name: name || r.student?.admission_number || '—', scores: [], absences: 0 };
        students.set(r.student_id, s);
        if (r.is_absent) {
          s.absences += 1;
          continue;
        }
        if (r.marks_obtained === null || !exam.max_marks) continue;
        const score = (Number(r.marks_obtained) / Number(exam.max_marks)) * 100;
        s.scores.push(score);
        scores.push(score);
        if (Number(r.marks_obtained) >= Number(exam.passing_marks)) passed += 1;
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
      };
    }),
  );
  return {
    exams: rows,
    students: [...students.entries()]
      .map(([id, s]) => ({ id, name: s.name, taken: s.scores.length, absences: s.absences, average: mean(s.scores) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function loadAssignments(teacherId: string, sectionId: string, from: string, to: string) {
  const res = unwrap(await homework.teacherList(teacherId, { section_id: sectionId, limit: LIMIT }));
  const all = Array.isArray(res) ? res : res.data;
  const total = Array.isArray(res) ? res.length : res.total;
  const rows = await Promise.all(
    all
      .filter((a) => inRange(a.due_date, from, to))
      .map(async (a) => {
        const stats = unwrap(await homework.stats(a.id));
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
        };
      }),
  );
  return { rows, truncated: total > LIMIT };
}

type Performance = Awaited<ReturnType<typeof loadPerformance>>;
type Assignments = Awaited<ReturnType<typeof loadAssignments>>;

export function SectionReports({ teacherId, sectionId, from, to, sectionName }: Filters & { sectionName?: string }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.reports.${key}`, o);
  const ready = !!teacherId && !!sectionId && !!from && !!to;
  const stamp = `${sectionId}|${from}|${to}`;
  // A report belongs to the filters it was generated for; changing them hides it.
  const [wanted, setWanted] = useState<{ performance?: string; assignments?: string }>({});
  const showPerf = ready && wanted.performance === stamp;
  const showAsg = ready && wanted.assignments === stamp;
  const perf = useSWR<Performance, ApiError>(showPerf ? ['teacher', 'performance-report', teacherId, sectionId, from, to] : null, ([, , tid, s, a, b]: string[]) => loadPerformance(tid, s, a, b));
  const asg = useSWR<Assignments, ApiError>(showAsg ? ['teacher', 'assignment-report', teacherId, sectionId, from, to] : null, ([, , tid, s, a, b]: string[]) => loadAssignments(tid, s, a, b));
  const suffix = sectionName ? ` — ${sectionName}` : '';
  const examList = perf.data?.exams ?? [];
  const studentList = perf.data?.students ?? [];
  const asgList = asg.data?.rows ?? [];

  const exportExams = () => {
    const cols: ExportColumn<Performance['exams'][number]>[] = [
      { key: 'exam', label: k('exam'), accessor: (r) => r.name },
      { key: 'subject', label: k('subject'), accessor: (r) => r.subject },
      { key: 'date', label: k('date'), accessor: (r) => r.date },
      { key: 'max', label: k('maxMarks'), accessor: (r) => r.max },
      { key: 'entered', label: k('resultsEntered'), accessor: (r) => r.entered },
      { key: 'average', label: k('average'), accessor: (r) => pct(r.average) },
      { key: 'pass', label: k('passRate'), accessor: (r) => pct(r.passRate) },
    ];
    return exportCsv(cols, examList, `performance_exams_${from}_${to}`);
  };
  const exportStudents = () => {
    const cols: ExportColumn<Performance['students'][number]>[] = [
      { key: 'student', label: k('student'), accessor: (r) => r.name },
      { key: 'taken', label: k('examsTaken'), accessor: (r) => r.taken },
      { key: 'absences', label: k('absences'), accessor: (r) => r.absences },
      { key: 'average', label: k('average'), accessor: (r) => pct(r.average) },
    ];
    return exportCsv(cols, studentList, `performance_students_${from}_${to}`);
  };
  const exportAssignments = () => {
    const cols: ExportColumn<Assignments['rows'][number]>[] = [
      { key: 'assignment', label: k('assignment'), accessor: (r) => r.title },
      { key: 'subject', label: k('subject'), accessor: (r) => r.subject },
      { key: 'due', label: k('dueDate'), accessor: (r) => r.due },
      { key: 'students', label: k('students'), accessor: (r) => r.students },
      { key: 'submitted', label: k('submitted'), accessor: (r) => r.submitted },
      { key: 'pending', label: k('pending'), accessor: (r) => r.pending },
      { key: 'graded', label: k('graded'), accessor: (r) => r.graded },
      { key: 'completion', label: k('completion'), accessor: (r) => pct(r.completion) },
      { key: 'score', label: k('averageScore'), accessor: (r) => r.averageScore },
    ];
    return exportCsv(cols, asgList, `assignments_${from}_${to}`);
  };

  const exportButton = (label: string, onPress: () => void) => (
    <Button variant="outline" size="sm" onPress={onPress}>
      <Icon as={FileSpreadsheet} className="size-4" />
      <Text>{label}</Text>
    </Button>
  );

  return (
    <View className="gap-3">
      <Panel>
        <RowItem leading={<IconTile icon={TrendingUp} tone="success" size={40} />} title={k('performanceReport')} meta={k('performanceReportDesc')}>
          <Button size="sm" className="self-start" disabled={!ready} onPress={() => setWanted((w) => ({ ...w, performance: stamp }))}>
            <Text>{k('generate')}</Text>
          </Button>
        </RowItem>
        <RowItem leading={<IconTile icon={BarChart3} tone="warning" size={40} />} title={k('assignmentReport')} meta={k('assignmentReportDesc')} last>
          <Button size="sm" className="self-start" disabled={!ready} onPress={() => setWanted((w) => ({ ...w, assignments: stamp }))}>
            <Text>{k('generate')}</Text>
          </Button>
        </RowItem>
      </Panel>

      {showPerf ? (
        <Section title={`${k('performanceReport')}${suffix}`}>
          {perf.isLoading ? (
            <LoadingList rows={3} />
          ) : perf.error ? (
            <ErrorState message={perf.error.message} onRetry={() => perf.mutate()} />
          ) : !examList.length ? (
            <EmptyState icon={TrendingUp} title={k('noExamsInPeriod')} />
          ) : (
            <View className="gap-3">
              <View className="flex-row flex-wrap gap-2">
                {exportButton(`${k('exportCsv')} · ${k('exam')}`, exportExams)}
                {studentList.length ? exportButton(`${k('exportCsv')} · ${k('student')}`, exportStudents) : null}
              </View>
              <Panel>
                {examList.map((e, i) => (
                  <RowItem key={e.id} title={e.name} meta={[e.subject, e.date].filter(Boolean).join(' · ')} trailing={<Text className="text-sm font-bold">{pct(e.average)}</Text>} last={i === examList.length - 1}>
                    <Text variant="muted" className="text-xs">{`${k('resultsEntered')}: ${e.entered} · ${k('maxMarks')}: ${e.max} · ${k('passRate')}: ${pct(e.passRate)}`}</Text>
                  </RowItem>
                ))}
              </Panel>
              {studentList.length ? (
                <Panel>
                  {studentList.map((s, i) => (
                    <RowItem key={s.id} title={s.name} meta={`${k('examsTaken')}: ${s.taken} · ${k('absences')}: ${s.absences}`} trailing={<Text className="text-sm font-bold">{pct(s.average)}</Text>} last={i === studentList.length - 1} />
                  ))}
                </Panel>
              ) : null}
            </View>
          )}
        </Section>
      ) : null}

      {showAsg ? (
        <Section title={`${k('assignmentReport')}${suffix}`}>
          {asg.isLoading ? (
            <LoadingList rows={3} />
          ) : asg.error ? (
            <ErrorState message={asg.error.message} onRetry={() => asg.mutate()} />
          ) : !asgList.length ? (
            <EmptyState icon={BarChart3} title={k('noAssignmentsInPeriod')} />
          ) : (
            <View className="gap-3">
              <View className="flex-row">{exportButton(k('exportCsv'), exportAssignments)}</View>
              <Panel>
                {asgList.map((a, i) => (
                  <RowItem key={a.id} title={a.title} meta={[a.subject, a.due].filter(Boolean).join(' · ')} trailing={<Text className="text-sm font-bold">{pct(a.completion)}</Text>} last={i === asgList.length - 1}>
                    <Text variant="muted" className="text-xs">{`${k('submitted')}: ${a.submitted}/${a.students} · ${k('pending')}: ${a.pending} · ${k('graded')}: ${a.graded} · ${k('averageScore')}: ${a.averageScore}`}</Text>
                  </RowItem>
                ))}
              </Panel>
              {asg.data?.truncated ? (
                <Text variant="muted" className="text-xs">
                  {k('listTruncated', { count: LIMIT })}
                </Text>
              ) : null}
            </View>
          )}
        </Section>
      ) : null}
    </View>
  );
}
