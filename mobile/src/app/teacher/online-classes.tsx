import type { OnlineClassRequest, OnlineClassType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarClock, Plus, StopCircle, Users, Video, XCircle } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { IconTile, RowPill } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademic } from '@/features/portal/academic';
import { adminOnlineClasses } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const STATUS: Record<string, ChipTone> = {
  pending_review: 'warning',
  approved: 'info',
  active: 'success',
  rejected: 'destructive',
  completed: 'muted',
  cancelled: 'muted',
};
const DAYS = [
  ['M', 'day_mon'],
  ['T', 'day_tue'],
  ['W', 'day_wed'],
  ['R', 'day_thu'],
  ['F', 'day_fri'],
  ['S', 'day_sat'],
  ['U', 'day_sun'],
] as const;

type Form = { type: OnlineClassType; cp: string; title: string; description: string; capacity: string; days: string[]; startTime: string; endTime: string; startDate: string; endDate: string };
const EMPTY: Form = { type: 'external_open', cp: '', title: '', description: '', capacity: '', days: [], startTime: '', endTime: '', startDate: '', endDate: '' };

/**
 * The teacher's online classes: request an open class (admin review) or start a live session for one of
 * their classes now; start / end / cancel. `?course_period_id=…&autostart=1` (from Courses) starts at once
 * (web: /teacher/online-classes).
 */
