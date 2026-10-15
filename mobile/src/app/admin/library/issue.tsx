import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, BookOpen, CheckCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { BorrowerSearch, isLibraryKey, type Borrower } from '@/features/admin/library';
import { useCurrency } from '@/features/admin/use-currency';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { todayIso } from '@studently/shared-utils';

/** Issue a book to a student or staff member after an eligibility check (web: Issue Book dialog). */
export default function LibraryIssue() {
  const { t } = useTranslation();
  const toast = useToast();
  const { money } = useCurrency();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const book = useApi(id ? ['admin', 'library-book', id] : null, ([, , bid]) => adminLibrary.book(bid as string));
  const [type, setType] = useState<'student' | 'user'>('student');
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const borrowerId = borrower ? borrower.id : null;
  const elig = useApi(borrowerId ? ['admin', 'library-eligibility', borrowerId] : null, ([, , sid]) => adminLibrary.eligibility(sid as string));
  const e = elig.data;

  async function issue() {
    if (!id || !borrower || !due) return;
    if (!e?.eligible) return toast.error(e?.message || t('app.lb_not_eligible'));
    setSaving(true);
    try {
      const r = await adminLibrary.issue({ book_id: id, student_id: type === 'student' ? borrower.id : undefined, borrower_type: type, borrower_id: borrower.id, due_date: due, notes: notes || undefined });
      if (!r.success) return toast.error(r.error || t('app.lb_issue_failed'));
      toast.success(t('app.lb_issued_to', { name: borrower.name }));
      await mutate(isLibraryKey);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (book.isLoading) return <LoadingList />;
  const b = book.data;
  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.lb_issue_book') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{t('app.lb_issue_desc')}</Text>
        <FilterChips
          value={type}
          onChange={(v) => {
            setType(v);
            setBorrower(null);
          }}
          options={[
            { value: 'student', label: t('app.lb_student') },
            { value: 'user', label: t('app.lb_staff_other') },
          ]}
        />
        {b ? (
          <Card>
            <CardContent className="gap-1 pt-4">
              <View className="flex-row items-center gap-2">
                <Icon as={BookOpen} className="text-primary size-4" />
                <Text className="font-semibold">{t('app.lb_book_details')}</Text>
              </View>
              <Text className="text-sm">{t('app.lb_title')}: {b.title}</Text>
              <Text className="text-sm">{t('app.lb_author')}: {b.author}</Text>
              <Text className="text-sm">{t('app.lb_available_copies')}: {b.available_copies}</Text>
            </CardContent>
          </Card>
        ) : null}
        <View className="gap-1.5">
          <Label>{type === 'student' ? t('app.lb_search_student_req') : t('app.lb_search_user_req')}</Label>
          <BorrowerSearch type={type} value={borrower} onChange={setBorrower} />
        </View>
        {borrower ? (
          elig.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('app.lb_checking_eligibility')}</Text>
          ) : e ? (
            <View className={`gap-1 rounded-md border p-3 ${e.eligible ? 'border-green-200 bg-green-50 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:bg-red-950/30'}`}>
              <View className="flex-row items-center gap-2">
                <Icon as={e.eligible ? CheckCircle : AlertTriangle} className={`size-4 ${e.eligible ? 'text-green-700' : 'text-red-700'}`} />
                <Text className={`flex-1 text-sm font-medium ${e.eligible ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>{e.message}</Text>
              </View>
              {e.active_loans !== undefined ? <Text className="text-xs">{t('app.lb_active_loans', { count: e.active_loans, max: e.max_books || 3 })}</Text> : null}
              {e.unpaid_fines ? <Text className="text-xs">{t('app.lb_unpaid_fines', { amount: money(e.unpaid_fines) })}</Text> : null}
              {(e.warnings ?? []).map((w) => (
                <Text key={w} className="text-xs text-amber-700">• {w}</Text>
              ))}
            </View>
          ) : null
        ) : null}
        <DateField label={t('app.lb_due_date_req')} value={due} onChange={setDue} min={todayIso()} />
        <View className="gap-1.5">
          <Label>{t('app.lb_notes_optional')}</Label>
          <Textarea value={notes} onChangeText={setNotes} placeholder={t('app.lb_notes_ph')} />
        </View>
        <Button onPress={issue} disabled={saving || !borrower || !due || !e?.eligible || elig.isLoading}>
          <Text>{saving ? t('app.lb_issuing') : t('app.lb_issue_book')}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
