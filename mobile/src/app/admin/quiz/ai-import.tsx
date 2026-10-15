import type { AdminQuestionType, DifficultyLevel, DraftQuestion } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Check, FileText, Save, Sparkles, Trash2, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { DIFFICULTIES, GradeSubjectPickers, QUESTION_TYPES, useQz } from '@/features/admin/quiz';
import { useCampus } from '@/features/campus/campus';
import { adminQuiz } from '@/lib/api';
import { pickDocuments, type PickedDocument } from '@/lib/upload';
import { cn } from '@/lib/utils';

const ACCEPTED = /\.(pdf|docx|jpe?g|png|webp|gif)$/i;

function CheckBox({ on }: { on: boolean }) {
  return <View className={cn('size-5 items-center justify-center rounded border', on ? 'border-primary bg-primary' : 'border-border')}>{on ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}</View>;
}

/** Draft bank questions from a document or with AI, review, save the chosen ones (web: /admin/quiz/bulk-import). */
export default function AiImport() {
  const { t } = useTranslation();
  const ai = (k: string, o?: Record<string, unknown>) => t(`app.ai_${k}`, o);
  const q = useQz();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const [ctx, setCtx] = useState({ gradeId: '', subjectId: '', chapterId: '' });
  const [types, setTypes] = useState<AdminQuestionType[]>([...QUESTION_TYPES]);
  const [tab, setTab] = useState<'extract' | 'generate'>('extract');
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [count, setCount] = useState('10');
  const [prompt, setPrompt] = useState('');
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const toggleType = (x: AdminQuestionType) => setTypes((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]));
  const received = (data: DraftQuestion[], msg: string) => {
    setDrafts(data);
    setSelected(new Set(data.map((_, i) => i)));
    setSuccess(msg);
  };

  async function choose() {
    const [f] = await pickDocuments({ multiple: false });
    if (!f) return;
    if (!ACCEPTED.test(f.name)) return setError(ai('bad_file'));
    setFile(f);
    setError('');
  }
  async function extract() {
    if (!file) return setError(ai('choose_first'));
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const r = await adminQuiz.extractQuestions(file, { allowedTypes: types, gradeLevelId: ctx.gradeId || undefined, subjectId: ctx.subjectId || undefined, chapterId: ctx.chapterId || undefined });
      if (!r.success) return setError(r.error || '');
      received(r.data ?? [], ai('extracted', { count: r.data?.length ?? 0 }));
    } finally {
      setLoading(false);
    }
  }
  async function generate() {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const n = Math.min(50, Math.max(1, Number(count) || 1));
      const r = await adminQuiz.generateQuestions({ grade_level_id: ctx.gradeId || null, subject_id: ctx.subjectId || null, chapter_ids: ctx.chapterId ? [ctx.chapterId] : [], count: n, allowed_types: types, prompt: prompt.trim() || undefined });
      if (!r.success) return setError(r.error || '');
      received(r.data ?? [], ai('generated', { count: r.data?.length ?? 0 }));
    } finally {
      setLoading(false);
    }
  }
  async function save() {
    const chosen = drafts.filter((_, i) => selected.has(i));
    if (!chosen.length) return setError(ai('none_selected'));
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const r = await adminQuiz.bulkCreateQuestions(
        chosen.map((d, i) => ({
          campus_id: campusId ?? null,
          category_id: null,
          title: d.title,
          type: d.type,
          description: d.description || null,
          answer: d.answer || null,
          sort_order: i,
          grade_level_id: ctx.gradeId || null,
          subject_id: ctx.subjectId || null,
          chapter_id: ctx.chapterId || null,
          difficulty_level: d.difficulty_level || 'medium',
        })),
      );
      if (!r.success) return setError(r.error || '');
      setSuccess(ai('saved', { count: r.data?.length ?? 0 }));
      setDrafts([]);
      setSelected(new Set());
      mutate((key) => Array.isArray(key) && key[0] === 'admin' && key[1] === 'quiz-questions');
    } finally {
      setSaving(false);
    }
  }

  const edit = (i: number, patch: Partial<DraftQuestion>) => setDrafts((p) => p.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const removeDraft = (i: number) => {
    setDrafts((p) => p.filter((_, j) => j !== i));
    setSelected((p) => new Set([...p].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))));
  };
  const toggle = (i: number) => setSelected((p) => (p.has(i) ? new Set([...p].filter((x) => x !== i)) : new Set([...p, i])));
  const all = drafts.length > 0 && selected.size === drafts.length;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: ai('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">{ai('subtitle')}</Text>
          <Card>
            <CardContent className="gap-3 pt-4">
              <Text className="font-semibold">{ai('context')}</Text>
              <GradeSubjectPickers withChapter gradeId={ctx.gradeId} subjectId={ctx.subjectId} chapterId={ctx.chapterId} onChange={setCtx} />
              <Label>{ai('types')}</Label>
              <View className="flex-row flex-wrap gap-1.5">
                {QUESTION_TYPES.map((x) => (
                  <Pressable key={x} onPress={() => toggleType(x)} className={cn('rounded-full border px-2.5 py-1', types.includes(x) ? 'border-primary bg-primary' : 'border-border')}>
                    <Text className={cn('text-xs', types.includes(x) ? 'text-primary-foreground' : 'text-foreground')}>{q(`questionTypes.${x}`)}</Text>
                  </Pressable>
                ))}
              </View>
            </CardContent>
          </Card>
          <FilterChips
            value={tab}
            onChange={setTab}
            options={[
              { value: 'extract', label: ai('tab_extract') },
              { value: 'generate', label: ai('tab_generate') },
            ]}
          />
          <Card>
            <CardContent className="gap-3 pt-4">
              {tab === 'extract' ? (
                <>
                  <View className="items-center gap-2 py-2">
                    <Icon as={FileText} className="text-muted-foreground size-10" />
                    <Text className="font-medium">{ai('upload_title')}</Text>
                    <Text className="text-muted-foreground text-center text-sm">{ai('upload_hint')}</Text>
                    <Button variant="outline" onPress={choose}>
                      <Text>{ai('choose_file')}</Text>
                    </Button>
                    {file ? (
                      <Text className="text-primary text-sm font-medium">
                        {file.name}
                        {file.size ? ` (${(file.size / 1024).toFixed(0)} KB)` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Button onPress={extract} disabled={loading || !file}>
                    <Icon as={Upload} className="text-primary-foreground size-4" />
                    <Text>{loading ? ai('extracting') : ai('extract')}</Text>
                  </Button>
                </>
              ) : (
                <>
                  <View className="gap-1">
                    <Label>{ai('count')}</Label>
                    <Input value={count} onChangeText={setCount} keyboardType="number-pad" />
                  </View>
                  <View className="gap-1">
                    <Label>{ai('instructions')}</Label>
                    <Input value={prompt} onChangeText={setPrompt} placeholder={ai('instructions_placeholder')} />
                  </View>
                  <Button onPress={generate} disabled={loading || !types.length}>
                    <Icon as={Sparkles} className="text-primary-foreground size-4" />
                    <Text>{loading ? ai('generating') : ai('generate')}</Text>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
          {success ? <Text className="text-sm text-green-700 dark:text-green-400">{success}</Text> : null}
          {drafts.length ? (
            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="font-semibold">{ai('review', { selected: selected.size, total: drafts.length })}</Text>
                <Button onPress={save} disabled={saving || !selected.size}>
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>{saving ? ai('saving') : ai('save_selected', { count: selected.size })}</Text>
                </Button>
                <Pressable onPress={() => setSelected(all ? new Set() : new Set(drafts.map((_, i) => i)))} className="flex-row items-center gap-3">
                  <CheckBox on={all} />
                  <Text className="text-sm font-semibold">{t('app.sc_select_all', { count: selected.size })}</Text>
                </Pressable>
                {drafts.map((d, i) => (
                  <View key={i} className={cn('border-border gap-2 rounded-md border p-3', selected.has(i) && 'bg-primary/5')}>
                    <View className="flex-row items-center gap-2">
                      <Pressable onPress={() => toggle(i)} hitSlop={8}>
                        <CheckBox on={selected.has(i)} />
                      </Pressable>
                      <Text className="text-muted-foreground flex-1 text-xs">#{i + 1}</Text>
                      <Pressable onPress={() => removeDraft(i)} hitSlop={8} accessibilityLabel={q('delete')}>
                        <Icon as={Trash2} className="text-destructive size-4" />
                      </Pressable>
                    </View>
                    <Input value={d.title} onChangeText={(v) => edit(i, { title: v })} multiline />
                    <View className="flex-row gap-2">
                      <Picker className="flex-[2]" value={d.type} onChange={(v) => edit(i, { type: v as AdminQuestionType })} options={QUESTION_TYPES.map((x) => ({ value: x, label: q(`questionTypes.${x}`) }))} />
                      <Picker className="flex-1" value={d.difficulty_level} onChange={(v) => edit(i, { difficulty_level: v as DifficultyLevel })} options={DIFFICULTIES.map((x) => ({ value: x, label: q(`difficulty.${x}`) }))} />
                    </View>
                    <Input value={d.answer} onChangeText={(v) => edit(i, { answer: v })} multiline className="min-h-16 font-mono text-xs" textAlignVertical="top" />
                  </View>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
