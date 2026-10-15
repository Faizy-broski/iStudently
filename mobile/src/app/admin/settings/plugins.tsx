import { PLUGINS } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { Check, Minus, Plus, Settings, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { openAdminPage } from '@/features/admin/module-list';
import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Switch plugins on/off for the selected campus; open their settings (web: /admin/settings/plugins). */
export default function Plugins() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`setup.plugins_page.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const active = settings.data?.active_plugins ?? {};
  const q = search.trim().toLowerCase();
  const list = PLUGINS.filter((x) => !q || p(`${x.id}_name`).toLowerCase().includes(q) || p(`${x.id}_desc`).toLowerCase().includes(q));

  async function toggle(id: string) {
    if (!settings.data) return;
    const next = !active[id];
    setToggling(id);
    try {
      const extra: Record<string, unknown> = id === 'automatic_attendance' ? { auto_attendance_enabled: next } : {};
      const r = await adminSchool.updateSettings({ active_plugins: { ...active, [id]: next }, ...extra }, campusId);
      if (!r.success) return toast.error(r.error || p('err_update'));
      // The menu, plugin gates and settings screens all read this key.
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'school-settings');
      toast.success(next ? p('toast_activated', { name: p(`${id}_name`) }) : p('toast_deactivated', { name: p(`${id}_name`) }));
    } finally {
      setToggling(null);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.plg_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <SearchBar value={search} onChangeText={setSearch} placeholder={p('search_placeholder')} />
        <Text className="text-muted-foreground text-sm">{p('plugins_found', { count: list.length })}</Text>
        {settings.isLoading ? (
          <LoadingList />
        ) : list.length === 0 ? (
          <Text className="text-muted-foreground py-10 text-center">{p('no_results')}</Text>
        ) : (
          <Card>
            {list.map((plugin, i) => {
              const on = !!active[plugin.id];
              return (
                <View key={plugin.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-2 px-4 py-3">
                    <View className="flex-row items-start gap-2">
                      <View className="flex-1">
                        <Text className="text-primary font-medium">{p(`${plugin.id}_name`)}</Text>
                        <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={3}>
                          {p(`${plugin.id}_desc`)}
                        </Text>
                      </View>
                      <Icon as={on ? Check : X} className={on ? 'size-4 text-green-600' : 'size-4 text-red-500'} />
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Button size="sm" variant={on ? 'outline' : 'default'} disabled={toggling === plugin.id} onPress={() => toggle(plugin.id)}>
                        <Icon as={on ? Minus : Plus} className={on ? 'text-foreground size-4' : 'text-primary-foreground size-4'} />
                        <Text>{on ? p('btn_deactivate') : p('btn_activate')}</Text>
                      </Button>
                      {on && plugin.settingsHref ? (
                        <Button size="sm" variant="ghost" onPress={() => openAdminPage({ href: plugin.settingsHref ?? '', title: plugin.id })}>
                          <Icon as={Settings} className="text-foreground size-4" />
                          <Text>{p('btn_configuration')}</Text>
                        </Button>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
