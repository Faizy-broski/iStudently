import type { EventAudienceRole, EventCategory } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { AUDIENCE_ROLES, EVENT_CATEGORIES, EVENT_COLORS, ymdOf } from '@/features/admin/events';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, events } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const SWATCHES = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#6b7280', '#16a34a', '#f97316', '#dc2626', '#2563eb', '#9333ea', '#0891b2'];

type Form = {
  title: string;
  description: string;
  category: EventCategory;
  color_code: string;
  is_all_day: boolean;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  target_grades: string[];
  visible_to_roles: string[];
  send_reminder: boolean;
  reminder_days_before: string;
};

const blank = (date?: string): Form => ({
  title: '',
  description: '',
  category: 'academic',
  color_code: EVENT_COLORS.academic,
  is_all_day: true,
  start_date: date ?? '',
  start_time: '09:00',
  end_date: '',
  end_time: '10:00',
  target_grades: [],
  visible_to_roles: ['teacher', 'student', 'parent'],
  send_reminder: false,
  reminder_days_before: '1',
});

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Add / edit a school event (web: EventFormDialog). `?id=` edits, `?date=` prefills the start date. */
export default function EventForm() {
  const { t } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`app.ev_${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const eventId = params.id || null;
  const { campusId } = useCampus();
  const existing = useApi(eventId ? ['admin', 'event', eventId] : null, ([, , id]) => events.getEventById(id));
  const gradesRes = useApi(['admin', 'grades-all'], () => adminAcademics.grades());
  const grades = (gradesRes.data ?? []).filter((g) => g.is_active !== false).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const [form, setForm] = useState<Form>(() => blank(params.date));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);

  const loaded = existing.data ?? null;
  const loadedId = loaded?.id ?? null;
  useEffect(() => {
    if (!loaded) return;
    setForm({
      title: loaded.title,
      description: loaded.description || '',
      category: loaded.category,
      color_code: loaded.color_code,
      is_all_day: loaded.is_all_day,
      start_date: ymdOf(loaded.start_at),
      start_time: hhmm(loaded.start_at),
      end_date: loaded.end_at ? ymdOf(loaded.end_at) : '',
      end_time: loaded.end_at ? hhmm(loaded.end_at) : '10:00',
      target_grades: loaded.target_grades || [],
      visible_to_roles: loaded.visible_to_roles.filter((r) => r !== 'super_admin' && r !== 'admin'),
      send_reminder: loaded.send_reminder || false,
      reminder_days_before: '1',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  const set = (p: Partial<Form>) => setForm((x) => ({ ...x, ...p }));
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const allGrades = grades.length > 0 && form.target_grades.length === grades.length;

  // Same conversion as the web's datetime-local / date inputs.
  const toIso = (date: string, time: string) => (form.is_all_day ? new Date(date).toISOString() : new Date(`${date}T${time}:00`).toISOString());

  async function save() {
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = f('err_title');
    else if (form.title.length > 200) e.title = f('err_title_long');
    if (!form.start_date) e.start_date = f('err_start');
    if (!HEX.test(form.color_code)) e.color_code = f('err_color');
    if (!form.visible_to_roles.length) e.visible_to_roles = f('err_roles');
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const start = toIso(form.start_date, form.start_time);
      const body = {
        campus_id: campusId,
        title: form.title,
        description: form.description,
        category: form.category,
        start_at: start,
        end_at: form.end_date ? toIso(form.end_date, form.end_time) : start,
        is_all_day: form.is_all_day,
        color_code: form.color_code,
        target_grades: form.target_grades.length ? form.target_grades : undefined,
        visible_to_roles: form.visible_to_roles as EventAudienceRole[],
        send_reminder: form.send_reminder,
      };
      const r = eventId ? await events.updateEvent(eventId, body) : await events.createEvent(body);
      if (!r.success) return toast.error(r.error || f('save_failed'));
      toast.success(eventId ? f('updated') : f('created'));
      await mutate((k) => Array.isArray(k) && (k[0] === 'admin' && ['events-month', 'events-all', 'event', 'event-counts', 'acal-events'].includes(k[1])));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (eventId && existing.isLoading) return <LoadingList />;

  const err = (k: keyof Form) => (errors[k] ? <Text className="text-destructive text-xs">{errors[k]}</Text> : null);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: eventId ? f('edit_title') : f('add_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{eventId ? f('edit_desc') : f('add_desc')}</Text>
        <Card>
          <CardContent className="gap-4 pt-4">
            <View className="gap-1.5">
              <Label>{f('f_title')} *</Label>
              <Input value={form.title} onChangeText={(v) => set({ title: v })} placeholder={f('ph_title')} maxLength={200} />
              {err('title')}
            </View>
            <View className="gap-1.5">
              <Label>{f('f_description')}</Label>
              <Textarea value={form.description} onChangeText={(v) => set({ description: v })} placeholder={f('ph_description')} />
            </View>
            <View className="gap-1.5">
              <Label>{f('f_category')} *</Label>
              <Picker
                value={form.category}
                onChange={(v) => set({ category: v as EventCategory, color_code: EVENT_COLORS[v as EventCategory] })}
                options={EVENT_CATEGORIES.map((c) => ({ value: c, label: t(`school.events.categories.${c}`) }))}
              />
            </View>
            <View className="gap-1.5">
              <Label>{f('f_color')}</Label>
              <View className="flex-row flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <Pressable key={c} onPress={() => set({ color_code: c })} accessibilityLabel={c} className={cn('size-8 rounded-full border-2', form.color_code.toLowerCase() === c ? 'border-foreground' : 'border-transparent')} style={{ backgroundColor: c }} />
                ))}
              </View>
              <View className="flex-row items-center gap-2">
                <View className="border-border size-9 rounded-md border" style={{ backgroundColor: HEX.test(form.color_code) ? form.color_code : 'transparent' }} />
                <Input className="flex-1" value={form.color_code} onChangeText={(v) => set({ color_code: v.trim() })} placeholder="#000000" autoCapitalize="none" maxLength={7} />
              </View>
              {err('color_code')}
            </View>
            <CheckRow checked={form.is_all_day} onPress={() => set({ is_all_day: !form.is_all_day })} label={f('f_all_day')} />
            <View className="gap-2">
              <DateField label={`${form.is_all_day ? f('f_start_date') : f('f_start_datetime')} *`} value={form.start_date} onChange={(v) => set({ start_date: v })} />
              {!form.is_all_day ? <TimeField value={form.start_time} onChange={(v) => set({ start_time: v })} /> : null}
              {err('start_date')}
            </View>
            <View className="gap-2">
              <DateField label={form.is_all_day ? f('f_end_date') : f('f_end_datetime')} value={form.end_date} onChange={(v) => set({ end_date: v })} clearable />
              {!form.is_all_day && form.end_date ? <TimeField value={form.end_time} onChange={(v) => set({ end_time: v })} /> : null}
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-2 pt-4">
            <Label>{f('f_grades')}</Label>
            <Text className="text-muted-foreground text-xs">{f('f_grades_hint')}</Text>
            {gradesRes.isLoading ? (
              <Text className="text-muted-foreground text-sm">{f('loading_grades')}</Text>
            ) : (
              <>
                <CheckRow checked={allGrades} onPress={() => set({ target_grades: allGrades ? [] : grades.map((g) => g.name) })} label={f('all_grades')} />
                <View className="flex-row flex-wrap gap-x-5">
                  {grades.map((g) => (
                    <CheckRow key={g.id} checked={form.target_grades.includes(g.name)} onPress={() => set({ target_grades: toggle(form.target_grades, g.name) })} label={g.name} />
                  ))}
                </View>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-2 pt-4">
            <Label>{f('f_roles')} *</Label>
            <Text className="text-muted-foreground text-xs">{f('f_roles_hint')}</Text>
            <View className="flex-row flex-wrap gap-x-5">
              {AUDIENCE_ROLES.map((r) => (
                <CheckRow key={r} checked={form.visible_to_roles.includes(r)} onPress={() => set({ visible_to_roles: toggle(form.visible_to_roles, r) })} label={f(`role_${r}`)} />
              ))}
            </View>
            {err('visible_to_roles')}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <CheckRow checked={form.send_reminder} onPress={() => set({ send_reminder: !form.send_reminder })} label={f('f_reminder')} />
            {form.send_reminder ? (
              <View className="gap-1.5">
                <Label>{f('f_reminder_days')}</Label>
                <Input
                  className="w-24"
                  value={form.reminder_days_before}
                  keyboardType="number-pad"
                  onChangeText={(v) => set({ reminder_days_before: String(Math.min(30, parseInt(v.replace(/\D/g, ''), 10) || 0) || '') })}
                />
              </View>
            ) : null}
          </CardContent>
        </Card>

        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => router.back()}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button onPress={save} disabled={saving}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{saving ? f('saving') : eventId ? f('update_btn') : f('create_btn')}</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
