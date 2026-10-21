import type { AdminQuiz } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, ChevronDown, ChevronUp, HelpCircle, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { IconTile, RowPill } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

const NONE = '__none__';

/** The teacher's quizzes: create, delete, and add / remove question-bank questions with points (web: /teacher/quiz). */
export default function TeacherQuiz() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.quiz.${key}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const { campusId } = useCampus();
  const quizzes = useApi(schoolId && staffId ? ['teacher', 'quizzes', schoolId, staffId, campusId ?? ''] : null, ([, , , s, c]) => adminQuiz.quizzes({ campus_id: (c as string) || null, created_by: s as string }));
  const cps = useApi(schoolId ? ['teacher', 'quiz-cps', schoolId, campusId ?? ''] : null, ([, , s, c]) => adminQuiz.coursePeriodsForQuiz(s as string, (c as string) || null));
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; cp: string; answers: boolean; shuffle: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const list = quizzes.data ?? [];

  async function create() {
    if (!form) return;
    if (!form.title.trim()) return toast.error(k('quizTitleRequired'));
    if (!schoolId || !staffId) return;
    setBusy(true);
    const r = await adminQuiz.createQuiz({
      title: form.title.trim(),
      description: form.description.trim() || null,
      course_period_id: form.cp || null,
      campus_id: campusId || null,
      academic_year_id: null,
      assignment_id: null,
      show_correct_answers: form.answers,
      shuffle: form.shuffle,
      created_by: staffId,
    });
    setBusy(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('quizCreated'));
    setForm(null);
    quizzes.mutate();
  }

  async function remove(quiz: AdminQuiz) {
    if (!(await confirm({ title: k('deleteQuizConfirm', { title: quiz.title }), destructive: true, confirmLabel: t('common.delete') }))) return;
    setDeleting(quiz.id);
    const r = await adminQuiz.deleteQuiz(quiz.id);
    setDeleting(null);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('quizDeleted'));
    quizzes.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => quizzes.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text variant="muted" className="flex-1 text-sm">
            {k('pageSubtitle')}
          </Text>
          <Button size="sm" className="rounded-full" onPress={() => setForm({ title: '', description: '', cp: '', answers: false, shuffle: false })}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{k('newQuiz')}</Text>
          </Button>
        </View>
        {quizzes.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState icon={HelpCircle} title={k('noQuizzesCreatedYet')} body={k('createFirstQuiz')} />
        ) : (
          list.map((q) => <QuizRow key={q.id} quiz={q} expanded={open === q.id} onToggle={() => setOpen(open === q.id ? null : q.id)} onDelete={() => remove(q)} deleting={deleting === q.id} onAdd={() => setAdding(q.id)} />)
        )}
      </ScrollView>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{k('createQuiz')}</DialogTitle>
          </DialogHeader>
          {form ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{`${k('title')} *`}</Label>
                <Input value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder={k('quizTitlePlaceholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{k('description')}</Label>
                <Textarea value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder={k('optionalDescriptionPlaceholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{k('classOptional')}</Label>
                <Picker
                  value={form.cp || NONE}
                  onChange={(v) => setForm({ ...form, cp: v === NONE ? '' : v })}
                  placeholder={k('selectClassPlaceholder')}
                  options={[{ value: NONE, label: k('none') }, ...(cps.data ?? []).map((c) => ({ value: c.id, label: c.courses?.title || c.id }))]}
                />
              </View>
              <View className="flex-row items-center gap-2">
                <Checkbox checked={form.answers} onCheckedChange={(v) => setForm({ ...form, answers: !!v })} />
                <Text className="text-sm" onPress={() => setForm({ ...form, answers: !form.answers })}>
                  {k('showCorrectAnswers')}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Checkbox checked={form.shuffle} onCheckedChange={(v) => setForm({ ...form, shuffle: !!v })} />
                <Text className="text-sm" onPress={() => setForm({ ...form, shuffle: !form.shuffle })}>
                  {k('shuffleQuestions')}
                </Text>
              </View>
            </View>
          ) : null}
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={() => setForm(null)}>
              <Text>{k('cancel')}</Text>
            </Button>
            <Button className="flex-1" onPress={create} disabled={busy}>
              <Text>{busy ? k('creating') : k('createQuiz')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {adding && schoolId && staffId ? (
        <AddQuestionDialog
          quizId={adding}
          schoolId={schoolId}
          staffId={staffId}
          campusId={campusId ?? null}
          onClose={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            quizzes.mutate();
          }}
        />
      ) : null}
    </>
  );
}

function QuizRow({ quiz, expanded, onToggle, onDelete, deleting, onAdd }: { quiz: AdminQuiz; expanded: boolean; onToggle: () => void; onDelete: () => void; deleting: boolean; onAdd: () => void }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.quiz.${key}`, o);
  const toast = useToast();
  const qs = useApi(expanded ? ['teacher', 'quiz-questions', quiz.id] : null, ([, , id]) => adminQuiz.quizQuestions(id as string));
  const questions = qs.data ?? [];
  const total = questions.reduce((s, q) => s + (q.points || 0), 0);

  async function removeQuestion(mapId: string) {
    const r = await adminQuiz.removeQuestionFromQuiz(quiz.id, mapId);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('questionRemoved'));
    qs.mutate();
  }

  return (
    <Panel>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }} className="flex-row items-center gap-3 px-4 py-3 active:opacity-70">
        <IconTile icon={HelpCircle} size={40} />
        <View className="flex-1 gap-1">
          <Text className="text-sm font-semibold">{quiz.title}</Text>
          <View className="flex-row flex-wrap items-center gap-1.5">
            {quiz.question_count != null ? <StatusChip label={k('questionCountBadge', { count: quiz.question_count })} tone="info" /> : null}
            {quiz.show_correct_answers ? <StatusChip label={k('answersShown')} tone="success" /> : null}
            {quiz.shuffle ? <StatusChip label={k('shuffled')} tone="warning" /> : null}
            <Text variant="muted" className="text-[11px]">
              {formatDate(quiz.created_at)}
            </Text>
          </View>
        </View>
        <Pressable onPress={onDelete} disabled={deleting} hitSlop={8} accessibilityLabel={t('common.delete')} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
          <Icon as={Trash2} className="text-destructive size-4" />
        </Pressable>
        <Icon as={expanded ? ChevronUp : ChevronDown} className="text-muted-foreground size-4" />
      </Pressable>
      {expanded ? (
        <View className="border-info-soft dark:border-border gap-3 border-t px-4 pb-4 pt-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-semibold">{`${k('questionsCount', { count: questions.length })}${total > 0 ? ` · ${k('ptsTotal', { points: total })}` : ''}`}</Text>
            <RowPill icon={Plus} label={k('addQuestion')} onPress={onAdd} />
          </View>
          {qs.isLoading ? (
            <LoadingList rows={2} />
          ) : !questions.length ? (
            <EmptyState icon={HelpCircle} title={k('noQuestionsYet')} />
          ) : (
            questions.map((m, i) => (
              <View key={m.id} className="bg-muted/40 flex-row items-start gap-3 rounded-xl p-3">
                <View className="bg-info-soft size-7 items-center justify-center rounded-full">
                  <Text className="text-brand dark:text-brand-secondary text-[11px] font-bold">{String(i + 1)}</Text>
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-sm">{m.question?.title || k('unknownQuestion')}</Text>
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    {m.question?.type ? <StatusChip label={t(`quiz.questionTypes.${m.question.type}`)} tone="info" /> : null}
                    <Text variant="muted" className="text-[11px]">
                      {k('ptsAbbrev', { count: m.points })}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => removeQuestion(m.id)} hitSlop={8} accessibilityLabel={t('common.delete')} className="bg-destructive-soft size-8 items-center justify-center rounded-full active:opacity-70">
                  <Icon as={Trash2} className="text-destructive size-3.5" />
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}
    </Panel>
  );
}

function AddQuestionDialog({ quizId, schoolId, staffId, campusId, onClose, onAdded }: { quizId: string; schoolId: string; staffId: string; campusId: string | null; onClose: () => void; onAdded: () => void }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.quiz.${key}`, o);
  const toast = useToast();
  const bank = useApi(['teacher', 'quiz-bank', schoolId, staffId, campusId ?? ''], ([, , s, c, cid]) => adminQuiz.questions({ school_id: s as string, campus_id: (cid as string) || null, created_by: c as string }));
  const [selected, setSelected] = useState('');
  const [points, setPoints] = useState('1');
  const [busy, setBusy] = useState(false);
  const questions = bank.data ?? [];

  async function add() {
    if (!selected) return toast.error(k('selectAQuestion'));
    setBusy(true);
    const existing = await adminQuiz.quizQuestions(quizId);
    const r = await adminQuiz.addQuestionToQuiz(quizId, selected, Number(points) || 1, (existing.data?.length ?? 0) + 1);
    setBusy(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('questionAdded'));
    onAdded();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[92vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{k('addQuestionFromBank')}</DialogTitle>
        </DialogHeader>
        <View className="gap-3">
          {bank.isLoading ? (
            <LoadingList rows={2} />
          ) : !questions.length ? (
            <View className="items-center gap-1 py-4">
              <View className="bg-muted mb-1 size-12 items-center justify-center rounded-full">
                <Icon as={AlertCircle} className="text-muted-foreground size-5" />
              </View>
              <Text className="text-center text-sm font-semibold">{k('noQuestionsInBank')}</Text>
              <Text variant="muted" className="text-center text-xs">
                {k('createQuestionsInAdminFirst')}
              </Text>
            </View>
          ) : (
            <View className="gap-1.5">
              <Label>{k('selectQuestion')}</Label>
              <Picker value={selected || null} onChange={setSelected} placeholder={k('chooseAQuestionPlaceholder')} options={questions.map((q) => ({ value: q.id, label: `${q.title} (${t(`quiz.questionTypes.${q.type}`)})` }))} />
            </View>
          )}
          <View className="gap-1.5">
            <Label>{k('points')}</Label>
            <Input value={points} onChangeText={(v) => setPoints(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" className="w-28" />
          </View>
        </View>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={onClose}>
            <Text>{k('cancel')}</Text>
          </Button>
          <Button className="flex-1" onPress={add} disabled={busy || !questions.length}>
            <Text>{busy ? k('adding') : k('addQuestion')}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
