import { CUSTOM_MENU_ROLES, type CustomMenuRole, resolveMenuOrder, SIDEBAR_SECTIONS } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { ArrowDown, ArrowUp, RotateCcw, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { FilterChips } from '@/components/app/filter-chips';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { InfoBanner, SettingsCard } from '@/features/admin/settings-ui';
import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Order of the web sidebar's top-level sections per role, per campus (web: /admin/settings/custom-menu). */
export default function CustomMenu() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId, campus } = useCampus();
  const saved = useApi(['admin', 'custom-menu-order', campusId ?? 'school'], () => adminSchool.customMenuOrder(campusId));
  const [role, setRole] = useState<CustomMenuRole>('admin');
  const [edits, setEdits] = useState<Partial<Record<CustomMenuRole, string[]>>>({});
  const [saving, setSaving] = useState(false);

  if (saved.isLoading) return <LoadingList rows={8} />;
  if (saved.error) return <ErrorState message={saved.error.message} onRetry={() => saved.mutate()} />;
  const savedOrder = resolveMenuOrder(role, saved.data?.[role]);
  const order = edits[role] ?? savedOrder;
  const dirty = JSON.stringify(order) !== JSON.stringify(savedOrder);
  const label = (title: string) => t(`sidebar.${title}`, { defaultValue: title });

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setEdits((e) => ({ ...e, [role]: next }));
  };

  async function save() {
    setSaving(true);
    const r = await adminSchool.saveCustomMenuOrder(role, order, campusId);
    setSaving(false);
    if (!r.success) return toast.error(r.error || t('app.ps_cm_failed'));
    toast.success(t('app.ps_cm_saved'));
    setEdits((e) => ({ ...e, [role]: undefined }));
    saved.mutate();
    // The admin menu in the app follows the same order.
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'school-settings');
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.ps_cm_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{campus ? `${t('app.ps_cm_subtitle')} · ${campus.name}` : t('app.ps_cm_subtitle')}</Text>
        <InfoBanner title={t('app.ps_how_it_works')}>
          <View className="gap-0.5">
            {[1, 2, 3, 4].map((n) => (
              <Text key={n} className="text-sm text-brand dark:text-brand-secondary ">{`• ${t(`app.ps_cm_how${n}`)}`}</Text>
            ))}
          </View>
        </InfoBanner>
        <SettingsCard title={t('app.ps_cm_card')} description={t('app.ps_cm_card_desc')}>
          <FilterChips<CustomMenuRole> value={role} onChange={setRole} options={CUSTOM_MENU_ROLES.map((r) => ({ value: r, label: t(`app.role_${r}`) }))} />
          {order.map((title, i) => (
            <View key={title} className="border-info-soft dark:border-border bg-card flex-row items-center gap-2 rounded-xl border px-3 py-2.5">
              <Text className="text-muted-foreground w-6 text-xs">{i + 1}</Text>
              <Text className="flex-1 text-sm font-medium">{label(title)}</Text>
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} accessibilityRole="button" accessibilityLabel={t('app.ps_move_up')} hitSlop={6} className={i === 0 ? 'opacity-30' : ''}>
                <Icon as={ArrowUp} className="size-4" />
              </Pressable>
              <Pressable onPress={() => move(i, 1)} disabled={i === order.length - 1} accessibilityRole="button" accessibilityLabel={t('app.ps_move_down')} hitSlop={6} className={i === order.length - 1 ? 'opacity-30' : ''}>
                <Icon as={ArrowDown} className="size-4" />
              </Pressable>
            </View>
          ))}
          <View className="flex-row gap-2">
            <Button className="flex-1" onPress={save} disabled={saving || !dirty}>
              <Icon as={Save} className="text-primary-foreground size-4" />
              <Text>{saving ? t('common.saving') : t('app.ps_cm_save')}</Text>
            </Button>
            <Button variant="outline" className="flex-1" onPress={() => setEdits((e) => ({ ...e, [role]: [...SIDEBAR_SECTIONS[role]] }))} disabled={saving}>
              <Icon as={RotateCcw} className="size-4" />
              <Text>{t('app.ps_cm_reset')}</Text>
            </Button>
          </View>
        </SettingsCard>
      </ScrollView>
    </>
  );
}
