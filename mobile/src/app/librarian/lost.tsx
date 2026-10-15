import type { LibraryStudentHit } from '@studently/api-client';
import type { BookLoan } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { AlertTriangle, BookX } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { isLibraryKey } from '@/features/admin/library';
import { ActiveLoansCard, StudentSelectCard } from '@/features/library/librarian';
import { adminLibrary } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** Web: a fixed processing fee added to the replacement cost. */
const PROCESSING_FEE = 10;

/** Mark a student's loaned book lost and charge its replacement cost (web: /librarian/lost). */
export default function LibrarianLost() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.li_${key}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [now] = useState(() => Date.now());
  const [student, setStudent] = useState<LibraryStudentHit | null>(null);
  const [loan, setLoan] = useState<BookLoan | null>(null);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function markLost() {
    if (!loan) return toast.error(k('select_loan_lost'));
    const c = parseFloat(cost);
    if (!cost || !(c > 0)) return toast.error(k('enter_cost'));
    setBusy(true);
    const r = await adminLibrary.markLost(loan.id, { replacement_cost: c, processing_fee: PROCESSING_FEE, notes: notes.trim() || undefined });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('lost_failed'));
    toast.success(k('lost_ok'));
    setLoan(null);
    setCost('');
    setNotes('');
    mutate(isLibraryKey);
    mutate((key) => Array.isArray(key) && key[0] === 'librarian' && key[1] === 'active-loans');
  }

  return (
    <>
      <Stack.Screen options={{ title: k('lost_books') }} />
      <KeyboardAvoidingView className="bg-background flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text variant="muted">{k('lost_subtitle')}</Text>
          <StudentSelectCard
            tone="orange"
            value={student}
            onChange={(s) => {
              setStudent(s);
              setLoan(null);
            }}
          />
          <ActiveLoansCard studentId={student?.id ?? null} selected={loan} onSelect={setLoan} now={now} />
          {loan ? (
            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <Icon as={BookX} className="size-5 text-red-600" />
                <CardTitle className="text-base">{k('mark_book_lost')}</CardTitle>
              </CardHeader>
              <CardContent className="gap-3">
                <View className="bg-muted/50 gap-1 rounded-lg p-3">
                  <Text className="font-medium">{k('book_details')}</Text>
                  <Text className="text-sm">{`${k('title')}: ${loan.book_title ?? ''}`}</Text>
                  <Text className="text-sm">{`${k('copy')}: ${loan.accession_number ?? '—'}`}</Text>
                  <Text className="text-sm">{`${k('due_date')}: ${formatDate(loan.due_date)}`}</Text>
                </View>
                <View className="gap-1.5">
                  <Label>{k('replacement_cost')}</Label>
                  <Input value={cost} onChangeText={(v) => setCost(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
                </View>
                <View className="gap-1.5">
                  <Label>{k('notes_optional')}</Label>
                  <Textarea value={notes} onChangeText={setNotes} placeholder={k('lost_notes_placeholder')} />
                </View>
                <View className="gap-1 rounded-lg border border-red-200 bg-red-50 p-3 dark:bg-red-950/30">
                  <View className="flex-row items-center gap-2">
                    <Icon as={AlertTriangle} className="size-4 text-red-600" />
                    <Text className="font-medium text-red-800 dark:text-red-200">{k('important_notice')}</Text>
                  </View>
                  <Text className="text-sm text-red-700 dark:text-red-300">{k('lost_notice_intro')}</Text>
                  {(['lost_notice_1', 'lost_notice_2', 'lost_notice_3'] as const).map((n) => (
                    <Text key={n} className="ms-3 text-sm text-red-700 dark:text-red-300">{`• ${k(n)}`}</Text>
                  ))}
                  <Text className="mt-1 text-sm text-red-700 dark:text-red-300">{k('lost_notice_4')}</Text>
                </View>
                <View className="flex-row gap-2">
                  <Button variant="outline" className="flex-1" onPress={() => setLoan(null)}>
                    <Text>{t('common.cancel')}</Text>
                  </Button>
                  <Button variant="destructive" className="flex-1" onPress={markLost} disabled={busy}>
                    <Text className="text-white">{busy ? k('processing') : k('mark_as_lost')}</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
