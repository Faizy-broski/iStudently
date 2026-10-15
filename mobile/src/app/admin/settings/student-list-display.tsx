import { Stack } from 'expo-router';
import { Save, TableProperties } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { InfoBanner, SettingsCard, SwitchRow } from '@/features/admin/settings-ui';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Config = { enabled: boolean; field: string | null; field2: string | null; separator: string };
const DEFAULT: Config = { enabled: false, field: 'system.username', field2: null, separator: ' / ' };
/** Same field list as the web (profile.*, system.username, custom_fields[category][key]). */
const FIELDS = ['profile.email', 'profile.phone', 'system.username', 'personal.gender', 'personal.date_of_birth', 'personal.address', 'academic.admission_date', 'academic.previous_school'];
const SAMPLE: Record<string, string> = { 'profile.email': 'student@school.com', 'profile.phone': '+1 555 0100', 'system.username': 'john.doe' };

/** Field appended to the Grade column of the web student list (web: /admin/settings/student-list-display, school-level). */
export default function StudentListDisplay() {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = useApi(['admin', 'school-settings', 'school-level'], () => adminSchool.getSettings());
  const [form, setForm] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  if (settings.isLoading) return <LoadingList rows={4} />;
  if (settings.error) return <ErrorState message={settings.error.message} onRetry={() => settings.mutate()} />;
  const v: Config = form ?? { ...DEFAULT, ...((settings.data?.student_list_append_config as Partial<Config> | undefined) ?? {}) };
  const set = (patch: Partial<Config>) => setForm({ ...v, ...patch });
  const label = (f: string) => t(`app.ps_sl_f_${f.replace('.', '_')}`);
  const options = [{ value: '', label: t('app.ps_none') }, ...FIELDS.map((f) => ({ value: f, label: label(f) }))];
  const sample = (f: string | null) => (f ? (SAMPLE[f] ?? f.split('.').pop() ?? '') : '');
  const preview = (grade: string, first: string) => (v.enabled && v.field ? `${grade}${v.separator}${first}${v.field2 ? v.separator + sample(v.field2) : ''}` : grade);

  async function save() {
    setSaving(true);
    const r = await adminSchool.updateSettings({ student_list_append_config: v.enabled ? v : { ...v, enabled: false } });
    setSaving(false);
    if (!r.success) return toast.error(r.error || t('app.ps_save_failed'));
    toast.success(t('app.ps_sl_saved'));
    setForm(null);
    settings.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.ps_sl_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{t('app.ps_sl_subtitle')}</Text>
        <InfoBanner title={t('app.ps_how_it_works')}>{t('app.ps_sl_how')}</InfoBanner>
        <SettingsCard title={t('app.ps_sl_card')} description={t('app.ps_sl_card_desc')} icon={TableProperties}>
          <SwitchRow label={t('app.ps_sl_enable')} hint={t('app.ps_sl_enable_hint')} value={v.enabled} onChange={(enabled) => set({ enabled })} />
          <View className={cn('gap-2', !v.enabled && 'opacity-50')} pointerEvents={v.enabled ? 'auto' : 'none'}>
            <Label>{t('app.ps_sl_primary')}</Label>
            <Picker value={v.field ?? ''} onChange={(f) => set({ field: f || null })} options={options} />
            <Text className="text-muted-foreground text-xs">{t('app.ps_sl_primary_hint')}</Text>
            <Label>{`${t('app.ps_sl_second')} (${t('app.im_optional').replace(/[()]/g, '')})`}</Label>
            <Picker value={v.field2 ?? ''} onChange={(f) => set({ field2: f || null })} options={options} />
            <Label>{t('app.ps_sl_separator')}</Label>
            <Input value={v.separator} onChangeText={(separator) => set({ separator })} maxLength={10} placeholder=" / " />
            <Text className="text-muted-foreground text-xs">{t('app.ps_sl_separator_hint')}</Text>
          </View>
        </SettingsCard>
        <SettingsCard title={t('app.ps_preview')} description={t('app.ps_sl_preview_desc')}>
          {[
            ['STU-001', 'John Doe', preview('Grade 9', sample(v.field))],
            ['STU-002', 'Jane Smith', preview('Grade 10', 'jane.s')],
          ].map(([id, name, grade]) => (
            <View key={id} className="border-border flex-row gap-2 border-b pb-2">
              <Text className="w-20 text-xs font-medium">{id}</Text>
              <Text className="flex-1 text-xs">{name}</Text>
              <Text className="text-primary flex-1 text-xs font-medium">{grade}</Text>
            </View>
          ))}
          <Text className="text-muted-foreground text-xs">{t('app.ps_sl_preview_note')}</Text>
        </SettingsCard>
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? t('common.saving') : t('app.ps_save_settings')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
