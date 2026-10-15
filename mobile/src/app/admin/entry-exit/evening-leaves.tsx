import type { EveningLeave } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { DateField, formatYmd, weekdayNames } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow, useAttendanceScope } from '@/features/admin/attendance';
import { PersonPicker, useCheckpoints, type PickedPerson } from '@/features/admin/entry-exit';
import { adminEntryExit } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Tab = 'leaves' | 'report';
const NONE = 'NULL';

/** Evening leaves: list, activate/deactivate, delete, add; tonight's return report (web: /admin/entry-exit/evening-leaves). */
export default function EveningLeaves() {
  const { t, i18n } = useTranslation();
  const v = (k: string) => t(`school.entry_exit.evening_leaves.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId } = useAttendanceScope();
  const checkpoints = useCheckpoints(schoolId);
  const [tab, setTab] = useState<Tab>('leaves');
  const leaves = useApi(schoolId ? ['admin', 'ee-leaves', schoolId] : null, () => adminEntryExit.eveningLeaves({ school_id: schoolId }));
  const report = useApi(schoolId && tab === 'report' ? ['admin', 'ee-leave-report', schoolId] : null, () => adminEntryExit.eveningLeaveReport(schoolId));
  const days = weekdayNames(i18n.language);
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<PickedPerson | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [dow, setDow] = useState<number[]>([]);
  const [returnTime, setReturnTime] = useState('21:00');
  const [checkpoint, setCheckpoint] = useState(NONE);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setStudent(null);
    setStart('');
    setEnd('');
    setDow([]);
    setReturnTime('21:00');
    setCheckpoint(NONE);
    setReason('');
  }

  async function create() {
    if (!student || !start || !end || !dow.length) return;
    setSaving(true);
    try {
      const res = await adminEntryExit.createEveningLeave({
        school_id: schoolId,
        student_id: student.id,
        checkpoint_id: checkpoint !== NONE ? checkpoint : undefined,
        start_date: start,
        end_date: end,
        days_of_week: dow,
        authorized_return_time: returnTime,
        reason: reason || undefined,
      });
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      setOpen(false);
      reset();
      leaves.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: EveningLeave) {
    if (!(await confirm({ title: v('msg_delete_confirm'), body: l.student_name ?? '', destructive: true }))) return;
    const res = await adminEntryExit.deleteEveningLeave(l.id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    leaves.mutate();
  }

  async function toggle(l: EveningLeave) {
    const res = await adminEntryExit.updateEveningLeave(l.id, { is_active: !l.is_active });
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    leaves.mutate();
  }

  const fmtDays = (d: number[]) => [...d].sort().map((n) => days[n] ?? n).join(', ');
  const time = (iso: string) => new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const active = tab === 'leaves' ? leaves : report;

  return (
    <>
      <Stack.Screen options={{ title: v('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted">{v('page_subtitle')}</Text>
              <Button onPress={() => setOpen(true)}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{v('btn_add_evening_leave')}</Text>
              </Button>
              <FilterChips<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'leaves', label: t('app.ee_all_leaves') },
                  { value: 'report', label: t('app.ee_tonight_report') },
                ]}
              />
            </View>
          }
          items={active.data}
          error={active.error}
          isLoading={active.isLoading}
          isRefreshing={active.isValidating && !active.isLoading}
          onRefresh={() => active.mutate()}
          emptyTitle={tab === 'leaves' ? t('app.ee_no_leaves') : t('app.ee_no_leaves_tonight')}
          keyExtractor={(l) => l.id}
          renderItem={(l) =>
            tab === 'leaves' ? (
              <View className="gap-1.5 px-4 py-3">
                <View className="flex-row items-start gap-2">
                  <Text className="flex-1 font-medium">{l.student_name || l.student_id.slice(0, 8)}</Text>
                  <View className={cn('rounded-full px-2 py-0.5', l.is_active ? 'bg-emerald-100' : 'bg-gray-100')}>
                    <Text className={cn('text-xs', l.is_active ? 'text-emerald-700' : 'text-gray-500')}>{l.is_active ? t('app.ee_active') : t('app.ee_inactive')}</Text>
                  </View>
                </View>
                <Text className="text-sm">{`${formatYmd(l.start_date, i18n.language)} – ${formatYmd(l.end_date, i18n.language)}`}</Text>
                <Text className="text-muted-foreground text-xs">{`${fmtDays(l.days_of_week)} · ${t('app.ee_return_by', { time: l.authorized_return_time })}`}</Text>
                <View className="flex-row justify-end gap-4">
                  <Pressable onPress={() => toggle(l)} hitSlop={8}>
                    <Text className="text-primary text-sm">{l.is_active ? t('app.ee_deactivate') : t('app.ee_activate')}</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(l)} hitSlop={8}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-3 px-4 py-3">
                <View className={cn('rounded-full p-2', l.has_returned ? 'bg-emerald-100' : 'bg-amber-100')}>
                  <Icon as={l.has_returned ? CheckCircle2 : AlertTriangle} className={cn('size-4', l.has_returned ? 'text-emerald-600' : 'text-amber-600')} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium">{l.student_name || l.student_id.slice(0, 8)}</Text>
                  <Text className="text-muted-foreground text-xs">{`${t('app.ee_return_by', { time: l.authorized_return_time })}${l.reason ? ` · ${l.reason}` : ''}`}</Text>
                </View>
                <View className="items-end gap-1">
                  <View className={cn('rounded-full px-2 py-0.5', l.has_returned && !l.is_late ? 'bg-emerald-100' : 'bg-amber-100')}>
                    <Text className={cn('text-xs', l.has_returned && !l.is_late ? 'text-emerald-700' : 'text-amber-700')}>
                      {l.has_returned ? (l.is_late ? t('app.ee_returned_late') : t('app.ee_returned')) : t('app.ee_not_back')}
                    </Text>
                  </View>
                  {l.has_returned && l.return_time ? <Text className="text-muted-foreground text-xs">{time(l.return_time)}</Text> : null}
                </View>
              </View>
            )
          }
        />
      </View>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{v('dialog_add_title')}</DialogTitle>
          </DialogHeader>
          <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
            <View className="gap-1.5">
              <Label>{v('label_student')}</Label>
              <PersonPicker type="STUDENT" value={student} onChange={setStudent} />
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={v('label_start_date')} value={start} onChange={setStart} />
              <DateField className="flex-1" label={v('label_end_date')} value={end} onChange={setEnd} />
            </View>
            <View className="gap-1.5">
              <Label>{v('label_days')}</Label>
              <View className="flex-row flex-wrap gap-x-3">
                {days.map((d, i) => (
                  <CheckRow key={i} checked={dow.includes(i)} onPress={() => setDow((x) => (x.includes(i) ? x.filter((n) => n !== i) : [...x, i]))} label={d} />
                ))}
              </View>
            </View>
            <TimeField label={v('label_return_time')} value={returnTime} onChange={setReturnTime} />
            <View className="gap-1.5">
              <Label>{`${v('label_checkpoint')} (${t('common.optional')})`}</Label>
              <Picker value={checkpoint} onChange={setCheckpoint} options={[{ value: NONE, label: t('common.all') }, ...(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
            </View>
            <View className="gap-1.5">
              <Label>{v('label_reason')}</Label>
              <Input value={reason} onChangeText={setReason} placeholder={v('placeholder_reason')} />
            </View>
          </ScrollView>
          <DialogFooter>
            <Button onPress={create} disabled={saving || !student || !start || !end || !dow.length}>
              <Text>{saving ? v('msg_loading') : t('common.create')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
