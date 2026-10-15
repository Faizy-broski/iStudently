import { Stack } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isLibraryKey } from '@/features/admin/library';
import { LoanDirectory } from '@/features/admin/library-loans';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Library overview for the selected campus: inventory, circulation, fines, loan directory (web: /admin/library). */
export default function LibraryOverview() {
  const { t } = useTranslation();
  const o = (k: string, v?: Record<string, unknown>) => t(`admin.library.overview.${k}`, v);
  const { money } = useCurrency();
  const { mutate } = useSWRConfig();
  const { campusId, campus } = useCampus();
  const stats = useApi(['admin', 'library-stats', campusId ?? 'school'], () => adminLibrary.stats(campusId));
  const s = stats.data;

  const card = (title: string, main: string, sub: string | null, subTone = 'text-muted-foreground') => (
    <Card>
      <CardContent className="gap-1 pt-4">
        <Text className="text-muted-foreground text-sm">{title}</Text>
        <Text className="text-2xl font-bold">{main}</Text>
        {sub ? <Text className={`text-xs ${subTone}`}>{sub}</Text> : null}
      </CardContent>
    </Card>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: o('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate(isLibraryKey)} />}>
        <Text className="text-muted-foreground text-sm">{campus ? `${o('showing_for')} ${campus.name}` : o('showing_all')}</Text>
        <View className="border-border flex-row gap-2 rounded-lg border p-3">
          <Icon as={Info} className="text-foreground mt-0.5 size-4" />
          <View className="flex-1">
            <Text className="font-medium">{o('moved_title')}</Text>
            <Text className="text-muted-foreground text-sm">
              {o('moved_desc_1')} <Text className="text-sm font-bold">{o('librarian_dashboard')}</Text>. {o('moved_desc_2')}
            </Text>
          </View>
        </View>

        {stats.isLoading ? (
          <LoadingList rows={2} />
        ) : stats.error || !s ? (
          <ErrorState message={o('errors.load_stats')} onRetry={() => stats.mutate()} />
        ) : (
          <View className="gap-3">
            {card(o('cards.total_inventory'), `${s.total_books || 0} ${o('cards.books')}`, `${s.total_copies || 0} ${o('cards.total_copies')}`)}
            {card(o('cards.current_circulation'), `${s.active_loans || 0} ${o('cards.issued')}`, (s.overdue_loans || 0) > 0 ? `${s.overdue_loans} ${o('cards.overdue')}` : null, 'text-destructive')}
            {card(o('cards.financials'), `${money(s.total_fines_collected || 0)} ${o('cards.collected')}`, (s.pending_fines || 0) > 0 ? `${money(s.pending_fines)} ${o('cards.pending')}` : null, 'text-amber-600')}
          </View>
        )}

        <LoanDirectory />
      </ScrollView>
    </View>
  );
}
