import type { PersonType, SchoolException } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { useCheckpoints } from '@/features/admin/entry-exit';
import { adminEntryExit } from '@/lib/api';

const TYPES = [
  { value: 'ENTRY_AND_EXIT', key: 'type_entry_exit' },
  { value: 'ENTRY', key: 'type_entry' },
  { value: 'EXIT', key: 'type_exit' },
];

/** School-wide automatic-record exceptions: search, filter by tab, remove (web: /admin/entry-exit/exceptions). */
export default function EntryExitExceptions() {
  const { t } = useTranslation();
  const x = (k: string, o?: Record<string, unknown>) => t(`school.entry_exit.exceptions.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId } = useAttendanceScope();
  const checkpoints = useCheckpoints(schoolId);
  const [tab, setTab] = useState<PersonType>('STUDENT');
  const [from, setFrom] = useState(todayYmd);
  const [to, setTo] = useState('');
  const [checkpoint, setCheckpoint] = useState('all');
  const [type, setType] = useState('ENTRY_AND_EXIT');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<SchoolException[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function go() {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await adminEntryExit.schoolExceptions(schoolId, { from_date: from || undefined, to_date: to || undefined, checkpoint_id: checkpoint === 'all' ? undefined : checkpoint, record_type: type === 'ENTRY_AND_EXIT' ? undefined : type });
      if (!res.success) return toast.error(res.error || x('msg_error_load'));
      setItems(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function remove(ex: SchoolException) {
    if (!(await confirm({ title: x('dialog_remove_title'), body: x('dialog_remove_desc'), confirmLabel: x('btn_remove'), destructive: true }))) return;
    const res = await adminEntryExit.deleteException(ex.id);
    if (!res.success) return toast.error(res.error || x('msg_error_delete'));
    setItems((p) => (p ? p.filter((e) => e.id !== ex.id) : p));
    toast.success(x('msg_success_removed'));
  }

  const q = search.toLowerCase();
  const visible = (items ?? []).filter((e) => e.person_type === tab && (!q || (e.person_name || '').toLowerCase().includes(q) || e.person_id.toLowerCase().includes(q)));
  const rt = (v: string) => (v === 'ENTRY' ? x('type_entry') : v === 'EXIT' ? x('type_exit') : x('type_entry_exit'));

  return (
    <>
      <Stack.Screen options={{ title: x('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Button variant="outline" onPress={() => router.push('/admin/entry-exit/add-exceptions')}>
                <Icon as={Plus} className="text-foreground size-4" />
                <Text>{t('app.ee_add_exceptions')}</Text>
              </Button>
              <FilterChips<PersonType>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'STUDENT', label: x('tab_students') },
                  { value: 'STAFF', label: x('tab_users') },
                ]}
              />
              <View className="flex-row gap-2">
                <DateField className="flex-1" label={x('label_from_date')} value={from} onChange={setFrom} clearable />
                <DateField className="flex-1" label={x('label_to_date')} value={to} onChange={setTo} min={from || undefined} clearable />
              </View>
              <View className="flex-row gap-2">
                <Picker className="flex-1" value={checkpoint} onChange={setCheckpoint} options={[{ value: 'all', label: t('common.all') }, ...(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
                <Picker className="flex-1" value={type} onChange={setType} options={TYPES.map((o) => ({ value: o.value, label: x(o.key) }))} />
              </View>
              <Button onPress={go} disabled={loading}>
                <Text>{x('btn_go')}</Text>
              </Button>
              {items ? (
                <>
                  <Text variant="muted">{x('stat_found', { count: visible.length })}</Text>
                  <SearchBar value={search} onChangeText={setSearch} placeholder={x('toolbar_search')} />
                </>
              ) : null}
            </View>
          }
          items={items ? visible : loading ? undefined : []}
          isLoading={loading}
          emptyTitle={items ? x('msg_no_data') : x('msg_filter_prompt')}
          keyExtractor={(e) => e.id}
          renderItem={(e) => (
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1 gap-0.5">
                <Text className="font-medium">{e.person_name || `${e.person_id.slice(0, 12)}…`}</Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-muted-foreground text-xs">{e.checkpoint_name || `${e.checkpoint_id.slice(0, 8)}…`}</Text>
                  <Badge variant="outline">
                    <Text className="text-xs">{rt(e.record_type)}</Text>
                  </Badge>
                </View>
                <Text className="text-xs">{`${e.from_date} → ${e.to_date}`}</Text>
                {e.reason ? <Text className="text-muted-foreground text-xs">{e.reason}</Text> : null}
              </View>
              <Pressable onPress={() => remove(e)} hitSlop={8}>
                <Icon as={Trash2} className="text-muted-foreground size-4" />
              </Pressable>
            </View>
          )}
        />
      </View>
    </>
  );
}
