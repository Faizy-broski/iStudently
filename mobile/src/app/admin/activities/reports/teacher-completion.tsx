import { coursePeriodTeacherName, type CoursePeriod, type EligibilityCompleted } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { colors } from '@/lib/colors';
import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { PrintButtons, tableHtml, useAc } from '@/features/admin/activities';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminActivities, adminCourses } from '@/lib/api';
import { useApi } from '@/lib/data';
import { escapeHtml } from '@/lib/print';

/** Which course periods have entered eligibility for a date, and by whom (web: /admin/activities/reports/teacher-completion). */
export default function EligibilityTeacherCompletion() {
  const a = useAc();
  const toast = useToast();
  const { campusId } = useCampus();
  const subjects = useApi(['admin', 'subjects', campusId ?? 'school', 'all'], () => adminAcademics.subjects(campusId));
  const [date, setDate] = useState(todayYmd());
  const [shownDate, setShownDate] = useState('');
  const [data, setData] = useState<{ cps: CoursePeriod[]; done: EligibilityCompleted[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      const [cps, done] = await Promise.all([adminCourses.allCoursePeriods(campusId), adminActivities.teacherCompletionReport(date, campusId)]);
      if (!cps.success || !done.success) return toast.error(cps.error || done.error || a('failedToLoadReport'));
      setData({ cps: cps.data ?? [], done: done.data ?? [] });
      setShownDate(date);
    } finally {
      setLoading(false);
    }
  }

  const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
  const cpName = (cp: CoursePeriod) => [cp.period?.period_name, cp.course?.title ?? cp.title, coursePeriodTeacherName(cp)].filter(Boolean).join(' - ') || cp.id;
  const rows = (data?.cps ?? []).map((cp) => ({
    cp,
    subject: (cp.course?.subject_id && subjectName.get(cp.course.subject_id)) || '-',
    done: (data?.done ?? []).find((c) => c.course_period_id === cp.id) ?? null,
  }));
  const completedCount = rows.filter((r) => r.done).length;
  const heading = a('completionFor', { date: shownDate });
  const summary = a('coursePeriodsCompleted', { completedCount, totalCount: rows.length });

  const printBody = () =>
    tableHtml(
      `${heading} (${summary})`,
      [a('coursePeriod'), a('subject'), a('completedBy'), a('status')],
      rows.map((r) => [
        escapeHtml(cpName(r.cp)),
        escapeHtml(r.subject),
        escapeHtml(r.done?.staff?.full_name ?? '-'),
        r.done ? `<span class="pill" style="background:${colors.successSoft};color:${colors.success}">${escapeHtml(a('completed'))}</span>` : `<span class="pill" style="background:${colors.printSurface};color:${colors.printMuted}">${escapeHtml(a('pending'))}</span>`,
      ]),
      [3],
    );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('teacherCompletionTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-3 pt-4">
            <DateField label={a('date')} value={date} onChange={setDate} />
            <Button onPress={go} disabled={!date || loading}>
              <Text>{a('go')}</Text>
            </Button>
          </CardContent>
        </Card>
        {loading ? <LoadingList rows={4} /> : null}
        {data && !loading ? (
          <Card>
            <CardContent className="gap-2 pt-4">
              <Text className="font-semibold">
                {heading} <Text className="text-muted-foreground text-sm font-normal">({summary})</Text>
              </Text>
              <PrintButtons title={heading} fileName="eligibility-teacher-completion.pdf" body={printBody} />
              {!rows.length ? <EmptyState title={a('noCoursePeriodsFound')} /> : null}
              {rows.map((r) => (
                <View key={r.cp.id}>
                  <Separator />
                  <View className="flex-row items-center gap-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-sm font-medium">{cpName(r.cp)}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {a('subject')}: {r.subject} · {a('completedBy')}: {r.done?.staff?.full_name ?? '-'}
                      </Text>
                    </View>
                    <StatusChip label={r.done ? a('completed') : a('pending')} tone={r.done ? 'success' : 'muted'} />
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
