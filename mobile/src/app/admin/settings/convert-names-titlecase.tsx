import { Stack } from 'expo-router';
import { CheckCircle2, Type } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { InfoBanner, SettingsCard } from '@/features/admin/settings-ui';
import { adminSchool } from '@/lib/api';

const EXAMPLES = [
  ['JOHN DOE', 'John Doe'],
  ['jane smith', 'Jane Smith'],
  ['AHMED al-RAZI', 'Ahmed Al-razi'],
  ['Maria GARCIA', 'Maria Garcia'],
];

/** One-time utility: title-case all profile names (web: /admin/settings/convert-names-titlecase). */
export default function ConvertNamesTitlecase() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  async function convert() {
    if (!(await confirm({ title: t('app.ps_cn_confirm_title'), body: t('app.ps_cn_confirm_body'), confirmLabel: t('app.ps_cn_convert') }))) return;
    setBusy(true);
    setResult(null);
    const r = await adminSchool.convertNamesTitlecase();
    setBusy(false);
    if (!r.success || r.data == null) return toast.error(r.error || t('app.ps_cn_failed'));
    setResult(r.data.converted);
    if (r.data.converted > 0) toast.success(t('app.ps_cn_done', { count: r.data.converted }));
    else toast.info(t('app.ps_cn_nothing'));
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.ps_cn_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{t('app.ps_cn_subtitle')}</Text>
        <InfoBanner title={t('app.ps_how_it_works')}>{t('app.ps_cn_how')}</InfoBanner>
        <SettingsCard title={t('app.ps_cn_card')} description={t('app.ps_cn_card_desc')} icon={Type}>
          <Text className="text-sm">{t('app.ps_cn_fields')}</Text>
          {['first_name', 'last_name', 'father_name', 'grandfather_name'].map((f) => (
            <Text key={f} className="text-muted-foreground ps-3 text-sm">{`• ${t(`school.students.bulk_import.fields.${f}`)}`}</Text>
          ))}
          {result !== null ? (
            <View className="flex-row items-center gap-2 rounded-md bg-green-50 p-2 dark:bg-green-950/30">
              <Icon as={CheckCircle2} className="size-4 text-green-700 dark:text-green-400" />
              <Text className="flex-1 text-sm text-green-800 dark:text-green-300">{result > 0 ? t('app.ps_cn_done', { count: result }) : t('app.ps_cn_nothing')}</Text>
            </View>
          ) : null}
          <Button onPress={convert} disabled={busy}>
            <Icon as={Type} className="text-primary-foreground size-4" />
            <Text>{busy ? t('app.ps_cn_converting') : t('app.ps_cn_convert')}</Text>
          </Button>
        </SettingsCard>
        <SettingsCard title={t('app.ps_cn_examples')} description={t('app.ps_cn_examples_desc')}>
          <View className="border-border flex-row border-b pb-1">
            <Text className="text-muted-foreground flex-1 text-xs font-medium">{t('app.ps_cn_before')}</Text>
            <Text className="text-muted-foreground flex-1 text-xs font-medium">{t('app.ps_cn_after')}</Text>
          </View>
          {EXAMPLES.map(([before, after]) => (
            <View key={before} className="flex-row">
              <Text className="text-muted-foreground flex-1 font-mono text-xs">{before}</Text>
              <Text className="text-primary flex-1 text-xs font-medium">{after}</Text>
            </View>
          ))}
          <Text className="text-muted-foreground text-xs">{t('app.ps_cn_examples_note')}</Text>
        </SettingsCard>
      </ScrollView>
    </>
  );
}
