import type { EntryExitRecord } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Download, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CheckRow, useAttendanceScope } from '@/features/admin/attendance';
import { QuickRecordDialog, RecordRow, useCheckpoints } from '@/features/admin/entry-exit';
import { adminEntryExit } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

const ALL = 'all';

/** Entry/exit records with filters, CSV export, add and (bulk) delete (web: /admin/entry-exit/report). */
export default function EntryExitRecords() {
  const { t, i18n } = useTranslation();
  const r = (k: string) => t(`school.entry_exit.report.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId } = useAttendanceScope();
  const checkpoints = useCheckpoints(schoolId);
  const [checkpoint, setCheckpoint] = useState(ALL);
  const [personType, setPersonType] = useState(ALL);
  const [direction, setDirection] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const opt = (v: string) => (v === ALL ? undefined : v);
  const list = useApi(schoolId ? ['admin', 'ee-records', schoolId, checkpoint, personType, direction, status, from, to] : null, () =>
    adminEntryExit.records({ school_id: schoolId, checkpoint_id: opt(checkpoint), person_type: opt(personType), record_type: opt(direction), status: opt(status), date_from: from || undefined, date_to: to || undefined }),
  );
  const rows = list.data ?? [];
  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function exportCsv() {
    if (!rows.length) return;
    const csv = toCsv(
      ['Time', 'Person', 'Type', 'Direction', 'Checkpoint', 'Status', 'Notes'],
      rows.map((x) => [new Date(x.recorded_at).toLocaleString(i18n.language), x.person_name || x.person_id, x.person_type, x.record_type, x.checkpoint_name || x.checkpoint_id, x.status, x.description || '']),
    );
    await shareTextFile(`entry-exit-records-${todayYmd()}.csv`, csv, 'text/csv', 'public.comma-separated-values-text');
  }

  async function removeOne(x: EntryExitRecord) {
    if (!(await confirm({ title: t('app.ee_delete_record'), body: x.person_name || x.person_id, destructive: true }))) return;
    const res = await adminEntryExit.deleteRecord(x.id);
    if (!res.success) return toast.error(res.error || t('app.ee_delete_failed'));
    toast.success(t('app.ee_record_deleted'));
    list.mutate();
  }

  async function removeSelected() {
    if (!(await confirm({ title: r('btn_delete_bulk'), body: t('app.ee_delete_many', { count: selected.size }), destructive: true }))) return;
    const results = await Promise.all([...selected].map((id) => adminEntryExit.deleteRecord(id)));
    const failed = results.filter((x) => !x.success).length;
    if (failed) toast.error(t('app.ee_delete_failed'));
    else toast.success(t('app.ee_deleted_many', { count: selected.size }));
    setSelected(new Set());
    list.mutate();
  }

  const statusOptions = [ALL, 'authorized', 'late', 'unauthorized'].map((v) => ({ value: v, label: v === ALL ? r('filter_all_status') : r(`status_${v}`) }));

  return (
    <>
      <Stack.Screen options={{ title: r('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted">{r('page_subtitle')}</Text>
              <View className="flex-row gap-2">
                <Button className="flex-1" onPress={() => setAdding(true)}>
                  <Icon as={Plus} className="text-primary-foreground size-4" />
                  <Text>{r('btn_add_record')}</Text>
                </Button>
                <Button variant="outline" onPress={exportCsv} disabled={!rows.length}>
                  <Icon as={Download} className="text-foreground size-4" />
                  <Text>{r('btn_export')}</Text>
                </Button>
              </View>
              <Text className="text-muted-foreground text-sm font-semibold">{r('filters_title')}</Text>
              <Picker value={checkpoint} onChange={setCheckpoint} options={[{ value: ALL, label: r('filter_all_checkpoints') }, ...(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
              <View className="flex-row gap-2">
                <Picker
                  className="flex-1"
                  value={personType}
                  onChange={setPersonType}
                  options={[
                    { value: ALL, label: r('filter_all_types') },
                    { value: 'STUDENT', label: r('option_student') },
                    { value: 'STAFF', label: r('option_staff') },
                  ]}
                />
                <Picker
                  className="flex-1"
                  value={direction}
                  onChange={setDirection}
                  options={[
                    { value: ALL, label: r('filter_all_directions') },
                    { value: 'ENTRY', label: r('option_entry') },
                    { value: 'EXIT', label: r('option_exit') },
                  ]}
                />
              </View>
              <Picker value={status} onChange={setStatus} options={statusOptions} />
              <View className="flex-row gap-2">
                <DateField className="flex-1" placeholder={r('filter_date_from_placeholder')} value={from} onChange={setFrom} clearable />
                <DateField className="flex-1" placeholder={r('filter_date_to_placeholder')} value={to} onChange={setTo} clearable />
              </View>
              {rows.length ? (
                <View className="flex-row items-center justify-between">
                  <CheckRow checked={all} onPress={() => setSelected(all ? new Set() : new Set(rows.map((x) => x.id)))} label={t('app.at_select_all')} />
                  {selected.size ? (
                    <Button size="sm" variant="destructive" onPress={removeSelected}>
                      <Icon as={Trash2} className="size-3.5 text-white" />
                      <Text>{`${r('btn_delete_bulk')} (${selected.size})`}</Text>
                    </Button>
                  ) : null}
                </View>
              ) : null}
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={r('msg_no_records')}
          emptyBody={r('msg_adjust_filters')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <Pressable onPress={() => toggle(x.id)} className={cn('flex-row items-center ps-4', selected.has(x.id) && 'bg-primary/10')}>
              <CheckRow checked={selected.has(x.id)} onPress={() => toggle(x.id)} label="" />
              <View className="flex-1">
                <RecordRow
                  r={x}
                  trailing={
                    <Pressable onPress={() => removeOne(x)} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  }
                />
              </View>
            </Pressable>
          )}
        />
      </View>
      <QuickRecordDialog schoolId={schoolId} open={adding} onOpenChange={setAdding} onDone={() => list.mutate()} />
    </>
  );
}
