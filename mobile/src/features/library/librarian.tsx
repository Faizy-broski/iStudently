import type { LibraryStudentHit } from '@studently/api-client';
import type { BookLoan } from '@studently/shared-types';
import { BookOpen, User, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { FormSection, Initials } from '@/components/app/layout';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

export const daysPast = (due: string, now: number) => Math.max(0, Math.ceil((now - new Date(due).getTime()) / 86_400_000));
export const studentName = (s: Pick<LibraryStudentHit, 'first_name' | 'last_name'>) => `${s.first_name} ${s.last_name}`.trim();

/** "Select Student" card of the librarian issue / return / lost pages: search by name or ID, pick one. */
export function StudentSelectCard({
  value,
  onChange,
  tone = 'green',
  extra,
}: {
  value: LibraryStudentHit | null;
  onChange: (s: LibraryStudentHit | null) => void;
  tone?: 'green' | 'orange';
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.li_${key}`);
  const { campusId } = useCampus();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const res = useApi(term && !value ? ['librarian', 'student-search', term, campusId ?? 'school'] : null, ([, , s]) => adminLibrary.searchStudents(s as string, campusId ?? undefined));
  return (
    <FormSection title={k('select_student')} icon={User}>
      {value ? (
        <View className="flex-row items-center gap-3">
          <Initials name={studentName(value) || '?'} size={44} tone={tone === 'green' ? 'warning' : 'destructive'} />
          <View className="flex-1 gap-0.5">
            <Text className="font-semibold" numberOfLines={1}>
              {studentName(value)}
            </Text>
            <Text variant="muted" className="text-xs" numberOfLines={1}>
              {[value.class_name, value.admission_number].filter(Boolean).join(' · ')}
            </Text>
            {extra}
          </View>
          <Pressable onPress={() => onChange(null)} hitSlop={8} className="bg-muted size-9 items-center justify-center rounded-full active:opacity-70" accessibilityLabel={t('app.ss_change')}>
            <Icon as={X} className="text-muted-foreground size-4" />
          </Pressable>
        </View>
      ) : (
        <>
          <SearchBar value={q} onChangeText={setQ} placeholder={k('student_search_placeholder')} />
          {res.isLoading ? <Text className="text-muted-foreground text-sm">{k('searching')}</Text> : null}
          {(res.data ?? []).map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                onChange(s);
                setQ('');
              }}
              accessibilityRole="button"
              className="border-info-soft dark:border-border flex-row items-center gap-3 rounded-xl border p-3 active:opacity-70">
              <Initials name={studentName(s) || '?'} size={36} />
              <View className="flex-1">
                <Text className="text-sm font-semibold">{studentName(s)}</Text>
                <Text className="text-muted-foreground text-xs">{`${k('id')}: ${s.admission_number}`}</Text>
              </View>
            </Pressable>
          ))}
          {term && !res.isLoading && !(res.data ?? []).length ? <Text className="text-muted-foreground text-sm">{k('no_students')}</Text> : null}
        </>
      )}
    </FormSection>
  );
}

/** A student's active loans to pick from (librarian return / lost pages). */
export function ActiveLoansCard({
  studentId,
  selected,
  onSelect,
  now,
  fine,
}: {
  studentId: string | null;
  selected: BookLoan | null;
  onSelect: (l: BookLoan) => void;
  now: number;
  /** Estimated overdue fine shown under a loan (return page). */
  fine?: (l: BookLoan) => number;
}) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.li_${key}`, o);
  const res = useApi(studentId ? ['librarian', 'active-loans', studentId] : null, ([, , s]) => adminLibrary.activeLoans(s as string));
  const loans = res.data ?? [];
  return (
    <FormSection title={k('active_loans')} icon={BookOpen} className="gap-2">
      {res.isLoading ? (
        <LoadingList rows={2} />
      ) : !loans.length ? (
        <EmptyState icon={BookOpen} title={k('no_active_loans')} body={studentId ? k('no_books_issued') : undefined} />
      ) : (
        loans.map((l) => {
          const over = daysPast(l.due_date, now);
          const f = fine?.(l) ?? 0;
          return (
            <Pressable
              key={l.id}
              onPress={() => onSelect(l)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected?.id === l.id }}
              className={cn('gap-1 rounded-xl border p-3 active:opacity-70', selected?.id === l.id ? 'border-brand-secondary bg-info-soft' : 'border-info-soft dark:border-border')}>
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{l.book_title}</Text>
                  <Text className="text-muted-foreground text-xs">{`${k('copy')}: ${l.accession_number ?? '—'}`}</Text>
                </View>
                <StatusChip label={over > 0 ? k('overdue') : k('active')} tone={over > 0 ? 'destructive' : 'success'} />
              </View>
              <View className="flex-row flex-wrap gap-3">
                <Text className="text-muted-foreground text-xs">{`${k('due')}: ${formatDate(l.due_date)}`}</Text>
                {f > 0 ? <Text className="text-xs font-medium text-destructive">{k('fine_amount', { amount: f.toFixed(2) })}</Text> : null}
              </View>
            </Pressable>
          );
        })
      )}
    </FormSection>
  );
}

