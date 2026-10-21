import type { LibraryLoanRow } from '@studently/api-client';
import { AlertTriangle, BookOpen, Clock, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/app/status-chip';
import { Panel } from '@/components/app/panel';
import { FilterChips } from '@/components/app/filter-chips';
import { IconTile, RoundIcon, StatTile, StatTiles } from '@/components/app/layout';
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
    const tone = od || l.status === 'lost' ? 'destructive' : l.status === 'returned' ? 'success' : 'info';
    return <StatusChip label={label} tone={tone} className="px-2 py-0.5" />;
  };
  const statusOptions = [
    { value: 'all', label: o('filters.all_loans') },
    { value: 'active', label: o('filters.active_issued') },
    { value: 'overdue', label: o('status.overdue') },
    { value: 'returned', label: o('status.returned') },
    { value: 'lost', label: o('status.lost') },
  ];

  return (
    <View className="gap-4">
        {title ? <Text className="text-lg font-semibold">{o('loan_directory')}</Text> : null}
        <StatTiles>
          <StatTile icon={BookOpen} label={o('status.active')} value={String(all.filter((l) => l.status === 'active').length)} onPress={() => setStatus('active')} />
          <StatTile icon={AlertTriangle} tone="destructive" label={o('status.overdue')} value={String(all.filter(isOverdue).length)} onPress={() => setStatus('overdue')} />
          <StatTile icon={Clock} tone="success" label={o('status.returned')} value={String(all.filter((l) => l.status === 'returned').length)} onPress={() => setStatus('returned')} />
          <StatTile icon={BookOpen} tone="muted" label={o('status.lost')} value={String(all.filter((l) => l.status === 'lost').length)} onPress={() => setStatus('lost')} />
        </StatTiles>
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <SearchBar value={search} onChangeText={setSearch} placeholder={o('filters.search_placeholder')} />
          </View>
          <RoundIcon icon={RefreshCw} label={o('refresh')} onPress={() => loans.mutate()} />
        </View>
        <FilterChips value={status} onChange={setStatus} options={statusOptions} />

        {loans.isLoading ? (
          <LoadingList />
        ) : loans.error ? (
          <ErrorState message={o('errors.load_loans')} onRetry={() => loans.mutate()} />
        ) : !filtered.length ? (
          <EmptyState icon={BookOpen} title={o('no_loans')} />
        ) : (
          <>
            <Panel>
              {shown.map((l, i) => {
                const od = isOverdue(l);
                return (
                  <View key={l.id} className={i > 0 ? 'border-info-soft dark:border-border border-t' : ''}>
                    <View className="flex-row items-center gap-3 px-4 py-3">
                      <IconTile icon={BookOpen} tone={od ? 'destructive' : l.status === 'returned' ? 'success' : l.status === 'lost' ? 'muted' : 'brand'} size={40} />
                      <View className="flex-1 gap-0.5">
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                          {l.book_title}
                        </Text>
                        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                          {[l.student_name, l.student_number || o('na'), `${o('table.accession')} ${l.accession_number}`].filter(Boolean).join(' · ')}
                        </Text>
                        <Text variant="muted" className="text-[11px]">
                          {o('table.issue_date')}: {date(l.issue_date)} · {o('table.due_date')}: {date(l.due_date)}
                          {od ? ` · ${daysOverdue(l.due_date)} ${o('days')}` : ''}
                        </Text>
                      </View>
                      {badge(l)}
                    </View>
                  </View>
                );
              })}
            </Panel>
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
