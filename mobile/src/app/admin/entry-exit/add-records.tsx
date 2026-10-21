import type { RecordType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { DoorClosed, DoorOpen, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
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

/** Record an entry or exit for many students at once (web: /admin/entry-exit/add-records). */
export default function AddEntryExitRecords() {
  const { t } = useTranslation();
  const e = (k: string, o?: Record<string, unknown>) => t(`school.entry_exit.dashboard.${k}`, o);
  const toast = useToast();
  const { schoolId } = useAttendanceScope();
  const gs = useGradeSection();
  const checkpoints = useCheckpoints(schoolId);
  const [checkpointId, setCheckpointId] = useState('');
  const [recordType, setRecordType] = useState<RecordType | ''>('');
  const [unauthorized, setUnauthorized] = useState(false);
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
    if (!checkpointId) return toast.error(e('msg_error_checkpoint'));
    if (!recordType) return toast.error(e('msg_error_type'));
    if (!selected.size) return toast.error(e('msg_error_no_selection'));
    setSubmitting(true);
    try {
      const res = await adminEntryExit.createBulkRecords({
        school_id: schoolId,
        checkpoint_id: checkpointId,
        person_ids: [...selected],
        person_type: 'STUDENT',
        record_type: recordType,
        description: comments ? `${unauthorized ? '[UNAUTHORIZED] ' : ''}${comments}` : unauthorized ? '[UNAUTHORIZED]' : undefined,
      });
      if (!res.success) return toast.error(res.error || e('msg_record_failed'));
      toast.success(e('msg_record_added', { type: recordType, count: selected.size }));
      setSelected(new Set());
      setComments('');
      setUnauthorized(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: e('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-4 p-4">
              <Card>
                <CardContent className="gap-4 pt-4">
                  <Text className="text-muted-foreground text-sm font-semibold">{e('card_details_title')}</Text>
                  <View className="gap-1.5">
                    <Label>{`${e('label_checkpoint')} *`}</Label>
                    <Picker
                      value={checkpointId}
                      onChange={setCheckpointId}
                      placeholder={checkpoints.data?.length === 0 ? e('msg_no_checkpoints') : e('placeholder_checkpoint')}
                      options={(checkpoints.data ?? []).filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </View>
                  <View className="gap-1.5">
                    <Label>{`${e('label_type')} *`}</Label>
                    <Picker
                      value={recordType}
                      onChange={(v) => setRecordType(v as RecordType)}
                      placeholder={e('placeholder_record_type')}
                      options={[
                        { value: 'ENTRY', label: e('type_entry') },
                        { value: 'EXIT', label: e('type_exit') },
                      ]}
                    />
                  </View>
                  <CheckRow checked={unauthorized} onPress={() => setUnauthorized((v) => !v)} label={e('option_unauthorized')} />
                  <View className="gap-1.5">
                    <Label>{e('label_comments')}</Label>
                    <Textarea value={comments} onChangeText={setComments} placeholder={e('placeholder_comments')} className="min-h-14" />
                  </View>
                </CardContent>
              </Card>
              <GradeSectionPickers gs={gs} />
              <SearchBar value={search} onChangeText={setSearch} placeholder={e('toolbar_search_placeholder')} />
              <View className="flex-row items-center justify-between">
                <CheckRow checked={all} onPress={() => setSelected(all ? new Set() : new Set(rows.map((s) => s.id)))} label={t('app.at_select_all')} />
                <View className="flex-row items-center gap-2">
                  <Text variant="muted">{students.isLoading ? e('msg_loading') : e('stat_students_found', { count: rows.length })}</Text>
                  {selected.size ? (
                    <Badge className="bg-info-soft">
                      <Text className="text-brand dark:text-brand-secondary">{e('stat_selected', { count: selected.size })}</Text>
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
          emptyTitle={e('msg_no_students')}
          emptyBody={search ? e('msg_clear_search') : undefined}
          keyExtractor={(s) => s.id}
          renderItem={(s) => (
            <RosterRow name={shortName(s.profile) || e('msg_unknown')} sub={[s.student_number, s.grade?.name ?? s.grade_level, s.section?.name].filter(Boolean).join(' · ')} selected={selected.has(s.id)} onToggle={() => toggle(s.id)} />
          )}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={submit} disabled={submitting || !selected.size || !checkpointId || !recordType}>
            <Icon as={recordType === 'EXIT' ? DoorClosed : recordType === 'ENTRY' ? DoorOpen : UserPlus} className="text-primary-foreground size-4" />
            <Text>{`${e('btn_submit_bulk')}${selected.size ? ` (${selected.size})` : ''}`}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
