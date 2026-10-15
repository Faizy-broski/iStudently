import { Stack } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { InfoBanner, SettingsCard, SwitchRow } from '@/features/admin/settings-ui';
import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

const PROFILES = ['admin', 'teacher', 'parent', 'student', 'librarian'] as const;
const DEFAULTS: Record<string, boolean> = { admin: true, teacher: true, parent: false, student: false, librarian: false };

/** Which user types see the dashboard Setup Assistant, per campus (web: /admin/settings/setup-assistant). */
export default function SetupAssistantSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId, campus } = useCampus();
  const data = useApi(['admin', 'setup-assistant-config', campusId ?? 'school'], () => adminSchool.setupAssistantConfig(campusId));
  const [form, setForm] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);

  if (data.isLoading) return <LoadingList rows={5} />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={() => data.mutate()} />;
  const saved = data.data && Object.keys(data.data).length ? data.data : DEFAULTS;
  const v = form ?? saved;
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  async function save() {
    setSaving(true);
    const r = await adminSchool.saveSetupAssistantConfig(v, campusId);
    setSaving(false);
    if (!r.success) return toast.error(r.error || t('app.ps_sa_failed'));
    toast.success(t('app.ps_sa_saved'));
    setForm(null);
    data.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.ps_sa_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{campus ? `${t('app.ps_sa_subtitle')} · ${campus.name}` : t('app.ps_sa_subtitle')}</Text>
        <InfoBanner title={t('app.ps_how_it_works')}>
          <View className="gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Text key={n} className="text-sm text-blue-800 dark:text-blue-300">{`• ${t(`app.ps_sa_how${n}`)}`}</Text>
            ))}
          </View>
        </InfoBanner>
        <SettingsCard title={t('app.ps_sa_card')} description={t('app.ps_sa_card_desc')}>
          {PROFILES.map((p) => (
            <SwitchRow key={p} label={t(`app.ps_sa_${p}`)} hint={t(`app.ps_sa_${p}_desc`)} value={!!v[p]} onChange={(on) => setForm({ ...v, [p]: on })} />
          ))}
          <Button onPress={save} disabled={saving || !dirty}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{saving ? t('common.saving') : t('app.ps_sa_save')}</Text>
          </Button>
        </SettingsCard>
      </ScrollView>
    </>
  );
}
