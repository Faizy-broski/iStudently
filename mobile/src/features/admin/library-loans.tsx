import type { LibraryLoanRow } from '@studently/api-client';
import { AlertTriangle, BookOpen, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useResetOn } from '@/lib/use-reset-on';

const PER_PAGE = 10;

export const isOverdueLoan = (l: LibraryLoanRow) => l.status === 'active' && new Date(l.due_date) < new Date();
const daysOverdue = (due: string) => {
  const d = new Date(due);
  const now = new Date();
  return d >= now ? 0 : Math.ceil((now.getTime() - d.getTime()) / 86_400_000);
};

/** Loans of the selected campus: search, status filter, counters, paged list (web: library overview + /admin/library/loans). */
export function LoanDirectory({ title = true }: { title?: boolean }) {
  const { t, i18n } = useTranslation();
  const o = (k: string, v?: Record<string, unknown>) => t(`admin.library.overview.${k}`, v);
  const { campusId } = useCampus();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const loans = useApi(['admin', 'library-loans', campusId ?? 'school', status], ([, , , st]) =>
    adminLibrary.loans({ campus_id: campusId, status: st === 'all' ? undefined : st === 'overdue' ? 'active' : (st as string) }),
  );
  useResetOn(JSON.stringify([search, status, campusId]), () => setPage(1));

  const fetched = (loans.data ?? []).filter((l) => (status === 'overdue' ? isOverdueLoan(l) : true));
  const q = search.trim().toLowerCase();
  const filtered = q ? fetched.filter((l) => [l.book_title, l.student_name, l.student_number, l.accession_number].some((x) => x?.toLowerCase().includes(q))) : fetched;
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const start = (page - 1) * PER_PAGE;
  const shown = filtered.slice(start, start + PER_PAGE);
  const all = loans.data ?? [];
  const date = (d: string) => new Date(d).toLocaleDateString(i18n.language);
  const isOverdue = isOverdueLoan;

  const badge = (l: LibraryLoanRow) => {
    const od = isOverdue(l);
    const label = od ? o('status.overdue') : o(`status.${l.status}`, { defaultValue: l.status });
    const tone = od || l.status === 'lost' ? 'bg-destructive' : l.status === 'returned' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-blue-100 dark:bg-blue-900/30';
    return (
      <View className={`rounded-full px-2 py-0.5 ${tone}`}>
        <Text className={`text-xs ${od || l.status === 'lost' ? 'text-white' : ''}`}>{label}</Text>
      </View>
    );
  };
  const counter = (icon: typeof BookOpen, label: string, n: number, tone: string) => (
    <Card className="min-w-[46%] flex-1">
      <CardContent className="flex-row items-center gap-2 pt-4">
        <Icon as={icon} className={`size-4 ${tone}`} />
        <Text className="flex-1 text-sm">{label}</Text>
        <Text className="font-bold">{n}</Text>
      </CardContent>
    </Card>
  );

  return (
    <View className="gap-4">
        {title ? <Text className="text-lg font-semibold">{o('loan_directory')}</Text> : null}
        <SearchBar value={search} onChangeText={setSearch} placeholder={o('filters.search_placeholder')} />
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Picker
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: o('filters.all_loans') },
                { value: 'active', label: o('filters.active_issued') },
                { value: 'overdue', label: o('status.overdue') },
                { value: 'returned', label: o('status.returned') },
                { value: 'lost', label: o('status.lost') },
              ]}
            />
          </View>
          <Button variant="outline" onPress={() => loans.mutate()}>
            <Text>{o('refresh')}</Text>
          </Button>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {counter(BookOpen, o('status.active'), all.filter((l) => l.status === 'active').length, 'text-blue-600')}
          {counter(AlertTriangle, o('status.overdue'), all.filter(isOverdue).length, 'text-red-600')}
          {counter(Clock, o('status.returned'), all.filter((l) => l.status === 'returned').length, 'text-emerald-600')}
          {counter(BookOpen, o('status.lost'), all.filter((l) => l.status === 'lost').length, 'text-gray-600')}
        </View>

        {loans.isLoading ? (
          <LoadingList />
        ) : loans.error ? (
          <ErrorState message={o('errors.load_loans')} onRetry={() => loans.mutate()} />
        ) : !filtered.length ? (
          <EmptyState icon={BookOpen} title={o('no_loans')} />
        ) : (
          <>
            <Card className="py-0">
              {shown.map((l, i) => {
                const od = isOverdue(l);
                return (
                  <View key={l.id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="gap-1 px-4 py-3">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 font-medium">{l.book_title}</Text>
                        {badge(l)}
                      </View>
                      <Text className="text-muted-foreground text-sm">
                        {[l.student_name, l.student_number || o('na'), `${o('table.accession')} ${l.accession_number}`].filter(Boolean).join(' · ')}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {o('table.issue_date')}: {date(l.issue_date)} · {o('table.due_date')}: {date(l.due_date)}
                        {od ? ` · ${daysOverdue(l.due_date)} ${o('days')}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
            {pages > 1 ? (
              <View className="flex-row items-center gap-2">
                <Text className="text-muted-foreground flex-1 text-xs">{o('showing', { start: start + 1, end: Math.min(start + PER_PAGE, filtered.length), total: filtered.length })}</Text>
                <Button size="sm" variant="outline" disabled={page === 1} onPress={() => setPage((p) => p - 1)}>
                  <Text>{t('common.previous')}</Text>
                </Button>
                <Button size="sm" variant="outline" disabled={page === pages} onPress={() => setPage((p) => p + 1)}>
                  <Text>{t('common.next')}</Text>
                </Button>
              </View>
            ) : null}
          </>
        )}
    </View>
  );
}
