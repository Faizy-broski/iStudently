import type { LibraryStudentHit } from '@studently/api-client';
import type { BookLoan } from '@studently/shared-types';
import { BookOpen, User, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const box = tone === 'green' ? 'border-green-200 bg-green-50 dark:bg-green-950/30' : 'border-orange-200 bg-orange-50 dark:bg-orange-950/30';
  const ink = tone === 'green' ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200';
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Icon as={User} className="size-5" />
        <CardTitle className="text-base">{k('select_student')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        {value ? (
          <View className={cn('gap-1 rounded-lg border p-3', box)}>
            <View className="flex-row items-center gap-2">
              <Icon as={User} className={cn('size-4', ink)} />
              <Text className={cn('flex-1 font-medium', ink)}>{k('selected_student')}</Text>
              <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={t('app.ss_change')}>
                <Icon as={X} className={cn('size-4', ink)} />
              </Pressable>
            </View>
            <Text className={cn('text-sm', ink)}>{`${studentName(value)} (${value.admission_number})`}</Text>
            {extra}
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
                className="border-border rounded-lg border p-3">
                <Text className="font-medium">{studentName(s)}</Text>
                <Text className="text-muted-foreground text-sm">{`${k('id')}: ${s.admission_number}`}</Text>
              </Pressable>
            ))}
            {term && !res.isLoading && !(res.data ?? []).length ? <Text className="text-muted-foreground text-sm">{k('no_students')}</Text> : null}
          </>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Icon as={BookOpen} className="size-5" />
        <CardTitle className="text-base">{k('active_loans')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-2">
        {res.isLoading ? (
          <LoadingList rows={2} />
        ) : !loans.length ? (
          <View className="items-center py-6">
            <Icon as={BookOpen} className="text-muted-foreground mb-3 size-10" />
            <Text className="text-muted-foreground">{k('no_active_loans')}</Text>
            {studentId ? <Text className="text-muted-foreground mt-1 text-sm">{k('no_books_issued')}</Text> : null}
          </View>
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
                className={cn('gap-1 rounded-lg border p-3', selected?.id === l.id ? 'border-primary bg-primary/5' : 'border-border')}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-medium">{l.book_title}</Text>
                    <Text className="text-muted-foreground text-xs">{`${k('copy')}: ${l.accession_number ?? '—'}`}</Text>
                  </View>
                  <Badge variant={over > 0 ? 'destructive' : 'secondary'}>
                    <Text className="text-xs">{over > 0 ? k('overdue') : k('active')}</Text>
                  </Badge>
                </View>
                <View className="flex-row flex-wrap gap-3">
                  <Text className="text-muted-foreground text-xs">{`${k('due')}: ${formatDate(l.due_date)}`}</Text>
                  {f > 0 ? <Text className="text-xs font-medium text-red-600">{k('fine_amount', { amount: f.toFixed(2) })}</Text> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

