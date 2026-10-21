import { router, Stack } from 'expo-router';
import { Building2, Mail, MapPin, Paintbrush, Pencil, Phone, Plus, Trash2, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, Pressable } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { SchoolLogo } from '@/components/app/school-logo';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { campuses as campusesApi } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The school's campuses: add, edit, delete, sidebar theme per campus (web: /admin/settings/campuses). */
export default function Campuses() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`school.campuses.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const res = useApi(['admin', 'campuses-settings'], () => campusesApi.list());
  const list = res.data ?? [];

  async function remove(id: string, name: string) {
    if (!(await confirm({ title: c('delete_confirm', { name }), destructive: true, confirmLabel: c('btn_delete') }))) return;
    const r = await campusesApi.remove(id);
    if (!r.success) return toast.error(r.error || c('delete_error'));
    toast.success(c('delete_success'));
    res.mutate();
    await mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'campuses');
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: c('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{c('subtitle')}</Text>
        <Button className="self-start" onPress={() => router.push('/admin/settings/campus-form')}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{c('btn_add')}</Text>
        </Button>
        {res.isLoading ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={Building2} title={c('no_campuses')} body={c('no_campuses_desc')} actionLabel={c('btn_add')} onAction={() => router.push('/admin/settings/campus-form')} />
        ) : (
          list.map((campus) => (
            <Card key={campus.id}>
              <CardContent className="gap-2 pt-4">
                <View className="flex-row items-center gap-3">
                  <SchoolLogo url={campus.logo_url} shape={campus.logo_shape ?? 'rounded'} size={44} />
                  <View className="flex-1 gap-1">
                    <Text className="text-lg font-semibold">{campus.name}</Text>
                    <StatusChip label={campus.status ?? '—'} tone={campus.status === 'active' ? 'success' : 'muted'} />
                  </View>
                </View>
                {campus.short_name ? <Text className="text-sm font-medium">{c('label_short')}: {campus.short_name}</Text> : null}
                {campus.school_number ? <Text className="text-muted-foreground text-xs">{c('label_code_short')}: {campus.school_number}</Text> : null}
                {campus.address || campus.city || campus.state || campus.zip_code ? (
                  <View className="flex-row gap-2">
                    <Icon as={MapPin} className="text-muted-foreground mt-0.5 size-4" />
                    <Text className="text-muted-foreground flex-1 text-sm">{[campus.address, [campus.city, campus.state, campus.zip_code].filter(Boolean).join(', ')].filter(Boolean).join('\n')}</Text>
                  </View>
                ) : null}
                {campus.contact_email ? (
                  <View className="flex-row items-center gap-2">
                    <Icon as={Mail} className="text-muted-foreground size-4" />
                    <Text className="text-muted-foreground text-sm">{campus.contact_email}</Text>
                  </View>
                ) : null}
                {campus.phone ? (
                  <View className="flex-row items-center gap-2">
                    <Icon as={Phone} className="text-muted-foreground size-4" />
                    <Text className="text-muted-foreground text-sm">{campus.phone}</Text>
                  </View>
                ) : null}
                {campus.principal_name ? (
                  <View className="flex-row items-center gap-2">
                    <Icon as={User} className="text-muted-foreground size-4" />
                    <Text className="text-muted-foreground text-sm">
                      {c('label_principal_short')}: {campus.principal_name}
                    </Text>
                  </View>
                ) : null}
                {!campus.address && !campus.contact_email && !campus.phone && !campus.principal_name ? <Text className="text-muted-foreground text-xs italic">{c('no_info')}</Text> : null}
                <View className="flex-row justify-end gap-1">
                  <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/admin/settings/sidebar-theme', params: { campusId: campus.id, name: campus.name } })}>
                    <Icon as={Paintbrush} className="text-foreground size-4" />
                    <Text>{t('app.cmp_sidebar')}</Text>
                  </Button>
                  <Pressable onPress={() => router.push({ pathname: '/admin/settings/campus-form', params: { id: campus.id } })} accessibilityLabel={c('btn_edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                  </Pressable>
                  <Pressable onPress={() => remove(campus.id, campus.name)} accessibilityLabel={c('btn_delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
