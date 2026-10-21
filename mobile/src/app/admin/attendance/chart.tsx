import type { AttendanceSummaryRow, DailySummaryGridStudent } from '@studently/api-client';
import { attendanceDownloads } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DataList } from '@/components/app/data-list';
import { DateField, parseYmd, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useAttendanceCodes, useAttendanceScope } from '@/features/admin/attendance';
import { adminAcademics, adminAttendance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { usePortalAcademicOptional } from '@/features/portal/academic';
import { useRoleBase } from '@/features/portal/role-base';
import { shareApiFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

type Mode = 'chart' | 'absence';
const KNOWN = ['Late', 'Tardy', 'Excused Absence', 'Excused', 'Present', 'Absent'];
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function StateBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <View className="size-7" />;
  const [letter, cls] = value >= 1 ? ['P', 'bg-success-soft border-success text-success'] : value === 0 ? ['A', 'bg-destructive-soft border-destructive text-destructive'] : ['H', 'bg-warning-soft border-warning text-warning'];
  const [bg, border, fg] = cls.split(' ');
  return (
    <View className={cn('size-7 items-center justify-center rounded border', bg, border)}>
      <Text className={cn('text-xs font-bold', fg)}>{letter}</Text>
    </View>
  );
}

/** Attendance chart (student × date grid) and absence summary (web: /admin/attendance/chart and /summary). */
export default function AttendanceChart() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`attendance.${k}`, o);
  const toast = useToast();
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const { schoolId, campusId } = useAttendanceScope();
  const [mode, setMode] = useState<Mode>(params.mode === 'absence' ? 'absence' : 'chart');
  const [start, setStart] = useState(() => `${todayYmd().slice(0, 8)}01`);
  const [end, setEnd] = useState(todayYmd);
  const [periodId, setPeriodId] = useState('daily');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [grid, setGrid] = useState<{ school_dates: string[]; students: DailySummaryGridStudent[] } | null>(null);
  const [summary, setSummary] = useState<AttendanceSummaryRow[] | null>(null);

  const periods = useApi(['admin', 'class-periods', campusId ?? 'school'], () => adminAcademics.periods(campusId));
  // Teachers (web: /teacher/attendance/daily-summary): one of the sections they teach; the server allows only those.
  const portal = usePortalAcademicOptional();
  const role = useRoleBase();
  const sections = role.isTeacher ? [...new Map((portal?.coursePeriods ?? []).filter((c) => c.section).map((c) => [c.section!.id, c.section!])).values()] : [];
  const [sectionPick, setSectionPick] = useState('');
  const sectionId = role.isTeacher ? sectionPick || sections[0]?.id || '' : '';
  const active = (periods.data ?? []).filter((p) => !p.is_break);
  const codes = (useAttendanceCodes().data ?? []).filter((c) => c.is_active);

  async function go() {
    if (!schoolId) return;
    if (role.isTeacher && !sectionId) return;
    if (start > end) return toast.error(a('print_startBeforeEnd'));
    setLoading(true);
    setGrid(null);
    setSummary(null);
    try {
      const range = { school_id: schoolId, start_date: start, end_date: end, campus_id: campusId, section_id: sectionId || undefined };
      if (mode === 'absence') {
        const res = await adminAttendance.getSummary(range);
        if (res.success && res.data) setSummary(res.data);
        else toast.error(res.error || a('loadAttendanceFailed'));
      } else {
        const res = await adminAttendance.getDailySummaryGrid({ ...range, filter_mode: periodId });
        if (res.success && res.data) setGrid(res.data);
        else toast.error(res.error || a('loadAttendanceFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function exportXlsx() {
    try {
      await shareApiFile(
        attendanceDownloads.summaryExport({ school_id: schoolId, start_date: start, end_date: end, campus_id: campusId }),
        `attendance-${mode === 'absence' ? 'summary' : 'chart'}-${start}-to-${end}.xlsx`,
        XLSX,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error_occurred'));
    }
  }

  const activeData: (DailySummaryGridStudent | AttendanceSummaryRow)[] | null = mode === 'absence' ? summary : (grid?.students ?? null);
  const q = search.toLowerCase().trim();
  const rows = (activeData ?? []).filter((s) => !q || s.student_name?.toLowerCase().includes(q) || s.student_number?.toLowerCase().includes(q));
  const extraCols = [...new Set((summary ?? []).flatMap((s) => Object.keys(s.state_code_breakdown || {})))].filter((k) => !KNOWN.includes(k));
  const dateCol = (d: string) => {
    const x = parseYmd(d);
    return x ? new Intl.DateTimeFormat(i18n.language, { month: 'short', day: '2-digit' }).format(x) : d;
  };

  const metric = (label: string, value: number) => (
    <View className="w-1/4 py-1">
      <Text className="text-muted-foreground text-[10px]">{label}</Text>
      <Text className="text-sm font-semibold">{value}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: mode === 'absence' ? a('absenceSummary') : a('chart') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Picker
                value={mode}
                onChange={(v) => {
                  setMode(v as Mode);
                  setGrid(null);
                  setSummary(null);
                  setSearch('');
                }}
                options={[
                  { value: 'chart', label: a('chart') },
                  { value: 'absence', label: a('absenceSummary') },
                ]}
              />
              {role.isTeacher ? (
                <Picker
                  value={sectionId || null}
                  onChange={(v) => {
                    setSectionPick(v);
                    setGrid(null);
                    setSummary(null);
                  }}
                  options={sections.map((x) => ({ value: x.id, label: `${x.name}${x.grade_level?.name ? ` — ${x.grade_level.name}` : ''}` }))}
                />
              ) : null}
              <Text className="text-sm font-semibold">{a('timeframe')}</Text>
              <View className="flex-row gap-2">
                <DateField className="flex-1" value={start} onChange={(d) => d && setStart(d)} />
                <DateField className="flex-1" value={end} onChange={(d) => d && setEnd(d)} />
              </View>
              {mode === 'chart' ? (
                <Picker value={periodId} onChange={setPeriodId} options={[{ value: 'daily', label: a('daily') }, ...active.map((p) => ({ value: p.id, label: p.period_name || `P${p.period_number}` }))]} />
              ) : null}
              <Button onPress={go} disabled={loading || !schoolId}>
                <Text>{t('app.at_go')}</Text>
              </Button>
              {mode === 'chart' && codes.length ? (
                <View className="border-border flex-row flex-wrap items-center gap-x-4 gap-y-2 border-b pb-2">
                  <Text className="text-muted-foreground text-sm font-semibold">{a('codes_title')}</Text>
                  {codes.map((c) => (
                    <View key={c.id} className="flex-row items-center gap-1.5">
                      <StateBadge value={c.state_code === 'P' ? 1 : c.state_code === 'A' ? 0 : 0.5} />
                      <Text className="text-muted-foreground text-sm">{`${c.short_name} · ${c.title}`}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {activeData ? (
                <>
                  <View className="flex-row items-center justify-between">
                    <Text variant="muted">{t('common.found_students', { count: activeData.length })}</Text>
                    {role.isTeacher ? null : (
                      <Pressable onPress={exportXlsx} hitSlop={8} className="flex-row items-center gap-1" accessibilityLabel={t('common.download')}>
                        <Icon as={Download} className="text-primary size-4" />
                        <Text className="text-primary text-sm">{t('common.download')}</Text>
                      </Pressable>
                    )}
                  </View>
                  <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
                </>
              ) : null}
            </View>
          }
          items={activeData ? rows : loading ? undefined : []}
          isLoading={loading}
          emptyTitle={activeData ? a('noStudentsFound') : a('ada_selectRange')}
          keyExtractor={(s) => s.student_id}
          renderItem={(s) => (
            <View className="gap-2 px-4 py-3">
              <View>
                <View className="flex-row items-center gap-3">
                  <Initials name={s.student_name || '?'} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold">{s.student_name}</Text>
                    <Text className="text-muted-foreground text-xs">{[s.student_number, s.grade_name].filter(Boolean).join(' · ') || '—'}</Text>
                  </View>
                </View>
              </View>
              {mode === 'chart' && grid ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0" contentContainerClassName="gap-1.5">
                  {grid.school_dates.map((d) => (
                    <View key={d} className="items-center gap-0.5">
                      <Text className="text-muted-foreground text-[9px]">{dateCol(d)}</Text>
                      <StateBadge value={(s as DailySummaryGridStudent).dates[d] ?? null} />
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              {mode === 'absence'
                ? (() => {
                    const r = s as AttendanceSummaryRow;
                    const bd = r.state_code_breakdown || {};
                    return (
                      <View className="flex-row flex-wrap">
                        {metric(a('ada_th_stateAbs'), r.days_absent + r.days_half)}
                        {metric(a('statusAbsent'), r.days_absent)}
                        {metric(a('ada_th_tardy'), bd['Late'] ?? bd['Tardy'] ?? 0)}
                        {metric(a('ada_th_excusedAbsence'), bd['Excused Absence'] ?? bd['Excused'] ?? 0)}
                        {extraCols.map((k) => (
                          <View key={k} className="w-1/4 py-1">
                            <Text className="text-muted-foreground text-[10px]">{k}</Text>
                            <Text className="text-sm font-semibold">{bd[k] ?? 0}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()
                : null}
            </View>
          )}
        />
      </View>
    </>
  );
}
