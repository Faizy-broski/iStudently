import type { ProfileBaseRole } from '@studently/shared-types';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Save, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { buildPermMap, permMapToArray, PROFILE_ROLE_TYPES, profileModuleGroups, setPerm, type PermMap } from '@/features/admin/user-profiles';
import { useCampus } from '@/features/campus/campus';
import { adminSchool, adminUserProfiles } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useResetOn } from '@/lib/use-reset-on';

const GROUPS_PER_PAGE = 4;

/** Which modules one permission profile may use / edit (web: /admin/settings/user-profiles, right panel). */
export default function UserProfilePermissions() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.user_profiles.${k}`, o);
  const label = (title: string) => (title === '__root__' ? t('sidebar.__root__', { defaultValue: t('app.up_general') }) : t(`sidebar.${title}`, { defaultValue: title.replace(/_/g, ' ') }));
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const { id } = useLocalSearchParams<{ id: string }>();
  const roles = useApi(['admin', 'user-profile-roles'], () => adminUserProfiles.roles());
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const perms = useApi(id ? ['admin', 'user-profile-perms', id] : null, ([, , pid]) => adminUserProfiles.permissions(pid));
  const profile = (roles.data ?? []).find((r) => r.id === id) ?? null;
  const denied = settings.data?.denied_modules ?? null;

  const [permMap, setPermMap] = useState<PermMap>({});
  const [panelRole, setPanelRole] = useState<ProfileBaseRole>('teacher');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [changingBase, setChangingBase] = useState(false);

  const baseRole = profile ? profile.base_role : null;
  useEffect(() => {
    if (baseRole) setPanelRole(baseRole);
  }, [baseRole]);

  // Show exactly what is stored (least privilege); keys the school has denied are dropped.
  const deniedKey = JSON.stringify(denied ?? []);
  useEffect(() => {
    if (!perms.data) return;
    const deny = new Set<string>(JSON.parse(deniedKey));
    setPermMap(buildPermMap(deny.size ? perms.data.filter((x) => !deny.has(x.module_key)) : perms.data));
  }, [perms.data, deniedKey]);

  useResetOn(JSON.stringify([search, panelRole]), () => setPage(1));

  const allGroups = useMemo(() => profileModuleGroups(panelRole, denied), [panelRole, denied]);
  const q = search.trim().toLowerCase();
  const groups = q
    ? allGroups
        .map((g) => (label(g.title).toLowerCase().includes(q) ? g : { ...g, items: g.items.filter((i) => label(i.title).toLowerCase().includes(q)) }))
        .filter((g) => g.items.length > 0)
    : allGroups;
  const moduleCount = allGroups.reduce((n, g) => n + g.items.length, 0);
  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const start = (page - 1) * GROUPS_PER_PAGE;
  const pageGroups = groups.slice(start, start + GROUPS_PER_PAGE);

  const setMany = (hrefs: string[], field: 'can_use' | 'can_edit', value: boolean) =>
    setPermMap((prev) => {
      const next = { ...prev };
      for (const h of hrefs) next[h] = setPerm(next[h], field, value);
      return next;
    });
  const setAllShown = (grant: boolean) =>
    setPermMap((prev) => {
      const next = { ...prev };
      for (const g of groups) for (const i of g.items) next[i.href] = { can_use: grant, can_edit: grant };
      return next;
    });

  async function changeBase(v: string) {
    if (!id) return;
    const base = v as ProfileBaseRole;
    setChangingBase(true);
    try {
      const r = await adminUserProfiles.update(id, { base_role: base });
      if (!r.success) return toast.error(r.error || t('app.up_change_type_failed'));
      setPanelRole(base);
      setSearch('');
      await mutate(['admin', 'user-profile-roles']);
    } finally {
      setChangingBase(false);
    }
  }

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const r = await adminUserProfiles.savePermissions(id, permMapToArray(permMap));
      if (!r.success) return toast.error(r.error || p('save_failed'));
      toast.success(p('saved'));
      perms.mutate();
    } finally {
      setSaving(false);
    }
  }

  if (roles.isLoading) return <LoadingList />;
  if (!profile) return <ErrorState onRetry={() => roles.mutate()} />;

  const box = (checked: boolean, onChange: (v: boolean) => void, a11y: string) => (
    <View className="w-16 items-center">
      <Checkbox checked={checked} onCheckedChange={onChange} accessibilityLabel={a11y} />
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: profile.name }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <Card>
          <CardContent className="gap-3 pt-4">
            <View>
              <Text className="text-muted-foreground text-xs font-semibold uppercase">{p('permissions_panel')}</Text>
              <Text className="text-base font-semibold">{profile.name}</Text>
            </View>
            <Text className="text-muted-foreground text-xs">{p('applies_to')}</Text>
            <View pointerEvents={changingBase ? 'none' : 'auto'} className={changingBase ? 'opacity-50' : ''}>
              <Picker value={panelRole} onChange={changeBase} options={PROFILE_ROLE_TYPES.map((r) => ({ value: r, label: t(`app.up_role_${r}`) }))} />
            </View>
            <Text className="text-muted-foreground text-[11px]">{t('app.up_modules_available', { count: moduleCount })}</Text>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('app.up_search_modules')} />
            <View className="flex-row gap-2">
              <Button size="sm" variant="outline" className="flex-1" onPress={() => setAllShown(true)}>
                <Text>{t('app.up_grant_all')}</Text>
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onPress={() => setAllShown(false)}>
                <Text>{t('app.up_clear_all')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        <View className="border-border bg-muted flex-row items-center rounded-md border px-3 py-2">
          <Text className="text-muted-foreground flex-1 text-xs font-semibold uppercase">{t('app.up_module')}</Text>
          <Text className="text-muted-foreground w-16 text-center text-xs font-semibold uppercase">{p('can_use')}</Text>
          <Text className="text-muted-foreground w-16 text-center text-xs font-semibold uppercase">{p('can_edit')}</Text>
        </View>

        {perms.isLoading ? (
          <LoadingList rows={6} />
        ) : !groups.length ? (
          <View className="items-center gap-3 py-12">
            <Icon as={ShieldCheck} className="text-muted-foreground size-10 opacity-30" />
            <Text className="text-muted-foreground text-sm">{t('app.up_no_modules')}</Text>
          </View>
        ) : (
          pageGroups.map((g, gi) => {
            const hrefs = g.items.map((i) => i.href);
            const all = (f: 'can_use' | 'can_edit') => hrefs.every((h) => permMap[h]?.[f]);
            return (
              <Card key={`${g.href}-${gi}`}>
                <CardContent className="px-0 pt-0">
                  <View className="bg-muted/40 border-border flex-row items-center border-b px-3 py-2">
                    <Text className="text-muted-foreground flex-1 text-xs font-semibold uppercase">{label(g.title)}</Text>
                    <View className="w-16 items-center gap-0.5">
                      <Checkbox checked={all('can_use')} onCheckedChange={(v) => setMany(hrefs, 'can_use', v)} />
                      <Text className="text-muted-foreground text-[10px]">{p('check_all')}</Text>
                    </View>
                    <View className="w-16 items-center gap-0.5">
                      <Checkbox checked={all('can_edit')} onCheckedChange={(v) => setMany(hrefs, 'can_edit', v)} />
                      <Text className="text-muted-foreground text-[10px]">{p('check_all')}</Text>
                    </View>
                  </View>
                  {g.items.map((item) => {
                    const perm = permMap[item.href] ?? { can_use: false, can_edit: false };
                    return (
                      <View key={item.href} className="border-border flex-row items-center border-b px-3 py-2.5 last:border-b-0">
                        <Text className="flex-1 text-sm capitalize">{label(item.title)}</Text>
                        {box(perm.can_use, (v) => setMany([item.href], 'can_use', v), `${label(item.title)} ${p('can_use')}`)}
                        {box(perm.can_edit, (v) => setMany([item.href], 'can_edit', v), `${label(item.title)} ${p('can_edit')}`)}
                      </View>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })
        )}

        {groups.length > GROUPS_PER_PAGE ? (
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-muted-foreground flex-1 text-xs">{t('app.up_showing', { from: start + 1, to: Math.min(start + GROUPS_PER_PAGE, groups.length), total: groups.length })}</Text>
            <Button size="sm" variant="outline" disabled={page === 1} onPress={() => setPage((x) => Math.max(1, x - 1))}>
              <Text>{t('common.previous')}</Text>
            </Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onPress={() => setPage((x) => Math.min(totalPages, x + 1))}>
              <Text>{t('common.next')}</Text>
            </Button>
          </View>
        ) : null}
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
        <Button onPress={save} disabled={saving || perms.isLoading}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? p('saving') : p('save_permissions')}</Text>
        </Button>
      </View>
    </View>
  );
}
