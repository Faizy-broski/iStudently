import type { Checkpoint, CheckpointMode } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Building2, Clock, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { useCheckpoints } from '@/features/admin/entry-exit';
import { adminEntryExit } from '@/lib/api';
import { cn } from '@/lib/utils';

type Slot = { day_of_week: number; start_time: string; end_time: string };
const MODE_CLS: Record<string, [string, string]> = { entry: ['bg-success-soft', 'text-success'], exit: ['bg-warning-soft', 'text-warning'], both: ['bg-info-soft', 'text-brand dark:text-brand-secondary'] };

/** Checkpoints: add/edit/delete, active switch, authorized time slots (web: /admin/entry-exit/checkpoints). */
export default function Checkpoints() {
  const { t, i18n } = useTranslation();
  const c = (k: string) => t(`school.entry_exit.checkpoints.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId } = useAttendanceScope();
  const list = useCheckpoints(schoolId);
  const [form, setForm] = useState<{ id: string | null; name: string; mode: CheckpointMode; description: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [times, setTimes] = useState<{ cp: Checkpoint; slots: Slot[] } | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(new Date(2000, 0, 2 + i)));
  const modeLabel = (m: string) => (m === 'both' ? c('mode_entry_exit') : m === 'entry' ? c('mode_entry_only') : c('mode_exit_only'));

  async function save() {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      const body = { name: form.name, mode: form.mode, description: form.description || undefined };
      const res = form.id ? await adminEntryExit.updateCheckpoint(form.id, body) : await adminEntryExit.createCheckpoint({ ...body, school_id: schoolId });
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      setForm(null);
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(cp: Checkpoint) {
    if (!(await confirm({ title: c('msg_delete_confirm'), body: cp.name, destructive: true }))) return;
    const res = await adminEntryExit.deleteCheckpoint(cp.id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    list.mutate();
  }

  async function toggle(cp: Checkpoint) {
    const res = await adminEntryExit.updateCheckpoint(cp.id, { is_active: !cp.is_active });
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    list.mutate();
  }

  async function openTimes(cp: Checkpoint) {
    const res = await adminEntryExit.authorizedTimes(cp.id);
    setTimes({ cp, slots: (res.data ?? []).map((x) => ({ day_of_week: x.day_of_week, start_time: x.start_time.slice(0, 5), end_time: x.end_time.slice(0, 5) })) });
  }

  async function saveTimes() {
    if (!times) return;
    setSaving(true);
    try {
      const res = await adminEntryExit.setAuthorizedTimes(times.cp.id, times.slots);
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      setTimes(null);
    } finally {
      setSaving(false);
    }
  }

  const setSlot = (i: number, patch: Partial<Slot>) => setTimes((x) => (x ? { ...x, slots: x.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : x));

  return (
    <>
      <Stack.Screen options={{ title: c('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted">{c('page_subtitle')}</Text>
              <Button onPress={() => setForm({ id: null, name: '', mode: 'both', description: '' })}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{c('btn_add_checkpoint')}</Text>
              </Button>
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={c('msg_no_data')}
          keyExtractor={(cp) => cp.id}
          renderItem={(cp) => {
            const [bg, fg] = MODE_CLS[cp.mode] ?? MODE_CLS.both;
            const desc = (cp as Checkpoint & { description?: string | null }).description;
            return (
              <View className={cn('gap-3 px-4 py-4', !cp.is_active && 'opacity-50')}>
                <View className="flex-row items-start gap-3">
                  <View className="bg-primary/10 rounded-lg p-2">
                    <Icon as={Building2} className="text-primary size-4" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold">{cp.name}</Text>
                    {desc ? <Text className="text-muted-foreground text-xs">{desc}</Text> : null}
                  </View>
                  <View className={cn('rounded-full px-2 py-0.5', bg)}>
                    <Text className={cn('text-xs font-medium', fg)}>{modeLabel(cp.mode)}</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-3">
                  <Switch checked={cp.is_active} onCheckedChange={() => toggle(cp)} />
                  <Text className="text-muted-foreground flex-1 text-xs">{cp.is_active ? c('status_active') : c('status_inactive')}</Text>
                  <Pressable onPress={() => openTimes(cp)} hitSlop={8} accessibilityLabel={c('tooltip_authorized_times')}>
                    <Icon as={Clock} className="text-muted-foreground size-5" />
                  </Pressable>
                  <Pressable onPress={() => setForm({ id: cp.id, name: cp.name, mode: cp.mode, description: desc ?? '' })} hitSlop={8}>
                    <Icon as={Pencil} className="text-muted-foreground size-5" />
                  </Pressable>
                  <Pressable onPress={() => remove(cp)} hitSlop={8}>
                    <Icon as={Trash2} className="text-destructive size-5" />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      </View>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? c('dialog_edit_checkpoint_title') : c('dialog_add_checkpoint_title')}</DialogTitle>
          </DialogHeader>
          {form ? (
            <View className="gap-4">
              <View className="gap-1.5">
                <Label>{c('label_checkpoint_name')}</Label>
                <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={c('placeholder_checkpoint_name')} />
              </View>
              <View className="gap-1.5">
                <Label>{c('label_checkpoint_mode')}</Label>
                <Picker value={form.mode} onChange={(v) => setForm({ ...form, mode: v as CheckpointMode })} options={(['both', 'entry', 'exit'] as const).map((m) => ({ value: m, label: modeLabel(m) }))} />
              </View>
              <View className="gap-1.5">
                <Label>{c('label_description')}</Label>
                <Input value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder={c('placeholder_checkpoint_description')} />
              </View>
              <Button onPress={save} disabled={saving || !form.name.trim()}>
                <Text>{saving ? c('msg_loading') : form.id ? t('common.update') : t('common.create')}</Text>
              </Button>
            </View>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!times} onOpenChange={(o) => !o && setTimes(null)}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{`${c('dialog_times_title')}${times ? ` — ${times.cp.name}` : ''}`}</DialogTitle>
          </DialogHeader>
          <ScrollView contentContainerClassName="gap-3">
            {times?.slots.length ? (
              times.slots.map((s, i) => (
                <View key={i} className="border-info-soft dark:border-border gap-2 rounded-xl border p-3">
                  <View className="flex-row items-center gap-2">
                    <Picker className="flex-1" value={String(s.day_of_week)} onChange={(v) => setSlot(i, { day_of_week: Number(v) })} options={days.map((d, n) => ({ value: String(n), label: d }))} />
                    <Pressable onPress={() => setTimes((x) => (x ? { ...x, slots: x.slots.filter((_, j) => j !== i) } : x))} hitSlop={8} className="p-1">
                      <Icon as={X} className="text-destructive size-5" />
                    </Pressable>
                  </View>
                  <View className="flex-row items-end gap-2">
                    <TimeField className="flex-1" value={s.start_time} onChange={(v) => setSlot(i, { start_time: v })} />
                    <Text className="text-muted-foreground pb-2.5">{t('common.to')}</Text>
                    <TimeField className="flex-1" value={s.end_time} onChange={(v) => setSlot(i, { end_time: v })} />
                  </View>
                </View>
              ))
            ) : (
              <EmptyState title={c('msg_no_times')} />
            )}
            <Button variant="outline" onPress={() => setTimes((x) => (x ? { ...x, slots: [...x.slots, { day_of_week: 1, start_time: '07:00', end_time: '18:00' }] } : x))}>
              <Icon as={Plus} className="text-foreground size-4" />
              <Text>{c('btn_add_time_slot')}</Text>
            </Button>
          </ScrollView>
          <DialogFooter>
            <Button onPress={saveTimes} disabled={saving}>
              <Text>{c('btn_save_times')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
