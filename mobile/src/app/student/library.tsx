import type { BookLoan } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { AlertCircle, BookOpen, CheckCircle, Library, Receipt } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { IconTile, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { usePortalCurrency } from '@/features/portal/currency';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { daysUntil, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'active' | 'overdue' | 'history' | 'fines';
/** Loan rows come with the book under book_copy.book (or book) and issued/returned timestamps. */
type LoanRow = BookLoan & { issued_at?: string; returned_at?: string | null; book_copy?: { book?: { title?: string; author?: string } }; book?: { title?: string; author?: string } };

function LoanCard({ loan, showStatus, last }: { loan: LoanRow; showStatus: boolean; last: boolean }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_lb_${key}`, o);
  const returned = loan.returned_at ?? null;
  const days = loan.due_date && !returned ? daysUntil(loan.due_date) : null;
  const overdue = days !== null && days < 0;
  const book = loan.book_copy?.book || loan.book || {};
  return (
    <View className={cn('flex-row items-start gap-3 px-4 py-3', !last && 'border-info-soft dark:border-border border-b')}>
      <IconTile icon={BookOpen} tone={returned ? 'success' : overdue ? 'destructive' : 'brand'} size={40} />
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold">{book.title || k('unknown')}</Text>
        {book.author ? <Text className="text-muted-foreground text-xs">{book.author}</Text> : null}
        <View className="mt-1 flex-row flex-wrap gap-x-2 gap-y-1">
          {loan.issued_at ? <Text className="text-muted-foreground text-xs">{k('issued', { date: formatDate(loan.issued_at) })}</Text> : null}
          {loan.due_date ? (
            <Text className={cn('text-xs', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
              {`${k('due', { date: formatDate(loan.due_date) })}${days !== null ? ` ${overdue ? k('days_overdue', { count: Math.abs(days) }) : k('days_left', { count: days })}` : ''}`}
            </Text>
          ) : null}
          {returned ? <Text className="text-success text-xs">{k('returned', { date: formatDate(returned) })}</Text> : null}
        </View>
      </View>
      {showStatus ? <StatusChip label={returned ? k('s_returned') : overdue ? k('s_overdue') : k('s_active')} tone={returned ? 'success' : overdue ? 'destructive' : 'info'} /> : null}
    </View>
  );
}

/** Active / overdue loans, loan history and unpaid fines (web: /student/library). */
export default function StudentLibrary() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_lb_${key}`, o);
  const { money } = usePortalCurrency();
  const { me } = useSession();
  // library_loans.student_id is the borrower's profile id.
  const pid = me.status === 'ready' ? me.me.profile.id : null;
  const [tab, setTab] = useState<Tab>('active');
  const active = useApi(pid ? ['student', 'loans-active', pid] : null, ([, , id]) => adminLibrary.activeLoans(id as string));
  const overdue = useApi(pid ? ['student', 'loans-overdue', pid] : null, ([, , id]) => adminLibrary.overdueLoans(id as string));
  const history = useApi(pid && tab === 'history' ? ['student', 'loans-history', pid] : null, ([, , id]) => adminLibrary.loanHistory(id as string));
  const fines = useApi(pid && tab === 'fines' ? ['student', 'fines', pid] : null, ([, , id]) => adminLibrary.unpaidFines(id as string));

  const cur = tab === 'active' ? active : tab === 'overdue' ? overdue : tab === 'history' ? history : fines;
  const nActive = (active.data ?? []).length;
  const nOverdue = (overdue.data ?? []).length;
  const count = (n: number) => (n > 0 ? ` (${n})` : '');

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => cur.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <StatTiles>
          <StatTile icon={BookOpen} label={k('tab_active')} value={String(nActive)} note={k('active_n', { count: nActive })} onPress={() => setTab('active')} />
          {nOverdue > 0 ? <StatTile icon={AlertCircle} tone="destructive" label={k('tab_overdue')} value={String(nOverdue)} note={k('overdue_n', { count: nOverdue })} onPress={() => setTab('overdue')} /> : null}
        </StatTiles>
        <FilterChips<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: `${k('tab_active')}${count(nActive)}` },
            { value: 'overdue', label: `${k('tab_overdue')}${count(nOverdue)}` },
            { value: 'history', label: k('tab_history') },
            { value: 'fines', label: k('tab_fines') },
          ]}
        />
        {!pid ? (
          <EmptyState icon={Library} title={k('no_profile')} />
        ) : cur.isLoading ? (
          <LoadingList rows={4} />
        ) : tab === 'fines' ? (
          (fines.data ?? []).length === 0 ? (
            <EmptyState icon={CheckCircle} title={k('no_fines')} body={k('no_fines_body')} />
          ) : (
            <Panel>
              {(fines.data ?? []).map((f, i, arr) => (
                <View key={f.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <IconTile icon={Receipt} tone="warning" size={40} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold">{f.reason || k('fine')}</Text>
                    <Text className="text-muted-foreground text-xs">{f.created_at ? formatDate(f.created_at) : ''}</Text>
                  </View>
                  <StatusChip label={money(f.amount || 0)} tone="warning" />
                </View>
              ))}
            </Panel>
          )
        ) : ((cur.data ?? []) as LoanRow[]).length === 0 ? (
          <EmptyState icon={BookOpen} title={tab === 'active' ? k('no_active') : tab === 'overdue' ? k('no_overdue') : k('no_history')} />
        ) : (
          <Panel>
            {((cur.data ?? []) as LoanRow[]).map((loan, i, arr) => (
              <LoanCard key={loan.id} loan={loan} showStatus={tab === 'history'} last={i === arr.length - 1} />
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
