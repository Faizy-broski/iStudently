import { overallEligibility, type StudentListReportRow } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { EligibilityBadge, ELIGIBILITY_PRINT, PrintButtons, tableHtml, useAc } from '@/features/admin/activities';
import { useCampus } from '@/features/campus/campus';
import { adminActivities } from '@/lib/api';
import { useApi } from '@/lib/data';
import { escapeHtml } from '@/lib/print';

const nameOf = (s: StudentListReportRow['student']) => (s ? `${s.last_name ?? ''}, ${s.first_name ?? ''}` : '-');

/** Students in an activity with their overall eligibility (web: /admin/activities/reports/student-list). */
export default function ActivityStudentList() {
  const a = useAc();
  const toast = useToast();
  const { campusId } = useCampus();
  const activities = useApi(['admin', 'activities', campusId ?? 'school', 'active'], () => adminActivities.activities(campusId));
  const [activityId, setActivityId] = useState('');
  const [rows, setRows] = useState<StudentListReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const activity = (activities.data ?? []).find((x) => x.id === activityId);
  const heading = a('studentListReportHeader', { activity: activity?.title ?? a('activity') });

  async function go() {
    if (!activityId) return;
    setLoading(true);
    try {
      const r = await adminActivities.studentListReport(activityId, campusId);
      if (!r.success) return toast.error(r.error || a('failedToLoadReport'));
      const sorted = [...(r.data ?? [])].sort((x, y) => nameOf(x.student).localeCompare(nameOf(y.student)));
      setRows(sorted);
    } finally {
      setLoading(false);
    }
  }

  const printBody = () =>
    tableHtml(
      `${heading} (${a('studentsCount', { count: rows?.length ?? 0 })})`,
      [a('studentLabel'), a('id'), a('grade'), a('overallEligibility'), a('records')],
      (rows ?? []).map((r) => {
        const o = overallEligibility(r.eligibility_records);
        return [escapeHtml(nameOf(r.student)), escapeHtml(r.student?.student_number ?? '-'), escapeHtml(r.student?.grade_level ?? '-'), `<span class="pill" style="${ELIGIBILITY_PRINT[o]}">${escapeHtml(a(`eligibilityCodes.${o}`))}</span>`, String(r.eligibility_records.length)];
      }),
      [3, 4],
    );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('studentListTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-3 pt-4">
            <Label>{a('activity')}</Label>
            {activities.isLoading ? (
              <LoadingList rows={1} />
            ) : (
              <Picker
                value={activityId}
                onChange={(v) => {
                  setActivityId(v);
                  setRows(null);
                }}
                placeholder={a('selectActivity')}
                options={(activities.data ?? []).map((x) => ({ value: x.id, label: x.title }))}
              />
            )}
            <Button onPress={go} disabled={!activityId || loading}>
              <Text>{a('go')}</Text>
            </Button>
          </CardContent>
        </Card>
        {loading ? <LoadingList rows={4} /> : null}
        {rows && !loading ? (
          <Card>
            <CardContent className="gap-2 pt-4">
              <Text className="font-semibold">
                {heading} <Text className="text-muted-foreground text-sm font-normal">({a('studentsCount', { count: rows.length })})</Text>
              </Text>
              <PrintButtons title={heading} fileName="activity-student-list.pdf" body={printBody} />
              {!rows.length ? <Text className="text-muted-foreground py-6 text-center text-sm">{a('noStudentsEnrolled')}</Text> : null}
              {rows.map((r, i) => (
                <View key={r.student?.id ?? i}>
                  <Separator />
                  <View className="flex-row items-center gap-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-sm font-medium">{nameOf(r.student)}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {a('id')}: {r.student?.student_number ?? '-'} · {a('grade')}: {r.student?.grade_level ?? '-'} · {a('records')}: {r.eligibility_records.length}
                      </Text>
                    </View>
                    <EligibilityBadge code={overallEligibility(r.eligibility_records)} />
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
