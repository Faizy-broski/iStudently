import type { AdminQuiz } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { BarChart2, Copy, ListChecks, Pencil, Plus, Trash2, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { useQz } from '@/features/admin/quiz';
import { useCampus } from '@/features/campus/campus';
import { adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

/** Quizzes: search, create, edit, manage questions, answer breakdown, close & sync, copy, delete (web: /admin/quiz/quizzes). */
export default function Quizzes() {
  const q = useQz();
  const { i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const currentYearId = years.current?.id ?? null;
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [busy, setBusy] = useState<string | null>(null);
  const res = useApi(['admin', 'quizzes', campusId ?? 'school', term], ([, , , s]) => adminQuiz.quizzes({ campus_id: campusId, search: (s as string) || undefined }));

  async function remove(x: AdminQuiz) {
    if (!(await confirm({ title: q('deleteQuiz'), body: q('deleteQuizWarning'), destructive: true, confirmLabel: q('delete') }))) return;
    const r = await adminQuiz.deleteQuiz(x.id);
    if (!r.success) return toast.error(r.error || '');
    res.mutate();
  }
  async function copy(x: AdminQuiz) {
    setBusy(`copy:${x.id}`);
    try {
      const r = await adminQuiz.copyQuiz(x.id, x.academic_year_id ?? currentYearId);
      if (!r.success) return toast.error(r.error || '');
      res.mutate();
    } finally {
      setBusy(null);
    }
  }
  async function close(x: AdminQuiz) {
    setBusy(`close:${x.id}`);
    try {
      const r = await adminQuiz.closeQuiz(x.id);
      if (!r.success) return toast.error(r.error || '');
      toast.success(`${q('closeSyncDone')} (${r.data?.marked ?? 0})`);
    } finally {
      setBusy(null);
    }
  }

  const action = (icon: typeof Copy, label: string, onPress: () => void, opts: { danger?: boolean; disabled?: boolean } = {}) => (
    <Pressable onPress={onPress} disabled={opts.disabled} hitSlop={6} className="p-1.5" accessibilityLabel={label}>
      <Icon as={icon} className={opts.danger ? 'text-destructive size-4' : 'text-muted-foreground size-4'} />
    </Pressable>
  );
  const dueDate = (d?: string) => (d ? new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d)) : q('notAvailable'));

  return (
    <>
      <Stack.Screen
        options={{
          title: q('title'),
          headerRight: () => (
            <Pressable onPress={() => router.push('/admin/quiz/quiz-form')} hitSlop={8} className="p-1" accessibilityLabel={q('newQuiz')}>
              <Icon as={Plus} className="text-foreground size-6" />
            </Pressable>
          ),
        }}
      />
      <DataList
        items={res.data}
        error={res.error}
        isLoading={res.isLoading}
        isRefreshing={res.isValidating && !res.isLoading}
        onRefresh={() => res.mutate()}
        emptyTitle={q('noQuizzes')}
        keyExtractor={(x: AdminQuiz) => x.id}
        header={
          <View className="px-4 pt-3 pb-1">
            <SearchBar value={search} onChangeText={setSearch} placeholder={q('searchQuizzes')} />
          </View>
        }
        renderItem={(x: AdminQuiz) => (
          <View className="gap-1.5 px-4 py-3">
            <View className="flex-row items-start gap-2">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold">{x.title}</Text>
                <Text className="text-muted-foreground text-xs">
                  {x.assignment?.title ?? q('noAssignment')} · {q('table.dueDate')}: {dueDate(x.assignment?.due_date)}
                </Text>
              </View>
              <Badge variant="secondary">
                <Text className="text-xs">
                  {x.question_count ?? 0} {q('questionCountSuffix')}
                </Text>
              </Badge>
            </View>
            {x.show_correct_answers || x.shuffle ? (
              <View className="flex-row gap-1">
                {x.show_correct_answers ? (
                  <Badge variant="outline">
                    <Text className="text-xs">{q('showAnswers')}</Text>
                  </Badge>
                ) : null}
                {x.shuffle ? (
                  <Badge variant="outline">
                    <Text className="text-xs">{q('shuffle')}</Text>
                  </Badge>
                ) : null}
              </View>
            ) : null}
            <View className="flex-row justify-end gap-1">
              {action(ListChecks, q('actions.manageQuestions'), () => router.push({ pathname: '/admin/quiz/manage-questions', params: { id: x.id, title: x.title } }))}
              {action(BarChart2, q('actions.answerBreakdown'), () => router.push({ pathname: '/admin/quiz/answer-breakdown', params: { id: x.id, title: x.title } }))}
              {x.start_time ? action(UserX, q('actions.closeSync'), () => close(x), { disabled: busy === `close:${x.id}` }) : null}
              {action(Copy, q('actions.copyQuiz'), () => copy(x), { disabled: busy === `copy:${x.id}` })}
              {action(Pencil, q('actions.editQuiz'), () => router.push({ pathname: '/admin/quiz/quiz-form', params: { id: x.id } }))}
              {action(Trash2, q('actions.deleteQuiz'), () => remove(x), { danger: true })}
            </View>
          </View>
        )}
      />
    </>
  );
}
