import type { LibraryStudentHit } from '@studently/api-client';
import type { BookLoan } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { AlertTriangle, BookOpen, DollarSign, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { isLibraryKey, RETURN_CONDITIONS } from '@/features/admin/library';
import { useCurrency } from '@/features/admin/use-currency';
import { ActiveLoansCard, daysPast, StudentSelectCard } from '@/features/library/librarian';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Return a book: pick the student, one of their active loans, see the overdue fine, return (web: /librarian/return). */
export default function LibrarianReturn() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.li_${key}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [now] = useState(() => Date.now());
  const [student, setStudent] = useState<LibraryStudentHit | null>(null);
  const [loan, setLoan] = useState<BookLoan | null>(null);
  const [condition, setCondition] = useState<string>('good');
  const [damage, setDamage] = useState('');
  const [collected, setCollected] = useState('0');
  const [busy, setBusy] = useState(false);
  const { money } = useCurrency();
  const studentId = student?.id ?? null;
  const loans = useApi(studentId ? ['librarian', 'active-loans', studentId] : null, ([, , s]) => adminLibrary.activeLoans(s as string));
  // The estimate uses the school's own fine per day (library settings); with no settings loaded the server still applies its fine on return.
  const settings = useApi(['librarian', 'library-settings'], () => adminLibrary.settings());
  const finePerDay = settings.data?.fine_per_day;
  const fine = (l: BookLoan) => daysPast(l.due_date, now) * (finePerDay ?? 0);

  async function doReturn() {
    if (!loan) return toast.error(k('select_loan'));
    const amount = parseFloat(collected) || 0;
    if (!(amount >= 0)) return toast.error(k('return_failed'));
    setBusy(true);
    const r = await adminLibrary.returnBook(loan.id, { return_condition: condition, damage_notes: damage.trim() || undefined, collected_amount: amount });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('return_failed'));
    toast.success(k('returned_ok'));
    setLoan(null);
    setCondition('good');
    setDamage('');
    setCollected('0');
    loans.mutate();
    mutate(isLibraryKey);
  }

  const over = loan ? daysPast(loan.due_date, now) : 0;
  return (
    <>
      <Stack.Screen options={{ title: k('return_book') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted" className="text-sm">
          {k('return_subtitle')}
        </Text>
        <StudentSelectCard
          value={student}
          onChange={(s) => {
            setStudent(s);
            setLoan(null);
          }}
          extra={
            student ? (
              <StatusChip label={k('active_loan_count', { count: (loans.data ?? []).length })} tone="info" className="mt-1 self-start" />
            ) : null
          }
        />
        <ActiveLoansCard studentId={studentId} selected={loan} onSelect={setLoan} now={now} fine={fine} />
        {loan ? (
          <FormSection title={k('return_details')} icon={RotateCcw}>
            {over > 0 ? (
              <View className="bg-destructive-soft gap-1 rounded-2xl p-3.5">
                <View className="flex-row items-center gap-2">
                  <Icon as={AlertTriangle} className="size-4 text-destructive" />
                  <Text className="font-medium text-destructive">{k('overdue_book')}</Text>
                </View>
                <Text className="text-sm text-destructive">{k('days_overdue_text', { count: over })}</Text>
                {finePerDay != null ? <Text className="text-sm font-medium text-destructive">{k('fine_amount', { amount: fine(loan).toFixed(2) })}</Text> : settings.error ? <Text className="text-sm text-destructive">{k('fine_unknown')}</Text> : null}
              </View>
            ) : (
              <View className="bg-success-soft gap-1 rounded-2xl p-3.5">
                <View className="flex-row items-center gap-2">
                  <Icon as={BookOpen} className="size-4 text-success" />
                  <Text className="font-medium text-success">{k('on_time')}</Text>
                </View>
                <Text className="text-sm text-success">{k('on_time_desc')}</Text>
              </View>
            )}
            <View className="gap-1.5">
              <Label>{t('app.lb_return_condition')}</Label>
              <Picker value={condition} onChange={setCondition} options={RETURN_CONDITIONS.map((c) => ({ value: c, label: t(`app.lb_cond_${c}`) }))} />
            </View>
            <View className="gap-1.5">
              <View className="flex-row items-center gap-1">
                <Icon as={DollarSign} className="text-foreground size-3.5" />
                <Label>{t('app.lb_damage_fine')}</Label>
              </View>
              <Input value={collected} onChangeText={(v) => setCollected(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={money(0)} />
              <Text className="text-muted-foreground text-xs">{t('app.lb_damage_fine_hint')}</Text>
            </View>
            <View className="gap-1.5">
              <Label>{t('app.lb_damage_notes')}</Label>
              <Textarea value={damage} onChangeText={setDamage} placeholder={t('app.lb_damage_notes_ph')} />
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={() => setLoan(null)}>
                <Text>{t('common.cancel')}</Text>
              </Button>
              <Button className="flex-1" onPress={doReturn} disabled={busy}>
                <Text>{busy ? k('returning') : k('return_book')}</Text>
              </Button>
            </View>
          </FormSection>
        ) : null}
      </ScrollView>
    </>
  );
}
