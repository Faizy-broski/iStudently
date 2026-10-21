import type { HomeworkSubmission } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Award, CheckSquare, Clock, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { FormSection, Initials, RowItem, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { attachmentUrl } from '@/features/teacher/homework';
import { homework } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate, formatDateTime } from '@/lib/format';

const STATUS: Record<string, [string, ChipTone]> = {
  pending: ['statusPending', 'muted'],
  submitted: ['statusSubmitted', 'info'],
  late: ['statusLate', 'warning'],
  graded: ['statusGraded', 'success'],
};

/** Pick one of the teacher's assignments, see submission counts, filter, and grade each submission (web: /teacher/submissions). */
export default function TeacherSubmissions() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.submissions.${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const staffId = profile?.staff_id ?? null;
  const profileId = profile?.id ?? null;
  const params = useLocalSearchParams<{ assignment?: string }>();
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? params.assignment ?? '';
  const list = useApi(staffId ? ['teacher', 'homework-all', staffId] : null, ([, , s]) => homework.teacherList(s as string, { is_archived: false }));
  const assignments = Array.isArray(list.data) ? list.data : (list.data?.data ?? []);
  const subs = useApi(selected ? ['teacher', 'homework-subs', selected] : null, ([, , a]) => homework.submissions(a as string));
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [grading, setGrading] = useState<HomeworkSubmission | null>(null);
  const [form, setForm] = useState({ score: '', feedback: '' });
  const [busy, setBusy] = useState(false);
  const all = subs.data ?? [];
  const term = q.trim().toLowerCase();
  const shown = all.filter(
    (s) => (status === 'all' || s.status === status) && (!term || `${s.student?.profile?.first_name ?? ''} ${s.student?.profile?.last_name ?? ''}`.toLowerCase().includes(term) || (s.student?.student_number ?? '').toLowerCase().includes(term)),
  );
  const stats = {
    total: all.length,
    pending: all.filter((s) => s.status === 'pending').length,
    submitted: all.filter((s) => s.status === 'submitted' || s.status === 'late').length,
    graded: all.filter((s) => s.status === 'graded').length,
  };
  const nameOf = (s: HomeworkSubmission) => `${s.student?.profile?.first_name ?? ''} ${s.student?.profile?.last_name ?? ''}`.trim();

  function open(s: HomeworkSubmission) {
    setGrading(s);
    setForm({ score: s.score != null ? String(s.score) : '', feedback: s.feedback ?? '' });
  }

  async function submit() {
    if (!grading || !profileId) return;
    const score = Number(form.score);
    if (form.score.trim() === '' || Number.isNaN(score)) return toast.error(k('enterValidScore'));
    setBusy(true);
    const r = await homework.grade(grading.id, { score, feedback: form.feedback, graded_by: profileId });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('gradeSubmissionFailed'));
    toast.success(k('submissionGraded'));
    setGrading(null);
    subs.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([list.mutate(), subs.mutate()])} />}>
        <Text variant="muted" className="text-sm">
          {k('pageSubtitle')}
        </Text>
        <FormSection title={k('selectAssignment')} icon={FileText}>
          <Picker value={selected || null} onChange={setPicked} placeholder={k('chooseAssignmentPlaceholder')} options={assignments.map((a) => ({ value: a.id, label: `${a.title} - ${a.section?.name ?? ''} (${a.subject?.name ?? ''})` }))} />
        </FormSection>
        {list.isLoading ? <LoadingList rows={2} /> : null}
        {selected ? (
          <>
            <StatTiles>
              <StatTile icon={FileText} tone="muted" label={k('total')} value={String(stats.total)} />
              <StatTile icon={Clock} tone="warning" label={k('statusPending')} value={String(stats.pending)} />
              <StatTile icon={CheckSquare} label={k('statusSubmitted')} value={String(stats.submitted)} />
              <StatTile icon={Award} tone="success" label={k('statusGraded')} value={String(stats.graded)} />
            </StatTiles>
            <SearchBar value={q} onChangeText={setQ} placeholder={k('searchByStudentPlaceholder')} />
            <FilterChips value={status} onChange={setStatus} options={[{ value: 'all', label: k('allStatus') }, ...Object.entries(STATUS).map(([v, [key]]) => ({ value: v, label: k(key) }))]} />
            {subs.isLoading ? (
              <LoadingList rows={4} />
            ) : !shown.length ? (
              <EmptyState icon={FileText} title={k('noSubmissionsFound')} body={status !== 'all' ? k('tryChangingFilter') : k('noSubmissionsYet')} />
            ) : (
              <Panel>
                {shown.map((s, i) => {
                  const [key, tone] = STATUS[s.status] ?? [s.status, 'muted' as ChipTone];
                  return (
                    <RowItem
                      key={s.id}
                      leading={<Initials name={nameOf(s) || '?'} size={40} />}
                      title={nameOf(s) || '—'}
                      meta={[s.submitted_at ? k('submittedOn', { date: formatDate(s.submitted_at) }) : null, s.score != null ? k('scoreLabel', { score: s.score }) : null].filter(Boolean).join(' · ') || null}
                      trailing={
                        <View className="items-end gap-1.5">
                          <StatusChip label={STATUS[s.status] ? k(key) : s.status} tone={tone} />
                          <Button size="sm" variant={s.status === 'graded' ? 'outline' : 'default'} className="h-8 rounded-full px-3" onPress={() => open(s)}>
                            <Text className="text-xs">{s.status === 'graded' ? k('viewGrade') : k('grade')}</Text>
                          </Button>
                        </View>
                      }
                      last={i === shown.length - 1}
                    />
                  );
                })}
              </Panel>
            )}
          </>
        ) : null}
      </ScrollView>
      <Dialog open={!!grading} onOpenChange={(o) => !o && setGrading(null)}>
        <DialogContent className="max-h-[85vh] w-[92vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{k('gradeSubmissionTitle', { name: grading ? nameOf(grading) : '' })}</DialogTitle>
          </DialogHeader>
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <Text className="font-semibold">{k('studentSubmission')}</Text>
            {grading?.submission_text ? (
              <View className="gap-1">
                <Label>{k('submissionText')}</Label>
                <View className="bg-muted/40 rounded-xl p-3">
                  <Text className="text-sm">{grading.submission_text}</Text>
                </View>
              </View>
            ) : null}
            {grading?.attachments?.length ? (
              <View className="gap-2">
                <Label>{k('attachmentsCount', { count: grading.attachments.length })}</Label>
                {grading.attachments.map((a, i) => (
                  <View key={i} className="bg-muted/40 flex-row items-center gap-2 rounded-xl p-2">
                    <View className="bg-info-soft size-8 items-center justify-center rounded-full">
                      <Icon as={FileText} className="text-brand dark:text-brand-secondary size-4" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium">{typeof a === 'string' || a.url ? k('fileNumber', { number: i + 1 }) : k('attachmentNumber', { number: i + 1 })}</Text>
                      {typeof a !== 'string' && a.uploaded_at ? <Text className="text-muted-foreground text-xs">{k('uploadedOn', { date: formatDate(a.uploaded_at) })}</Text> : null}
                    </View>
                    <Button size="sm" variant="outline" onPress={() => WebBrowser.openBrowserAsync(attachmentUrl(a))}>
                      <Text>{k('download')}</Text>
                    </Button>
                  </View>
                ))}
              </View>
            ) : null}
            {!grading?.submission_text && !grading?.attachments?.length ? <Text className="text-muted-foreground bg-muted/40 rounded-xl p-3 text-center text-sm">{k('noSubmissionContent')}</Text> : null}
            <View className="border-info-soft dark:border-border gap-3 border-t pt-3">
              <Text className="font-semibold">{k('gradeThisSubmission')}</Text>
              <View className="gap-1.5">
                <Label>{`${k('score')} *`}</Label>
                <Input value={form.score} onChangeText={(v) => setForm((f) => ({ ...f, score: v.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" placeholder={k('enterScorePlaceholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{k('feedback')}</Label>
                <Textarea value={form.feedback} onChangeText={(v) => setForm((f) => ({ ...f, feedback: v }))} placeholder={k('enterFeedbackPlaceholder')} />
              </View>
              {grading?.submitted_at ? <Text className="text-muted-foreground text-xs">{`${k('submittedAt')} ${formatDateTime(grading.submitted_at)}`}</Text> : null}
            </View>
          </ScrollView>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={() => setGrading(null)}>
              <Text>{k('cancel')}</Text>
            </Button>
            <Button className="flex-1" onPress={submit} disabled={busy}>
              <Text>{k('submitGrade')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
