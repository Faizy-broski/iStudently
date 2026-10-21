import { Stack } from 'expo-router';
import { AlertCircle, CheckCircle, DollarSign, TrendingUp, Wallet } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList, EmptyState } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Initials, StatTile } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Overdue fines and condition/damage fees: totals and recent entries (web: /admin/library/fines). */
export default function LibraryFines() {
  const { t, i18n } = useTranslation();
  const { money } = useCurrency();
  const res = useApi(['admin', 'library-fine-stats'], () => adminLibrary.fineStats());
  const s = res.data;
  if (res.isLoading) return <LoadingList />;

  const cell = (child: React.ReactNode) => <View className="min-w-[46%] flex-1">{child}</View>;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.lb_fines_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{t('app.lb_fines_subtitle')}</Text>
        <View className="flex-row flex-wrap gap-3">
          {cell(<StatTile icon={AlertCircle} label={t('app.lb_fines_unpaid')} value={money(s?.unpaid_overdue_fines ?? 0)} note={t('app.lb_fines_unpaid_hint')} tone="destructive" />)}
          {cell(<StatTile icon={CheckCircle} label={t('app.lb_fines_paid')} value={money(s?.paid_overdue_fines ?? 0)} note={t('app.lb_fines_paid_hint')} />)}
          {cell(<StatTile icon={TrendingUp} label={t('app.lb_fines_condition')} value={money(s?.total_condition_fines ?? 0)} note={t('app.lb_fines_condition_hint')} />)}
          {cell(<StatTile icon={DollarSign} label={t('app.lb_fines_total')} value={money((s?.paid_overdue_fines ?? 0) + (s?.total_condition_fines ?? 0))} note={t('app.lb_fines_total_hint')} />)}
        </View>
        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{t('app.lb_fines_recent')}</Text>
            <Text className="text-muted-foreground text-sm">{t('app.lb_fines_recent_desc')}</Text>
            {!s?.recent_fines?.length ? (
              <EmptyState icon={Wallet} title={t('app.lb_fines_none')} />
            ) : (
              s.recent_fines.map((f, i) => (
                <View key={f.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="flex-row items-center gap-3 py-2.5">
                    <Initials name={f.student_name || '?'} tone={f.type === 'overdue' ? 'destructive' : 'warning'} />
                    <View className="flex-1 gap-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {f.student_name}
                      </Text>
                      <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                        {`${f.book_title} · ${new Date(f.created_at).toLocaleDateString(i18n.language)}`}
                      </Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        <StatusChip label={f.type === 'overdue' ? t('app.lb_fine_overdue') : t('app.lb_fine_condition')} tone={f.type === 'overdue' ? 'destructive' : 'warning'} className="px-2 py-0.5" />
                        <StatusChip label={f.type === 'overdue' ? (f.paid ? t('app.lb_fine_paid') : t('app.lb_fine_unpaid')) : t('app.lb_fine_collected')} tone={f.type === 'overdue' && !f.paid ? 'muted' : 'success'} className="px-2 py-0.5" />
                      </View>
                    </View>
                    <Text className="text-sm font-bold">{money(f.amount)}</Text>
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