export default function TeacherOnlineClasses() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`online_classes.${key}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const academic = usePortalAcademic();
  const params = useLocalSearchParams<{ course_period_id?: string; autostart?: string }>();
  const res = useApi(['teacher', 'online-classes'], () => adminOnlineClasses.mine());
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [autostarting, setAutostarting] = useState(params.autostart === '1' && !!params.course_period_id);
  const fired = useRef(false);

  useEffect(() => {
    const cp = params.course_period_id;
    if (!cp || params.autostart !== '1' || fired.current) return;
    fired.current = true;
    adminOnlineClasses.startCourseSession(cp).then((r) => {
      if (!r.success || !r.data) {
        toast.error(r.error || k('msg_start_failed'));
        setAutostarting(false);
        return;
      }
      router.replace({ pathname: '/teacher/jitsi-meet/rooms/[id]', params: { id: r.data.id } });
    });
    // Runs once on arrival, like the web page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));

  async function submit() {
    if (!form) return;
    if (!form.title.trim()) return toast.error(k('msg_title_required'));
    if (form.type === 'existing_course' && !form.cp) return toast.error(k('msg_course_period_required'));
    if (form.type === 'external_open' && (!form.capacity || Number(form.capacity) <= 0)) return toast.error(k('msg_capacity_required'));
    setBusy(true);
    if (form.type === 'existing_course') {
      const r = await adminOnlineClasses.startCourseSession(form.cp);
      setBusy(false);
      if (!r.success || !r.data) return toast.error(r.error || k('msg_start_failed'));
      setForm(null);
      return router.push({ pathname: '/teacher/jitsi-meet/rooms/[id]', params: { id: r.data.id } });
    }
    const r = await adminOnlineClasses.submitRequest({
      class_type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      student_capacity: Number(form.capacity),
      scheduled_days: form.days.length ? form.days.join('') : undefined,
      session_start_time: form.startTime || undefined,
      session_end_time: form.endTime || undefined,
      start_date: form.startDate || undefined,
      end_date: form.endDate || undefined,
      campus_id: campusId ?? undefined,
    });
    setBusy(false);
    if (!r.success || !r.data) return toast.error(r.error || k('msg_submit_failed'));
    toast.success(k('msg_submit_success'));
    setForm(null);
    res.mutate();
  }

  async function act(c: OnlineClassRequest, kind: 'start' | 'end' | 'cancel') {
    setWorking(`${kind}:${c.id}`);
    if (kind === 'start') {
      const r = await adminOnlineClasses.startSession(c.id);
      setWorking(null);
      if (!r.success || !r.data) return toast.error(r.error || k('msg_start_failed'));
      return router.push({ pathname: '/teacher/jitsi-meet/rooms/[id]', params: { id: r.data.id } });
    }
    const r = kind === 'end' ? await adminOnlineClasses.endSession(c.id) : await adminOnlineClasses.cancel(c.id);
    setWorking(null);
    if (!r.success) return toast.error(r.error || (kind === 'end' ? k('msg_end_failed') : t('common.error')));
    toast.success(kind === 'end' ? k('msg_ended') : k('msg_cancelled'));
    res.mutate();
  }

  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('heading') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text variant="muted" className="flex-1 text-sm">
            {k('teacher_subtitle')}
          </Text>
          <Button size="sm" className="rounded-full" onPress={() => setForm(EMPTY)}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{k('new_online_class')}</Text>
          </Button>
        </View>
        {autostarting ? (
          <Panel className="items-center gap-3 py-10">
            <ActivityIndicator />
            <Text variant="muted" className="text-sm">{`${k('start_now')}…`}</Text>
          </Panel>
        ) : null}
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error ? (
          <ErrorState message={res.error.message || k('network_error')} onRetry={() => res.mutate()} />
        ) : !list.length ? (
          <EmptyState icon={Video} title={k('no_requests_yet')} />
        ) : (
          list.map((c) => (
            <Panel key={c.id} className="gap-3 p-4">
              <View className="flex-row items-start gap-3">
                <IconTile icon={Video} tone={c.status === 'active' ? 'success' : 'brand'} size={40} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold">{c.title}</Text>
                  <Text variant="muted" className="text-xs">
                    {c.class_type === 'existing_course' ? k('mode_existing_title') : k('mode_external_title')}
                  </Text>
                </View>
                <StatusChip label={k(`status_${c.status}`, { defaultValue: c.status })} tone={STATUS[c.status] ?? 'muted'} />
              </View>
              {c.scheduled_days || c.class_type === 'external_open' ? (
                <View className="flex-row flex-wrap gap-4">
                  {c.scheduled_days ? (
                    <View className="flex-row items-center gap-1">
                      <Icon as={CalendarClock} className="text-muted-foreground size-3.5" />
                      <Text variant="muted" className="text-xs">
                        {c.scheduled_days}
                      </Text>
                    </View>
                  ) : null}
                  {c.class_type === 'external_open' ? (
                    <View className="flex-row items-center gap-1">
                      <Icon as={Users} className="text-muted-foreground size-3.5" />
                      <Text variant="muted" className="text-xs">{`${c.enrolled_count ?? 0}/${c.student_capacity ?? 0}`}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {c.status === 'rejected' && c.review_note ? (
                <View className="bg-destructive-soft rounded-xl p-3">
                  <Text className="text-destructive text-xs">{`${k('rejection_reason')}: ${c.review_note}`}</Text>
                </View>
              ) : null}
              {c.status === 'active' || c.status === 'pending_review' || c.status === 'approved' ? (
                <View className="border-info-soft dark:border-border flex-row flex-wrap justify-end gap-2 border-t pt-3">
                  {c.status === 'active' ? (
                    <>
                      <Button size="sm" className="rounded-full" onPress={() => act(c, 'start')} disabled={working === `start:${c.id}`}>
                        <Icon as={Video} className="text-primary-foreground size-4" />
                        <Text>{k('start_session')}</Text>
                      </Button>
                      <RowPill icon={StopCircle} tone="destructive" label={k('end_session')} onPress={() => (working === `end:${c.id}` ? undefined : act(c, 'end'))} />
                    </>
                  ) : null}
                  {c.status === 'pending_review' || c.status === 'approved' ? <RowPill icon={XCircle} tone="destructive" label={k('cancel_request')} onPress={() => (working === `cancel:${c.id}` ? undefined : act(c, 'cancel'))} /> : null}
                </View>
              ) : null}
            </Panel>
          ))
        )}
      </ScrollView>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[88vh] w-[94vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{k('new_online_class')}</DialogTitle>
            <DialogDescription>{form?.type === 'existing_course' ? k('start_dialog_desc') : k('request_dialog_desc')}</DialogDescription>
          </DialogHeader>
          {form ? (
            <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
              {(['external_open', 'existing_course'] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => set({ type })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: form.type === type }}
                  className={cn('rounded-2xl border p-3', form.type === type ? 'border-brand-secondary bg-info-soft' : 'border-info-soft dark:border-border bg-card')}>
                  <Text className="text-sm font-semibold">{type === 'external_open' ? k('mode_external_title') : k('mode_existing_title')}</Text>
                  <Text className="text-muted-foreground text-xs">{type === 'external_open' ? k('mode_external_desc') : k('mode_existing_desc')}</Text>
                </Pressable>
              ))}
              {form.type === 'existing_course' ? (
                <View className="gap-1.5">
                  <Label>{`${k('course_period_label')} *`}</Label>
                  <Picker
                    value={form.cp || null}
                    onChange={(v) => {
                      const cp = academic.coursePeriods.find((c) => c.id === v);
                      set({ cp: v, title: form.title || cp?.course?.title || cp?.title || '' });
                    }}
                    placeholder={k('course_period_placeholder')}
                    options={academic.coursePeriods.map((c) => ({ value: c.id, label: `${c.course?.title || c.title || ''}${c.section ? ` — ${c.section.name}` : ''}` }))}
                  />
                </View>
              ) : null}
              <View className="gap-1.5">
                <Label>{`${k('title_label')} *`}</Label>
                <Input value={form.title} onChangeText={(v) => set({ title: v })} />
              </View>
              <View className="gap-1.5">
                <Label>{k('description_label')}</Label>
                <Textarea value={form.description} onChangeText={(v) => set({ description: v })} />
              </View>
              {form.type === 'external_open' ? (
                <>
                  <View className="gap-1.5">
                    <Label>{`${k('capacity_label')} *`}</Label>
                    <Input value={form.capacity} onChangeText={(v) => set({ capacity: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
                  </View>
                  <View className="gap-1.5">
                    <Label>{k('days_label')}</Label>
                    <View className="flex-row flex-wrap gap-1.5">
                      {DAYS.map(([code, key]) => {
                        const on = form.days.includes(code);
                        return (
                          <Pressable
                            key={code}
                            onPress={() => set({ days: on ? form.days.filter((d) => d !== code) : [...form.days, code] })}
                            accessibilityRole="checkbox"
                            accessibilityLabel={k(key)}
                            accessibilityState={{ checked: on }}
                            className={cn('size-9 items-center justify-center rounded-full border', on ? 'border-brand bg-brand dark:border-brand-secondary dark:bg-brand-secondary' : 'border-info-soft dark:border-border bg-card')}>
                            <Text className={cn('text-xs font-semibold', on ? 'text-white' : 'text-muted-foreground')}>{k(key).slice(0, 1)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <TimeField className="flex-1" label={k('start_time_label')} value={form.startTime} onChange={(v) => set({ startTime: v })} />
                    <TimeField className="flex-1" label={k('end_time_label')} value={form.endTime} onChange={(v) => set({ endTime: v })} />
                  </View>
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" label={k('start_date_label')} value={form.startDate || null} onChange={(v) => set({ startDate: v })} clearable />
                    <DateField className="flex-1" label={k('end_date_label')} value={form.endDate || null} onChange={(v) => set({ endDate: v })} clearable />
                  </View>
                </>
              ) : null}
            </ScrollView>
          ) : null}
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={() => setForm(null)}>
              <Text>{k('cancel_action')}</Text>
            </Button>
            <Button className="flex-1" onPress={submit} disabled={busy}>
              <Text>{form?.type === 'existing_course' ? k('start_now') : k('submit_request')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
