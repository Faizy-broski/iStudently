import type { ApiResponse, EntryExitRecord, PersonType, RecordType } from '@studently/api-client';
import { ArrowRightLeft, Clock, DoorClosed, DoorOpen, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckMark, IconTile, Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminEmployees, adminEntryExit, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

export function useCheckpoints(schoolId: string) {
  return useApi(schoolId ? ['admin', 'ee-checkpoints', schoolId] : null, () => adminEntryExit.checkpoints(schoolId));
}

const STATUS_CLS: Record<string, [string, string]> = {
  authorized: ['bg-success-soft', 'text-success'],
  late: ['bg-warning-soft', 'text-warning'],
  unauthorized: ['bg-destructive-soft', 'text-destructive'],
};

export function EntryStatusPill({ status }: { status: string }) {
  const [bg, fg] = STATUS_CLS[status] ?? STATUS_CLS.unauthorized;
  return (
    <View className={cn('rounded-full px-2.5 py-1', bg)}>
      <Text className={cn('text-[11px] font-semibold', fg)}>{status}</Text>
    </View>
  );
}

/** One entry/exit record (web dashboard's recent-records row). */
export function RecordRow({ r, trailing }: { r: EntryExitRecord; trailing?: React.ReactNode }) {
  const { i18n } = useTranslation();
  const entry = r.record_type === 'ENTRY';
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <IconTile icon={entry ? DoorOpen : DoorClosed} tone={entry ? 'success' : 'warning'} size={40} />
      <View className="flex-1">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {r.person_name || r.person_id}
        </Text>
        <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
          {[r.person_type, r.checkpoint_name || r.checkpoint_id, r.student_number].filter(Boolean).join(' · ')}
        </Text>
        {r.description ? <Text className="text-muted-foreground text-xs" numberOfLines={2}>{r.description}</Text> : null}
      </View>
      <View className="items-end gap-1">
        <EntryStatusPill status={r.status} />
        <View className="flex-row items-center gap-1">
          <Icon as={Clock} className="text-muted-foreground size-3" />
          <Text className="text-muted-foreground text-[11px]">
            {new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(r.recorded_at))}
          </Text>
        </View>
      </View>
      {trailing}
    </View>
  );
}

export type PickedPerson = { id: string; name: string; sub: string };

/** Students or staff (teachers + other staff) of the selected campus, as search results. */
export function usePersonSearch(type: PersonType, term: string, enabled = true) {
  const { campusId } = useCampus();
  return useApi<PickedPerson[]>(enabled && term.length >= 2 ? ['admin', 'ee-person-search', type, campusId ?? 'school', term] : null, async () => {
    if (type === 'STUDENT') {
      const res = await adminStudents.list(campusId, { search: term, limit: 20 });
      return { ...res, data: (res.data ?? []).map((s): PickedPerson => ({ id: s.id, name: shortName(s.profile) || s.student_number, sub: [s.student_number, s.grade?.name ?? s.grade_level].filter(Boolean).join(' · ') })) };
    }
    const [teachers, staff] = await Promise.all([adminEmployees.list('teacher', campusId, { page: 1, limit: 20, search: term }), adminEmployees.list('staff', campusId, { page: 1, limit: 20, search: term })]);
    if (!teachers.success) return { success: false, error: teachers.error, code: teachers.code, retryable: teachers.retryable } as ApiResponse<PickedPerson[]>;
    return { ...teachers, data: [...(teachers.data ?? []), ...(staff.data ?? [])].map((s): PickedPerson => ({ id: s.id, name: shortName(s.profile) || s.employee_number || s.id, sub: s.employee_number ?? '' })) };
  });
}

