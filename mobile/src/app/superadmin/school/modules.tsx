import { ALL_MODULE_HREFS, MODULE_CATALOG, type ModuleCatalogItem } from '@studently/shared-types';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { platform } from '@/lib/api';

/**
 * Which web modules a school may use (deny-list), same rules as the web's SchoolModuleAccessButton:
 * restrict off = null (everything visible); on = unchecked items' pages are denied.
 */
export default function SchoolModules() {
  const { t } = useTranslation();
  const toast = useToast();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [denied, setDenied] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await platform.getDeniedModules(id);
      if (!d.success) {
        setError(d.error || t('app.error_title'));
        setLoading(false);
        return;
      }
      let list = d.data?.denied_modules ?? null;
      if (list === null) {
        // School never had a deny-list: derive it from the old allow-list (shown, saved only on Save).
        const a = await platform.getAllowedModules(id);
        const allowed = a.data?.allowed_modules ?? null;
        list = allowed ? ALL_MODULE_HREFS.filter((h) => !allowed.includes(h)) : [];
      }
      setDenied(new Set(list));
      setRestricted(list.length > 0);
      setLoading(false);
    })();
  }, [id, t]);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MODULE_CATALOG.map((g) => ({
      key: g.title,
      title: g.title === '__root__' ? t('app.ma_root') : t(`sidebar.${g.title}`, { defaultValue: g.title }),
      data: g.items.filter((i) => !q || t(`sidebar.${i.title}`, { defaultValue: i.title }).toLowerCase().includes(q) || i.hrefs.some((h) => h.includes(q))),
    })).filter((s) => s.data.length > 0);
  }, [search, t]);

  const state = (item: ModuleCatalogItem): boolean | 'partial' => {
    const visible = item.hrefs.filter((h) => !denied.has(h)).length;
    return visible === item.hrefs.length ? true : visible === 0 ? false : 'partial';
  };
  const setItem = (item: ModuleCatalogItem, visible: boolean) =>
    setDenied((prev) => {
      const next = new Set(prev);
      for (const h of item.hrefs) {
        if (visible) next.delete(h);
        else next.add(h);
      }
      return next;
    });

  async function save() {
    setSaving(true);
    const res = await platform.setDeniedModules(id, restricted ? [...denied] : null);
    setSaving(false);
    if (res.success) {
      toast.success(t('app.ma_saved'));
      router.back();
    } else toast.error(res.error || t('app.error_title'));
  }

  if (loading) return <LoadingList rows={8} />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <Stack.Screen options={{ title: name ? `${t('app.ma_title')} · ${name}` : t('app.ma_title') }} />
      <View className="bg-background flex-1">
        <View className="gap-3 p-4">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">{t('app.ma_restrict')}</Text>
              <Text variant="muted">{t('app.ma_restrict_hint')}</Text>
            </View>
            <Switch checked={restricted} onCheckedChange={setRestricted} />
          </View>
          {restricted ? (
            <>
              <Text variant="muted">{t('app.ma_hidden_count', { count: denied.size })}</Text>
              <SearchBar value={search} onChangeText={setSearch} placeholder={t('app.ma_search')} />
              <View className="flex-row gap-2">
                <Button size="sm" variant="outline" onPress={() => setDenied(new Set())}>
                  <Text>{t('app.ma_show_all')}</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => setDenied(new Set(ALL_MODULE_HREFS))}>
                  <Text>{t('app.ma_hide_all')}</Text>
                </Button>
              </View>
            </>
          ) : null}
        </View>
        {restricted ? (
          <SectionList
            sections={sections}
            keyExtractor={(item, i) => `${item.title}:${i}`}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled
            ItemSeparatorComponent={() => <Separator />}
            renderSectionHeader={({ section }) => (
              <View className="bg-muted px-4 py-2">
                <Text className="text-muted-foreground text-xs font-semibold uppercase">{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const s = state(item);
              return (
                <View className="min-h-12 flex-row items-center gap-3 px-4 py-2">
                  <Checkbox checked={s !== false} onCheckedChange={(c) => setItem(item, !!c)} />
                  <View className="flex-1">
                    <Text>{t(`sidebar.${item.title}`, { defaultValue: item.title })}</Text>
                    {s === 'partial' ? <Text className="text-warning text-xs">{t('app.ma_partial')}</Text> : null}
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <View className="flex-1" />
        )}
        <View className="border-border border-t p-4">
          <Button onPress={save} disabled={saving}>
            <Text>{t('app.bl_save')}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
