import { router, Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';

/** People and companies the school pays (web: /admin/accounting/payees). */
export default function Payees() {
  const { t } = useTranslation();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const list = useApi(scopeId ? ['admin', 'acc-payees', scopeId] : null, () => adminAccounting.payees(scopeId!));
  return (
    <>
      <Stack.Screen
        options={{
          title: t('accounting.payees.title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push('/admin/accounting/payees/form')} accessibilityLabel={t('accounting.payees.addPayee')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={t('accounting.payees.noPayees')}
          keyExtractor={(p) => p.id}
          renderItem={(p) => (
            <ListRow
              title={p.name}
              subtitle={[p.phone, p.email, p.total_payments !== undefined ? money(p.total_payments) : null].filter(Boolean).join(' · ')}
              leading={<PersonAvatar name={p.name} />}
              onPress={() => router.push({ pathname: '/admin/accounting/payees/[id]', params: { id: p.id } })}
            />
          )}
        />
      </View>
    </>
  );
}
