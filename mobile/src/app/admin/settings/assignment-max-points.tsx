import { Stack } from 'expo-router';
import { Save, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
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

/** Cap on gradebook assignment points (web: /admin/settings/assignment-max-points, school-level). */
export default function AssignmentMaxPoints() {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = useApi(['admin', 'school-settings', 'school-level'], () => adminSchool.getSettings());
  const [form, setForm] = useState<{ enabled: boolean; points: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (settings.isLoading) return <LoadingList rows={3} />;
  if (settings.error) return <ErrorState message={settings.error.message} onRetry={() => settings.mutate()} />;
  const cap = settings.data?.assignment_max_points as number | null | undefined;
  const v = form ?? { enabled: cap != null, points: cap != null ? String(cap) : '100' };

  async function save() {
    const parsed = parseInt(v.points, 10);
    if (v.enabled && (isNaN(parsed) || parsed < 1)) return toast.error(t('app.ps_mp_invalid'));
    setSaving(true);
    const r = await adminSchool.updateSettings({ assignment_max_points: v.enabled ? parsed : null });
    setSaving(false);
    if (!r.success) return toast.error(r.error || t('app.ps_save_failed'));
    toast.success(t('app.ps_mp_saved'));
    setForm(null);
    settings.mutate();
  }

  const rules: [string, string, string][] = [
    ['bg-primary', t('app.ps_mp_rule1'), t('app.ps_mp_rule1_body')],
    ['bg-brand', t('app.ps_mp_rule2'), t('app.ps_mp_rule2_body')],
    ['bg-success', t('app.ps_mp_rule3'), t('app.ps_mp_rule3_body')],
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('app.ps_mp_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{t('app.ps_mp_subtitle')}</Text>
        <InfoBanner title={t('app.ps_how_it_works')}>{t('app.ps_mp_how')}</InfoBanner>
        <SettingsCard title={t('app.ps_mp_card')} description={t('app.ps_mp_card_desc')} icon={ShieldCheck}>
          <SwitchRow label={t('app.ps_mp_enable')} hint={t('app.ps_mp_enable_hint')} value={v.enabled} onChange={(enabled) => setForm({ ...v, enabled })} />
          <View className={cn('gap-1.5', !v.enabled && 'opacity-50')} pointerEvents={v.enabled ? 'auto' : 'none'}>
            <Label>{t('app.ps_mp_max')}</Label>
            <Input value={v.points} onChangeText={(p) => setForm({ ...v, points: p.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="100" />
            <Text className="text-muted-foreground text-xs">{t('app.ps_mp_max_hint')}</Text>
          </View>
        </SettingsCard>
        <SettingsCard title={t('app.ps_mp_validated')} description={t('app.ps_mp_validated_desc')}>
          {rules.map(([dot, title, body]) => (
            <View key={title} className="flex-row gap-3">
              <View className={cn('mt-1.5 size-2 rounded-full', dot)} />
              <View className="flex-1">
                <Text className="text-sm font-medium">{title}</Text>
                <Text className="text-muted-foreground text-xs">{body}</Text>
              </View>
            </View>
          ))}
        </SettingsCard>
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? t('common.saving') : t('app.ps_save_settings')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
