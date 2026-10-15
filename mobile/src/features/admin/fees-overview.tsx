import { router } from 'expo-router';
import { AlertTriangle, CheckCircle2, Clock, Wallet } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ListRow } from '@/components/app/list-row';
import { StatCard } from '@/components/app/stat-card';
import { ErrorState } from '@/components/app/states';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Student billing totals for the campus (web: /admin/fees), shown above the Fees tab's modules. */
export function FeesOverview() {
  const { t } = useTranslation();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const stats = useApi(scopeId ? ['admin', 'fees-dashboard', scopeId] : null, ([, , sid]) => adminFees.dashboard(sid as string));
  const s = stats.data;
  if (stats.error && !s) return <ErrorState message={stats.error.message} onRetry={() => stats.mutate()} />;

  return (
    <>
      <View className="gap-3 p-4">
        {!s ? (
          <View className="gap-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </View>
        ) : (
          <>
            <View className="flex-row gap-3">
              <StatCard icon={Wallet} label={t('fees.totalFees')} value={money(s.total_fees)} />
              <StatCard icon={CheckCircle2} label={t('fees.statusCollected')} value={money(s.total_collected)} />
            </View>
            <View className="flex-row gap-3">
              <StatCard icon={Clock} label={t('fees.statusPending')} value={money(s.total_pending)} detail={t('app.fe_count', { count: (s.counts?.pending ?? 0) + (s.counts?.partial ?? 0) })} />
              <StatCard icon={AlertTriangle} label={t('fees.statusOverdue')} value={money(s.total_overdue)} detail={t('app.fe_count', { count: s.counts?.overdue ?? 0 })} tone="destructive" />
            </View>
          </>
        )}
        <Card className="gap-0 py-0">
          <ListRow title={t('fees.payments.title')} subtitle={t('app.fe_payments_hint')} onPress={() => router.push('/admin/billing/payments')} />
          <Separator />
          <ListRow title={t('fees.studentBalances')} subtitle={t('app.fe_balances_hint')} onPress={() => router.push('/admin/billing/balances')} />
        </Card>
      </View>
    </>
  );
}
