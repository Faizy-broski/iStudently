import type { StaffAbsence } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { DateField, formatYmd, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Initials, RowActions } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { adminStaffAbsences } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

export const ABSENCE_STATUS_CLS: Record<string, string> = {
  pending: 'bg-warning-soft border-warning/30 text-warning',
  approved: 'bg-success-soft border-success/30 text-success',
  rejected: 'bg-destructive-soft border-destructive/30 text-destructive',
};

export function StatusPill({ status, label }: { status: string; label: string }) {
  const [bg, border, fg] = (ABSENCE_STATUS_CLS[status] ?? 'bg-muted border-border text-foreground').split(' ');
  return (
    <View className={cn('rounded-full border px-2 py-0.5', bg, border)}>
      <Text className={cn('text-xs font-medium', fg)}>{label}</Text>
    </View>
  );
}

const daysAbsent = (start: string, end: string) => Math.max(0.5, Math.round(((new Date(end).getTime() - new Date(start).getTime()) / 86400000) * 10) / 10);

/** Staff absences list with date/status/name filters, edit and delete (web: /admin/staff-absences/absences). */
export default function StaffAbsences() {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`staffAbsences.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId, campusId } = useAttendanceScope();
  const [start, setStart] = useState(() => `${todayYmd().slice(0, 8)}01`);
  const [end, setEnd] = useState(todayYmd);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const list = useApi(schoolId ? ['admin', 'staff-absences', schoolId, campusId ?? 'school', start, end, status] : null, () =>
    adminStaffAbsences.list({ school_id: schoolId, campus_id: campusId, start_date: start, end_date: end, status: status === 'all' ? undefined : status }),
  );
  const rows = (list.data ?? []).filter((a) => !search || a.staff_name?.toLowerCase().includes(search.toLowerCase()));

  async function remove(a: StaffAbsence) {
    if (!(await confirm({ title: s('deleteAbsence.title'), body: s('deleteAbsence.description'), confirmLabel: s('delete'), destructive: true }))) return;
    const res = await adminStaffAbsences.remove(a.id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(s('toasts.absenceDeleted'));
    list.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Button onPress={() => router.push('/admin/staff-absences/form')}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{s('addAbsence')}</Text>
              </Button>
              <View className="flex-row gap-2">
                <DateField className="flex-1" label={s('filters.from')} value={start} onChange={setStart} clearable />
                <DateField className="flex-1" label={s('filters.to')} value={end} onChange={setEnd} clearable />
              </View>
              <Picker
                value={status}
                onChange={setStatus}
                options={['all', 'pending', 'approved', 'rejected'].map((v) => ({ value: v, label: s(`statuses.${v}`) }))}
              />
              <SearchBar value={search} onChangeText={setSearch} placeholder={s('filters.namePlaceholder')} />
              <Text variant="muted">{s('resultsCount', { count: rows.length })}</Text>
            </View>
          }
          items={list.data ? rows : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={s('empty.absences')}
          keyExtractor={(a) => a.id}
          renderItem={(a) => (
            <View className="gap-1.5 px-4 py-3">
              <View className="flex-row items-center gap-3">
                <Initials name={a.staff_name || '?'} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{a.staff_name || s('notAvailable')}</Text>
                  <Text variant="muted" className="text-[11px] capitalize">
                    {a.staff_role || s('notAvailable')}
                  </Text>
                </View>
                <StatusPill status={a.status} label={s(`statuses.${a.status}`)} />
              </View>
              <Text className="text-sm">
                {`${formatYmd(a.start_date, i18n.language)} → ${formatYmd(a.end_date, i18n.language)} · ${s('table.days')}: ${daysAbsent(a.start_date, a.end_date)}`}
              </Text>
              {a.reason ? <Text className="text-muted-foreground text-sm" numberOfLines={2}>{a.reason}</Text> : null}
              <RowActions onEdit={() => router.push({ pathname: '/admin/staff-absences/form', params: { id: a.id } })} onDelete={() => remove(a)} editLabel={s('editAbsence')} deleteLabel={s('delete')} />
            </View>
          )}
        />
      </View>
    </>
  );
}
