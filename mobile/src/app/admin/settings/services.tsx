import type { SchoolService } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View, Pressable } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminServices } from '@/lib/api';
import { useApi } from '@/lib/data';

/** School services (transport, meals, …) of the selected campus: list, add, edit, delete (web: /admin/settings/services). */
export default function ServicesSettings() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.services.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'services', campusId ?? 'school'], () => adminServices.list(campusId));
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(service: SchoolService) {
    if (!(await confirm({ title: s('msg_delete_confirm'), destructive: true, confirmLabel: t('common.delete') }))) return;
    setDeleting(service.id);
    try {
      const r = await adminServices.remove(service.id);
      if (!r.success) return toast.error(r.error || t('app.svc_save_failed'));
      toast.success(s('delete_success'));
      res.mutate();
    } finally {
      setDeleting(null);
    }
  }

  if (res.isLoading) return <LoadingList />;
  if (res.error) return <ErrorState onRetry={() => res.mutate()} />;
  const services = res.data ?? [];

  const pill = (text: string, cls: string, textCls = 'text-xs') => (
    <View className={`self-start rounded-full px-2 py-0.5 ${cls}`}>
      <Text className={textCls}>{text}</Text>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="flex-row items-start justify-between gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{s('subtitle')}</Text>
          <Button size="sm" onPress={() => router.push('/admin/settings/service-form')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{s('btn_add')}</Text>
          </Button>
        </View>
        <Card>
          <CardContent className="pt-2">
            {!services.length ? (
              <EmptyState title={s('no_services')} />
            ) : (
              services.map((svc, i) => (
                <View key={svc.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="flex-row items-start gap-2 py-3">
                    <View className="flex-1 gap-1.5">
                      <Text className="text-sm font-semibold">{svc.name}</Text>
                      {svc.description ? <Text className="text-muted-foreground text-sm">{svc.description}</Text> : null}
                      <View className="flex-row flex-wrap gap-1.5">
                        {pill(svc.code, 'border-border border')}
                        {pill(s(`freq_${svc.charge_frequency}`), 'bg-muted')}
                        {pill(svc.is_mandatory ? `${s('table_col_mandatory')}: ${s('mandatory_yes')}` : `${s('table_col_mandatory')}: ${s('mandatory_no')}`, 'bg-muted')}
                        {pill(svc.is_active ? s('status_active') : s('status_inactive'), svc.is_active ? 'bg-primary' : 'bg-secondary', svc.is_active ? 'text-primary-foreground text-xs' : 'text-xs')}
                      </View>
                      <Text className="text-sm">
                        {s('table_col_charge')}: <Text className="text-sm font-semibold">{money(svc.default_charge)}</Text>
                      </Text>
                    </View>
                    <Pressable onPress={() => router.push({ pathname: '/admin/settings/service-form', params: { id: svc.id } })} accessibilityLabel={t('common.edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                    </Pressable>
                    <Pressable disabled={deleting === svc.id} onPress={() => remove(svc)} accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
