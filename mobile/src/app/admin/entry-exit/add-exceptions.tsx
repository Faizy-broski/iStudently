import type { PersonType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow, GradeSectionPickers, useAttendanceScope, useGradeSection } from '@/features/admin/attendance';
import { RosterRow, useCheckpoints, useStudentRoster } from '@/features/admin/entry-exit';
import { shortName } from '@/features/admin/people';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminEmployees, adminEntryExit } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

const TYPES = [
  { value: 'ENTRY_AND_EXIT', key: 'type_entry_exit' },
  { value: 'ENTRY', key: 'type_entry' },
  { value: 'EXIT', key: 'type_exit' },
];

/** Exempt many students or staff from automatic records for a date range (web: /admin/entry-exit/add-exceptions). */
export default function AddExceptions() {
  const { t } = useTranslation();
  const x = (k: string, o?: Record<string, unknown>) => t(`school.entry_exit.exceptions.${k}`, o);
  const toast = useToast();
  const { schoolId } = useAttendanceScope();
  const { campusId } = useCampus();
  const { me } = useSession();
  const userName = me.status === 'ready' ? [me.me.profile.first_name, me.me.profile.last_name].filter(Boolean).join(' ') : '';
  const gs = useGradeSection();
  const checkpoints = useCheckpoints(schoolId);
  const [tab, setTabRaw] = useState<PersonType>('STUDENT');
  const [checkpoint, setCheckpoint] = useState('all');
  const [type, setType] = useState('ENTRY_AND_EXIT');
  const [from, setFrom] = useState(todayYmd);
  const [to, setTo] = useState(todayYmd);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const students = useStudentRoster(tab === 'STUDENT' ? term : '', gs.gradeName, gs.sectionId);
  const staff = useApi(tab === 'STAFF' ? ['admin', 'ee-staff-roster', campusId ?? 'school', term] : null, async () => {
    const [a, b] = await Promise.all([adminEmployees.list('teacher', campusId, { page: 1, limit: 500, search: term || undefined }), adminEmployees.list('staff', campusId, { page: 1, limit: 500, search: term || undefined })]);
    return { ...a, data: [...(a.data ?? []), ...(b.data ?? [])] };
  });
  const rows =
    tab === 'STUDENT'
      ? (students.data ?? []).map((s) => ({ id: s.id, name: shortName(s.profile) || s.student_number, sub: [s.student_number, s.grade?.name ?? s.grade_level, s.section?.name].filter(Boolean).join(' · ') }))
      : (staff.data ?? []).map((s) => ({ id: s.id, name: shortName(s.profile) || s.employee_number || s.id, sub: s.employee_number ?? '' }));
  const active = tab === 'STUDENT' ? students : staff;
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setTab = (v: PersonType) => {
    setTabRaw(v);
    setSelected(new Set());
  };

  async function submit() {
    if (!from) return toast.error(x('msg_error_from_date'));
    if (!to) return toast.error(x('msg_error_to_date'));
    if (!selected.size) return toast.error(x('msg_error_no_selection'));
    setSubmitting(true);
    try {
      const res = await adminEntryExit.bulkCreateExceptions({
        school_id: schoolId,
        person_ids: [...selected],
        person_type: tab,
        checkpoint_id: checkpoint === 'all' ? undefined : checkpoint,
        record_type: type === 'ENTRY_AND_EXIT' ? undefined : type,
        from_date: from,
        to_date: to,
        reason: reason || undefined,
        created_by: userName,
      });
      if (!res.success || !res.data) return toast.error(res.error || x('msg_error_create'));
      toast.success(res.data.created === 0 ? x('msg_no_rules_found') : x('msg_success_bulk_created', { count: res.data.created }));
      setSelected(new Set());
    } finally {
      setSubmitting(false);
    }
  }

  const tabLabel = tab === 'STUDENT' ? x('tab_students') : x('tab_users');

  return (
    <>
      <Stack.Screen options={{ title: x('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <FilterChips<PersonType>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'STUDENT', label: x('tab_students') },
                  { value: 'STAFF', label: x('tab_users') },
                ]}
              />
              <Card>
                <CardContent className="gap-3 pt-4">
                  <Text className="text-muted-foreground text-center text-sm font-semibold uppercase">{x('card_add_title')}</Text>
                  <View className="gap-1.5">
                    <Label>{x('label_checkpoint')}</Label>
                    <Picker value={checkpoint} onChange={setCheckpoint} options={[{ value: 'all', label: x('option_na_all') }, ...(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
                  </View>
                  <View className="gap-1.5">
                    <Label>{x('label_type')}</Label>
                    <Picker value={type} onChange={setType} options={TYPES.map((o) => ({ value: o.value, label: x(o.key) }))} />
                  </View>
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" label={x('label_from')} value={from} onChange={setFrom} />
                    <DateField className="flex-1" label={x('label_to')} value={to} onChange={setTo} min={from || undefined} />
                  </View>
                  <View className="gap-1.5">
                    <Label>{x('label_reason')}</Label>
                    <Input value={reason} onChangeText={setReason} placeholder={x('placeholder_reason')} />
                  </View>
                </CardContent>
              </Card>
              {tab === 'STUDENT' ? <GradeSectionPickers gs={gs} /> : null}
              <SearchBar value={search} onChangeText={setSearch} placeholder={x('toolbar_search')} />
              <View className="flex-row items-center justify-between">
                <CheckRow checked={all} onPress={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} label={t('app.at_select_all')} />
                <Text variant="muted">{x('stat_found', { count: rows.length })}</Text>
              </View>
            </View>
          }
          items={active.data ? rows : undefined}
          error={active.error}
          isLoading={active.isLoading}
          onRefresh={() => active.mutate()}
          emptyTitle={x('msg_no_data')}
          keyExtractor={(r) => r.id}
          renderItem={(r) => <RosterRow name={r.name} sub={r.sub} selected={selected.has(r.id)} onToggle={() => toggle(r.id)} />}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={submit} disabled={submitting || !selected.size}>
            <Text>{x('btn_add_bulk', { type: tabLabel, count: selected.size })}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
