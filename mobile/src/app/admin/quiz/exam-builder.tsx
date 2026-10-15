import type { AdminQuestionType, AdminQuizQuestion, DifficultyLevel } from '@studently/api-client';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { Bold, CheckCircle2, FileDown, Image as ImageIcon, Italic, Plus, Printer, Trash2, Underline, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { examPaperHtml, type ExamHeaderConfig, type ExamItem, type ExamPrintMode } from '@/features/admin/exam-paper';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminQuiz, adminSchool, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { printHtml, sharePdf } from '@/lib/print';
import { pickImage } from '@/lib/upload';
import { cn } from '@/lib/utils';

const TYPES: AdminQuestionType[] = ['select', 'multiple', 'gap', 'text', 'textarea', 'matching', 'anatomy_label'];
const DIFFS: DifficultyLevel[] = ['easy', 'medium', 'hard'];
const MATH = ['½', '⅓', '¼', '¾', '√(', '²', '^', 'π', '∑', '∫', '±', '≠', '≤', '≥', '∞', 'θ', 'α', 'β', 'Δ', '°', '( )', '[ ]'];
const MATH_LABEL: Record<string, string> = { '√(': '√x', '²': 'x²', '^': 'xⁿ' };

/** One question on the paper: type, marks, text with formatting/math, image, options + key or essay lines (web: RichTextQuestionEditor). */
function QuestionEditor({ q, index, onChange, onRemove }: { q: ExamItem; index: number; onChange: (q: ExamItem) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const x = (k: string, o?: Record<string, unknown>) => t(`app.eb_${k}`, o);
  const toast = useToast();
  const [sel, setSel] = useState({ start: q.title.length, end: q.title.length });
  const [showImage, setShowImage] = useState(false);
  const [url, setUrl] = useState(q.image_url ?? '');
  const [uploading, setUploading] = useState(false);
  const options = q.type === 'select' || q.type === 'multiple' ? (q.answer_options?.length ? q.answer_options : ['Option 1', 'Option 2', 'Option 3', 'Option 4']) : [];

  const insert = (text: string) => onChange({ ...q, title: q.title.slice(0, sel.start) + text + q.title.slice(sel.end) });
  const wrap = (tag: 'b' | 'i' | 'u') => onChange({ ...q, title: `${q.title.slice(0, sel.start)}<${tag}>${q.title.slice(sel.start, sel.end) || 'text'}</${tag}>${q.title.slice(sel.end)}` });

  async function upload() {
    const r = await pickImage({ maxDimension: 1600, keepTransparency: true });
    if (!r.ok) return;
    setUploading(true);
    try {
      const res = await media.uploadImage(r.file);
      if (!res.success || !res.data?.url) return toast.error(res.error || x('upload_failed'));
      onChange({ ...q, image_url: res.data.url });
      setUrl(res.data.url);
    } finally {
      setUploading(false);
    }
  }

  const isCorrect = (o: string) => (q.type === 'multiple' ? Array.isArray(q.correct_answer) && (q.correct_answer as string[]).includes(o) : q.correct_answer === o);
  const toggleCorrect = (o: string) => {
    if (q.type === 'multiple') {
      const cur = Array.isArray(q.correct_answer) ? (q.correct_answer as string[]) : [];
      onChange({ ...q, correct_answer: cur.includes(o) ? cur.filter((c) => c !== o) : [...cur, o] });
    } else onChange({ ...q, correct_answer: o });
  };

  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <View className="flex-row items-center gap-2">
          <Badge variant="outline">
            <Text className="text-xs">Q{index + 1}</Text>
          </Badge>
          <View className="flex-1">
            <Picker value={q.type} onChange={(v) => onChange({ ...q, type: v })} options={TYPES.map((ty) => ({ value: ty, label: x(`type_${ty}`) }))} />
          </View>
          <Input className="w-16" value={String(q.allocated_marks)} onChangeText={(v) => onChange({ ...q, allocated_marks: Number(v.replace(/[^\d.]/g, '')) || 0 })} keyboardType="decimal-pad" />
          <Pressable onPress={onRemove} hitSlop={6} className="p-1" accessibilityLabel={x('remove')}>
            <Icon as={Trash2} className="text-destructive size-4" />
          </Pressable>
        </View>
        <View className="flex-row flex-wrap gap-1">
          {(['b', 'i', 'u'] as const).map((tag) => (
            <Pressable key={tag} onPress={() => wrap(tag)} className="border-border rounded border p-1.5">
              <Icon as={tag === 'b' ? Bold : tag === 'i' ? Italic : Underline} className="text-foreground size-3.5" />
            </Pressable>
          ))}
          {MATH.map((m) => (
            <Pressable key={m} onPress={() => insert(m)} className="border-border min-w-8 items-center rounded border px-1.5 py-1">
              <Text className="text-xs">{MATH_LABEL[m] ?? m}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowImage((s) => !s)} className={cn('flex-row items-center gap-1 rounded border px-2 py-1', q.image_url ? 'border-primary bg-primary' : 'border-border')}>
            <Icon as={ImageIcon} className={cn('size-3.5', q.image_url ? 'text-primary-foreground' : 'text-foreground')} />
            <Text className={cn('text-xs', q.image_url && 'text-primary-foreground')}>{q.image_url ? x('image_inserted') : x('insert_image')}</Text>
          </Pressable>
        </View>
        <Input
          value={q.title}
          onChangeText={(v) => onChange({ ...q, title: v })}
          onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
          placeholder={x('question_placeholder')}
          multiline
          textAlignVertical="top"
          className="min-h-20"
        />
        {showImage || q.image_url ? (
          <View className="border-border gap-2 rounded-md border p-2">
            <View className="flex-row gap-2">
              <Button size="sm" variant="outline" className="flex-1" onPress={upload} disabled={uploading}>
                <Text>{uploading ? x('uploading') : x('upload_image')}</Text>
              </Button>
              {q.image_url ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    onChange({ ...q, image_url: null });
                    setUrl('');
                  }}>
                  <Text>{x('remove_image')}</Text>
                </Button>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              <Input className="flex-1" value={url} onChangeText={setUrl} placeholder={x('image_url_placeholder')} autoCapitalize="none" keyboardType="url" />
              <Button size="sm" onPress={() => onChange({ ...q, image_url: url.trim() || null })}>
                <Text>{x('apply_url')}</Text>
              </Button>
            </View>
            {q.image_url ? <Image source={{ uri: q.image_url }} style={{ width: '100%', height: 160 }} contentFit="contain" /> : null}
          </View>
        ) : null}
        {q.type === 'select' || q.type === 'multiple' ? (
          <View className="gap-2">
            <View className="flex-row items-center">
              <Icon as={CheckCircle2} className="size-4 text-green-600" />
              <Text className="ms-1 flex-1 text-sm font-medium">{x('options_key')}</Text>
              <Button size="sm" variant="ghost" onPress={() => onChange({ ...q, answer_options: [...options, `Option ${options.length + 1}`] })}>
                <Icon as={Plus} className="text-foreground size-3.5" />
                <Text>{x('add_option')}</Text>
              </Button>
            </View>
            {options.map((o, i) => (
              <View key={i} className="flex-row items-center gap-2">
                <Pressable onPress={() => toggleCorrect(o)} hitSlop={6} className={cn('size-5 items-center justify-center border', q.type === 'multiple' ? 'rounded' : 'rounded-full', isCorrect(o) ? 'border-green-600 bg-green-600' : 'border-border')}>
                  {isCorrect(o) ? <Text className="text-[10px] text-white">✓</Text> : null}
                </Pressable>
                <Input className="flex-1" value={o} onChangeText={(v) => onChange({ ...q, answer_options: options.map((x2, j) => (j === i ? v : x2)) })} />
                {options.length > 2 ? (
                  <Pressable onPress={() => onChange({ ...q, answer_options: options.filter((_, j) => j !== i) })} hitSlop={6} className="p-1">
                    <Icon as={X} className="text-muted-foreground size-4" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {q.type === 'textarea' || q.type === 'text' ? (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm">{x('essay_lines')}</Text>
            <Input className="w-16" value={String(q.blank_lines_count)} onChangeText={(v) => onChange({ ...q, blank_lines_count: Math.min(30, Number(v.replace(/\D/g, '')) || 0) })} keyboardType="number-pad" />
          </View>
        ) : null}
        {q.type === 'anatomy_label' ? <Text className="text-muted-foreground text-xs">{x('anatomy_on_web')}</Text> : null}
      </CardContent>
    </Card>
  );
}

/** Build and print an exam paper (student copy or answer key) from the question bank and custom questions (web: /admin/quiz/exam-builder). */
export default function ExamBuilder() {
  const { t } = useTranslation();
  const x = (k: string, o?: Record<string, unknown>) => t(`app.eb_${k}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const schoolId = profile?.school_id ?? undefined;
  const { campusId, campus } = useCampus();
  const scope = campusId ?? schoolId;
  const [header, setHeader] = useState<ExamHeaderConfig>(() => ({
    material: '',
    semester: 'Second semester',
    exam_type: 'final exam',
    exam_date: new Date().toISOString().slice(0, 10),
    school_name: campus?.name || 'School',
    education_monitoring: 'مراقبة التعليم - Education Monitoring',
    classroom: '',
    duration: '2 Hours',
    academic_year: '2026-2027',
    total_marks: 100,
    auto_calculate_marks: true,
    teacher_name: profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : '',
    exam_instructions: 'Answer all questions. No calculators allowed. Write clearly.',
  }));
  const [mode, setMode] = useState<ExamPrintMode>('student');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [type, setType] = useState('');
  const [diff, setDiff] = useState('');
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim(), 400);
  const [items, setItems] = useState<ExamItem[]>([]);
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);

  const grades = useApi(scope ? ['admin', 'grades', campusId ?? 'school'] : null, () => adminAcademics.grades(campusId));
  const subjects = useApi(grade ? ['admin', 'subjects', campusId ?? 'school', grade] : null, ([, , , gr]) => adminAcademics.subjects(campusId, gr as string));
  const chapters = useApi(subject ? ['admin', 'quiz-chapters', subject, schoolId ?? ''] : null, ([, , s]) => adminQuiz.chapters(s as string, schoolId));
  const bank = useApi(schoolId ? ['admin', 'exam-bank', schoolId, campusId ?? 'school', grade, subject, chapter, diff, search] : null, () =>
    adminQuiz.questions({ school_id: schoolId, campus_id: campusId, grade_level_id: grade || undefined, subject_id: subject || undefined, chapter_id: chapter || undefined, difficulty: (diff || undefined) as DifficultyLevel | undefined, search: search || undefined }),
  );
  const pdf = useApi(['admin', 'pdf-header-footer', campusId ?? 'school'], () => adminSchool.getPdfHeaderFooter(campusId));

  const chosen = new Set(items.map((i) => i.id));
  const total = items.reduce((s, i) => s + (i.allocated_marks || 0), 0);
  const totalMarks = header.auto_calculate_marks ? total : header.total_marks;
  const available = (bank.data ?? []).filter((b) => !chosen.has(b.id) && (!type || b.type === type));
  const set = (p: Partial<ExamHeaderConfig>) => setHeader((h) => ({ ...h, ...p }));

  const addFromBank = (b: AdminQuizQuestion) => {
    setItems((it) => [
      ...it,
      {
        id: b.id,
        title: b.title || '',
        type: b.type || 'select',
        description: b.description ?? undefined,
        allocated_marks: b.allocated_marks || 10,
        image_url: b.image_url ?? null,
        correct_answer: b.correct_answer ?? (b.type === 'select' ? 'Option 1' : null),
        blank_lines_count: b.blank_lines_count || (b.type === 'textarea' ? 6 : 0),
        answer_options: (b.answer || '')
          .split('\n')
          .filter(Boolean)
          .map((o) => o.replace(/^\*/, '')),
      },
    ]);
    toast.success(x('added'));
  };
  const addBlank = () =>
    setItems((it) => [...it, { id: `custom-${Date.now()}`, title: '', type: 'select', allocated_marks: 10, image_url: null, correct_answer: 'Option 1', blank_lines_count: 0, answer_options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'] }]);

  async function output(kind: 'print' | 'pdf') {
    if (!items.length) return toast.error(x('add_one'));
    setBusy(kind);
    try {
      const pd = pdf.data as Record<string, unknown> | undefined;
      const html = examPaperHtml({ header: { ...header, total_marks: totalMarks }, items, mode, schoolLogoUrl: campus?.logo_url || (pd?.header_logo_url as string | undefined) || null, ministryLogoUrl: (pd?.footer_logo_url as string | undefined) || null });
      if (kind === 'print') await printHtml(html);
      else await sharePdf(html, `${header.material || 'exam'}-${mode === 'teacher_key' ? 'answer-key' : 'student'}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(null);
    }
  }

  const field = (label: string, key: keyof ExamHeaderConfig, placeholder?: string) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      <Input value={String(header[key] ?? '')} onChangeText={(v) => set({ [key]: v } as Partial<ExamHeaderConfig>)} placeholder={placeholder} />
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: x('title') }} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">{x('subtitle')}</Text>
          <FilterChips
            value={mode}
            onChange={setMode}
            options={[
              { value: 'student', label: x('mode_student') },
              { value: 'teacher_key', label: x('mode_key') },
            ]}
          />
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={() => output('pdf')} disabled={!!busy || !items.length}>
              <Icon as={FileDown} className="text-foreground size-4" />
              <Text>PDF</Text>
            </Button>
            <Button className="flex-1" onPress={() => output('print')} disabled={!!busy || !items.length}>
              <Icon as={Printer} className="text-primary-foreground size-4" />
              <Text>{mode === 'teacher_key' ? x('print_key') : x('print_student')}</Text>
            </Button>
          </View>

          <Card>
            <CardContent className="gap-3 pt-4">
              <Text className="font-semibold">{x('header_title')}</Text>
              {field(x('material'), 'material', 'e.g., Mathematics / الرياضيات')}
              <View className="gap-1.5">
                <Label>{x('semester')}</Label>
                <Picker
                  value={header.semester}
                  onChange={(v) => set({ semester: v })}
                  options={[
                    { value: 'First semester', label: 'First Semester (الفصل الأول)' },
                    { value: 'Second semester', label: 'Second Semester (الفصل الثاني)' },
                    { value: 'Summer term', label: 'Summer Term (الفصل الصيفي)' },
                  ]}
                />
              </View>
              <View className="gap-1.5">
                <Label>{x('exam_type')}</Label>
                <Picker
                  value={header.exam_type}
                  onChange={(v) => set({ exam_type: v })}
                  options={[
                    { value: 'final exam', label: 'Final Exam (امتحان نهاية الفصل)' },
                    { value: 'midterm exam', label: 'Mid-Term Exam (امتحان منتصف الفصل)' },
                    { value: 'monthly exam', label: 'Monthly Test (اختبار شهري)' },
                    { value: 'quiz', label: 'Quiz (اختبار قصير)' },
                  ]}
                />
              </View>
              {field(x('school_name'), 'school_name')}
              {field(x('education_monitoring'), 'education_monitoring')}
              {field(x('classroom'), 'classroom', 'e.g., Ninth grade / الصف التاسع')}
              {field(x('academic_year'), 'academic_year', 'e.g., 2026-2027')}
              <DateField label={x('exam_date')} value={header.exam_date} onChange={(v) => set({ exam_date: v })} />
              {field(x('duration'), 'duration', '2 Hours')}
              {field(x('teacher'), 'teacher_name')}
              <View className="gap-1.5">
                <View className="flex-row items-center">
                  <Label className="flex-1">{x('total_marks')}</Label>
                  <Text className="text-muted-foreground me-2 text-xs">{x('auto_sum')}</Text>
                  <Switch checked={header.auto_calculate_marks} onCheckedChange={(v) => set({ auto_calculate_marks: v })} />
                </View>
                <Input value={String(totalMarks)} editable={!header.auto_calculate_marks} onChangeText={(v) => set({ total_marks: Number(v.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" />
              </View>
              <View className="gap-1.5">
                <Label>{x('instructions')}</Label>
                <Input value={header.exam_instructions} onChangeText={(v) => set({ exam_instructions: v })} multiline />
              </View>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="gap-3 pt-4">
              <View className="flex-row items-center">
                <Text className="flex-1 font-semibold">{x('bank')}</Text>
                <Badge variant="secondary">
                  <Text className="text-xs">{x('available', { count: available.length })}</Text>
                </Badge>
              </View>
              <Picker
                value={grade}
                onChange={(v) => {
                  setGrade(v);
                  setSubject('');
                  setChapter('');
                }}
                options={[{ value: '', label: x('all_grades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
              />
              {grade ? (
                <Picker
                  value={subject}
                  onChange={(v) => {
                    setSubject(v);
                    setChapter('');
                  }}
                  options={[{ value: '', label: x('all_subjects') }, ...(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
                />
              ) : null}
              {subject && (chapters.data ?? []).length ? <Picker value={chapter} onChange={setChapter} options={[{ value: '', label: x('all_chapters') }, ...(chapters.data ?? []).map((c) => ({ value: c.id, label: c.title }))]} /> : null}
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Picker value={type} onChange={setType} options={[{ value: '', label: x('all_types') }, ...TYPES.map((ty) => ({ value: ty, label: x(`type_${ty}`) }))]} />
                </View>
                <View className="flex-1">
                  <Picker value={diff} onChange={setDiff} options={[{ value: '', label: x('all_difficulties') }, ...DIFFS.map((d) => ({ value: d, label: x(`diff_${d}`) }))]} />
                </View>
              </View>
              <SearchBar value={q} onChangeText={setQ} placeholder={x('search')} />
              {bank.isLoading ? (
                <LoadingList rows={4} />
              ) : !available.length ? (
                <Text className="text-muted-foreground py-4 text-center text-sm">{x('no_questions')}</Text>
              ) : (
                available.slice(0, 80).map((b) => (
                  <View key={b.id} className="border-border flex-row items-start gap-2 rounded-md border p-2">
                    <View className="flex-1 gap-1">
                      <Text className="text-sm" numberOfLines={3}>
                        {b.title.replace(/<[^>]+>/g, '')}
                      </Text>
                      <View className="flex-row flex-wrap gap-1">
                        <Badge variant="secondary">
                          <Text className="text-[10px]">{x(`type_${b.type}`)}</Text>
                        </Badge>
                        {b.difficulty_level ? (
                          <Badge variant="outline">
                            <Text className="text-[10px]">{x(`diff_${b.difficulty_level}`)}</Text>
                          </Badge>
                        ) : null}
                        <Text className="text-muted-foreground text-[10px]">[{b.allocated_marks || 10} pts]</Text>
                      </View>
                    </View>
                    <Button size="sm" variant="outline" onPress={() => addFromBank(b)}>
                      <Icon as={Plus} className="text-foreground size-3.5" />
                      <Text>{x('add')}</Text>
                    </Button>
                  </View>
                ))
              )}
            </CardContent>
          </Card>

          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Text className="font-semibold">{x('paper')}</Text>
              <Text className="text-muted-foreground text-xs">{x('paper_counts', { count: items.length, total })}</Text>
            </View>
            <Button size="sm" variant="outline" onPress={addBlank}>
              <Icon as={Plus} className="text-foreground size-3.5" />
              <Text>{x('add_blank')}</Text>
            </Button>
          </View>
          {!items.length ? (
            <Card>
              <CardContent className="items-center gap-2 pt-6 pb-6">
                <Text className="font-medium">{x('empty_title')}</Text>
                <Text className="text-muted-foreground text-center text-sm">{x('empty_body')}</Text>
              </CardContent>
            </Card>
          ) : (
            items.map((it, i) => <QuestionEditor key={it.id} q={it} index={i} onChange={(nq) => setItems((all) => all.map((a, j) => (j === i ? nq : a)))} onRemove={() => setItems((all) => all.filter((_, j) => j !== i))} />)
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
