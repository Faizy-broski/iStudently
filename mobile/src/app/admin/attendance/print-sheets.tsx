import type { CoursePeriodItem } from '@studently/api-client';
import { attendanceDownloads } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Printer } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CheckRow, useAttendanceScope } from '@/features/admin/attendance';
import { adminAttendance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

/** Printable attendance sheets per course period, as a ZIP (web: /admin/attendance/print-sheets). */
export default function PrintAttendanceSheets() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`attendance.${k}`, o);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const [start, setStart] = useState(() => `${todayYmd().slice(0, 8)}01`);
  const [end, setEnd] = useState(todayYmd);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState(false);

  const list = useApi(schoolId ? ['admin', 'attendance-course-periods', schoolId, campusId ?? 'school'] : null, () => adminAttendance.getCoursePeriods(schoolId, campusId));
  const all = list.data ?? [];
  useEffect(() => {
    if (list.data) setSelected(new Set(list.data.map((cp) => cp.id)));
  }, [list.data]);

  const q = search.trim().toLowerCase();
  const filtered = q ? all.filter((cp) => [cp.label, cp.teacher_name, cp.section_name, cp.subject_name].some((v) => (v ?? '').toLowerCase().includes(q))) : all;
  const allFiltered = filtered.length > 0 && filtered.every((cp) => selected.has(cp.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      filtered.forEach((cp) => (allFiltered ? n.delete(cp.id) : n.add(cp.id)));
      return n;
    });

  async function create() {
    if (!selected.size) return toast.error(a('print_selectCourse'));
    if (start > end) return toast.error(a('print_startBeforeEnd'));
    setDownloading(true);
    try {
      await shareApiFile(attendanceDownloads.courseSheets, `Attendance_Sheets_${start}_to_${end}.zip`, 'application/zip', {
        method: 'POST',
        body: { school_id: schoolId, course_period_ids: [...selected], start_date: start, end_date: end, campus_id: campusId, include_inactive: includeInactive },
      });
      toast.success(t('app.at_sheets_created', { count: selected.size }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: a('print_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <View className="flex-row gap-2">
                <DateField className="flex-1" label={a('print_startDate')} value={start} onChange={(d) => d && setStart(d)} />
                <DateField className="flex-1" label={a('print_endDate')} value={end} onChange={(d) => d && setEnd(d)} />
              </View>
              <CheckRow checked={includeInactive} onPress={() => setIncludeInactive((v) => !v)} label={a('print_includeInactiveStudents')} />
              <SearchBar value={search} onChangeText={setSearch} placeholder={a('print_courseSearch')} />
              {filtered.length ? (
                <View className="bg-muted/50 flex-row items-center justify-between rounded-md px-3 py-2">
                  <CheckRow checked={allFiltered} onPress={toggleAll} label={a('print_selectAll', { count: filtered.length })} />
                  <Text className="text-muted-foreground text-xs">{a('print_selected', { count: selected.size })}</Text>
                </View>
              ) : null}
            </View>
          }
          items={list.data ? filtered : undefined}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={all.length === 0 ? a('print_noCoursePeriods') : a('print_noResults')}
          keyExtractor={(cp: CoursePeriodItem) => cp.id}
          renderItem={(cp: CoursePeriodItem) => (
            <Pressable onPress={() => toggle(cp.id)} className="flex-row items-center gap-3 px-4 py-3">
              <CheckRow checked={selected.has(cp.id)} onPress={() => toggle(cp.id)} label="" />
              <View className="flex-1">
                <Text className="text-sm font-semibold" numberOfLines={1}>
                  {cp.label}
                </Text>
                <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                  {`${cp.section_name} · ${cp.subject_name} · ${cp.period_title}${cp.teacher_name ? ` — ${cp.teacher_name}` : ''}`}
                </Text>
              </View>
            </Pressable>
          )}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={create} disabled={downloading || !selected.size}>
            <Icon as={Printer} className="text-primary-foreground size-4" />
            <Text>{a('print_createBtn')}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
