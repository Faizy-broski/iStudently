import { router, Stack } from 'expo-router';
import { BookOpen, Eye, PenLine } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors } from '@/lib/colors';
import { ScrollView } from '@/components/app/keyboard';
import { DataList } from '@/components/app/data-list';
import { Initials, StickyActions } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { DateField, formatYmd, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { CodeChip, CodeLegend, CodeSelect, GradeSectionPickers, useAttendanceCodes, useAttendanceScope, useGradeSection } from '@/features/admin/attendance';
import { adminAttendance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

interface PeriodInfo {
  id: string;
  period_name: string;
  period_number: number;
  start_time: string;
  end_time: string;
}

interface PeriodRecordInfo {
  record_id: string;
  attendance_code_id: string | null;
  attendance_code: { id: string; title: string; short_name: string; state_code: string; color: string } | null;
  admin_override: boolean;
}

interface StudentGridRow {
  student_id: string;
  student_name: string;
  student_number?: string;
  section_name?: string;
  grade_name?: string;
  period_records: Record<string, PeriodRecordInfo>;
  state_value: number | null;
  comment: string;
}

type Status = 'all' | 'not_present' | 'present' | 'absent' | 'half';

/** Attendance administration: per-period code grid for a day, day comments, batch update (web: /admin/attendance). */
export default function AttendanceAdministration() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`attendance.${k}`, o);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const gs = useGradeSection();
  const [date, setDateRaw] = useState(todayYmd);
  const [status, setStatus] = useState<Status>('not_present');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [changes, setChanges] = useState<Map<string, string>>(new Map());
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [updating, setUpdating] = useState(false);
  const [detail, setDetail] = useState<StudentGridRow | null>(null);

  const codesRes = useAttendanceCodes();
  const codes = codesRes.data ?? [];
  const grid = useApi(schoolId ? ['admin', 'attendance-grid', schoolId, campusId ?? 'school', date, gs.grade, gs.section] : null, () =>
    adminAttendance.getPeriodGrid(schoolId, date, gs.sectionId, gs.gradeId, campusId),
  );
  const students: StudentGridRow[] = grid.data?.students ?? [];
  const periods: PeriodInfo[] = grid.data?.periods ?? [];

  const setDate = (d: string) => {
    setDateRaw(d);
    setChanges(new Map());
    setComments(new Map());
  };

  const q = search.trim().toLowerCase();
  let rows = q
    ? students.filter((s) => [s.student_name, s.student_number ?? '', s.grade_name ?? '', s.section_name ?? '', s.comment ?? ''].some((v) => v.toLowerCase().includes(q)))
    : students;
  if (!expanded) {
    rows = rows.filter((s) => (s.state_value !== null && s.state_value < 1) || Object.values(s.period_records).some((pr) => pr.attendance_code?.state_code && pr.attendance_code.state_code !== 'P'));
  }
  if (status === 'not_present') rows = rows.filter((s) => s.state_value !== null && s.state_value < 1);
  else if (status === 'present') rows = rows.filter((s) => s.state_value === 1);
  else if (status === 'absent') rows = rows.filter((s) => s.state_value === 0);
  else if (status === 'half') rows = rows.filter((s) => s.state_value === 0.5);

  const pendingCount = changes.size + comments.size;
  const codeIdOf = (r?: PeriodRecordInfo) => (r ? (changes.get(r.record_id) ?? r.attendance_code_id ?? '') : '');
  const commentOf = (s: StudentGridRow) => comments.get(s.student_id) ?? s.comment ?? '';
  const rowChanged = (s: StudentGridRow) => comments.has(s.student_id) || Object.values(s.period_records).some((pr) => changes.has(pr.record_id));
  const setCode = (recordId: string, codeId: string) => setChanges((m) => new Map(m).set(recordId, codeId));
  const periodLabel = (p: PeriodInfo) => p.period_name || `P${p.period_number}`;

  const stateLabel = (v: number | null) =>
    v === null || v === undefined ? '-' : v === 1 ? a('statePresent') : v === 0.5 ? a('stateHalf') : v === 0 ? a('stateNone') : `${Math.round(v * 100)}%`;
  const stateBg = (v: number | null) => (v === null || v === undefined ? colors.printMuted : v === 1 ? colors.success : v === 0.5 ? colors.warning : colors.destructive);

  async function update() {
    if (!pendingCount) {
      toast.info(a('noChanges'));
      return;
    }
    setUpdating(true);
    try {
      let codesSaved = true;
      if (changes.size) {
        const res = await adminAttendance.bulkOverride([...changes.entries()].map(([record_id, attendance_code_id]) => ({ record_id, attendance_code_id })));
        if (res.success) toast.success(a('updatedRecords', { count: res.data?.updated ?? 0 }));
        else {
          codesSaved = false;
          toast.error(res.error || a('failedUpdate'));
        }
      }
      // Keep comments that failed to save so the user can retry them.
      const unsaved = new Map<string, string>();
      for (const [student_id, comment] of comments) {
        const r = await adminAttendance.updateDailyComment({ school_id: schoolId, student_id, date, comment });
        if (!r.success) unsaved.set(student_id, comment);
      }
      if (unsaved.size) toast.error(a('failedUpdate'));
      if (codesSaved) setChanges(new Map());
      setComments(unsaved);
      grid.mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : a('failedUpdateMsg'));
    } finally {
      setUpdating(false);
    }
  }

  const header = (
    <View className="gap-3 p-4">
      <DateField value={date} onChange={(d) => d && setDate(d)} />
      <View className="flex-row flex-wrap items-center gap-2">
        <CodeLegend codes={codes} />
        <Picker
          className="flex-1"
          value={status}
          onChange={(v) => setStatus(v as Status)}
          options={[
            { value: 'all', label: a('statusAll') },
            { value: 'not_present', label: a('statusNotPresent') },
            { value: 'present', label: a('statusPresent') },
            { value: 'absent', label: a('statusAbsent') },
            { value: 'half', label: a('statusHalfDay') },
          ]}
        />
      </View>
      <GradeSectionPickers gs={gs} />
      <SearchBar value={search} onChangeText={setSearch} placeholder={a('searchStudents')} />
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row">
          <StatusChip label={`${a('studentsShown', { count: rows.length })}${!expanded && students.length > rows.length ? ` (${students.length})` : ''}`} tone="info" className="px-2.5 py-1" />
        </View>
        {!expanded && students.length > rows.length ? (
          <Button size="sm" variant="ghost" onPress={() => setExpanded(true)}>
            <Text className="text-primary">{a('showAll')}</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: a('administration'),
          headerRight: () => (
            <View className="flex-row">
              <Button size="sm" variant="ghost" onPress={() => router.push('/admin/attendance/class-diary')} accessibilityLabel={a('classDiaryRead')}>
                <Icon as={BookOpen} className="size-5" />
              </Button>
              <Button size="sm" variant="ghost" onPress={() => router.push('/admin/attendance/class-diary-write')} accessibilityLabel={a('diary_title')}>
                <Icon as={PenLine} className="size-5" />
              </Button>
            </View>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          header={header}
          items={grid.data ? rows : undefined}
          error={grid.error}
          isLoading={grid.isLoading}
          isRefreshing={grid.isValidating && !grid.isLoading}
          onRefresh={() => grid.mutate()}
          emptyTitle={a('noStudentsFound')}
          emptyBody={students.length === 0 ? a('noRecordsForDate') : expanded ? a('totalRecordsFilter', { total: students.length }) : a('noNonPresentStudents')}
          keyExtractor={(s) => s.student_id}
          renderItem={(s) => (
            <View className={cn('gap-2 px-4 py-3', rowChanged(s) && 'bg-warning-soft')}>
              <View className="flex-row items-center gap-3">
                <Pressable className="flex-1 flex-row items-center gap-3 active:opacity-70" onPress={() => setDetail(s)}>
                  <Initials name={s.student_name} size={38} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" numberOfLines={1}>
                      {s.student_name}
                    </Text>
                    <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                      {[s.student_number, s.grade_name, s.section_name].filter(Boolean).join(' · ') || '-'}
                    </Text>
                  </View>
                </Pressable>
                <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: stateBg(s.state_value) }}>
                  <Text className="text-xs font-medium text-white">{stateLabel(s.state_value)}</Text>
                </View>
                <Pressable onPress={() => setDetail(s)} hitSlop={4} accessibilityLabel={a('viewPeriodDetails')} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                  <Icon as={Eye} className="text-brand dark:text-brand-secondary size-4" />
                </Pressable>
              </View>
              {periods.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {periods.map((p) => {
                    const r = s.period_records[p.id];
                    return (
                      <View key={p.id} className="items-center gap-0.5">
                        <Text className="text-muted-foreground text-[10px]">{periodLabel(p)}</Text>
                        {r ? (
                          <CodeSelect codes={codes} value={codeIdOf(r)} onChange={(id) => setCode(r.record_id, id)} pending={changes.has(r.record_id)} />
                        ) : (
                          <View className="min-h-9 justify-center px-2">
                            <Text className="text-muted-foreground text-xs">-</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}
              <Input
                value={commentOf(s)}
                onChangeText={(v) => setComments((m) => new Map(m).set(s.student_id, v))}
                placeholder={a('th_dayComment')}
                className={cn('h-9 text-sm', comments.has(s.student_id) && 'border-warning')}
              />
            </View>
          )}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="absolute inset-x-0 bottom-0">
          <StickyActions>
            <Button className="flex-1" onPress={update} disabled={updating || !pendingCount}>
              <Text>{pendingCount ? `${a('update')} (${pendingCount})` : a('update')}</Text>
            </Button>
          </StickyActions>
        </View>
      </View>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.student_name}</DialogTitle>
            <DialogDescription>
              {a('periodLevelAttendance', { date: formatYmd(date, i18n.language, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) })}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <ScrollView className="max-h-96" contentContainerClassName="gap-3">
              {periods.map((p) => {
                const r = detail.period_records[p.id];
                return (
                  <View key={p.id} className="border-border gap-1.5 border-b pb-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold">{periodLabel(p)}</Text>
                      <Text className="text-muted-foreground text-xs">{`${p.start_time?.slice(0, 5) ?? ''} – ${p.end_time?.slice(0, 5) ?? ''}`}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-muted-foreground w-24 text-xs">{a('th_attendanceCode')}</Text>
                      {r ? <CodeSelect codes={codes} value={codeIdOf(r)} onChange={(id) => setCode(r.record_id, id)} pending={changes.has(r.record_id)} showTitle /> : <Text className="text-muted-foreground">-</Text>}
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-muted-foreground w-24 text-xs">{a('th_teacherEntry')}</Text>
                      {r?.attendance_code ? (
                        <View className="flex-row items-center gap-1.5">
                          <CodeChip code={r.attendance_code} size="sm" />
                          <Text className="text-sm">{r.attendance_code.title}</Text>
                          {r.admin_override ? (
                            <Badge variant="outline">
                              <Text className="text-[10px]">Admin</Text>
                            </Badge>
                          ) : null}
                        </View>
                      ) : (
                        <Text className="text-muted-foreground">-</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setDetail(null)}>
              <Text>{a('studentList')}</Text>
            </Button>
            <Button
              disabled={updating || !pendingCount}
              onPress={() => {
                update();
                setDetail(null);
              }}>
              <Text>{a('update')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
