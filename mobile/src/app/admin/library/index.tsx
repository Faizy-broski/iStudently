import { router, Stack } from 'expo-router';
import { BookOpen, Info, Settings, Wallet } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { HeaderButton, HeroCard, StatTile, StatTiles } from '@/components/app/layout';
import { ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isLibraryKey } from '@/features/admin/library';
import { LoanDirectory } from '@/features/admin/library-loans';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { useRoleBase } from '@/features/portal/role-base';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Library overview for the selected campus: inventory, circulation, fines, loan directory (web: /admin/library). */
export default function LibraryOverview() {
  const { t } = useTranslation();
  const { isLibrarian } = useRoleBase();
  const o = (k: string, v?: Record<string, unknown>) => t(`admin.library.overview.${k}`, v);
  const { money } = useCurrency();
  const { mutate } = useSWRConfig();
  const { campusId, campus } = useCampus();
  const stats = useApi(['admin', 'library-stats', campusId ?? 'school'], () => adminLibrary.stats(campusId));
  const s = stats.data;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: o('title'), headerRight: () => <HeaderButton icon={Settings} label={t('library_settings.title')} onPress={() => router.push(isLibrarian ? '/librarian/library-settings' : '/admin/library/settings')} /> }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate(isLibraryKey)} />}>
        <Text className="text-muted-foreground text-sm">{campus ? `${o('showing_for')} ${campus.name}` : o('showing_all')}</Text>
        <View className="bg-info-soft flex-row gap-3 rounded-2xl p-4">
          <Icon as={Info} className="text-brand dark:text-brand-secondary mt-0.5 size-4" />
          <View className="flex-1">
            <Text className="text-sm font-semibold">{o('moved_title')}</Text>
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
            <HeroCard>
              <Text className="text-sm font-semibold text-white/85">{o('cards.total_inventory')}</Text>
              <Text className="text-3xl font-bold text-white">{`${s.total_books || 0} ${o('cards.books')}`}</Text>
              <Text className="text-xs text-white/80">{`${s.total_copies || 0} ${o('cards.total_copies')}`}</Text>
            </HeroCard>
            <StatTiles>
              <StatTile icon={BookOpen} label={o('cards.current_circulation')} value={`${s.active_loans || 0}`} note={o('cards.issued')} chip={(s.overdue_loans || 0) > 0 ? <StatusChip label={`${s.overdue_loans} ${o('cards.overdue')}`} tone="destructive" className="self-start px-2 py-0.5" /> : undefined} />
              <StatTile icon={Wallet} tone="success" label={o('cards.financials')} value={money(s.total_fines_collected || 0)} note={o('cards.collected')} chip={(s.pending_fines || 0) > 0 ? <StatusChip label={`${money(s.pending_fines)} ${o('cards.pending')}`} tone="warning" className="self-start px-2 py-0.5" /> : undefined} />
            </StatTiles>
          </View>
        )}

        <LoanDirectory />
      </ScrollView>
    </View>
  );
}
