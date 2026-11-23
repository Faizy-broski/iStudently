import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MonitorSmartphone, Smartphone, Trash2, UserX } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SectionList } from '@/components/app/lists';

import { useConfirm } from '@/components/app/confirm';
import { RowPill } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, InlineError, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { vlaby } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { useAction } from '@/lib/use-action';

const MAX_LIMIT = 20;

/**
 * Virtual Labs (VLaby) device limit of a school, same rules as the web's SchoolVlabyDevicesButton:
 * how many devices each user may use at the same time (blank = unlimited), plus the registered
 * devices with remove / reset actions. Only the super admin sets it.
 */
export default function SchoolVlabyDevices() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  const limit = useApi(['platform', 'vlaby', 'limit', id], () => vlaby.deviceLimit(id));
  const devices = useApi(['platform', 'vlaby', 'devices', id], () => vlaby.devices(id));

  const [limitText, setLimitText] = useState('');
  const savedLimit = limit.data?.limit ?? null;
  const limitLoaded = limit.data !== undefined;
  useEffect(() => {
    if (limitLoaded) setLimitText(savedLimit ? String(savedLimit) : '');
  }, [limitLoaded, savedLimit]);

  const trimmed = limitText.trim();
  const parsed = trimmed === '' ? null : Number(trimmed);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_LIMIT);

  const save = useAction(vlaby.setDeviceLimit, { success: t('app.vd_saved'), onSuccess: () => limit.mutate() });
  const removeDevice = useAction(vlaby.removeDevice, { success: t('app.vd_device_removed'), onSuccess: () => devices.mutate() });
  const resetUser = useAction(vlaby.resetUserDevices, { success: t('app.vd_user_reset'), onSuccess: () => devices.mutate() });
  const busy = save.running || removeDevice.running || resetUser.running;

  const sections = useMemo(() => {
    const map = new Map<string, { key: string; title: string; role: string | null; data: NonNullable<typeof devices.data> }>();
    for (const d of devices.data ?? []) {
      const g = map.get(d.profile_id) ?? { key: d.profile_id, title: d.user_name || d.profile_id, role: d.role, data: [] };
      g.data.push(d);
      map.set(d.profile_id, g);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [devices.data]);

  async function onSave() {
    if (!valid) return;
    await save.run(id, parsed);
  }

  async function onReset(profileId: string, userName: string) {
    const ok = await confirm({
      title: t('app.vd_reset_title', { name: userName }),
      body: t('app.vd_reset_body'),
      confirmLabel: t('app.vd_reset_user'),
      destructive: true,
    });
    if (ok) await resetUser.run(id, profileId);
  }

  const title = name ? `${t('app.vd_title')} · ${name}` : t('app.vd_title');

  if (limit.isLoading || (devices.isLoading && !devices.data)) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <LoadingList rows={6} />
      </>
    );
  }
  if (limit.error) {
    // The server answers 503 not_migrated until the VLaby device SQL migration has been run.
    const notMigrated = limit.error.code === 'not_migrated';
    return (
      <>
        <Stack.Screen options={{ title }} />
        <ErrorState message={notMigrated ? t('app.vd_not_migrated') : limit.error.message || t('app.error_title')} onRetry={() => { limit.mutate(); devices.mutate(); }} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <View className="bg-background flex-1">
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerClassName="px-4 pb-6"
          refreshing={devices.isValidating && !devices.isLoading}
          onRefresh={() => { limit.mutate(); devices.mutate(); }}
          ItemSeparatorComponent={() => <View className="h-1.5" />}
          ListHeaderComponent={
            <View className="gap-3 pb-3 pt-4">
              <Panel className="gap-3 p-4">
                <View className="gap-0.5">
                  <Text className="text-sm font-semibold">{t('app.vd_limit_label')}</Text>
                  <Text variant="muted" className="text-xs">
                    {t('app.vd_limit_hint', { max: MAX_LIMIT })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Input
                      value={limitText}
                      onChangeText={setLimitText}
                      placeholder={t('app.vd_unlimited')}
                      keyboardType="number-pad"
                      maxLength={2}
                      accessibilityLabel={t('app.vd_limit_label')}
                    />
                  </View>
                  <Button onPress={onSave} disabled={busy || !valid}>
                    <Text>{t('app.bl_save')}</Text>
                  </Button>
                </View>
                {!valid ? <Text className="text-destructive text-xs">{t('app.vd_limit_invalid', { max: MAX_LIMIT })}</Text> : null}
              </Panel>
              {devices.error ? <InlineError message={devices.error.code === 'not_migrated' ? t('app.vd_not_migrated') : devices.error.message || t('app.vd_devices_failed')} onRetry={() => devices.mutate()} /> : null}
              <Text className="px-1 text-sm font-semibold">{t('app.vd_registered', { count: devices.data?.length ?? 0 })}</Text>
            </View>
          }
          ListEmptyComponent={devices.error ? null : <EmptyState icon={MonitorSmartphone} title={t('app.vd_none')} />}
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center gap-2 pb-2 pt-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold" numberOfLines={1}>
                  {section.title}
                </Text>
                <Text variant="muted" className="text-xs">
                  {[section.role, t('app.vd_device_count', { count: section.data.length })].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <RowPill label={t('app.vd_reset_user')} icon={UserX} tone="destructive" onPress={() => !busy && onReset(section.key, section.title)} />
            </View>
          )}
          renderItem={({ item }) => (
            <Panel className="flex-row items-center gap-3 p-3">
              <Icon as={Smartphone} className="text-brand size-5" />
              <View className="flex-1">
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {item.label || item.platform || t('app.vd_unknown_device')}
                </Text>
                <Text variant="muted" className="text-xs">
                  {t('app.vd_last_used', { date: formatDateTime(item.last_seen_at) })}
                </Text>
              </View>
              <Button variant="ghost" size="icon" disabled={busy} onPress={() => removeDevice.run(item.id)} accessibilityLabel={t('app.vd_remove_device')}>
                <Icon as={Trash2} className="text-destructive size-4" />
              </Button>
            </Panel>
          )}
        />
      </View>
    </>
  );
}
