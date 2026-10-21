import { Stack } from 'expo-router';
import { AlertCircle, BarChart3, Calendar, CheckCircle, TrendingUp, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { FormSection, IconTile, Initials, RowItem, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
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
        <Text variant="muted" className="text-sm">
          {k('pageSubtitle')}
        </Text>
        <FormSection title={k('reportFilters')} icon={BarChart3}>
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
        </FormSection>
        {showing ? (
          report.isLoading ? (
            <LoadingList rows={4} />
          ) : (
            <>
              {rows.length ? (
                <StatTiles>
                  <StatTile icon={Users} label={k('students')} value={String(rows.length)} />
                  <StatTile icon={Calendar} label={k('schoolDays')} value={String(rows[0]?.total_days ?? 0)} />
                  <StatTile icon={CheckCircle} tone="success" label={k('avgAttendance')} value={avg !== null ? `${avg}%` : '—'} />
                  <StatTile icon={AlertCircle} tone="destructive" label={k('below75Percent')} value={String(rows.filter((r) => r.attendance_percentage < 75).length)} />
                </StatTiles>
              ) : null}
              <Section title={`${k('attendanceReport')}${sectionName ? ` — ${sectionName}` : ''}`}>
                {report.error ? (
                  <ErrorState message={report.error.message} onRetry={() => report.mutate()} />
                ) : !rows.length ? (
                  <EmptyState icon={Calendar} title={k('noAttendanceDataForPeriod')} />
                ) : (
                  <Panel>
                    {rows.map((r, i) => {
                      const p = r.attendance_percentage;
                      const tone = p >= 90 ? 'text-success' : p >= 75 ? 'text-warning' : 'text-destructive';
                      return (
                        <RowItem
                          key={r.student_id}
                          leading={<Initials name={r.student_name || '?'} />}
                          title={r.student_name}
                          meta={r.student_number || null}
                          trailing={
                            <View className="items-end gap-1">
                              <Text className={cn('text-sm font-bold', tone)}>{`${p.toFixed(1)}%`}</Text>
                              <StatusChip label={p >= 90 ? k('good') : p >= 75 ? k('atRisk') : k('critical')} tone={p >= 90 ? 'success' : p >= 75 ? 'warning' : 'destructive'} />
                            </View>
                          }
                          last={i === rows.length - 1}>
                          <View className="flex-row flex-wrap gap-4 ps-12">
                            <Text className="text-success text-xs font-medium">{`${k('present')}: ${r.days_present}`}</Text>
                            <Text className="text-destructive text-xs font-medium">{`${k('absent')}: ${r.days_absent}`}</Text>
                            <Text variant="muted" className="text-xs">{`${k('totalDays')}: ${r.total_days}`}</Text>
                          </View>
                        </RowItem>
                      );
                    })}
                  </Panel>
                )}
              </Section>
            </>
          )
        ) : null}
        <Panel>
          <RowItem leading={<IconTile icon={TrendingUp} tone="success" size={40} />} title={k('performanceReport')} meta={k('performanceReportComingSoon')} />
          <RowItem leading={<IconTile icon={BarChart3} tone="warning" size={40} />} title={k('assignmentReport')} meta={k('assignmentReportComingSoon')} last />
        </Panel>
      </ScrollView>
    </>
  );
}
