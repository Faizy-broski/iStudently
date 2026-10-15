import { router, Stack } from 'expo-router';
import { ArrowRight, CalendarDays, Save, UserCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { InfoBanner, SettingsCard, SwitchRow } from '@/features/admin/settings-ui';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

// Server weekday numbering: 0 = Monday … 6 = Sunday.
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
type Form = { enabled: boolean; hour: string; days: number[]; firstAbsence: boolean };

/**
 * When the daily job marks students present for classes nobody took attendance for, and whether the
 * first absent period makes the whole day absent (web: /admin/settings/automatic-attendance, school-level).
 */
export default function AutomaticAttendance() {
  const { t } = useTranslation();
  const toast = useToast();
  // Like the web page, this reads and writes the school-wide settings row.
  const settings = useApi(['admin', 'school-settings', 'school-level'], () => adminSchool.getSettings());
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  if (settings.isLoading) return <LoadingList rows={4} />;
  if (settings.error) return <ErrorState message={settings.error.message} onRetry={() => settings.mutate()} />;
  const d = settings.data;
  const v: Form = form ?? {
    enabled: (d?.auto_attendance_enabled as boolean | undefined) ?? true,
    hour: (d?.auto_attendance_hour as string | undefined) ?? '18:00',
    days: (d?.auto_attendance_days as number[] | undefined) ?? [0, 1, 2, 3, 4],
    firstAbsence: (d?.absent_on_first_absence as boolean | undefined) ?? false,
  };
  const set = (patch: Partial<Form>) => setForm({ ...v, ...patch });

  async function save() {
    setSaving(true);
    const r = await adminSchool.updateSettings({ auto_attendance_enabled: v.enabled, auto_attendance_hour: v.hour, auto_attendance_days: v.days, absent_on_first_absence: v.firstAbsence });
    setSaving(false);
    if (!r.success) return toast.error(r.error || t('app.ps_save_failed'));
    toast.success(t('app.ps_aa_saved'));
    setForm(null);
    settings.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.ps_aa_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{t('app.ps_aa_subtitle')}</Text>
        <InfoBanner tone="green" title={t('app.ps_how_it_works')}>
          {t('app.ps_aa_how')}
        </InfoBanner>
        <InfoBanner tone="orange" title={t('app.ps_aa_first_title')}>
          {t('app.ps_aa_first_body')}
        </InfoBanner>
        <SettingsCard title={t('app.ps_aa_card')} description={t('app.ps_aa_card_desc')} icon={UserCheck}>
          <SwitchRow label={t('app.ps_aa_enable')} hint={t('app.ps_aa_enable_hint')} value={v.enabled} onChange={(enabled) => set({ enabled })} />
          <SwitchRow label={t('app.ps_aa_first_label')} hint={t('app.ps_aa_first_hint')} value={v.firstAbsence} onChange={(firstAbsence) => set({ firstAbsence })} />
          <View className={cn('gap-1', !v.enabled && 'opacity-50')} pointerEvents={v.enabled ? 'auto' : 'none'}>
            <TimeField label={t('app.ps_aa_hour')} value={v.hour} onChange={(hour) => set({ hour })} />
            <Text className="text-muted-foreground text-xs">{t('app.ps_aa_hour_hint')}</Text>
          </View>
        </SettingsCard>
        <SettingsCard title={t('app.ps_aa_days')} description={t('app.ps_aa_days_desc')} icon={CalendarDays}>
          <View className={cn('gap-2', !v.enabled && 'opacity-50')} pointerEvents={v.enabled ? 'auto' : 'none'}>
            <View className="flex-row flex-wrap gap-2">
              <Button size="sm" variant="outline" onPress={() => set({ days: [0, 1, 2, 3, 4] })}>
                <Text>{t('app.ps_aa_weekdays')}</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => set({ days: [0, 1, 2, 3, 4, 5] })}>
                <Text>{t('app.ps_aa_mon_sat')}</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => set({ days: [] })}>
                <Text>{t('app.ps_clear')}</Text>
              </Button>
            </View>
            {DAYS.map((day, i) => (
              <CheckRow
                key={day}
                checked={v.days.includes(i)}
                label={t(`app.ps_day_${day}`)}
                onPress={() => set({ days: v.days.includes(i) ? v.days.filter((x) => x !== i) : [...v.days, i].sort((a, b) => a - b) })}
              />
            ))}
            <Text className="text-muted-foreground text-xs">{t('app.ps_aa_days_hint')}</Text>
          </View>
        </SettingsCard>
        <View className="border-border flex-row items-center gap-3 rounded-lg border p-3">
          <View className="flex-1">
            <Text className="text-sm font-medium">{t('app.ps_aa_missing')}</Text>
            <Text className="text-muted-foreground text-xs">{t('app.ps_aa_missing_hint')}</Text>
          </View>
          <Button size="sm" variant="outline" onPress={() => router.push('/admin/attendance/take-missing')}>
            <Text>{t('app.ps_open')}</Text>
            <Icon as={ArrowRight} className="size-4 rtl:rotate-180" />
          </Button>
        </View>
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? t('common.saving') : t('app.ps_save_settings')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
