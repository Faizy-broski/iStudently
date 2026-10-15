import type { OnlineClassRequest, OnlineClassType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CalendarClock, Plus, RefreshCw, StopCircle, Users, Video, XCircle } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

const STATUS: Record<string, string> = {
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-500',
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
        <Text variant="muted">{k('teacher_subtitle')}</Text>
        <Button className="self-start" onPress={() => setForm(EMPTY)}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{k('new_online_class')}</Text>
        </Button>
        {autostarting ? (
          <Card>
            <CardContent className="items-center py-12">
              <ActivityIndicator />
              <Text className="text-muted-foreground mt-3">{`${k('start_now')}…`}</Text>
            </CardContent>
          </Card>
        ) : null}
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={AlertTriangle} className="text-destructive mb-3 size-10" />
              <Text className="text-destructive font-medium">{res.error.message || k('network_error')}</Text>
              <Button variant="outline" size="sm" className="mt-4" onPress={() => res.mutate()}>
                <Icon as={RefreshCw} className="size-3.5" />
                <Text>{k('retry')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : !list.length ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={Video} className="text-muted-foreground mb-3 size-10" />
              <Text className="text-muted-foreground">{k('no_requests_yet')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((c) => {
            const tone = STATUS[c.status] ?? STATUS.completed;
            return (
              <Card key={c.id}>
                <CardContent className="gap-3 p-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-semibold">{c.title}</Text>
                      <Text className="text-muted-foreground text-sm">{c.class_type === 'existing_course' ? k('mode_existing_title') : k('mode_external_title')}</Text>
                    </View>
                    <Badge className={tone.split(' ')[0]}>
                      <Text className={cn('text-xs', tone.split(' ')[1])}>{k(`status_${c.status}`, { defaultValue: c.status })}</Text>
                    </Badge>
                  </View>
                  <View className="flex-row flex-wrap gap-4">
                    {c.scheduled_days ? (
                      <View className="flex-row items-center gap-1">
                        <Icon as={CalendarClock} className="text-muted-foreground size-3.5" />
                        <Text className="text-muted-foreground text-sm">{c.scheduled_days}</Text>
                      </View>
                    ) : null}
                    {c.class_type === 'external_open' ? (
                      <View className="flex-row items-center gap-1">
                        <Icon as={Users} className="text-muted-foreground size-3.5" />
                        <Text className="text-muted-foreground text-sm">{`${c.enrolled_count ?? 0}/${c.student_capacity ?? 0}`}</Text>
                      </View>
                    ) : null}
                  </View>
                  {c.status === 'rejected' && c.review_note ? <Text className="text-destructive text-sm">{`${k('rejection_reason')}: ${c.review_note}`}</Text> : null}
                  <View className="flex-row flex-wrap gap-2">
                    {c.status === 'active' ? (
                      <>
                        <Button size="sm" onPress={() => act(c, 'start')} disabled={working === `start:${c.id}`}>
                          <Icon as={Video} className="text-primary-foreground size-4" />
                          <Text>{k('start_session')}</Text>
                        </Button>
                        <Button size="sm" variant="ghost" onPress={() => act(c, 'end')} disabled={working === `end:${c.id}`}>
                          <Icon as={StopCircle} className="text-destructive size-4" />
                          <Text className="text-destructive">{k('end_session')}</Text>
                        </Button>
                      </>
                    ) : null}
                    {c.status === 'pending_review' || c.status === 'approved' ? (
                      <Button size="sm" variant="ghost" onPress={() => act(c, 'cancel')} disabled={working === `cancel:${c.id}`}>
                        <Icon as={XCircle} className="text-destructive size-4" />
                        <Text className="text-destructive">{k('cancel_request')}</Text>
                      </Button>
                    ) : null}
                  </View>
                </CardContent>
              </Card>
            );
          })
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
                  className={cn('rounded-lg border-2 p-3', form.type === type ? 'border-primary bg-primary/5' : 'border-border')}>
                  <Text className="text-sm font-medium">{type === 'external_open' ? k('mode_external_title') : k('mode_existing_title')}</Text>
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
                            className={cn('size-9 items-center justify-center rounded-full border-2', on ? 'border-primary bg-primary' : 'border-border')}>
                            <Text className={cn('text-xs font-medium', on && 'text-primary-foreground')}>{k(key).slice(0, 1)}</Text>
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
