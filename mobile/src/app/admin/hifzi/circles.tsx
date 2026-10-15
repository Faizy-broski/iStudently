import type { HifziCircle, HifziGender } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { CalendarClock, Plus, UserPlus, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { NoCircles, useHifziCircles, useHz, useRiwayat } from '@/features/admin/hifzi';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminEmployees, adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useDebounced } from '@/lib/use-debounced';

const GENDER_COLORS: Record<HifziGender, string> = {
  male: 'bg-blue-100 dark:bg-blue-900',
  female: 'bg-pink-100 dark:bg-pink-900',
  mixed: 'bg-gray-100 dark:bg-gray-800',
};

function CreateCircle({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { h, a, isAr } = useHz('circles');
  const toast = useToast();
  const { campusId } = useCampus();
  const riwayat = useRiwayat();
  const list = riwayat.data ?? [];
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [riwayahId, setRiwayahId] = useState('');
  const [gender, setGender] = useState<HifziGender>('mixed');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const riwayah = riwayahId || list[0]?.id || '';

  async function save() {
    if (!nameAr.trim() || !riwayah) return;
    setSaving(true);
    try {
      const res = await adminHifzi.createCircle({ name_ar: nameAr.trim(), name_en: nameEn.trim() || undefined, riwayah_id: riwayah, section_gender: gender, capacity: capacity ? Number(capacity) : undefined }, campusId);
      if (!res.success) return toast.error(res.error || h('createError'));
      toast.success(h('createSuccess'));
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <KeyboardAvoidingView>
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <DialogHeader>
              <DialogTitle>{h('create')}</DialogTitle>
              <DialogDescription>{h('title')}</DialogDescription>
            </DialogHeader>
            <View className="gap-1.5">
              <Label>{h('nameAr')}</Label>
              <Input value={nameAr} onChangeText={setNameAr} style={{ writingDirection: 'rtl', textAlign: 'right' }} />
            </View>
            <View className="gap-1.5">
              <Label>{h('nameEn')}</Label>
              <Input value={nameEn} onChangeText={setNameEn} style={{ writingDirection: 'ltr', textAlign: 'left' }} />
            </View>
            <View className="gap-1.5">
              <Label>{h('riwayah')}</Label>
              {riwayat.data && !list.length ? <Text className="text-destructive text-xs">{a('hz_no_riwayat')}</Text> : null}
              <Picker value={riwayah} onChange={setRiwayahId} options={list.map((r) => ({ value: r.id, label: isAr ? r.name_ar : r.name_en }))} />
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1.5">
                <Label>{h('sectionGender')}</Label>
                <Picker value={gender} onChange={(v) => setGender(v as HifziGender)} options={(['mixed', 'male', 'female'] as const).map((g) => ({ value: g, label: h(g) }))} />
              </View>
              <View className="w-28 gap-1.5">
                <Label>{h('capacity')}</Label>
                <Input value={capacity} onChangeText={(v) => setCapacity(v.replace(/\D/g, ''))} keyboardType="number-pad" />
              </View>
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={onClose} disabled={saving}>
                <Text>{a('hz_cancel')}</Text>
              </Button>
              <Button className="flex-1" onPress={save} disabled={saving || !nameAr.trim() || !riwayah}>
                <Text>{h('create')}</Text>
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </DialogContent>
    </Dialog>
  );
}

/** Assign / remove circle teachers (web: AssignTeacherDialog). A teacher sees a circle only once assigned here. */
function AssignTeachers({ circle, onClose, onChanged }: { circle: HifziCircle; onClose: () => void; onChanged: () => void }) {
  const { h, a } = useHz('circles');
  const toast = useToast();
  const { campusId } = useCampus();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const [busy, setBusy] = useState<string | null>(null);
  const res = useApi(['admin', 'hifzi-teacher-search', term, campusId ?? 'school'], ([, , s]) => adminEmployees.list('teacher', campusId, { search: (s as string) || undefined, limit: 50 }));
  const results = res.data ?? [];
  const active = (circle.hifzi_circle_teachers ?? []).filter((ct) => !ct.active_to);
  const assigned = new Set(active.map((ct) => ct.teacher_profile_id));
  const circleId = circle.id;
  const label = (s: (typeof results)[number]) => shortName(s.profile) || s.employee_number;

  async function run(profileId: string, add: boolean) {
    setBusy(profileId);
    try {
      const r = add ? await adminHifzi.addTeacher(circleId, profileId, campusId) : await adminHifzi.removeTeacher(circleId, profileId, campusId);
      if (!r.success) return toast.error(r.error || a(add ? 'hz_assign_failed' : 'hz_remove_failed'));
      toast.success(a(add ? 'hz_teacher_assigned' : 'hz_teacher_removed'));
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
          <DialogHeader>
            <DialogTitle>{h('teachers')}</DialogTitle>
            <DialogDescription>{circle.name_ar}</DialogDescription>
          </DialogHeader>
          {active.length ? (
            <View className="gap-1.5">
              <Text className="text-muted-foreground text-xs font-medium">{a('hz_currently_assigned')}</Text>
              {active.map((ct) => {
                const s = results.find((r) => r.profile_id === ct.teacher_profile_id);
                return (
                  <View key={ct.id} className="border-border flex-row items-center gap-2 rounded-md border px-3 py-2">
                    <Text className="flex-1 text-sm">
                      {s ? label(s) : ct.teacher_profile_id} <Text className="text-muted-foreground text-xs">({ct.role})</Text>
                    </Text>
                    <Pressable onPress={() => run(ct.teacher_profile_id, false)} disabled={busy === ct.teacher_profile_id} hitSlop={6} accessibilityLabel={a('hz_remove')}>
                      <Icon as={X} className="text-muted-foreground size-4" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
          <SearchBar value={q} onChangeText={setQ} placeholder={a('hz_search_teachers')} />
          {res.isLoading ? (
            <LoadingList rows={2} />
          ) : !results.length ? (
            <Text className="text-muted-foreground py-2 text-center text-sm">{a('hz_no_teachers')}</Text>
          ) : (
            results
              .filter((s) => !assigned.has(s.profile_id))
              .map((s, i) => (
                <View key={s.id}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable onPress={() => run(s.profile_id, true)} disabled={busy === s.profile_id} className="flex-row items-center gap-2 px-1 py-2.5">
                    <Text className="flex-1">{label(s)}</Text>
                    <Icon as={UserPlus} className="text-primary size-4" />
                  </Pressable>
                </View>
              ))
          )}
          <Button variant="outline" onPress={onClose}>
            <Text>{a('hz_close')}</Text>
          </Button>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}

/** Hifzi circles: create, teachers, scheduling mode (web: /admin/hifzi/circles). */
export default function HifziCircles() {
  const { h, t } = useHz('circles');
  const toast = useToast();
  const { campusId } = useCampus();
  const circles = useHifziCircles();
  const [creating, setCreating] = useState(false);
  const [teachersFor, setTeachersFor] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const list = circles.data ?? [];
  const teacherCircle = list.find((c) => c.id === teachersFor) ?? null;

  // Freeform (each circle's own weekly slots) is the default; bell schedule opts a circle into the timetable generator.
  async function toggleMode(c: HifziCircle) {
    const next = c.scheduling_mode === 'bell_schedule' ? 'freeform' : 'bell_schedule';
    setToggling(c.id);
    try {
      const res = await adminHifzi.setSchedulingMode(c.id, next, campusId);
      if (!res.success) return toast.error(res.error || h('schedulingModeError'));
      toast.success(next === 'bell_schedule' ? h('schedulingModeBellSuccess') : h('schedulingModeFreeformSuccess'));
      if (next === 'bell_schedule' && res.data && !res.data.synced) toast.error(`${h('schedulingModeSyncIncomplete')}: ${res.data.reason ?? ''}`);
      circles.mutate();
    } finally {
      setToggling(null);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: h('title'),
          headerRight: () => (
            <Pressable onPress={() => setCreating(true)} hitSlop={8} className="p-1" accessibilityLabel={h('create')}>
              <Icon as={Plus} className="text-foreground size-6" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => circles.mutate()} />}>
        {circles.isLoading ? (
          <LoadingList rows={3} />
        ) : circles.error ? (
          <ErrorState message={circles.error.message} onRetry={() => circles.mutate()} />
        ) : !list.length ? (
          <NoCircles />
        ) : (
          list.map((c) => {
            const teachers = (c.hifzi_circle_teachers ?? []).filter((t) => !t.active_to).length;
            const bell = c.scheduling_mode === 'bell_schedule';
            return (
              <Card key={c.id}>
                <CardContent className="gap-3 pt-4">
                  <View className="flex-row items-start gap-2">
                    <View className="flex-1">
                      <Text className="font-semibold">{c.name_ar}</Text>
                      {c.name_en ? <Text className="text-muted-foreground text-xs">{c.name_en}</Text> : null}
                    </View>
                    <Badge variant="outline" className={cn('border-0', GENDER_COLORS[c.section_gender])}>
                      <Text className="text-xs">{h(c.section_gender)}</Text>
                    </Badge>
                  </View>
                  <View className="flex-row flex-wrap items-center gap-4">
                    <View className="flex-row items-center gap-1">
                      <Icon as={Users} className="text-muted-foreground size-3.5" />
                      <Text className="text-muted-foreground text-xs">
                        {teachers} {h('teachers')}
                      </Text>
                    </View>
                    {c.capacity ? <Text className="text-muted-foreground text-xs">{`${h('capacity')}: ${c.capacity}`}</Text> : null}
                    {c.hifzi_circle_schedules?.length ? (
                      <Text className="text-muted-foreground text-xs">
                        {c.hifzi_circle_schedules.length} {h('schedule').toLowerCase()}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => toggleMode(c)}
                    disabled={toggling === c.id}
                    accessibilityHint={h('schedulingModeToggleHint')}
                    className={cn('flex-row items-center gap-1.5 self-start rounded-md px-2 py-1', bell ? 'bg-blue-50 dark:bg-blue-950' : 'bg-muted', toggling === c.id && 'opacity-60')}>
                    <Icon as={CalendarClock} className={cn('size-3', bell ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground')} />
                    <Text className={cn('text-xs', bell ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground')}>{bell ? h('schedulingModeBellSchedule') : h('schedulingModeFreeform')}</Text>
                  </Pressable>
                  <View className="flex-row items-center justify-between gap-2">
                    <Pressable onPress={() => router.push({ pathname: '/admin/hifzi/students', params: { circle_id: c.id } })} hitSlop={6}>
                      <Text className="text-primary text-xs">{t('hifzi.students.title')} →</Text>
                    </Pressable>
                    <Button size="sm" variant="outline" onPress={() => setTeachersFor(c.id)}>
                      <Icon as={Users} className="text-foreground size-3.5" />
                      <Text>{h('teachers')}</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
      {creating ? <CreateCircle onClose={() => setCreating(false)} onCreated={() => circles.mutate()} /> : null}
      {teacherCircle ? <AssignTeachers circle={teacherCircle} onClose={() => setTeachersFor(null)} onChanged={() => circles.mutate()} /> : null}
    </View>
  );
}
