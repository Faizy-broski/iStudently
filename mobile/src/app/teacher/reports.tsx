import { Stack } from 'expo-router';
import { AlertCircle, BarChart3, Calendar, CheckCircle, TrendingUp, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminAttendance, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const monthStart = () => `${todayYmd().slice(0, 8)}01`;

/** Attendance report for one of the teacher's sections over a date range (web: /teacher/reports). */
export default function TeacherReports() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.reports.${key}`, o);
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const { campusId } = useCampus();
  const assigned = useApi(['teacher', 'my-subjects'], () => teacher.mySubjects());
  const [section, setSection] = useState('');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayYmd);
  const [loaded, setLoaded] = useState<string | null>(null);
  const sections = [...new Map((assigned.data ?? []).map((a) => [a.section_id, `${a.section?.name ?? ''} (${a.section?.grade_level?.name ?? ''})`])).entries()];
  const scope = campusId || schoolId;
  const key = section && from && to && scope ? `${section}|${from}|${to}` : null;
  const canGenerate = !!key;
  const showing = loaded !== null && loaded === key;
  const report = useApi(showing && scope ? ['teacher', 'attendance-report', scope, section, from, to] : null, ([, , s, sec, a, b]) =>
    adminAttendance.getSummary({ school_id: s as string, start_date: a as string, end_date: b as string, section_id: sec as string }),
  );
  const rows = report.data ?? [];
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.attendance_percentage, 0) / rows.length) : null;
  const sectionName = (assigned.data ?? []).find((a) => a.section_id === section)?.section?.name;

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k('reportFilters')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="gap-1.5">
              <Label>{k('selectSection')}</Label>
              <Picker value={section || null} onChange={setSection} placeholder={k('chooseASection')} options={sections.map(([id, name]) => ({ value: id, label: name }))} />
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={k('fromDate')} value={from} onChange={setFrom} />
              <DateField className="flex-1" label={k('toDate')} value={to} onChange={setTo} />
            </View>
            <Button onPress={() => setLoaded(key)} disabled={!canGenerate}>
              <Icon as={BarChart3} className="text-primary-foreground size-4" />
              <Text>{k('generateAttendanceReport')}</Text>
            </Button>
          </CardContent>
        </Card>
        {showing ? (
          report.isLoading ? (
            <LoadingList rows={4} />
          ) : (
            <>
              {rows.length ? (
                <View className="flex-row flex-wrap gap-2">
                  <Stat icon={Users} tone="text-primary" value={String(rows.length)} label={k('students')} />
                  <Stat icon={Calendar} tone="text-blue-500" value={String(rows[0]?.total_days ?? 0)} label={k('schoolDays')} />
                  <Stat icon={CheckCircle} tone="text-green-500" value={avg !== null ? `${avg}%` : '—'} label={k('avgAttendance')} />
                  <Stat icon={AlertCircle} tone="text-red-500" value={String(rows.filter((r) => r.attendance_percentage < 75).length)} label={k('below75Percent')} />
                </View>
              ) : null}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{`${k('attendanceReport')}${sectionName ? ` — ${sectionName}` : ''}`}</CardTitle>
                </CardHeader>
                <CardContent className="gap-2">
                  {report.error ? (
                    <Text className="text-destructive text-sm">{report.error.message}</Text>
                  ) : !rows.length ? (
                    <Text className="text-muted-foreground py-6 text-center">{k('noAttendanceDataForPeriod')}</Text>
                  ) : (
                    rows.map((r) => {
                      const p = r.attendance_percentage;
                      const tone = p >= 90 ? 'text-green-600' : p >= 75 ? 'text-yellow-600' : 'text-red-600';
                      const badge = p >= 90 ? 'bg-green-100 text-green-700' : p >= 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                      return (
                        <View key={r.student_id} className="border-border gap-1 border-b pb-2 last:border-b-0">
                          <View className="flex-row items-center justify-between gap-2">
                            <View className="flex-1">
                              <Text className="font-medium">{r.student_name}</Text>
                              {r.student_number ? <Text className="text-muted-foreground text-xs">{r.student_number}</Text> : null}
                            </View>
                            <Text className={cn('font-semibold', tone)}>{`${p.toFixed(1)}%`}</Text>
                            <View className={cn('rounded-full px-2 py-0.5', badge.split(' ')[0])}>
                              <Text className={cn('text-xs font-medium', badge.split(' ')[1])}>{p >= 90 ? k('good') : p >= 75 ? k('atRisk') : k('critical')}</Text>
                            </View>
                          </View>
                          <View className="flex-row gap-4">
                            <Text className="text-xs font-medium text-green-600">{`${k('present')}: ${r.days_present}`}</Text>
                            <Text className="text-xs font-medium text-red-600">{`${k('absent')}: ${r.days_absent}`}</Text>
                            <Text className="text-muted-foreground text-xs">{`${k('totalDays')}: ${r.total_days}`}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </>
          )
        ) : null}
        <Card>
          <CardContent className="flex-row items-start gap-3 p-4">
            <Icon as={TrendingUp} className="size-5 text-green-600" />
            <View className="flex-1">
              <Text className="font-semibold">{k('performanceReport')}</Text>
              <Text className="text-muted-foreground text-sm">{k('performanceReportComingSoon')}</Text>
            </View>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex-row items-start gap-3 p-4">
            <Icon as={BarChart3} className="size-5 text-purple-600" />
            <View className="flex-1">
              <Text className="font-semibold">{k('assignmentReport')}</Text>
              <Text className="text-muted-foreground text-sm">{k('assignmentReportComingSoon')}</Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Stat({ icon, tone, value, label }: { icon: typeof Users; tone: string; value: string; label: string }) {
  return (
    <Card className="min-w-[45%] flex-1">
      <CardContent className="items-center p-3">
        <Icon as={icon} className={cn('mb-1 size-5', tone)} />
        <Text className="text-2xl font-bold">{value}</Text>
        <Text className="text-muted-foreground text-xs">{label}</Text>
      </CardContent>
    </Card>
  );
}
