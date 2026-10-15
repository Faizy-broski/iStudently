import { Stack } from 'expo-router';
import { Moon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow, GradeSectionPickers, useAttendanceScope, useGradeSection } from '@/features/admin/attendance';
import { RosterRow, useCheckpoints, useStudentRoster } from '@/features/admin/entry-exit';
import { shortName } from '@/features/admin/people';
import { adminEntryExit } from '@/lib/api';
import { useDebounced } from '@/lib/use-debounced';

const DAYS = [
  { value: 1, key: 'day_monday' },
  { value: 2, key: 'day_tuesday' },
  { value: 3, key: 'day_wednesday' },
  { value: 4, key: 'day_thursday' },
  { value: 5, key: 'day_friday' },
  { value: 6, key: 'day_saturday' },
  { value: 0, key: 'day_sunday' },
];

/** Give many students the same evening leave, optionally replacing existing ones (web: /admin/entry-exit/mass-evening-leaves). */
export default function MassEveningLeaves() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`school.entry_exit.mass_evening_leaves.${k}`, o);
  const toast = useToast();
  const { schoolId } = useAttendanceScope();
  const gs = useGradeSection();
  const checkpoints = useCheckpoints(schoolId);
  const [checkpointId, setCheckpointId] = useState('');
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [from, setFrom] = useState(todayYmd);
  const [to, setTo] = useState('');
  const [dow, setDow] = useState<Set<number>>(() => new Set([1, 2, 3, 4, 5]));
  const [returnTime, setReturnTime] = useState('21:00');
  const [comments, setComments] = useState('');
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const students = useStudentRoster(term, gs.gradeName, gs.sectionId);
  const rows = students.data ?? [];
  const all = rows.length > 0 && rows.every((s) => selected.has(s.id));
  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function submit() {
    if (!checkpointId) return toast.error(m('msg_error_no_checkpoint'));
    if (!from) return toast.error(m('msg_error_no_start_date'));
    if (!to) return toast.error(m('msg_error_no_end_date'));
    if (!dow.size) return toast.error(m('msg_error_no_days'));
    if (!returnTime) return toast.error(m('msg_error_no_return_time'));
    if (!selected.size) return toast.error(m('msg_error_no_students'));
    setSubmitting(true);
    try {
      const ids = [...selected];
      if (deleteExisting) {
        const existing = await adminEntryExit.eveningLeaves({ school_id: schoolId });
        const doomed = (existing.data ?? []).filter((l) => ids.includes(l.student_id) && (l.checkpoint_id === checkpointId || !l.checkpoint_id));
        await Promise.all(doomed.map((l) => adminEntryExit.deleteEveningLeave(l.id)));
      }
      const results = await Promise.all(
        ids.map((sid) =>
          adminEntryExit.createEveningLeave({
            school_id: schoolId,
            student_id: sid,
            checkpoint_id: checkpointId,
            start_date: from,
            end_date: to,
            days_of_week: [...dow].sort(),
            authorized_return_time: returnTime,
            reason: comments || undefined,
          }),
        ),
      );
      const failed = results.find((r) => !r.success);
      if (failed) return toast.error(failed.error || m('msg_error'));
      toast.success(m('msg_success_added', { count: ids.length }));
      setSelected(new Set());
      setComments('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: m('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-4 p-4">
              <Text variant="muted">{m('page_subtitle')}</Text>
              <Card>
                <CardContent className="gap-4 pt-4">
                  <View className="gap-1.5">
                    <Label>{`${m('label_checkpoint')} *`}</Label>
                    <Picker
                      value={checkpointId}
                      onChange={setCheckpointId}
                      placeholder={checkpoints.data?.length === 0 ? m('msg_no_checkpoints') : m('placeholder_checkpoint')}
                      options={(checkpoints.data ?? []).filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </View>
                  <CheckRow checked={deleteExisting} onPress={() => setDeleteExisting((v) => !v)} label={m('label_delete_existing')} />
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" label={`${m('label_from')} *`} value={from} onChange={setFrom} />
                    <DateField className="flex-1" label={`${m('label_to')} *`} value={to} onChange={setTo} />
                  </View>
                  <View className="gap-1.5">
                    <Label>{`${m('label_days')} *`}</Label>
                    <View className="flex-row flex-wrap gap-x-3">
                      {DAYS.map((d) => (
                        <CheckRow
                          key={d.value}
                          checked={dow.has(d.value)}
                          onPress={() =>
                            setDow((p) => {
                              const n = new Set(p);
                              if (n.has(d.value)) n.delete(d.value);
                              else n.add(d.value);
                              return n;
                            })
                          }
                          label={m(d.key)}
                        />
                      ))}
                    </View>
                  </View>
                  <TimeField label={`${m('label_return_time')} *`} value={returnTime} onChange={setReturnTime} />
                  <View className="gap-1.5">
                    <Label>{m('label_comments')}</Label>
                    <Textarea value={comments} onChangeText={setComments} placeholder={m('placeholder_comments')} className="min-h-14" />
                  </View>
                </CardContent>
              </Card>
              <GradeSectionPickers gs={gs} />
              <SearchBar value={search} onChangeText={setSearch} placeholder={m('toolbar_search')} />
              <View className="flex-row items-center justify-between">
                <CheckRow checked={all} onPress={() => setSelected(all ? new Set() : new Set(rows.map((s) => s.id)))} label={t('app.at_select_all')} />
                <View className="flex-row items-center gap-2">
                  <Text variant="muted">{students.isLoading ? m('msg_loading_students') : m('stat_students_found', { count: rows.length })}</Text>
                  {selected.size ? (
                    <Badge className="bg-blue-100">
                      <Text className="text-blue-700">{m('stat_selected', { count: selected.size })}</Text>
                    </Badge>
                  ) : null}
                </View>
              </View>
            </View>
          }
          items={students.data ? rows : undefined}
          error={students.error}
          isLoading={students.isLoading}
          onRefresh={() => students.mutate()}
          emptyTitle={m('msg_no_students')}
          keyExtractor={(s) => s.id}
          renderItem={(s) => (
            <RosterRow name={shortName(s.profile) || s.student_number} sub={[s.student_number, s.grade?.name ?? s.grade_level, s.section?.name].filter(Boolean).join(' · ')} selected={selected.has(s.id)} onToggle={() => toggle(s.id)} />
          )}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={submit} disabled={submitting || !selected.size || !checkpointId || !from || !to || !dow.size}>
            <Icon as={Moon} className="text-primary-foreground size-4" />
            <Text>{`${m('btn_submit')}${selected.size ? ` (${selected.size})` : ''}`}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
