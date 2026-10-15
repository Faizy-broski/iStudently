import type { LibraryLoanRow } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, DollarSign } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { ActiveLoanSearch, isLibraryKey, RETURN_CONDITIONS } from '@/features/admin/library';
import { useCurrency } from '@/features/admin/use-currency';
import { adminLibrary } from '@/lib/api';

const daysOverdue = (due: string) => Math.max(0, Math.ceil((Date.now() - new Date(due).getTime()) / 86_400_000));

/** Return an issued book, record its condition and any damage fine (web: Return Book dialog). */
export default function LibraryReturn() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { money } = useCurrency();
  const { mutate } = useSWRConfig();
  const { title } = useLocalSearchParams<{ title?: string }>();
  const [loan, setLoan] = useState<LibraryLoanRow | null>(null);
  const [condition, setCondition] = useState<string>('good');
  const [collected, setCollected] = useState('0');
  const [damage, setDamage] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const pick = (l: LibraryLoanRow | null) => {
    setLoan(l);
    setCollected(String(l?.fine_amount ?? 0));
  };

  async function submit() {
    if (!loan) return;
    setSaving(true);
    try {
      const r = await adminLibrary.returnBook(loan.id, { return_condition: condition, damage_notes: damage || undefined, collected_amount: parseFloat(collected) || 0, return_comment: comment || undefined });
      if (!r.success) return toast.error(r.error || t('app.lb_return_failed'));
      toast.success(t('app.lb_returned'));
      await mutate(isLibraryKey);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const date = (d?: string) => (d ? new Date(d).toLocaleDateString(i18n.language) : '—');
  const od = loan ? daysOverdue(loan.due_date) : 0;

  return (
    <KeyboardAvoidingView className="bg-background flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('app.lb_return_book') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{t('app.lb_return_desc')}</Text>
        <View className="gap-1.5">
          <Label>{t('app.lb_search_issued')}</Label>
          <ActiveLoanSearch initial={title ?? ''} value={loan} onChange={pick} />
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
              </CardContent>
            </Card>
            {od > 0 ? (
              <View className="flex-row gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/30">
                <Icon as={AlertTriangle} className="size-4 text-amber-600" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {t('app.lb_overdue_by', { count: od })} · {t('app.lb_fine')}: {money(od * 0.5)}
                  </Text>
                  <Text className="text-xs text-amber-800 dark:text-amber-300">{t('app.lb_overdue_fine_note')}</Text>
                </View>
              </View>
            ) : null}
            <View className="gap-1.5">
              <Label>{t('app.lb_return_condition')}</Label>
              <Picker value={condition} onChange={setCondition} options={RETURN_CONDITIONS.map((c) => ({ value: c, label: t(`app.lb_cond_${c}`) }))} />
            </View>
            <View className="gap-1.5">
              <View className="flex-row items-center gap-1">
                <Icon as={DollarSign} className="text-foreground size-3.5" />
                <Label>{t('app.lb_damage_fine')}</Label>
              </View>
              <Input value={collected} onChangeText={setCollected} keyboardType="decimal-pad" placeholder="0.00" />
              <Text className="text-muted-foreground text-xs">{t('app.lb_damage_fine_hint')}</Text>
            </View>
            <View className="gap-1.5">
              <Label>{t('app.lb_damage_notes')}</Label>
              <Textarea value={damage} onChangeText={setDamage} placeholder={t('app.lb_damage_notes_ph')} />
            </View>
            <View className="gap-1.5">
              <Label>{t('app.lb_return_comment')}</Label>
              <Textarea value={comment} onChangeText={setComment} placeholder={t('app.lb_return_comment_ph')} />
            </View>
          </>
        ) : null}
        <Button onPress={submit} disabled={saving || !loan}>
          <Text>{saving ? t('app.lb_processing') : t('app.lb_return_book')}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
