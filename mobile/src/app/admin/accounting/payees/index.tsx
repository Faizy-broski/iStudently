import { router, Stack } from 'expo-router';
import { FileSpreadsheet, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { exportCsv } from '@/features/admin/table-export';
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
  const toast = useToast();
  /** Web "Export Payments": the payees with their payment totals, as CSV. */
  const exportList = async () => {
    const rows = list.data ?? [];
    if (!rows.length) return toast.error(t('app.pay_export_empty'));
    await exportCsv<(typeof rows)[number]>(
      [
        { key: 'name', label: t('app.pay_col_name'), accessor: (p) => p.name },
        { key: 'email', label: t('app.pay_col_email'), accessor: (p) => p.email },
        { key: 'phone', label: t('app.pay_col_phone'), accessor: (p) => p.phone },
        { key: 'bank', label: t('app.pay_col_bank'), accessor: (p) => p.bank },
        { key: 'payments', label: t('app.pay_col_payments'), accessor: (p) => Number(p.total_payments ?? 0) },
      ],
      rows,
      `payees_${new Date().toISOString().slice(0, 10)}`,
    );
  };
  return (
    <>
      <Stack.Screen
        options={{
          title: t('accounting.payees.title'),
          headerRight: () => (
            <View className="flex-row">
              <Button size="sm" variant="ghost" onPress={exportList} accessibilityLabel={t('app.pay_export')}>
                <Icon as={FileSpreadsheet} className="size-5" />
              </Button>
              <Button size="sm" variant="ghost" onPress={() => router.push('/admin/accounting/payees/form')} accessibilityLabel={t('accounting.payees.addPayee')}>
                <Icon as={Plus} className="size-5" />
              </Button>
            </View>
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
