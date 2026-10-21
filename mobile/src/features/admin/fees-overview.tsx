import { router } from 'expo-router';
import { Receipt, Scale } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HeroCard, StatTile, StatTiles } from '@/components/app/layout';
import { ActionRow, Panel } from '@/components/app/panel';
import { ErrorState } from '@/components/app/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
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
  const pct = s && s.total_fees > 0 ? Math.min(100, (s.total_collected / s.total_fees) * 100) : 0;

  return (
    <View className="gap-3 pb-5">
      {!s ? (
        <View className="gap-3">
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </View>
      ) : (
        <>
          <HeroCard>
            <Text className="text-white text-xs opacity-80">{t('fees.totalFees')}</Text>
            <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit>
              {money(s.total_fees)}
            </Text>
            <View className="h-2 overflow-hidden rounded-full bg-white/20">
              <View className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </View>
            <Text className="text-white text-xs">{`${t('fees.statusCollected')}: ${money(s.total_collected)} · ${Math.round(pct)}%`}</Text>
          </HeroCard>
          <StatTiles>
            <StatTile label={t('fees.statusPending')} value={money(s.total_pending)} tone="warning" note={t('app.fe_count', { count: (s.counts?.pending ?? 0) + (s.counts?.partial ?? 0) })} />
            <StatTile label={t('fees.statusOverdue')} value={money(s.total_overdue)} tone="destructive" note={t('app.fe_count', { count: s.counts?.overdue ?? 0 })} />
          </StatTiles>
        </>
      )}
      <Panel>
        <ActionRow icon={Receipt} title={t('fees.payments.title')} subtitle={t('app.fe_payments_hint')} onPress={() => router.push('/admin/billing/payments')} />
        <ActionRow icon={Scale} title={t('fees.studentBalances')} subtitle={t('app.fe_balances_hint')} onPress={() => router.push('/admin/billing/balances')} last />
      </Panel>
    </View>
  );
}
