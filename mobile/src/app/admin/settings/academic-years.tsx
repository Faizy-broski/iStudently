import type { AcademicYear } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertTriangle, ArrowRight, Calendar, CheckCircle, Info, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { StatCard } from '@/components/app/stat-card';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { plainMessage } from '@/i18n/plain';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Form = { name: string; start_date: string; end_date: string; is_current: boolean; is_active: boolean };
const EMPTY: Form = { name: '', start_date: '', end_date: '', is_current: false, is_active: true };

/** Academic years: current and next year, add/edit, set current/next (web: /admin/settings/academic-years). */
export default function AcademicYears() {
  const { t, i18n } = useTranslation();
  const y = (k: string, o?: Record<string, unknown>) => t(`school.academic_years.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const res = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const years = res.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const sorted = [...years].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const current = years.find((x) => x.is_current);
  const explicitNext = years.find((x) => x.is_next);
  const ci = current ? sorted.findIndex((x) => x.id === current.id) : -1;
  const next = explicitNext ?? (ci >= 0 && ci < sorted.length - 1 ? sorted[ci + 1] : null);
  const eligibleNext = sorted.filter((x) => !x.is_current && x.is_active);
  const day = (s: string) => new Date(s).toLocaleDateString(i18n.language);

  // Rollover, menus and grade screens all read the year list.
  const refresh = () => mutate((k) => Array.isArray(k) && k[0] === 'admin' && String(k[1]).startsWith('academic-year'));

  async function act(fn: () => Promise<{ success: boolean; error?: string }>, ok: string, fail: string) {
    const r = await fn();
    if (!r.success) return toast.error(r.error || fail);
    toast.success(ok);
    refresh();
  }

  const openForm = (yr: AcademicYear | null) => {
    setEditing(yr);
    setForm(yr ? { name: yr.name, start_date: yr.start_date.split('T')[0], end_date: yr.end_date.split('T')[0], is_current: yr.is_current, is_active: yr.is_active } : EMPTY);
    setOpen(true);
  };

  async function submit() {
    if (!form.name.trim() || !form.start_date || !form.end_date) return toast.error(y('save_error'));
    setSaving(true);
    try {
      const r = editing ? await adminAcademics.updateAcademicYear(editing.id, { ...form, is_next: editing.is_next }) : await adminAcademics.createAcademicYear(form);
      if (!r.success) return toast.error(r.error || y('save_error'));
      toast.success(editing ? y('update_success') : y('create_success'));
      setOpen(false);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: y('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{y('subtitle')}</Text>
        <View className="flex-row gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/30">
          <Icon as={Info} className="size-4 text-blue-600" />
          <Text className="flex-1 text-sm text-blue-800 dark:text-blue-200">
            <Text className="text-sm font-bold text-blue-800 dark:text-blue-200">{y('alert_rollover_title')} </Text>
            {plainMessage('school.academic_years.alert_rollover_desc')}
          </Text>
        </View>

        {current ? (
          <Card className="border-primary border-2">
            <CardContent className="flex-row items-center gap-3 pt-4">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={CheckCircle} className="size-5 text-green-600" />
                  <Text className="text-muted-foreground text-sm font-medium">{y('label_current_year')}</Text>
                </View>
                <Text className="text-primary text-2xl font-bold">{current.name}</Text>
                <Text className="text-muted-foreground text-sm">
                  {day(current.start_date)} – {day(current.end_date)}
                </Text>
              </View>
              <Icon as={Calendar} className="text-primary size-8" />
            </CardContent>
          </Card>
        ) : (
          <View className="flex-row gap-3 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 p-4 dark:bg-orange-950/20">
            <Icon as={AlertTriangle} className="size-6 text-orange-500" />
            <View className="flex-1">
              <Text className="font-semibold text-orange-700 dark:text-orange-300">{y('label_no_current')}</Text>
              <Text className="text-sm text-orange-600 dark:text-orange-400">{plainMessage('school.academic_years.desc_no_current')}</Text>
            </View>
          </View>
        )}

        <Card className={cn('border-2', next ? 'border-green-400' : 'border-muted border-dashed')}>
          <CardContent className="gap-2 pt-4">
            <View className="flex-row items-center gap-2">
              <Icon as={ArrowRight} className="size-5 text-green-600 rtl:rotate-180" />
              <Text className="text-muted-foreground text-sm font-medium">{y('label_next_year')}</Text>
            </View>
            <Picker
              value={explicitNext?.id ?? ''}
              onChange={(v) => {
                if (!v) {
                  if (explicitNext) act(() => adminAcademics.updateAcademicYear(explicitNext.id, { is_next: false }), y('clear_next_success'), y('clear_next_error'));
                } else act(() => adminAcademics.updateAcademicYear(v, { is_next: true }), y('set_next_success'), y('set_next_error'));
              }}
              placeholder={y('placeholder_select_next')}
              options={[{ value: '', label: y('placeholder_select_next') }, ...eligibleNext.map((x) => ({ value: x.id, label: x.name }))]}
            />
            {next && !explicitNext ? <Text className="text-xs text-amber-600">{y('auto_detected', { name: next.name })}</Text> : null}
            {!next && eligibleNext.length === 0 ? <Text className="text-xs text-red-500">{y('no_eligible')}</Text> : null}
          </CardContent>
        </Card>

        <View className="flex-row gap-2">
          <StatCard icon={Calendar} label={y('stat_total')} value={String(years.length)} />
          <StatCard icon={CheckCircle} label={y('stat_active')} value={String(years.filter((x) => x.is_active).length)} />
          <StatCard icon={Calendar} label={y('stat_past')} value={String(years.filter((x) => !x.is_active).length)} tone="warning" />
        </View>

        <Card>
          <CardContent className="gap-2 pt-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold">{y('table_title')}</Text>
              <Button size="sm" onPress={() => openForm(null)}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{y('btn_add')}</Text>
              </Button>
            </View>
            {res.isLoading ? (
              <LoadingList rows={3} />
            ) : !years.length ? (
              <Text className="text-muted-foreground py-6 text-center">{y('no_years_found')}</Text>
            ) : (
              years.map((yr, i) => {
                const months = Math.round((new Date(yr.end_date).getTime() - new Date(yr.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30));
                return (
                  <View key={yr.id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="gap-1.5 py-2.5">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="flex-1 font-medium">{yr.name}</Text>
                        {yr.is_current ? (
                          <View className="rounded-full bg-green-600 px-2 py-0.5">
                            <Text className="text-xs text-white">{y('status_current')}</Text>
                          </View>
                        ) : null}
                        <View className={cn('rounded-full px-2 py-0.5', yr.is_active ? 'bg-primary' : 'bg-secondary')}>
                          <Text className={cn('text-xs', yr.is_active ? 'text-primary-foreground' : 'text-secondary-foreground')}>{yr.is_active ? y('status_active') : y('status_inactive')}</Text>
                        </View>
                      </View>
                      <Text className="text-muted-foreground text-xs">
                        {day(yr.start_date)} – {day(yr.end_date)} · {y('duration_months', { count: months })}
                      </Text>
                      <View className="flex-row flex-wrap items-center gap-2">
                        {!yr.is_current ? (
                          <CheckRow
                            checked={explicitNext?.id === yr.id}
                            onPress={() => act(() => adminAcademics.updateAcademicYear(yr.id, { is_next: explicitNext?.id !== yr.id }), explicitNext?.id === yr.id ? y('clear_next_success') : y('set_next_success'), y('set_next_error'))}
                            label={y('table_col_next')}
                          />
                        ) : null}
                        <View className="flex-1" />
                        {!yr.is_current ? (
                          <Button size="sm" variant="outline" onPress={() => act(() => adminAcademics.updateAcademicYear(yr.id, { is_current: true }), y('set_current_success'), y('set_current_error'))}>
                            <Text>{y('btn_set_current')}</Text>
                          </Button>
                        ) : null}
                        <Button size="icon" variant="ghost" onPress={() => openForm(yr)} accessibilityLabel={t('common.edit')}>
                          <Icon as={Pencil} className="text-foreground size-4" />
                        </Button>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? y('dialog_edit') : y('dialog_add')}</DialogTitle>
          </DialogHeader>
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            {!editing ? (
              <View className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/30">
                <Text className="text-sm text-amber-800 dark:text-amber-200">
                  <Text className="text-sm font-bold text-amber-800 dark:text-amber-200">{y('alert_dialog_title')} </Text>
                  {plainMessage('school.academic_years.alert_dialog_desc')}
                </Text>
              </View>
            ) : null}
            <View className="gap-1.5">
              <Label>{y('label_name')}</Label>
              <Input value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder={y('placeholder_name')} />
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={y('label_start')} value={form.start_date} onChange={(v) => setForm((f) => ({ ...f, start_date: v }))} />
              <DateField className="flex-1" label={y('label_end')} value={form.end_date} onChange={(v) => setForm((f) => ({ ...f, end_date: v }))} />
            </View>
            <CheckRow checked={form.is_current} onPress={() => setForm((f) => ({ ...f, is_current: !f.is_current }))} label={y('label_set_current')} />
            <CheckRow checked={form.is_active} onPress={() => setForm((f) => ({ ...f, is_active: !f.is_active }))} label={y('label_active')} />
            <Text className="text-muted-foreground text-xs">{y('hint_rollover')}</Text>
          </ScrollView>
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>{y('btn_cancel')}</Text>
            </Button>
            <Button onPress={submit} disabled={saving}>
              <Text>{editing ? y('btn_update') : y('btn_create')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}
