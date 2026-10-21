import type { CopySchoolSettingsOptions, CopySchoolSettingsResult } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { CheckCircle2, Copy, ListChecks } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FormError } from '@/components/app/form';
import { CheckMark, FormSection, IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { platform } from '@/lib/api';
import { useAction } from '@/lib/use-action';

type Category = keyof CopySchoolSettingsOptions;

/** Same categories and defaults as the web's CopySchoolSettingsDialog. */
const CATEGORIES: { key: Category; on: boolean; note?: boolean }[] = [
  { key: 'gradeLevels', on: true },
  { key: 'periods', on: true },
  { key: 'gradingScales', on: true },
  { key: 'defaultFieldOrders', on: true },
  { key: 'customFields', on: true },
  { key: 'markingPeriods', on: false, note: true },
  { key: 'accountingCategories', on: true },
];

/**
 * Copy setup (grades, periods, ...) from another school into `id` (web: CopySchoolSettingsDialog).
 * `schools` is every school for the super admin, or the admin's own school family.
 */
export function CopySettingsScreen({ id, name, schools }: { id: string; name?: string; schools: { data?: { id: string; name: string }[] } }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [source, setSource] = useState<string | null>(null);
  const [options, setOptions] = useState<CopySchoolSettingsOptions>(() => Object.fromEntries(CATEGORIES.map((c) => [c.key, c.on])));
  const [result, setResult] = useState<CopySchoolSettingsResult | null>(null);
  const copy = useAction((src: string) => platform.copySchoolSettings(id, src, options));

  const sources = (schools.data ?? []).filter((s) => s.id !== id);
  const sourceName = sources.find((s) => s.id === source)?.name ?? '';
  const anySelected = Object.values(options).some(Boolean);

  async function run() {
    if (!source) return;
    const ok = await confirm({
      title: t('app.cs_confirm_title'),
      body: t('app.cs_confirm_body', { from: sourceName, to: name ?? '' }),
      confirmLabel: t('app.cs_copy'),
    });
    if (!ok) return;
    const res = await copy.run(source);
    if (res.ok && res.data) setResult(res.data);
  }

  if (result) {
    const counts = Object.entries(result.counts).filter(([, n]) => n > 0);
    return (
      <>
        <Stack.Screen options={{ title: t('app.cs_title') }} />
        <Screen scroll edges={['bottom']}>
          <Panel className="gap-3 p-4">
            <View className="flex-row items-center gap-3">
              <IconTile icon={CheckCircle2} tone={result.errors.length ? 'warning' : 'success'} size={40} round />
              <Text className="flex-1 font-semibold">{result.errors.length ? t('app.cs_done_errors') : t('app.cs_done')}</Text>
            </View>
            {counts.length === 0 ? <Text variant="muted">{t('app.cs_nothing')}</Text> : null}
            {counts.map(([k, n]) => (
              <View key={k} className="flex-row justify-between gap-4">
                <Text className="text-sm">{t(`app.cs_count_${k}`)}</Text>
                <Text className="text-sm font-semibold">{n}</Text>
              </View>
            ))}
          </Panel>
          {result.errors.map((e, i) => (
            <FormError key={i} message={e} />
          ))}
          <Button onPress={() => router.back()}>
            <Text>{t('app.cs_close')}</Text>
          </Button>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.cs_title') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted" className="text-sm">
          {t('app.cs_intro', { name: name ?? '' })}
        </Text>
        <FormSection title={t('app.cs_source')} icon={Copy}>
          <Picker value={source} onChange={setSource} placeholder={t('app.cs_source_placeholder')} options={sources.map((s) => ({ value: s.id, label: s.name }))} />
          {schools.data && sources.length === 0 ? <Text variant="muted">{t('app.cs_no_sources')}</Text> : null}
        </FormSection>

        <FormSection title={t('app.cs_copy')} icon={ListChecks} className="gap-1">
          {CATEGORIES.map((c) => {
            const checked = !!options[c.key];
            const toggle = () => setOptions((o) => ({ ...o, [c.key]: !checked }));
            return (
              <Pressable key={c.key} onPress={toggle} className="flex-row items-start gap-3 py-2.5 active:opacity-70" accessibilityRole="checkbox" accessibilityState={{ checked }}>
                <View className="mt-0.5">
                  <CheckMark on={checked} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm">{t(`app.cs_cat_${c.key}`)}</Text>
                  {c.note ? <Text className="text-muted-foreground text-xs">{t('app.cs_marking_note')}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </FormSection>

        <Button onPress={run} disabled={!source || !anySelected || copy.running}>
          <Text>{copy.running ? t('app.cs_copying') : t('app.cs_copy')}</Text>
        </Button>
      </Screen>
    </>
  );
}
