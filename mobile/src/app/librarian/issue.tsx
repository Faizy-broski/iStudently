import type { LibraryStudentHit } from '@studently/api-client';
import type { BookCopy } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { AlertCircle, BookOpen, Calendar, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { isLibraryKey } from '@/features/admin/library';
import { StudentSelectCard } from '@/features/library/librarian';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type PickedBook = { id: string; title: string; author: string; available: number };
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

  return (
    <>
      <Stack.Screen options={{ title: k('issue_book') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{k('issue_subtitle')}</Text>
        <StudentSelectCard value={student} onChange={setStudent} />
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={BookOpen} className="size-5" />
            <CardTitle className="text-base">{k('select_book')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {book && copy ? (
              <View className="gap-1 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/30">
                <View className="flex-row items-center gap-2">
                  <Icon as={BookOpen} className="size-4 text-blue-600" />
                  <Text className="flex-1 font-medium text-blue-800 dark:text-blue-200">{k('selected_book')}</Text>
                  <Pressable onPress={clearBook} hitSlop={8} accessibilityLabel={t('app.ss_change')}>
                    <Icon as={X} className="size-4 text-blue-600" />
                  </Pressable>
                </View>
                <Text className="text-sm text-blue-700 dark:text-blue-300">{k('book_by', { title: book.title, author: book.author })}</Text>
                <Text className="text-xs text-blue-600">{`${k('copy')}: ${copy.accession_number}`}</Text>
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
                onPress={() => pickBook({ id: b.id, title: b.title, author: b.author ?? '', available: b.available_copies })}
                accessibilityRole="button"
                className="border-border gap-1 rounded-lg border p-3">
                <Text className="font-medium">{b.title}</Text>
                <Text className="text-muted-foreground text-sm">{k('by_author', { author: b.author ?? '' })}</Text>
                <Badge variant="secondary" className="self-start">
                  <Text className="text-xs">{k('available_count', { count: b.available_copies })}</Text>
                </Badge>
              </Pressable>
            ))}
            {book && copies.length > 1 ? (
              <View className="gap-1.5">
                <Label>{k('select_copy')}</Label>
                <View className="flex-row flex-wrap gap-2">
                  {copies.map((c) => (
                    <Button key={c.id} size="sm" variant={copy?.id === c.id ? 'default' : 'outline'} onPress={() => setCopy(c)}>
                      <Text>{c.accession_number}</Text>
                    </Button>
                  ))}
                </View>
              </View>
            ) : null}
          </CardContent>
        </Card>
        {student || book ? (
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Icon as={Calendar} className="size-5" />
              <CardTitle className="text-base">{k('issue_details')}</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              <DateField label={k('due_date')} value={due} onChange={setDue} />
              {!student || !copy ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:bg-yellow-950/30">
                  <Icon as={AlertCircle} className="size-4 text-yellow-600" />
                  <Text className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">{k('select_both')}</Text>
                </View>
              ) : null}
              <Button className={cn('self-end')} onPress={issue} disabled={!student || !copy || busy}>
                <Text>{busy ? k('issuing') : k('issue_book')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
