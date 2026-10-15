import type { TeacherEvaluation } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertTriangle, Camera, Check, FileAudio, Image as ImageIcon, Mic, Send, TrendingUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { voiceRecorder } from '@/features/inspector/native';
import { PillPicker } from '@/features/inspector/ui';
import { inspector, teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, pickImage } from '@/lib/upload';
import { cn } from '@/lib/utils';

const AUDIO_TYPES = ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg'];
const normAudio = (type: string, name: string) => {
  const n = name.toLowerCase();
  if (type === 'audio/m4a' || type === 'audio/x-m4a' || n.endsWith('.m4a')) return 'audio/mp4';
  if (type === 'audio/x-wav' || n.endsWith('.wav')) return 'audio/wav';
  return type;
};

/** Score a teacher on the rubric 1–5, attach photo / voice evidence, compare a grade sample, submit (web: /inspector/visits/[id]/observe). */
export default function ObserveVisit() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`inspections.observe.${key}`, o);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const visit = useApi(id ? ['inspector', 'visit', id] : null, ([, , v]) => inspector.visit(v as string));
  const v = visit.data;
  const [picked, setPicked] = useState<string | null>(null);
  const teacherId = picked ?? (v?.teachers.length === 1 ? v.teachers[0].teacher_profile_id : null);
  const schoolId = v?.school_id ?? null;
  const ev = useApi(id && teacherId ? ['inspector', 'evaluation', id, teacherId] : null, async ([, , vid, tid]) => {
    const draft = await inspector.draftEvaluation(vid as string, tid as string);
    if (!draft.success || !draft.data) return draft;
    return inspector.evaluation(draft.data.id);
  });
  const cps = useApi(teacherId && schoolId ? ['inspector', 'teacher-cps', teacherId, schoolId] : null, ([, , tid, s]) => inspector.coursePeriodsForTeacher(tid as string, s as string));
  const [cp, setCp] = useState('');
  const [sample, setSample] = useState<Awaited<ReturnType<typeof inspector.gradeSample>>['data'] | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const Recorder = voiceRecorder();

  const e = ev.data ?? null;
  const evalId = e?.id ?? null;
  const isDraft = e?.status === 'draft';
  const scores = new Map((e?.scores ?? []).map((s) => [s.criterion_id, s]));
  const all = (e?.rubric_template?.categories ?? []).flatMap((c) => c.criteria);
  const missing = all.filter((c) => !scores.has(c.id)).length;

  async function score(criterionId: string, n: number) {
    if (!evalId) return;
    setSaving(criterionId);
    const r = await inspector.saveScore(evalId, criterionId, n);
    setSaving(null);
    if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
    ev.mutate();
  }

  async function upload(file: { uri: string; name: string; type: string }, criterionId?: string) {
    if (!evalId) return;
    setUploading(criterionId ?? 'general');
    const r = await inspector.uploadEvidence(evalId, file, criterionId);
    setUploading(null);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('msg_evidence_added'));
    ev.mutate();
  }

  async function photo(criterionId: string | undefined, source: 'camera' | 'library') {
    const p = await pickImage({ maxDimension: 2048, keepTransparency: false, source });
    if (!p.ok) {
      if (p.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    await upload(p.file as { uri: string; name: string; type: string }, criterionId);
  }

  async function audioFile(criterionId?: string) {
    const [doc] = await pickDocuments({ multiple: false });
    if (!doc) return;
    const type = normAudio(doc.type, doc.name);
    if (!AUDIO_TYPES.includes(type)) return toast.error(t('app.in_audio_type'));
    await upload({ uri: doc.uri, name: doc.name, type }, criterionId);
  }

  async function removeEvidence(evidenceId: string) {
    const r = await inspector.removeEvidence(evidenceId);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('msg_evidence_removed'));
    ev.mutate();
  }

  async function loadSample() {
    if (!cp) return;
    setLoadingSample(true);
    const r = await inspector.gradeSample(cp);
    setLoadingSample(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    setSample(r.data ?? []);
  }

  async function submit() {
    if (!evalId) return;
    setSubmitting(true);
    const r = await inspector.submitEvaluation(evalId);
    setSubmitting(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('msg_submitted'));
    ev.mutate();
  }

  const tools = (criterionId?: string) =>
    isDraft ? (
      <View className="flex-row flex-wrap items-center gap-1">
        {uploading === (criterionId ?? 'general') ? <ActivityIndicator size="small" /> : null}
        <Button size={criterionId ? 'icon' : 'sm'} variant={criterionId ? 'ghost' : 'outline'} onPress={() => photo(criterionId, 'camera')} disabled={!!uploading} accessibilityLabel={k('btn_add_photo')}>
          <Icon as={Camera} className="size-4" />
          {criterionId ? null : <Text>{k('btn_add_photo')}</Text>}
        </Button>
        <Button size={criterionId ? 'icon' : 'sm'} variant={criterionId ? 'ghost' : 'outline'} onPress={() => photo(criterionId, 'library')} disabled={!!uploading} accessibilityLabel={t('app.in_photo_library')}>
          <Icon as={ImageIcon} className="size-4" />
          {criterionId ? null : <Text>{t('app.in_photo_library')}</Text>}
        </Button>
        <Button size={criterionId ? 'icon' : 'sm'} variant={criterionId ? 'ghost' : 'outline'} onPress={() => audioFile(criterionId)} disabled={!!uploading} accessibilityLabel={k('btn_add_audio')}>
          <Icon as={FileAudio} className="size-4" />
          {criterionId ? null : <Text>{k('btn_add_audio')}</Text>}
        </Button>
        {Recorder ? <Recorder disabled={!!uploading} onDone={(f) => upload(f, criterionId)} /> : null}
      </View>
    ) : null;

  const chips = (list: TeacherEvaluation['evidence']) =>
    list.length ? (
      <View className="flex-row flex-wrap gap-1.5">
        {list.map((x) => (
          <EvidenceChip key={x.id} id={x.id} name={x.file_name} type={x.file_type} editable={isDraft} onRemove={removeEvidence} />
        ))}
      </View>
    ) : null;

  if (visit.isLoading) return <LoadingList rows={4} />;
  if (!v) return <Text className="text-muted-foreground p-6 text-center">{k('visit_not_found')}</Text>;
  return (
    <>
      <Stack.Screen options={{ title: k('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-28" refreshControl={<RefreshControl refreshing={false} onRefresh={() => ev.mutate()} />}>
        <Text variant="muted">{`${v.school?.name ?? ''} · ${v.scheduled_date}`}</Text>
        {!v.teachers.length ? (
          <Card>
            <CardContent className="py-10">
              <Text className="text-muted-foreground text-center text-sm">{k('no_teachers_on_visit')}</Text>
            </CardContent>
          </Card>
        ) : v.teachers.length > 1 ? (
          <PillPicker
            items={v.teachers.map((vt) => ({ value: vt.teacher_profile_id, label: vt.teacher ? `${vt.teacher.first_name} ${vt.teacher.last_name}` : vt.teacher_profile_id }))}
            value={teacherId}
            onChange={(x) => {
              setPicked(x);
              setSample(null);
              setCp('');
            }}
          />
        ) : null}
        {teacherId && ev.isLoading ? <LoadingList rows={3} /> : null}
        {teacherId && ev.error ? <Text className="text-destructive text-sm">{ev.error.message || k('err_load_failed')}</Text> : null}
        {e ? (
          <>
            {!isDraft ? (
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
                <CardContent className="flex-row items-center gap-2 py-4">
                  <Icon as={Check} className="size-4 text-green-700" />
                  <Text className="flex-1 text-sm text-green-800 dark:text-green-200">{k('already_submitted', { score: String(e.overall_score ?? '—') })}</Text>
                </CardContent>
              </Card>
            ) : null}
            {!e.rubric_template ? (
              <Card>
                <CardContent className="py-10">
                  <Text className="text-muted-foreground text-center text-sm">{k('no_rubric')}</Text>
                </CardContent>
              </Card>
            ) : (
              <>
                {e.rubric_template.categories.map((cat) => (
                  <Card key={cat.id}>
                    <CardHeader className="flex-row items-center gap-2">
                      <CardTitle className="text-base">{cat.name}</CardTitle>
                      <Badge variant="outline">
                        <Text className="text-[10px]">{`${cat.weight}%`}</Text>
                      </Badge>
                    </CardHeader>
                    <CardContent className="gap-4">
                      {cat.criteria.map((crit) => {
                        const cur = scores.get(crit.id);
                        return (
                          <View key={crit.id} className="border-border gap-2 border-b pb-4 last:border-b-0 last:pb-0">
                            <View className="flex-row items-start gap-2">
                              <View className="flex-1">
                                <Text className="text-sm font-medium">{crit.name}</Text>
                                {crit.description ? <Text className="text-muted-foreground text-xs">{crit.description}</Text> : null}
                              </View>
                              {saving === crit.id ? <ActivityIndicator size="small" /> : null}
                            </View>
                            <View className="flex-row flex-wrap items-center gap-2">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Pressable
                                  key={n}
                                  disabled={!isDraft}
                                  onPress={() => score(crit.id, n)}
                                  accessibilityRole="radio"
                                  accessibilityState={{ checked: cur?.score === n, disabled: !isDraft }}
                                  className={cn('size-11 items-center justify-center rounded-full border-2', cur?.score === n ? 'border-[#022172] bg-[#022172]' : 'border-border bg-background')}>
                                  <Text className={cn('text-base font-semibold', cur?.score === n && 'text-white')}>{String(n)}</Text>
                                </Pressable>
                              ))}
                            </View>
                            {tools(crit.id)}
                            {chips(e.evidence.filter((x) => x.criterion_id === crit.id))}
                          </View>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
                <Card>
                  <CardHeader>
                    <View className="flex-row items-center gap-2">
                      <Icon as={ImageIcon} className="size-4 text-[#022172] dark:text-blue-300" />
                      <CardTitle className="text-base">{k('general_evidence_title')}</CardTitle>
                    </View>
                    <CardDescription>{k('general_evidence_desc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="gap-3">
                    {tools(undefined)}
                    {e.evidence.filter((x) => !x.criterion_id).length ? chips(e.evidence.filter((x) => !x.criterion_id)) : <Text className="text-muted-foreground text-xs">{k('no_general_evidence')}</Text>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <View className="flex-row items-center gap-2">
                      <Icon as={TrendingUp} className="size-4 text-[#022172] dark:text-blue-300" />
                      <CardTitle className="text-base">{k('grade_sample_title')}</CardTitle>
                    </View>
                    <CardDescription>{k('grade_sample_desc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="gap-3">
                    {!(cps.data ?? []).length ? (
                      <Text className="text-muted-foreground text-xs">{k('no_course_periods')}</Text>
                    ) : (
                      <View className="flex-row items-center gap-2">
                        <Picker
                          className="flex-1"
                          value={cp || null}
                          onChange={setCp}
                          placeholder={k('field_course_period_placeholder')}
                          options={(cps.data ?? []).map((c) => ({ value: c.id, label: c.title || c.short_name || c.section_name || c.id }))}
                        />
                        <Button size="sm" variant="outline" onPress={loadSample} disabled={!cp || loadingSample}>
                          <Icon as={TrendingUp} className="size-4" />
                          <Text>{k('btn_load_sample')}</Text>
                        </Button>
                      </View>
                    )}
                    {sample ? (
                      !sample.length ? (
                        <Text className="text-muted-foreground text-xs">{k('no_grades_found')}</Text>
                      ) : (
                        <View>
                          <View className="border-border flex-row border-b pb-1">
                            <Text className="text-muted-foreground flex-1 text-xs">{k('col_student')}</Text>
                            <Text className="text-muted-foreground flex-1 text-xs">{k('col_assignment')}</Text>
                            <Text className="text-muted-foreground w-16 text-xs">{k('col_score')}</Text>
                          </View>
                          {sample.map((row, i) => (
                            <View key={i} className="border-border/50 flex-row border-b py-1.5">
                              <Text className="flex-1 text-xs">{row.student_name}</Text>
                              <Text className="flex-1 text-xs">{row.assignment_title || '—'}</Text>
                              <Text className="w-16 text-xs">{row.letter_grade || (row.points != null ? String(row.points) : '—')}</Text>
                            </View>
                          ))}
                        </View>
                      )
                    ) : null}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
      {e && isDraft && e.rubric_template ? (
        <View className="border-border bg-background absolute inset-x-0 bottom-0 flex-row items-center justify-between gap-3 border-t px-4 pt-3 pb-6">
          {missing > 0 ? (
            <View className="flex-1 flex-row items-center gap-1.5">
              <Icon as={AlertTriangle} className="size-4 text-amber-600" />
              <Text className="flex-1 text-sm text-amber-700">{k('missing_count', { count: String(missing) })}</Text>
            </View>
          ) : (
            <View className="flex-1 flex-row items-center gap-1.5">
              <Icon as={Check} className="size-4 text-green-600" />
              <Text className="flex-1 text-sm text-green-700">{k('all_scored')}</Text>
            </View>
          )}
          <Button onPress={submit} disabled={submitting || missing > 0}>
            <Icon as={Send} className="text-primary-foreground size-4 rtl:-scale-x-100" />
            <Text>{k('btn_submit_evaluation')}</Text>
          </Button>
        </View>
      ) : null}
    </>
  );
}

function EvidenceChip({ id, name, type, editable, onRemove }: { id: string; name: string; type: 'photo' | 'audio'; editable: boolean; onRemove: (id: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  async function view() {
    setLoading(true);
    const r = await teacherInspections.evidenceUrl(id);
    setLoading(false);
    if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
    await WebBrowser.openBrowserAsync(r.data.url);
  }
  return (
    <View className="border-border bg-muted/40 flex-row items-center gap-1.5 rounded-full border px-2.5 py-1">
      <Pressable onPress={view} className="flex-row items-center gap-1" accessibilityRole="link">
        {loading ? <ActivityIndicator size="small" /> : <Icon as={type === 'photo' ? Camera : Mic} className="size-3" />}
        <Text className="max-w-[110px] text-xs" numberOfLines={1}>
          {name}
        </Text>
      </Pressable>
      {editable ? (
        <Pressable onPress={() => onRemove(id)} hitSlop={8} accessibilityLabel={t('inspections.observe.btn_remove_evidence')}>
          <Icon as={X} className="text-muted-foreground size-3" />
        </Pressable>
      ) : null}
    </View>
  );
}
