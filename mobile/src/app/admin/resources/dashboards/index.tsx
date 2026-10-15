import type { ResourceDashboard } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Eye, LayoutDashboard, Plus, Settings, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Custom dashboards that combine pages on one screen: create, configure, view, delete (web: /admin/resources/dashboards). */
export default function ResourceDashboards() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`school.resources.dashboards.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'resource-dashboards', campusId ?? 'school'], () => adminResources.dashboards(campusId));
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const r = await adminResources.createDashboard({ title: title.trim(), campus_id: campusId });
      if (!r.success) return toast.error(r.error || d('msg_create_error'));
      toast.success(d('msg_create_success'));
      setTitle('');
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(x: ResourceDashboard) {
    if (!(await confirm({ title: d('delete_confirm_title'), body: d('delete_confirm_desc', { name: x.title }), destructive: true, confirmLabel: d('btn_confirm') }))) return;
    const r = await adminResources.deleteDashboard(x.id);
    if (!r.success) return toast.error(r.error || d('msg_delete_error'));
    toast.success(d('msg_delete_success'));
    res.mutate();
  }

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{d('subtitle')}</Text>
        <Text className="font-semibold">{res.isLoading ? d('loading') : list.length === 1 ? d('dashboards_found_singular') : d('dashboards_found', { count: list.length })}</Text>
        {res.isLoading ? (
          <LoadingList />
        ) : (
          <Card className="py-0">
            {list.map((x, i) => (
              <View key={x.id}>
                {i > 0 ? <Separator /> : null}
                <View className="flex-row items-center gap-1 px-3 py-2">
                  <Icon as={LayoutDashboard} className="text-primary size-4" />
                  <Text className="flex-1 font-medium" onPress={() => router.push({ pathname: '/admin/resources/dashboards/[id]', params: { id: x.id } })}>
                    {x.title}
                  </Text>
                  <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/resources/dashboards/configure', params: { id: x.id } })}>
                    <Icon as={Settings} className="text-foreground size-3.5" />
                    <Text className="text-xs">{d('btn_configuration')}</Text>
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => router.push({ pathname: '/admin/resources/dashboards/[id]', params: { id: x.id } })} accessibilityLabel={d('btn_view')}>
                    <Icon as={Eye} className="text-foreground size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => remove(x)} accessibilityLabel={d('btn_delete')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Button>
                </View>
              </View>
            ))}
            {list.length ? <Separator /> : null}
            <View className="flex-row items-center gap-2 px-3 py-2">
              <Input className="flex-1" value={title} onChangeText={setTitle} placeholder={d('input_placeholder')} onSubmitEditing={create} />
              <Button size="icon" onPress={create} disabled={saving || !title.trim()} accessibilityLabel={d('create_button')}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
              </Button>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
