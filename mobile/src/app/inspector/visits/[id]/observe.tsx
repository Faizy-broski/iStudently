import type { TeacherEvaluation } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Camera, Check, FileAudio, Image as ImageIcon, Mic, Send, TrendingUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
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
  const { id, teacher } = useLocalSearchParams<{ id: string; teacher?: string }>();
  const visit = useApi(id ? ['inspector', 'visit', id] : null, ([, , v]) => inspector.visit(v as string));
  const v = visit.data;
  const [picked, setPicked] = useState<string | null>(null);
  const teacherId = picked ?? teacher ?? (v?.teachers.length === 1 ? v.teachers[0].teacher_profile_id : null);
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
  const scoreValues = (e?.scores ?? []).map((x) => x.score).filter((n): n is number => typeof n === 'number');
  const avg = scoreValues.length ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : null;
  const vt = v?.teachers.find((x) => x.teacher_profile_id === teacherId);
  const teacherName = vt?.teacher ? `${vt.teacher.first_name} ${vt.teacher.last_name}` : '';
  const teacherInitials = teacherName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

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
        {/* Teacher card: who is observed, where, and the live average score */}
        <Panel className="flex-row items-center gap-3 p-4">
          <View className="bg-warning-soft size-12 items-center justify-center rounded-full">
            <Text className="text-warning font-bold">{teacherInitials}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-semibold" numberOfLines={1}>
              {teacherName || k('page_title')}
            </Text>
            <Text variant="muted" className="text-xs" numberOfLines={1}>{`${v.school?.name ?? ''} · ${v.scheduled_date}`}</Text>
          </View>
          {avg !== null ? (
            <View className="items-end">
              <Text className="text-brand dark:text-foreground text-2xl font-bold">{avg.toFixed(1)}</Text>
              <Text variant="muted" className="text-[11px]">
                {t('app.obs_avg')}
              </Text>
            </View>
          ) : null}
        </Panel>
        {!v.teachers.length ? (
          <Card>
            <CardContent className="py-10">
              <EmptyState title={k('no_teachers_on_visit')} />
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
              <Card className="border-success/30 bg-success-soft">
                <CardContent className="flex-row items-center gap-2 py-4">
                  <Icon as={Check} className="size-4 text-success" />
                  <Text className="flex-1 text-sm text-success">{k('already_submitted', { score: String(e.overall_score ?? '—') })}</Text>
                </CardContent>
              </Card>
            ) : null}
            {!e.rubric_template ? (
              <Card>
                <CardContent className="py-10">
                  <EmptyState title={k('no_rubric')} />
                </CardContent>
              </Card>
            ) : (
              <>
                {e.rubric_template.categories.map((cat) => (
                  <View key={cat.id} className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="flex-1 text-base font-semibold">{cat.name}</Text>
                      <StatusChip label={`${cat.weight}%`} tone="info" />
                    </View>
                    <Panel>
                      {cat.criteria.map((crit, ci) => {
                        const cur = scores.get(crit.id);
                        return (
                          <View key={crit.id} className={cn('gap-2 px-4 py-3', ci < cat.criteria.length - 1 && 'border-info-soft dark:border-border border-b')}>
                            <View className="flex-row items-start gap-2">
                              <View className="flex-1">
                                <Text className="text-sm font-semibold">{crit.name}</Text>
                                {crit.description ? <Text className="text-muted-foreground text-xs">{crit.description}</Text> : null}
                              </View>
                              {saving === crit.id ? <ActivityIndicator size="small" /> : cur?.score ? <Text className="text-muted-foreground text-xs">{t(`app.obs_level_${cur.score}`)}</Text> : null}
                            </View>
                            <View className="flex-row gap-1.5">
                              {[1, 2, 3, 4, 5].map((n) => {
                                const on = cur?.score === n;
                                return (
                                  <Pressable
                                    key={n}
                                    disabled={!isDraft}
                                    onPress={() => score(crit.id, n)}
                                    accessibilityRole="radio"
                                    accessibilityLabel={t(`app.obs_level_${n}`)}
                                    accessibilityState={{ checked: on, disabled: !isDraft }}
                                    className={cn('h-10 flex-1 items-center justify-center rounded-xl border', on ? 'bg-brand border-brand' : 'bg-info-soft/60 border-info-soft dark:bg-muted dark:border-border')}>
                                    <Text className={cn('text-sm font-semibold', on ? 'text-white' : 'text-foreground')}>{String(n)}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                            {tools(crit.id)}
                            {chips(e.evidence.filter((x) => x.criterion_id === crit.id))}
                          </View>
                        );
                      })}
                    </Panel>
                  </View>
                ))}
                <Card>
                  <CardHeader>
                    <View className="flex-row items-center gap-2">
                      <Icon as={ImageIcon} className="size-4 text-brand dark:text-brand-secondary" />
                      <CardTitle className="text-base">{k('general_evidence_title')}</CardTitle>
                    </View>
                    <CardDescription>{k('general_evidence_desc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="gap-3">
                    <View className="flex-row flex-wrap gap-2.5">
                      {e.evidence
                        .filter((x) => !x.criterion_id)
                        .map((x) => (
                          <EvidenceTile key={x.id} id={x.id} name={x.file_name} type={x.file_type} editable={isDraft} onRemove={removeEvidence} />
                        ))}
                      {isDraft ? (
                        <Pressable
                          onPress={() => photo(undefined, 'camera')}
                          disabled={!!uploading}
                          className="border-brand-secondary/60 bg-info-soft/40 size-[76px] items-center justify-center rounded-2xl border-2 border-dashed"
                          accessibilityRole="button"
                          accessibilityLabel={k('btn_add_photo')}>
                          {uploading === 'general' ? <ActivityIndicator size="small" /> : <Icon as={Camera} className="text-brand dark:text-brand-secondary size-5" />}
                        </Pressable>
                      ) : null}
                    </View>
                    {tools(undefined)}
                    {!e.evidence.filter((x) => !x.criterion_id).length && !isDraft ? <Text className="text-muted-foreground text-xs">{k('no_general_evidence')}</Text> : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <View className="flex-row items-center gap-2">
                      <Icon as={TrendingUp} className="size-4 text-brand dark:text-brand-secondary" />
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
        <View className="bg-background absolute inset-x-0 bottom-0 gap-2.5 px-4 pb-6 pt-3">
          <View className="flex-row items-center gap-3">
            <View className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
              <View className={cn('h-2 rounded-full', missing > 0 ? 'bg-warning' : 'bg-success')} style={{ width: `${all.length ? ((all.length - missing) / all.length) * 100 : 0}%` }} />
            </View>
            <Text className={cn('text-xs font-semibold', missing > 0 ? 'text-warning' : 'text-success')}>{t('app.obs_scored', { done: all.length - missing, total: all.length })}</Text>
          </View>
          <Button size="lg" onPress={submit} disabled={submitting || missing > 0}>
            <Icon flipRtl as={Send} className="size-4 text-white" />
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

/** Evidence as a square tile (photo / voice): tap to view, × to remove while a draft. */
function EvidenceTile({ id, name, type, editable, onRemove }: { id: string; name: string; type: 'photo' | 'audio'; editable: boolean; onRemove: (id: string) => void }) {
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
    <Pressable onPress={view} className="border-info-soft dark:border-border bg-info-soft/40 size-[76px] items-center justify-center gap-1 rounded-2xl border p-1.5" accessibilityRole="link" accessibilityLabel={name}>
      {loading ? <ActivityIndicator size="small" /> : <Icon as={type === 'photo' ? ImageIcon : Mic} className="text-brand dark:text-brand-secondary size-5" />}
      <Text className="text-[10px]" numberOfLines={1}>
        {name}
      </Text>
      {editable ? (
        <Pressable onPress={() => onRemove(id)} hitSlop={8} className="bg-card absolute end-1 top-1 size-5 items-center justify-center rounded-full" accessibilityLabel={t('inspections.observe.btn_remove_evidence')}>
          <Icon as={X} className="text-muted-foreground size-3" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
