import type { UserProfileRole } from '@studently/api-client';
import { DEFAULT_ROLE_HREFS, type ProfileBaseRole } from '@studently/shared-types';
import { router, Stack } from 'expo-router';
import { Check, ChevronRight, Layers, Plus, ShieldCheck, Trash2, Users } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { PROFILE_ROLE_TYPES } from '@/features/admin/user-profiles';
import { adminUserProfiles } from '@/lib/api';
import { useApi } from '@/lib/data';

const DEFAULT_NAMES: Record<ProfileBaseRole, string> = {
  teacher: 'Default Teacher',
  staff: 'Default Staff',
  librarian: 'Default Librarian',
  admin: 'Default Admin',
  student: 'Default Student',
  parent: 'Default Parent',
};

/** Permission profiles of the school: list, create, delete; tap one to edit its modules (web: /admin/settings/user-profiles, left panel). */
export default function UserProfilesList() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.user_profiles.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const res = useApi(['admin', 'user-profile-roles'], () => adminUserProfiles.roles());
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [base, setBase] = useState<ProfileBaseRole>('staff');
  const [creating, setCreating] = useState(false);
  const seeded = useRef(false);

  // Like the web: quietly add any missing "Default <Type>" role the first time the page loads
  // ('reconcile' never touches roles someone already customized).
  const roles = res.data;
  useEffect(() => {
    if (!roles || seeded.current) return;
    const names = new Set(roles.map((r) => r.name));
    if (Object.values(DEFAULT_NAMES).every((n) => names.has(n))) return;
    seeded.current = true;
    adminUserProfiles
      .seedDefaults(DEFAULT_ROLE_HREFS, 'reconcile')
      .then((r) => {
        if (!r.success) return toast.error(r.error || t('app.up_seed_failed'));
        res.mutate();
        const errs = r.data?.errors ?? [];
        if (errs.length) toast.error(t('app.up_seed_partial', { names: errs.map((e) => e.name).join(', '), error: errs[0].error }));
      })
      .catch(() => toast.error(t('app.up_seed_failed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const r = await adminUserProfiles.create({ name: name.trim(), base_role: base });
      if (!r.success || !r.data) return toast.error(r.error || t('app.up_create_failed'));
      setShowForm(false);
      setName('');
      await res.mutate();
      router.push({ pathname: '/admin/settings/user-profiles/[id]', params: { id: r.data.id } });
    } finally {
      setCreating(false);
    }
  }

  async function remove(item: UserProfileRole) {
    if (item.is_system) return toast.error(p('system_protected'));
    if (!(await confirm({ title: t('app.up_delete_title'), body: `${p('delete_confirm')} ${item.name}\n\n${t('app.up_delete_note')}`, destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminUserProfiles.remove(item.id);
    if (!r.success) return toast.error(r.error || p('delete_failed'));
    toast.success(p('delete_success'));
    res.mutate();
  }

  if (res.isLoading) return <LoadingList />;
  if (res.error) return <ErrorState onRetry={() => res.mutate()} />;
  const list = roles ?? [];

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: p('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Icon as={ShieldCheck} className="text-primary mt-0.5 size-6" />
          <Text className="text-muted-foreground flex-1 text-sm">{t('app.up_subtitle')}</Text>
        </View>
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Layers} className="text-muted-foreground size-3.5" />
                <Text className="text-muted-foreground text-sm font-semibold">{p('roles_panel')}</Text>
              </View>
              <Button size="sm" variant="outline" onPress={() => setShowForm((v) => !v)}>
                <Icon as={Plus} className="text-foreground size-3.5" />
                <Text>{p('new_role')}</Text>
              </Button>
            </View>
            {showForm ? (
              <View className="border-info-soft dark:border-border bg-muted/30 gap-2 rounded-xl border p-3">
                <Label>{p('profile_name')}</Label>
                <Input value={name} onChangeText={setName} placeholder={p('profile_name_placeholder')} autoFocus onSubmitEditing={create} />
                <Label>{p('applies_to')}</Label>
                <Picker value={base} onChange={(v) => setBase(v as ProfileBaseRole)} options={PROFILE_ROLE_TYPES.map((r) => ({ value: r, label: t(`app.up_role_${r}`) }))} />
                <View className="flex-row gap-2">
                  <Button size="sm" className="flex-1" onPress={create} disabled={!name.trim() || creating}>
                    <Icon as={Check} className="text-primary-foreground size-3.5" />
                    <Text>{t('common.create')}</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      setShowForm(false);
                      setName('');
                    }}
                  >
                    <Text>{t('common.cancel')}</Text>
                  </Button>
                </View>
              </View>
            ) : null}
            {!list.length ? (
              <Text className="text-muted-foreground py-3 text-center text-xs">{t('app.up_none')}</Text>
            ) : (
              list.map((item, i) => (
                <View key={item.id}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable onPress={() => router.push({ pathname: '/admin/settings/user-profiles/[id]', params: { id: item.id } })} className="active:bg-muted flex-row items-center gap-2 py-2.5">
                    <Icon as={Users} className="text-muted-foreground size-4" />
                    <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
                      <Text className="text-sm">{item.name}</Text>
                      {item.is_system ? (
                        <View className="bg-secondary rounded px-1">
                          <Text className="text-[10px]">sys</Text>
                        </View>
                      ) : (
                        <View className="border-border rounded border px-1">
                          <Text className="text-[10px]">{t(`app.up_role_${item.base_role}`, { defaultValue: item.base_role })}</Text>
                        </View>
                      )}
                    </View>
                    {!item.is_system ? (
                      <Pressable onPress={() => remove(item)} accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                        <Icon as={Trash2} className="text-destructive size-4" />
                      </Pressable>
                    ) : null}
                    <Icon flipRtl as={ChevronRight} className="text-muted-foreground size-4" />
                  </Pressable>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
