import type { DuplicateAttendanceRecord } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { Initials } from '@/components/app/layout';
import { formatYmd } from '@/components/app/date-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CheckRow, useAttendanceScope } from '@/features/admin/attendance';
import { adminAttendance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Find and remove duplicate period attendance rows (web: /admin/attendance/delete-duplicates). */
export default function DeleteDuplicates() {
  const { t, i18n } = useTranslation();
  const a = (k: string) => t(`attendance.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId, campusId } = useAttendanceScope();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const list = useApi(schoolId ? ['admin', 'attendance-duplicates', schoolId, campusId ?? 'school'] : null, () =>
    adminAttendance.findDuplicates(schoolId, undefined, undefined, campusId),
  );
  const dups = list.data ?? [];
  const all = dups.length > 0 && selected.size === dups.length;
  const toggle = (i: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  async function remove() {
    if (!selected.size) return toast.error(a('delete_duplicates_choose'));
    if (!(await confirm({ title: a('delete_duplicates_title'), body: t('app.at_delete_dups_confirm', { count: selected.size }), destructive: true }))) return;
    setDeleting(true);
    try {
      const res = await adminAttendance.deleteDuplicates({ school_id: schoolId, campus_id: campusId });
      if (res.data) {
        toast.success(t('app.at_dups_deleted', { count: res.data.deleted }));
        setSelected(new Set());
        list.mutate();
      } else toast.error(res.error || t('app.error_title'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: a('delete_duplicates_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            dups.length ? (
              <View className="px-4 pt-3">
                <CheckRow checked={all} onPress={() => setSelected(all ? new Set() : new Set(dups.map((_, i) => i)))} label={t('app.at_select_all')} />
              </View>
            ) : undefined
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={a('delete_noFound')}
          keyExtractor={(d: DuplicateAttendanceRecord) => `${d.student_id}-${d.period_id}-${d.attendance_date}`}
          renderItem={(d: DuplicateAttendanceRecord, i) => (
            <Pressable onPress={() => toggle(i)} className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', selected.has(i) && 'bg-info-soft/70')}>
              <CheckRow checked={selected.has(i)} onPress={() => toggle(i)} label="" />
              <Initials name={d.student_name || '?'} tone="warning" size={36} />
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold">
                  {d.student_name || 'Unknown'} <Text className="text-muted-foreground text-[11px]">({d.student_id.substring(0, 8)})</Text>
                </Text>
                <Text variant="muted" className="text-[11px]">
                  {`${a('delete_duplicates_th_period')}: ${d.period_name || 'Unknown'} (${d.period_id.substring(0, 8)}) · ${formatYmd(d.attendance_date, i18n.language)}`}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-destructive text-lg font-semibold">{d.count}</Text>
                <Text className="text-muted-foreground text-[10px]">{a('delete_duplicates_th_duplicateCount')}</Text>
              </View>
            </Pressable>
          )}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button variant="destructive" onPress={remove} disabled={deleting || !selected.size}>
            <Icon as={Trash2} className="size-4 text-white" />
            <Text>{a('delete_btn')}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
