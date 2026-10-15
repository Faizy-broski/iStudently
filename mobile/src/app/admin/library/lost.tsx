import type { LibraryLoanRow } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { ActiveLoanSearch, isLibraryKey } from '@/features/admin/library';
import { useCurrency } from '@/features/admin/use-currency';
import { adminLibrary } from '@/lib/api';

/** Mark an issued book as lost and charge replacement + processing fee (web: Mark Lost dialog). */
export default function LibraryLost() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();
  const { mutate } = useSWRConfig();
  const [loan, setLoan] = useState<LibraryLoanRow | null>(null);
  const [replacement, setReplacement] = useState('0');
  const [fee, setFee] = useState('5');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const pick = (l: LibraryLoanRow | null) => {
    setLoan(l);
    setReplacement(String(l?.book_price ?? 0));
  };
  const rep = parseFloat(replacement) || 0;
  const proc = parseFloat(fee) || 0;

  async function submit() {
    if (!loan) return;
    if (!(await confirm({ title: t('app.lb_mark_lost'), body: t('app.lb_lost_warning'), destructive: true, confirmLabel: t('app.lb_mark_lost') }))) return;
    setSaving(true);
    try {
      const r = await adminLibrary.markLost(loan.id, { replacement_cost: rep, processing_fee: proc, notes: notes || undefined });
      if (!r.success) return toast.error(r.error || t('app.lb_lost_failed'));
      toast.success(t('app.lb_lost_done'));
      await mutate(isLibraryKey);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const date = (d?: string) => (d ? new Date(d).toLocaleDateString(i18n.language) : '—');
  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.lb_mark_lost_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{t('app.lb_lost_desc')}</Text>
        <View className="flex-row gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:bg-red-950/30">
          <Icon as={AlertTriangle} className="size-4 text-red-600" />
          <Text className="flex-1 text-sm text-red-800 dark:text-red-300">{t('app.lb_lost_warning')}</Text>
        </View>
        <View className="gap-1.5">
          <Label>{t('app.lb_search_issued')}</Label>
          <ActiveLoanSearch value={loan} onChange={pick} />
        </View>
        {loan ? (
          <>
            <Card>
              <CardContent className="gap-1 pt-4">
                <Text className="font-semibold">{t('app.lb_loan_details')}</Text>
                <Text className="text-sm">{t('app.lb_book')}: {loan.book_title}</Text>
                <Text className="text-sm">{t('app.lb_accession')}: {loan.accession_number}</Text>
                <Text className="text-sm">{t('app.lb_borrower')}: {loan.student_name}</Text>
                <Text className="text-sm">{t('app.lb_issue_date')}: {date(loan.issue_date)} · {t('app.lb_due')}: {date(loan.due_date)}</Text>
                <Text className="text-sm">{t('app.lb_status')}: {loan.status}</Text>
              </CardContent>
            </Card>
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1.5">
                <Label>{t('app.lb_replacement_cost')}</Label>
                <Input value={replacement} onChangeText={setReplacement} keyboardType="decimal-pad" />
              </View>
              <View className="flex-1 gap-1.5">
                <Label>{t('app.lb_processing_fee')}</Label>
                <Input value={fee} onChangeText={setFee} keyboardType="decimal-pad" />
              </View>
            </View>
            <Card>
              <CardContent className="gap-1 pt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium">{t('app.lb_total_fee')}</Text>
                  <Text className="text-lg font-bold text-red-600">{money(rep + proc)}</Text>
                </View>
                <Text className="text-muted-foreground text-xs">
                  {t('app.lb_replacement')}: {money(rep)} + {t('app.lb_processing')}: {money(proc)}
                </Text>
              </CardContent>
            </Card>
            <View className="gap-1.5">
              <Label>{t('app.lb_notes')}</Label>
              <Textarea value={notes} onChangeText={setNotes} placeholder={t('app.lb_lost_notes_ph')} />
            </View>
          </>
        ) : null}
        <Button variant="destructive" onPress={submit} disabled={saving || !loan}>
          <Text>{saving ? t('app.lb_processing') : t('app.lb_mark_lost')}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
