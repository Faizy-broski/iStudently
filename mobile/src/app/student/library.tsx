import type { BookLoan } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { AlertCircle, BookOpen, CheckCircle, Library } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
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

function LoanCard({ loan, showStatus }: { loan: LoanRow; showStatus: boolean }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_lb_${key}`, o);
  const returned = loan.returned_at ?? null;
  const days = loan.due_date && !returned ? daysUntil(loan.due_date) : null;
  const overdue = days !== null && days < 0;
  const book = loan.book_copy?.book || loan.book || {};
  return (
    <Card className={cn('py-3', overdue && 'border-red-200')}>
      <CardContent className="flex-row items-start gap-3 px-3">
        <View className="bg-primary/10 rounded-lg p-2">
          <Icon as={BookOpen} className="text-primary size-5" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold">{book.title || k('unknown')}</Text>
          {book.author ? <Text className="text-muted-foreground text-xs">{book.author}</Text> : null}
          <View className="mt-2 flex-row flex-wrap gap-x-2 gap-y-1">
            {loan.issued_at ? <Text className="text-muted-foreground text-xs">{k('issued', { date: formatDate(loan.issued_at) })}</Text> : null}
            {loan.due_date ? (
              <Text className={cn('text-xs', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                {`${k('due', { date: formatDate(loan.due_date) })}${days !== null ? ` ${overdue ? k('days_overdue', { count: Math.abs(days) }) : k('days_left', { count: days })}` : ''}`}
              </Text>
            ) : null}
            {returned ? <Text className="text-xs text-green-600">{k('returned', { date: formatDate(returned) })}</Text> : null}
          </View>
        </View>
        {showStatus ? (
          <View className={cn('rounded-full border px-2 py-0.5', returned ? 'border-green-400' : overdue ? 'border-red-400' : 'border-blue-400')}>
            <Text className={cn('text-xs', returned ? 'text-green-600' : overdue ? 'text-red-600' : 'text-blue-600')}>{returned ? k('s_returned') : overdue ? k('s_overdue') : k('s_active')}</Text>
          </View>
        ) : null}
      </CardContent>
    </Card>
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => cur.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <View className="flex-row items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 dark:bg-blue-950/20">
            <Icon as={BookOpen} className="size-4 text-blue-600" />
            <Text className="text-sm font-medium text-blue-700">{k('active_n', { count: nActive })}</Text>
          </View>
          {nOverdue > 0 ? (
            <View className="flex-row items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 dark:bg-red-950/20">
              <Icon as={AlertCircle} className="size-4 text-red-600" />
              <Text className="text-sm font-medium text-red-700">{k('overdue_n', { count: nOverdue })}</Text>
            </View>
          ) : null}
        </View>
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
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={Library} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground">{k('no_profile')}</Text>
            </CardContent>
          </Card>
        ) : cur.isLoading ? (
          <LoadingList rows={4} />
        ) : tab === 'fines' ? (
          (fines.data ?? []).length === 0 ? (
            <Card>
              <CardContent className="items-center py-10">
                <Icon as={CheckCircle} className="mb-2 size-10 text-green-500" />
                <Text className="font-medium">{k('no_fines')}</Text>
                <Text className="text-muted-foreground mt-1 text-sm">{k('no_fines_body')}</Text>
              </CardContent>
            </Card>
          ) : (
            (fines.data ?? []).map((f) => (
              <Card key={f.id} className="border-orange-200 py-3">
                <CardContent className="flex-row items-start justify-between gap-3 px-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{f.reason || k('fine')}</Text>
                    <Text className="text-muted-foreground mt-1 text-xs">{f.created_at ? formatDate(f.created_at) : ''}</Text>
                  </View>
                  <View className="rounded-full border border-orange-400 px-2 py-0.5">
                    <Text className="text-sm font-bold text-orange-600">{money(f.amount || 0)}</Text>
                  </View>
                </CardContent>
              </Card>
            ))
          )
        ) : ((cur.data ?? []) as LoanRow[]).length === 0 ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={BookOpen} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground">{tab === 'active' ? k('no_active') : tab === 'overdue' ? k('no_overdue') : k('no_history')}</Text>
            </CardContent>
          </Card>
        ) : (
          ((cur.data ?? []) as LoanRow[]).map((loan) => <LoanCard key={loan.id} loan={loan} showStatus={tab === 'history'} />)
        )}
      </ScrollView>
    </>
  );
}
