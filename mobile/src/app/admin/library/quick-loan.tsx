import type { Book } from '@studently/shared-types';
import { router, Stack } from 'expo-router';
import { BookOpen, User, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { BorrowerSearch, isLibraryKey, type Borrower } from '@/features/admin/library';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

/** Lend a document in three steps: borrower, document, confirm; the server picks a copy and due date (web: Quick Loan). */
export default function LibraryQuickLoan() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<'student' | 'user'>('student');
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [doc, setDoc] = useState<Book | null>(null);
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 400);
  const docs = useApi(step === 2 && term ? ['admin', 'library-doc-search', term] : null, ([, , s]) => adminLibrary.search(s as string));
  const [saving, setSaving] = useState(false);

  async function lend() {
    if (!borrower || !doc) return;
    setSaving(true);
    try {
      const r = await adminLibrary.quickLoan({ borrower_type: type, borrower_id: borrower.id, book_id: doc.id });
      if (!r.success) return toast.error(r.error || t('app.lb_quick_failed'));
      toast.success(t('app.lb_quick_done'));
      await mutate(isLibraryKey);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const steps = [t('app.lb_step_borrower'), t('app.lb_step_document'), t('app.lb_step_confirm')];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.lb_quick_loan') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{t('app.lb_quick_desc')}</Text>
        <View className="flex-row items-center justify-center gap-2">
          {steps.map((label, i) => (
            <View key={label} className="flex-row items-center gap-1.5">
              <View className={cn('size-7 items-center justify-center rounded-full', step >= i + 1 ? 'bg-primary' : 'bg-muted')}>
                <Text className={cn('text-xs font-bold', step >= i + 1 ? 'text-primary-foreground' : 'text-muted-foreground')}>{i + 1}</Text>
              </View>
              <Text className="text-xs">{label}</Text>
            </View>
          ))}
        </View>

        {step === 1 ? (
          <>
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
            <BorrowerSearch
              type={type}
              value={null}
              onChange={(b) => {
                if (!b) return;
                setBorrower(b);
                setStep(2);
              }}
            />
          </>
        ) : null}

        {step >= 2 && borrower ? (
          <Card>
            <CardContent className="flex-row items-center gap-2 pt-4">
              <Icon as={User} className="text-primary size-4" />
              <Text className="flex-1 text-sm font-semibold">{borrower.name}</Text>
              <StatusChip label={String(type === 'student' ? t('app.lb_student') : t('app.lb_staff_other'))} tone="muted" className="px-2 py-0.5" />
              <Button size="sm" variant="ghost" onPress={() => setStep(1)}>
                <Text>{t('app.lb_change')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <View className="gap-1">
            <SearchBar value={q} onChangeText={setQ} placeholder={t('app.lb_search_document')} />
            {(docs.data ?? []).map((d, i) => {
              const ok = d.available_copies > 0;
              return (
                <View key={d.id}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable
                    disabled={!ok}
                    onPress={() => {
                      setDoc(d);
                      setStep(3);
                    }}
                    className={cn('flex-row items-center gap-3 px-2 py-2.5', !ok && 'opacity-50')}>
                    <Icon as={BookOpen} className="text-muted-foreground size-4" />
                    <View className="flex-1">
                      <Text>{d.title}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {d.author}
                        {d.reference ? ` • Ref: ${d.reference}` : ''}
                      </Text>
                    </View>
                    <StatusChip label={t('app.lb_avail', { count: d.available_copies })} tone={ok ? 'info' : 'destructive'} />
                  </Pressable>
                </View>
              );
            })}
            {term && !docs.isLoading && !(docs.data ?? []).length ? <Text className="text-muted-foreground px-2 text-sm">{t('app.lb_no_documents')}</Text> : null}
          </View>
        ) : null}

        {step === 3 && doc ? (
          <>
            <Card>
              <CardContent className="flex-row items-center gap-2 pt-4">
                <Icon as={BookOpen} className="text-primary size-4" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{doc.title}</Text>
                  <Text className="text-muted-foreground text-xs">{doc.author}</Text>
                </View>
                <Button size="sm" variant="ghost" onPress={() => setStep(2)}>
                  <Text>{t('app.lb_change')}</Text>
                </Button>
              </CardContent>
            </Card>
            <Text className="text-muted-foreground text-center text-xs">{t('app.lb_quick_auto')}</Text>
            <Button onPress={lend} disabled={saving}>
              <Icon as={Zap} className="text-primary-foreground size-4" />
              <Text>{saving ? t('app.lb_lending') : t('app.lb_lend_now')}</Text>
            </Button>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
