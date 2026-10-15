import { Stack } from 'expo-router';
import { Check, Download, X } from 'lucide-react-native';
import { toCsv } from '@studently/shared-utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { studentFullName, useCampusStudents } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

type Row = { id: string; name: string; number: string; grade: string; has: Record<string, boolean> };

/** Students with at least one school period that has no active course (web: /admin/scheduling/incomplete-schedules). */
export default function IncompleteSchedules() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.incomplete_schedules.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const students = useCampusStudents();
  const periodsRes = useApi(['admin', 'class-periods', campusId ?? 'school'], () => adminAcademics.periods(campusId));
  const periods = [...(periodsRes.data ?? [])].filter((p) => p.is_active !== false).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const studentList = students.data ?? [];
  const ready = !!yearId && studentList.length > 0 && periods.length > 0;
  // One schedule request per student, 10 at a time, like the web.
  const rows = useApi(ready ? ['admin', 'incomplete-schedules', yearId, campusId ?? 'school', studentList.length, periods.length] : null, async ([, , y]) => {
    const out: Row[] = [];
    for (let i = 0; i < studentList.length; i += 10) {
      const batch = studentList.slice(i, i + 10);
      const results = await Promise.allSettled(batch.map((st) => adminScheduling.studentSchedule(st.id, y as string)));
      results.forEach((r, k) => {
        const st = batch[k];
        const active = r.status === 'fulfilled' && r.value.success ? (r.value.data ?? []).filter((x) => !x.end_date) : [];
        const has: Record<string, boolean> = {};
        for (const p of periods) {
          has[p.id] = active.some((x) => x.course_period?.period_id === p.id || x.course_period?.period?.id === p.id || (!!p.short_name && (x.course_period?.short_name === p.short_name || (typeof x.course_period?.days === 'string' && x.course_period.days.includes(p.short_name)))));
        }
        if (periods.some((p) => !has[p.id])) out.push({ id: st.id, name: studentFullName(st.profile) || '—', number: st.student_number, grade: st.grade_level || '—', has });
      });
    }
    return { success: true, data: out };
  });
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const all = rows.data ?? [];
  const shown = term ? all.filter((r) => r.name.toLowerCase().includes(term) || r.number.toLowerCase().includes(term) || r.grade.toLowerCase().includes(term)) : all;
  const label = (p: (typeof periods)[number]) => p.short_name || p.title || p.period_name || String(p.period_number);
  const loading = students.isLoading || periodsRes.isLoading || rows.isLoading;

  const download = () =>
    shareTextFile(
      'incomplete-schedules.csv',
      toCsv(
        [t('common.student'), s('th_student_id'), t('common.grade_level'), ...periods.map(label)],
        shown.map((r) => [r.name, r.number, r.grade, ...periods.map((p) => (r.has[p.id] ? '✓' : '✗'))]),
      ),
      'text/csv',
      'public.comma-separated-values-text',
    ).catch((e) => toast.error(e instanceof Error ? e.message : ''));

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => rows.mutate()} />}>
        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground flex-1 text-sm">{loading ? t('common.loading') : s('found_students', { count: shown.length })}</Text>
          <Pressable onPress={download} hitSlop={8} className="p-1" accessibilityLabel={t('common.download')}>
            <Icon as={Download} className="text-muted-foreground size-4" />
          </Pressable>
        </View>
        <SearchBar value={q} onChangeText={setQ} placeholder={t('common.search')} />
        {loading ? (
          <LoadingList rows={5} />
        ) : !shown.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{all.length ? s('no_matching') : s('all_complete')}</Text>
        ) : (
          <Card>
            <CardContent className="py-1">
              {shown.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-1.5 py-2.5">
                    <Text className="font-medium">{r.name}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {r.number} · {r.grade}
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {periods.map((p) => (
                        <View key={p.id} className={cn('flex-row items-center gap-0.5 rounded px-1.5 py-0.5', r.has[p.id] ? 'bg-green-100 dark:bg-green-950' : 'bg-red-100 dark:bg-red-950')}>
                          <Icon as={r.has[p.id] ? Check : X} className={cn('size-3', r.has[p.id] ? 'text-green-700' : 'text-red-600')} />
                          <Text className="text-[11px]">{label(p)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
