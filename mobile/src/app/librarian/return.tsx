import type { LibraryStudentHit } from '@studently/api-client';
import type { BookLoan } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { AlertTriangle, BookOpen, Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField, todayYmd } from '@/components/app/date-field';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isLibraryKey } from '@/features/admin/library';
import { ActiveLoansCard, daysPast, StudentSelectCard } from '@/features/library/librarian';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Web: a flat $0.50 a day estimate shown before returning (the server applies the school's own fine rules). */
const FINE_PER_DAY = 0.5;

/** Return a book: pick the student, one of their active loans, see the overdue fine, return (web: /librarian/return). */
export default function LibrarianReturn() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.li_${key}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [now] = useState(() => Date.now());
  const [student, setStudent] = useState<LibraryStudentHit | null>(null);
  const [loan, setLoan] = useState<BookLoan | null>(null);
  const [date, setDate] = useState(todayYmd);
  const [busy, setBusy] = useState(false);
  const studentId = student?.id ?? null;
  const loans = useApi(studentId ? ['librarian', 'active-loans', studentId] : null, ([, , s]) => adminLibrary.activeLoans(s as string));
  const fine = (l: BookLoan) => daysPast(l.due_date, now) * FINE_PER_DAY;

  async function doReturn() {
    if (!loan) return toast.error(k('select_loan'));
    setBusy(true);
    const r = await adminLibrary.returnBook(loan.id, { return_condition: 'good', collected_amount: 0 });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('return_failed'));
    toast.success(k('returned_ok'));
    setLoan(null);
    loans.mutate();
    mutate(isLibraryKey);
  }

  const over = loan ? daysPast(loan.due_date, now) : 0;
  return (
    <>
      <Stack.Screen options={{ title: k('return_book') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{k('return_subtitle')}</Text>
        <StudentSelectCard
          value={student}
          onChange={(s) => {
            setStudent(s);
            setLoan(null);
          }}
          extra={
            student ? (
              <Badge variant="outline" className="mt-1 self-start">
                <Text className="text-xs">{k('active_loan_count', { count: (loans.data ?? []).length })}</Text>
              </Badge>
            ) : null
          }
        />
        <ActiveLoansCard studentId={studentId} selected={loan} onSelect={setLoan} now={now} fine={fine} />
        {loan ? (
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Icon as={Calendar} className="size-5" />
              <CardTitle className="text-base">{k('return_details')}</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              <DateField label={k('return_date')} value={date} onChange={setDate} />
              {over > 0 ? (
                <View className="gap-1 rounded-lg border border-red-200 bg-red-50 p-3 dark:bg-red-950/30">
                  <View className="flex-row items-center gap-2">
                    <Icon as={AlertTriangle} className="size-4 text-red-600" />
                    <Text className="font-medium text-red-800 dark:text-red-200">{k('overdue_book')}</Text>
                  </View>
                  <Text className="text-sm text-red-700 dark:text-red-300">{k('days_overdue_text', { count: over })}</Text>
                  <Text className="text-sm font-medium text-red-800 dark:text-red-200">{k('fine_amount', { amount: fine(loan).toFixed(2) })}</Text>
                </View>
              ) : (
                <View className="gap-1 rounded-lg border border-green-200 bg-green-50 p-3 dark:bg-green-950/30">
                  <View className="flex-row items-center gap-2">
                    <Icon as={BookOpen} className="size-4 text-green-600" />
                    <Text className="font-medium text-green-800 dark:text-green-200">{k('on_time')}</Text>
                  </View>
                  <Text className="text-sm text-green-700 dark:text-green-300">{k('on_time_desc')}</Text>
                </View>
              )}
              <View className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={() => setLoan(null)}>
                  <Text>{t('common.cancel')}</Text>
                </Button>
                <Button className="flex-1" onPress={doReturn} disabled={busy}>
                  <Text>{busy ? k('returning') : k('return_book')}</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
