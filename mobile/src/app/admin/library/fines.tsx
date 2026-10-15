import { Stack } from 'expo-router';
import { AlertCircle, CheckCircle, DollarSign, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { StatCard } from '@/components/app/stat-card';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

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
          {cell(<StatCard icon={AlertCircle} label={t('app.lb_fines_unpaid')} value={money(s?.unpaid_overdue_fines ?? 0)} detail={t('app.lb_fines_unpaid_hint')} tone="destructive" />)}
          {cell(<StatCard icon={CheckCircle} label={t('app.lb_fines_paid')} value={money(s?.paid_overdue_fines ?? 0)} detail={t('app.lb_fines_paid_hint')} />)}
          {cell(<StatCard icon={TrendingUp} label={t('app.lb_fines_condition')} value={money(s?.total_condition_fines ?? 0)} detail={t('app.lb_fines_condition_hint')} />)}
          {cell(<StatCard icon={DollarSign} label={t('app.lb_fines_total')} value={money((s?.paid_overdue_fines ?? 0) + (s?.total_condition_fines ?? 0))} detail={t('app.lb_fines_total_hint')} />)}
        </View>
        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{t('app.lb_fines_recent')}</Text>
            <Text className="text-muted-foreground text-sm">{t('app.lb_fines_recent_desc')}</Text>
            {!s?.recent_fines?.length ? (
              <Text className="text-muted-foreground py-8 text-center">{t('app.lb_fines_none')}</Text>
            ) : (
              s.recent_fines.map((f, i) => (
                <View key={f.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-1 py-2.5">
                    <View className="flex-row items-center gap-2">
                      <Text className="flex-1 font-medium">{f.student_name}</Text>
                      <Text className="font-semibold">{money(f.amount)}</Text>
                    </View>
                    <Text className="text-muted-foreground text-sm">{f.book_title}</Text>
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <View className={cn('rounded-full px-2 py-0.5', f.type === 'overdue' ? 'bg-destructive' : 'bg-secondary')}>
                        <Text className={cn('text-xs', f.type === 'overdue' && 'text-white')}>{f.type === 'overdue' ? t('app.lb_fine_overdue') : t('app.lb_fine_condition')}</Text>
                      </View>
                      <View className="border-border rounded-full border px-2 py-0.5">
                        <Text className="text-xs">{f.type === 'overdue' ? (f.paid ? t('app.lb_fine_paid') : t('app.lb_fine_unpaid')) : t('app.lb_fine_collected')}</Text>
                      </View>
                      <Text className="text-muted-foreground text-xs">{new Date(f.created_at).toLocaleDateString(i18n.language)}</Text>
                    </View>
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
