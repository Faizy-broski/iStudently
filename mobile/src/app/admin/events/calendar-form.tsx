import type { CalendarType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField, weekdayNames } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminCalendars } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const year = new Date().getFullYear();

/**
 * Create an attendance calendar (web: /admin/events/calendars/new) or, with `?id=`, edit one
 * (web: the calendar dialog on /admin/events). Weekdays are Sunday-first.
 */
export default function CalendarForm() {
  const { t, i18n } = useTranslation();
  const e = (k: string, o?: Record<string, unknown>) => t(`school.events.${k}`, o);
  const c = (k: string, o?: Record<string, unknown>) => t(`app.cal_${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ id?: string }>();
  const calendarId = params.id || null;
  const { campusId } = useCampus();
  const list = useApi(['admin', 'calendars', campusId ?? 'school'], () => adminCalendars.list(campusId));
  const existing = calendarId ? (list.data ?? []).find((x) => x.id === calendarId) : undefined;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarType>('gregorian');
  const [copyFrom, setCopyFrom] = useState('none');
  const [isDefault, setIsDefault] = useState(false);
  const [start, setStart] = useState(`${year}-01-01`);
  const [end, setEnd] = useState(`${year + 1}-01-01`);
  const [weekdays, setWeekdays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [minutes, setMinutes] = useState('360');
  const [saving, setSaving] = useState(false);

  const existingId = existing?.id ?? null;
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setType(existing.calendar_type);
    setIsDefault(existing.is_default);
    setStart(existing.start_date);
    setEnd(existing.end_date);
    setWeekdays(existing.weekdays);
    setMinutes(String(existing.default_minutes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingId]);

  async function save() {
    if (!title.trim()) return toast.error(c('err_title'));
    if (!start || !end || end <= start) return toast.error(c('err_dates'));
    setSaving(true);
    try {
      const r = calendarId
        ? await adminCalendars.update(calendarId, { title, calendar_type: type, start_date: start, end_date: end, weekdays, default_minutes: parseInt(minutes, 10) || 360, is_default: isDefault })
        : await adminCalendars.create({
            title,
            calendar_type: type,
            copy_from_calendar_id: copyFrom === 'none' ? null : copyFrom,
            is_default: isDefault,
            start_date: start,
            end_date: end,
            weekdays,
            default_minutes: parseInt(minutes, 10) || 360,
            campus_id: campusId ?? null,
          });
      if (!r.success) return toast.error(r.error || (calendarId ? c('update_failed') : c('create_failed')));
      toast.success(calendarId ? c('updated') : c('created'));
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'calendars' || k[1] === 'calendar-days'));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (calendarId && list.isLoading) return <LoadingList />;

  const days = weekdayNames(i18n.language, 'short');
  const copyOptions = (list.data ?? []).filter((x) => x.calendar_type === type);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: calendarId ? t('common.edit') : c('new_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {!calendarId ? <Text className="text-muted-foreground text-sm">{c('new_desc')}</Text> : null}
        <Card>
          <CardContent className="gap-4 pt-4">
            <View className="gap-1.5">
              <Label>{e('label_calendar_title')} *</Label>
              <Input value={title} onChangeText={setTitle} placeholder={calendarId ? e('placeholder_calendar_title') : c('title_ph')} />
            </View>
            {!calendarId ? (
              <>
                <View className="gap-1.5">
                  <Label>{c('type')}</Label>
                  <Picker
                    value={type}
                    onChange={(v) => {
                      setType(v as CalendarType);
                      setCopyFrom('none');
                    }}
                    options={[
                      { value: 'gregorian', label: c('gregorian') },
                      { value: 'hijri', label: c('hijri') },
                    ]}
                  />
                </View>
                <View className="gap-1.5">
                  <Label>{c('copy_from')}</Label>
                  <Picker value={copyFrom} onChange={setCopyFrom} options={[{ value: 'none', label: c('na') }, ...copyOptions.map((x) => ({ value: x.id, label: x.title }))]} />
                </View>
              </>
            ) : null}
            <View className="flex-row items-center gap-3">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <Label onPress={() => setIsDefault(!isDefault)}>{calendarId ? e('label_default_calendar_school') : c('set_default')}</Label>
            </View>
            <View className="flex-row gap-3">
              <DateField className="flex-1" label={`${e('label_from')} *`} value={start} onChange={setStart} />
              <DateField className="flex-1" label={`${e('label_to')} *`} value={end} onChange={setEnd} />
            </View>
            <View className="gap-1.5">
              <Label>{e('label_school_days')}</Label>
              <View className="flex-row flex-wrap gap-2">
                {days.map((d, i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: weekdays[i] }}
                    onPress={() => setWeekdays((w) => w.map((v, j) => (j === i ? !v : v)))}
                    className={cn('rounded-md border px-3 py-1.5', weekdays[i] ? 'bg-primary border-primary' : 'border-border')}>
                    <Text className={cn('text-sm', weekdays[i] ? 'text-primary-foreground' : 'text-foreground')}>{d}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="gap-1.5">
              <Label>{e('label_minutes')}</Label>
              <Input className="w-32" value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="360" />
              <Text className="text-muted-foreground text-xs">{e('label_minutes_desc')}</Text>
            </View>
          </CardContent>
        </Card>
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => router.back()}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button onPress={save} disabled={saving}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{saving ? e('status_saving') : calendarId ? e('btn_ok') : c('create_btn')}</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
