import { htmlToText } from '@studently/shared-utils';
import type { DiaryEntry } from '@studently/api-client';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, ChevronLeft, ChevronRight, Minus, Paperclip, Plus, Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';

import { DateField, todayYmd } from '@/components/app/date-field';
import { ScrollView } from '@/components/app/keyboard';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminAcademics, classDiary } from '@/lib/api';
import { useApi } from '@/lib/data';

const ALL = 'all';
const shift = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const longDate = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const stamp = (ts: string) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: '2-digit' })} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
};

/** Every class's diary for a day, by grade/section: content, files, comments, comment switch (web: /admin/attendance/class-diary). */
export default function AdminClassDiary() {
  const { t } = useTranslation();
  const a = (k: string) => t(`attendance.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const [date, setDate] = useState(todayYmd);
  const [grade, setGrade] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const sections = useApi(['admin', 'sections', campusId ?? 'school', 'all'], () => adminAcademics.sections(campusId));
  const entries = useApi(['admin', 'diary-read', campusId ?? 'school', date, section], ([, , , d, s]) =>
    classDiary.getDiaryReadView({ diary_date: d as string, campus_id: campusId, section_id: s === ALL ? undefined : (s as string) }),
  );
  const list = entries.data ?? [];
  const sectionOptions = (sections.data ?? []).filter((s) => grade === ALL || (s.grade_level_id === grade && s.is_active !== false));

  const patchEntry = (id: string, fn: (e: DiaryEntry) => DiaryEntry) => entries.mutate((r) => r?.map((e) => (e.id === id ? fn(e) : e)), { revalidate: false });

  async function toggleComments(e: DiaryEntry) {
    const r = await classDiary.toggleComments(e.id, !e.enable_comments);
    if (!r.success) return toast.error(r.error || a('diary_toggleFailed'));
    patchEntry(e.id, (x) => ({ ...x, enable_comments: !e.enable_comments }));
    toast.success(!e.enable_comments ? a('diary_commentsEnabled') : a('diary_commentsDisabled'));
  }

  async function addComment(e: DiaryEntry) {
    const text = (drafts[e.id] ?? '').trim();
    if (!text) return;
    setBusy(e.id);
    const r = await classDiary.addDiaryComment(e.id, text);
    setBusy(null);
    if (!r.success || !r.data) return toast.error(r.error || a('diary_commentFailed'));
    const added = r.data;
    patchEntry(e.id, (x) => ({ ...x, comments: [...(x.comments ?? []), added] }));
    setDrafts((d) => ({ ...d, [e.id]: '' }));
    toast.success(a('diary_commentAdded'));
  }

  async function deleteComment(e: DiaryEntry, commentId: string) {
    const r = await classDiary.deleteDiaryComment(commentId);
    if (!r.success) return toast.error(r.error || a('diary_commentDeleteFailed'));
    patchEntry(e.id, (x) => ({ ...x, comments: (x.comments ?? []).filter((c) => c.id !== commentId) }));
    toast.success(a('diary_commentDeleted'));
  }

  const dayName = (e: DiaryEntry) => {
    const raw = e.day_of_week ?? (new Date(`${e.diary_date}T00:00:00`).getDay() + 6) % 7;
    return new Date(2000, 0, 3 + raw).toLocaleDateString(locale, { weekday: 'long' });
  };

  return (
    <>
      <Stack.Screen options={{ title: a('classDiaryRead') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => entries.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {a('diary_subtitle_read')}
        </Text>
        <View className="flex-row items-end gap-2">
          <Button size="icon" variant="outline" onPress={() => setDate((d) => shift(d, -1))} accessibilityLabel={t('common.previous')}>
            <Icon as={ChevronLeft} flipRtl className="size-4" />
          </Button>
          <View className="flex-1">
            <DateField value={date} onChange={setDate} />
          </View>
          <Button size="icon" variant="outline" onPress={() => setDate((d) => shift(d, 1))} accessibilityLabel={t('common.next')}>
            <Icon as={ChevronRight} flipRtl className="size-4" />
          </Button>
          <Button variant="outline" onPress={() => setDate(todayYmd())}>
            <Text>{a('diary_today')}</Text>
          </Button>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Picker
              value={grade}
              onChange={(v) => {
                setGrade(v);
                setSection(ALL);
              }}
              options={[{ value: ALL, label: a('diary_allGrades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
            />
          </View>
          <View className="flex-1">
            <Picker value={section} onChange={setSection} options={[{ value: ALL, label: a('diary_allSections') }, ...sectionOptions.map((s) => ({ value: s.id, label: s.name }))]} />
          </View>
        </View>
        <Text className="text-sm font-semibold">{longDate(date)}</Text>

        {entries.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <EmptyState icon={BookOpen} title={a('diary_noEntries')} body={a('diary_noEntriesFound')} />
        ) : (
          list.map((e) => {
            const closed = collapsed.has(e.id);
            const teacher = e.teacher?.profile ? `${e.teacher.profile.first_name ?? ''} ${e.teacher.profile.last_name ?? ''}`.trim() : '';
            return (
              <Panel key={e.id} className="overflow-hidden">
                <View className="bg-info-soft/50 border-border flex-row items-center gap-2 border-b px-4 py-2.5">
                  <StatusChip label={dayName(e)} tone="info" className="px-2 py-0.5" />
                  <Text className="flex-1 text-sm font-medium" numberOfLines={2}>
                    {[e.section?.grade_level?.name, e.section?.name, e.subject?.name ?? t('app.dy_general')].filter(Boolean).join(' — ')}
                  </Text>
                  <Pressable onPress={() => setCollapsed((s) => (s.has(e.id) ? new Set([...s].filter((x) => x !== e.id)) : new Set([...s, e.id])))} hitSlop={8} accessibilityRole="button">
                    <Icon as={closed ? Plus : Minus} className="size-4" />
                  </Pressable>
                </View>
                {teacher ? (
                  <Text variant="muted" className="px-4 pt-2 text-xs">
                    {teacher}
                  </Text>
                ) : null}
                <View className="border-border border-b px-4 py-2">
                  <CheckRow checked={e.enable_comments} onPress={() => toggleComments(e)} label={a('diary_enableComments')} />
                </View>
                {!closed ? (
                  <View className="gap-3 p-4">
                    <Text className="text-sm leading-5">{htmlToText(e.content)}</Text>
                    {(e.files ?? []).map((f) => (
                      <Pressable key={f.id} onPress={() => WebBrowser.openBrowserAsync(f.file_url)} className="flex-row items-center gap-2" accessibilityRole="link">
                        <Icon as={Paperclip} className="text-muted-foreground size-4" />
                        <Text className="text-brand-secondary text-sm">{f.file_name}</Text>
                      </Pressable>
                    ))}
                    <Text variant="muted" className="text-xs">
                      {stamp(e.created_at)}
                    </Text>
                    {e.enable_comments ? (
                      <View className="border-border gap-2 border-t pt-3">
                        {(e.comments ?? []).map((c) => (
                          <View key={c.id} className="flex-row items-start gap-2">
                            <View className="flex-1">
                              <Text className="text-sm font-medium">{c.content}</Text>
                              <Text variant="muted" className="text-xs">
                                {`${stamp(c.created_at)}${c.author ? ` — ${c.author.first_name} ${c.author.last_name}` : ''}`}
                              </Text>
                            </View>
                            {/* Admins may delete any comment (web: own comment or admin/teacher). */}
                            <Pressable onPress={() => deleteComment(e, c.id)} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                              <Icon as={Trash2} className="text-destructive size-4" />
                            </Pressable>
                          </View>
                        ))}
                        <View className="flex-row items-center gap-2">
                          <Input className="flex-1" value={drafts[e.id] ?? ''} onChangeText={(v) => setDrafts((d) => ({ ...d, [e.id]: v }))} placeholder={a('diary_commentPlaceholder')} onSubmitEditing={() => addComment(e)} />
                          <Button size="sm" onPress={() => addComment(e)} disabled={!(drafts[e.id] ?? '').trim() || busy === e.id}>
                            {busy === e.id ? <ActivityIndicator size="small" /> : <Icon as={Send} className="text-primary-foreground size-4" />}
                            <Text>{a('diary_saveComment')}</Text>
                          </Button>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Panel>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