/** Single searchable student/staff picker (web quick-record "Change" selector). */
export function PersonPicker({ type, value, onChange }: { type: PersonType; value: PickedPerson | null; onChange: (p: PickedPerson | null) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const results = usePersonSearch(type, term, !value);
  if (value) {
    return (
      <View className="border-brand-secondary bg-info-soft flex-row items-center gap-3 rounded-2xl border p-2.5">
        <Initials name={value.name} />
        <View className="flex-1">
          <Text className="text-sm font-semibold">{value.name}</Text>
          {value.sub ? <Text className="text-muted-foreground text-[11px]">{value.sub}</Text> : null}
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={t('school.entry_exit.dashboard.btn_change')} className="bg-card size-8 items-center justify-center rounded-full active:opacity-70">
          <Icon as={X} className="text-muted-foreground size-4" />
        </Pressable>
      </View>
    );
  }
  return (
    <View className="gap-1">
      <SearchBar value={q} onChangeText={setQ} placeholder={t('school.entry_exit.dashboard.placeholder_search')} />
      {results.isLoading ? <Text className="text-muted-foreground px-2 text-sm">{t('school.entry_exit.dashboard.msg_loading')}</Text> : null}
      {(results.data ?? []).length ? (
        <View className="border-info-soft dark:border-border bg-card overflow-hidden rounded-2xl border">
          {(results.data ?? []).map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Separator /> : null}
              <Pressable
                className="flex-row items-center gap-3 px-3 py-2.5 active:opacity-70"
                onPress={() => {
                  onChange(p);
                  setQ('');
                }}>
                <Initials name={p.name} size={32} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{p.name}</Text>
                  {p.sub ? <Text className="text-muted-foreground text-[11px]">{p.sub}</Text> : null}
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Quick single record: checkpoint, person type, direction, person, note (web dashboard + records dialogs). */
export function QuickRecordDialog({ schoolId, open, onOpenChange, onDone }: { schoolId: string; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { t } = useTranslation();
  const e = (k: string) => t(`school.entry_exit.dashboard.${k}`);
  const toast = useToast();
  const checkpoints = useCheckpoints(schoolId);
  const [checkpoint, setCheckpoint] = useState('');
  const [personType, setPersonType] = useState<PersonType>('STUDENT');
  const [recordType, setRecordType] = useState<RecordType>('ENTRY');
  const [person, setPerson] = useState<PickedPerson | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function record() {
    if (!checkpoint || !person) return;
    setSubmitting(true);
    try {
      const res = await adminEntryExit.createRecord({ school_id: schoolId, checkpoint_id: checkpoint, person_id: person.id, person_type: personType, record_type: recordType, description: description || undefined });
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      onOpenChange(false);
      setCheckpoint('');
      setPerson(null);
      setDescription('');
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{e('dialog_record_title')}</DialogTitle>
        </DialogHeader>
        <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
          <View className="gap-1.5">
            <Label>{e('label_checkpoint')}</Label>
            <Picker value={checkpoint} onChange={setCheckpoint} placeholder={e('label_checkpoint')} options={(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Label>{e('label_person_type')}</Label>
              <Picker
                value={personType}
                onChange={(v) => {
                  setPersonType(v as PersonType);
                  setPerson(null);
                }}
                options={[
                  { value: 'STUDENT', label: e('person_type_student') },
                  { value: 'STAFF', label: e('person_type_staff') },
                ]}
              />
            </View>
            <View className="flex-1 gap-1.5">
              <Label>{e('label_record_type')}</Label>
              <Picker
                value={recordType}
                onChange={(v) => setRecordType(v as RecordType)}
                options={[
                  { value: 'ENTRY', label: e('record_type_entry') },
                  { value: 'EXIT', label: e('record_type_exit') },
                ]}
              />
            </View>
          </View>
          <View className="gap-1.5">
            <Label>{personType === 'STUDENT' ? e('person_type_student') : e('person_type_staff')}</Label>
            <PersonPicker type={personType} value={person} onChange={setPerson} />
          </View>
          <View className="gap-1.5">
            <Label>{e('label_description')}</Label>
            <Input value={description} onChangeText={setDescription} />
          </View>
          <Button onPress={record} disabled={submitting || !checkpoint || !person}>
            <Icon as={ArrowRightLeft} className="text-primary-foreground size-4" />
            <Text>{submitting ? e('msg_loading') : e('btn_record')}</Text>
          </Button>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Active students of the campus, filtered by grade/section/search (bulk entry-exit pages). */
export function useStudentRoster(term: string, gradeName?: string, sectionId?: string) {
  const { campusId } = useCampus();
  return useApi(['admin', 'ee-roster', campusId ?? 'school', term, gradeName ?? '', sectionId ?? ''], () =>
    adminStudents.list(campusId, { search: term || undefined, grade_level: gradeName ? [gradeName] : undefined, section_id: sectionId ? [sectionId] : undefined, limit: 500, is_active: true }),
  );
}

/** Selectable roster row with initials avatar (web bulk tables). */
export function RosterRow({ name, sub, selected, onToggle }: { name: string; sub: string; selected: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', selected && 'bg-info-soft')}>
      <CheckMark on={selected} />
      <View className={cn('size-9 items-center justify-center rounded-full', selected ? 'bg-brand dark:bg-brand-secondary' : 'bg-info-soft')}>
        <Text className={cn('text-[11px] font-bold', selected ? 'text-white' : 'text-brand dark:text-brand-secondary')}>{initials(name)}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold">{name}</Text>
        <Text className="text-muted-foreground text-[11px]">{sub || '—'}</Text>
      </View>
    </Pressable>
  );
}
