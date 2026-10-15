import type { ElementTransaction } from '@studently/api-client';
import { todayIso } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Undo2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { DataList } from '@/components/app/data-list';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { adminBillingElements } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Billing-element payments taken between two dates (web: /admin/billing-elements/daily-transactions). */
export default function DailyTransactions() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();
  const { me } = useSession();
  const isAdmin = me.status === 'ready' && me.me.profile.role === 'admin';
  // Web default: the first of this month to today.
  const [from, setFrom] = useState(`${todayIso().slice(0, 8)}01`);
  const [to, setTo] = useState(todayIso());
  const [categoryId, setCategoryId] = useState('');
  const categories = useApi(['admin', 'be-categories'], () => adminBillingElements.categories());
  const valid = DATE.test(from) && DATE.test(to);
  const list = useApi(valid ? ['admin', 'be-transactions', from, to, categoryId] : null, ([, , f, tt, c]) =>
    adminBillingElements.transactions({ from_date: f as string, to_date: tt as string, category_id: (c as string) || undefined }),
  );
  const total = (list.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);

  return (
    <>
      <Stack.Screen options={{ title: t('app.be_tx_title') }} />
      <View className="bg-background flex-1">
        <View className="gap-2 px-4 pt-3 pb-2">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <DateField value={from} onChange={(v) => setFrom(v ?? from)} />
            </View>
            <View className="flex-1">
              <DateField value={to} onChange={(v) => setTo(v ?? to)} />
            </View>
          </View>
          <Picker
            value={categoryId}
            onChange={setCategoryId}
            options={[{ value: '', label: t('admin.billing_elements.daily_transactions.category') }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.title }))]}
          />
          {list.data ? <Text className="font-semibold">{t('app.be_tx_total', { count: list.data.length, total: money(total) })}</Text> : null}
        </View>
        <DataList<ElementTransaction>
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={t('app.be_tx_none')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1 gap-0.5">
                <Text className="font-medium">{`${x.student_name ?? '—'} · ${money(x.amount)}`}</Text>
                <Text className="text-muted-foreground text-xs">{[x.element_title, x.category_title, x.comment, x.payment_method, formatDate(x.transaction_date), x.grade_level].filter(Boolean).join(' · ')}</Text>
              </View>
              {isAdmin ? (
                <Pressable
                  hitSlop={8}
                  accessibilityLabel={t('app.be_reverse')}
                  onPress={async () => {
                    if (!(await confirm({ title: t('app.be_reverse'), body: `${x.student_name ?? ''} · ${money(x.amount)}`, destructive: true, confirmLabel: t('app.be_reverse') }))) return;
                    const res = await adminBillingElements.reverseTransaction(x.id);
                    if (!res.success) return toast.error(res.error || t('app.error_title'));
                    list.mutate();
                  }}>
                  <Icon as={Undo2} className="text-muted-foreground size-5" />
                </Pressable>
              ) : null}
            </View>
          )}
        />
      </View>
    </>
  );
}
