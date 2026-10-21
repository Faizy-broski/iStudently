import type { LibraryStudentHit } from '@studently/api-client';
import type { BookCopy } from '@studently/shared-types';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { AlertCircle, BookOpen, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { Panel } from '@/components/app/panel';
import { SearchBar } from '@/components/app/search-bar';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { locale } from '@/i18n';
import { isLibraryKey } from '@/features/admin/library';
import { StudentSelectCard } from '@/features/library/librarian';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type PickedBook = { id: string; title: string; author: string; available: number; total: number; cover?: string | null; isbn?: string | null; category?: string | null };
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Issue a book: pick a student, a book with available copies (then a copy), a due date (web: /librarian/issue). */
export default function LibrarianIssue() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.li_${key}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [student, setStudent] = useState<LibraryStudentHit | null>(null);
  const [q, setQ] = useState('');
  const [book, setBook] = useState<PickedBook | null>(null);
  const [copies, setCopies] = useState<BookCopy[]>([]);
  const [copy, setCopy] = useState<BookCopy | null>(null);
  const [due, setDue] = useState(() => inDays(14));
  const [busy, setBusy] = useState(false);
  const books = useApi(['admin', 'library-books'], () => adminLibrary.books());
  const studentId = student?.id ?? null;
  const elig = useApi(studentId ? ['admin', 'library-eligibility', studentId] : null, ([, , sid]) => adminLibrary.eligibility(sid as string));
  const term = q.trim().toLowerCase();
  const matches = term && !book ? (books.data ?? []).filter((b) => b.available_copies > 0 && (b.title.toLowerCase().includes(term) || (b.author ?? '').toLowerCase().includes(term))) : [];

  async function pickBook(b: PickedBook) {
    setBook(b);
    setQ(b.title);
    const r = await adminLibrary.availableCopies(b.id);
    if (!r.success) return toast.error(r.error || k('copies_failed'));
    const list = r.data ?? [];
    setCopies(list);
    if (list.length) setCopy(list[0]);
    else toast.error(k('no_copies'));
  }

  function clearBook() {
    setBook(null);
    setCopies([]);
    setCopy(null);
    setQ('');
  }

  async function issue() {
    if (!student || !copy) return toast.error(k('select_both'));
    setBusy(true);
    const r = await adminLibrary.issue({ copyId: copy.id, student_id: student.id, due_date: new Date(due).toISOString() });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('issue_failed'));
    toast.success(k('issued'));
    setStudent(null);
    clearBook();
    mutate(isLibraryKey);
  }

  const days = Math.max(0, Math.round((new Date(due).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86_400_000));

  return (
    <>
      <Stack.Screen options={{ title: k('issue_book') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-5 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{k('issue_subtitle')}</Text>

        {/* 1 · Borrower */}
        <View className="gap-2">
          <Text className="text-sm font-semibold">{`1 · ${k('step_borrower')}`}</Text>
          <StudentSelectCard
            value={student}
            onChange={setStudent}
            extra={
              elig.data?.active_loans !== undefined ? (
                <StatusChip label={k('loans_chip', { count: elig.data.active_loans, max: elig.data.max_books || 3 })} tone={elig.data.eligible ? 'success' : 'destructive'} className="mt-1 self-start px-2 py-0.5" />
              ) : null
            }
          />
        </View>

        {/* 2 · Book copy */}
        <View className="gap-2">
          <Text className="text-sm font-semibold">{`2 · ${k('step_copy')}`}</Text>
          <Panel className="gap-3 p-3">
            {book ? (
              <View className="flex-row gap-3">
                {book.cover ? (
                  <Image source={{ uri: book.cover }} style={{ width: 52, height: 72, borderRadius: 8 }} contentFit="cover" accessibilityIgnoresInvertColors />
                ) : (
                  <View className="bg-info-soft h-[72px] w-[52px] items-center justify-center rounded-lg">
                    <Icon as={BookOpen} className="text-brand dark:text-brand-secondary size-5" />
                  </View>
                )}
                <View className="flex-1 gap-1">
                  <Text className="font-semibold" numberOfLines={2}>
                    {book.title}
                  </Text>
                  <Text variant="muted" className="text-xs" numberOfLines={2}>
                    {[book.author, book.category, book.isbn ? `ISBN ${book.isbn}` : null].filter(Boolean).join(' · ')}
                  </Text>
                  <StatusChip label={k('of_available', { count: book.available, total: book.total })} tone="success" className="self-start px-2 py-0.5" />
                </View>
                <Pressable onPress={clearBook} hitSlop={8} className="bg-muted size-8 items-center justify-center rounded-full" accessibilityLabel={t('app.ss_change')}>
                  <Icon as={X} className="text-muted-foreground size-4" />
                </Pressable>
              </View>
            ) : (
              <SearchBar
                value={q}
                onChangeText={(v) => {
                  setQ(v);
                  if (book) clearBook();
                }}
                placeholder={k('book_search_placeholder')}
              />
            )}
            {matches.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => pickBook({ id: b.id, title: b.title, author: b.author ?? '', available: b.available_copies, total: b.total_copies, cover: b.cover_image_url, isbn: b.isbn, category: b.category })}
                accessibilityRole="button"
                className="border-info-soft dark:border-border flex-row items-center gap-3 rounded-xl border p-3 active:opacity-80">
                <Icon as={BookOpen} className="text-brand dark:text-brand-secondary size-4" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold" numberOfLines={1}>
                    {b.title}
                  </Text>
                  <Text variant="muted" className="text-xs" numberOfLines={1}>
                    {k('by_author', { author: b.author ?? '' })}
                  </Text>
                </View>
                <StatusChip label={k('available_count', { count: b.available_copies })} tone="success" className="px-2 py-0.5" />
              </Pressable>
            ))}
            {/* Copies as radio rows */}
            {book && copies.length ? (
              <View className="gap-2">
                {copies.map((c) => {
                  const on = copy?.id === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCopy(c)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      className={cn('flex-row items-center gap-3 rounded-xl border px-3 py-2.5', on ? 'bg-info-soft border-brand-secondary' : 'border-info-soft dark:border-border')}>
                      <View className={cn('size-5 items-center justify-center rounded-full border-2', on ? 'border-brand' : 'border-border')}>
                        {on ? <View className="bg-brand size-2.5 rounded-full" /> : null}
                      </View>
                      <Text className="flex-1 text-sm font-semibold">{`#${c.accession_number}`}</Text>
                      {c.condition_notes ? (
                        <Text variant="muted" className="text-xs" numberOfLines={1}>
                          {c.condition_notes}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Panel>
        </View>

        {/* 3 · Due date */}
        <View className="gap-2">
          <Text className="text-sm font-semibold">{`3 · ${k('due_date')}`}</Text>
          <DateField label={k('due_in_days', { count: days })} value={due} onChange={setDue} />
          <View className="flex-row gap-2">
            {[7, 14, 21].map((n) => (
              <Pressable key={n} onPress={() => setDue(inDays(n))} className={cn('rounded-full border px-3 py-1.5', days === n ? 'bg-brand border-brand' : 'border-info-soft dark:border-border bg-card')}>
                <Text className={cn('text-xs font-semibold', days === n ? 'text-white' : 'text-muted-foreground')}>{k('days_n', { count: n })}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary */}
        {student || book ? (
          <View className="gap-2">
            <Text className="text-sm font-semibold">{k('issue_details')}</Text>
            <Panel className="gap-2 p-4">
              {(
                [
                  [k('step_borrower'), student ? `${student.first_name} ${student.last_name}` : '—'],
                  [k('copy'), book && copy ? `${book.title} · #${copy.accession_number}` : '—'],
                  [k('issued_on'), new Date().toLocaleString(locale)],
                  [k('due_date'), due],
                ] as const
              ).map(([label, value]) => (
                <View key={label} className="flex-row justify-between gap-3">
                  <Text variant="muted" className="text-xs">
                    {label}
                  </Text>
                  <Text className="flex-1 text-end text-xs font-semibold" numberOfLines={1}>
                    {value}
                  </Text>
                </View>
              ))}
              {!student || !copy ? (
                <View className="bg-warning-soft mt-1 flex-row items-center gap-2 rounded-xl p-2.5">
                  <Icon as={AlertCircle} className="text-warning size-4" />
                  <Text className="text-warning flex-1 text-xs">{k('select_both')}</Text>
                </View>
              ) : null}
            </Panel>
          </View>
        ) : null}
      </ScrollView>
      <View className="bg-background absolute inset-x-0 bottom-0 px-4 pb-6 pt-3">
        <Button size="lg" onPress={issue} disabled={!student || !copy || busy}>
          <Icon as={BookOpen} className="size-4 text-white" />
          <Text>{busy ? k('issuing') : k('issue_book')}</Text>
        </Button>
      </View>
    </>
  );
}
