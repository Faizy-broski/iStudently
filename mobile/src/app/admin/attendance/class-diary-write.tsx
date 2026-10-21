import { htmlToText } from '@studently/shared-utils';
import type { DiaryEntry } from '@studently/api-client';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, ChevronRight, Paperclip, Pencil, Save, Trash2, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField, todayYmd } from '@/components/app/date-field';
import { RichTextField } from '@/components/app/rich-text-field';
import { ScrollView } from '@/components/app/keyboard';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminAcademics, adminTimetable, classDiary, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, type PickedDocument } from '@/lib/upload';

const dayOfWeek = (ymd: string) => (new Date(`${ymd}T00:00:00`).getDay() + 6) % 7; // 0 = Monday
const shift = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hms = () => {
  const n = new Date();
  return [n.getHours(), n.getMinutes(), n.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':');
};

/** Write, edit and delete a section's diary for a day, per timetable slot, with files (web: /admin/attendance/class-diary-write). */
export default function AdminClassDiaryWrite() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`attendance.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const myTeacherId = profile?.staff_id ?? profile?.id ?? '';
  const { campusId } = useCampus();
  const [date, setDate] = useState(todayYmd);
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [slot, setSlot] = useState('');
  const [content, setContent] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [comments, setComments] = useState(true);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [files, setFiles] = useState<PickedDocument[]>([]);
  const [saving, setSaving] = useState(false);

  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const sections = useApi(['admin', 'sections', campusId ?? 'school', 'all'], () => adminAcademics.sections(campusId));
  const year = useApi(['admin', 'current-year'], () => adminAcademics.currentAcademicYear());
  const yearId = year.data?.id ?? null;
  const timetable = useApi(section && yearId ? ['admin', 'timetable-section', section, yearId] : null, ([, , s, y]) => adminTimetable.bySection(s as string, y as string));
  const entries = useApi(section ? ['admin', 'diary-entries', campusId ?? 'school', date, section] : null, ([, , , d, s]) => classDiary.getDiaryEntries({ diary_date: d as string, section_id: s as string, campus_id: campusId }));
  const sectionOptions = (sections.data ?? []).filter((s) => s.grade_level_id === grade && s.is_active !== false);
  const daySlots = (timetable.data ?? []).filter((e) => e.day_of_week === dayOfWeek(date));
  const chosenSlot = daySlots.find((e) => e.id === slot) ?? null;

  const clear = () => {
    setContent('');
    setEditing(null);
    setFiles([]);
    setComments(true);
    setEditorKey((k) => k + 1);
  };

  async function attach(entryId: string) {
    let failed = 0;
    for (const f of files) {
      const up = await media.uploadAttachment(f, campusId);
      if (!up.success || !up.data) {
        failed++;
        toast.error(a('diary_uploadFileFailed', { name: f.name, error: up.error ?? '' }));
        continue;
      }
      const added = await classDiary.addDiaryFile(entryId, { file_name: f.name, file_url: up.data.url, file_type: f.type, file_size: f.size });
      if (!added.success) {
        failed++;
        toast.error(a('diary_uploadFileFailed', { name: f.name, error: added.error ?? '' }));
      }
    }
    if (files.length && !failed) toast.success(a('diary_filesUploaded'));
  }

  async function save() {
    if (!htmlToText(content).trim()) return toast.error(a('diary_writeContent'));
    if (!section) return toast.error(a('diary_selectSectionRequired'));
    setSaving(true);
    try {
      if (editing) {
        const r = await classDiary.updateDiaryEntry(editing.id, { content, enable_comments: comments });
        if (!r.success) return toast.error(r.error || a('diary_updateFailed'));
        await attach(editing.id);
        toast.success(a('diary_updated'));
      } else {
        const r = await classDiary.createDiaryEntry({
          content,
          section_id: section,
          teacher_id: chosenSlot?.teacher_id || myTeacherId,
          subject_id: chosenSlot?.subject_id,
          timetable_entry_id: chosenSlot ? slot : undefined,
          diary_date: date,
          day_of_week: dayOfWeek(date),
          entry_time: hms(),
          enable_comments: comments,
          campus_id: campusId,
        });
        if (!r.success || !r.data) return toast.error(r.error || a('diary_createEntryFailed'));
        await attach(r.data.id);
        toast.success(a('diary_created'));
      }
      clear();
      entries.mutate();
    } finally {
      setSaving(false);
    }
  }

  function edit(e: DiaryEntry) {
    setEditing(e);
    setContent(e.content);
    setComments(e.enable_comments);
    setEditorKey((k) => k + 1);
  }

  async function remove(e: DiaryEntry) {
    if (!(await confirm({ title: a('diary_deleteEntry'), body: a('diary_deleteConfirm'), destructive: true, confirmLabel: a('diary_delete') }))) return;
    const r = await classDiary.deleteDiaryEntry(e.id);
    if (!r.success) return toast.error(r.error || a('diary_deleteFailed'));
    toast.success(a('diary_deleted'));
    if (editing?.id === e.id) clear();
    entries.mutate();
  }

  async function removeFile(fileId: string) {
    const r = await classDiary.removeDiaryFile(fileId);
    if (!r.success) return toast.error(r.error || a('diary_removeFailed'));
    toast.success(a('diary_fileRemoved'));
    entries.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: a('diary_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted" className="text-sm">
          {a('diary_subtitle_write')}
        </Text>
        <View className="flex-row items-end gap-2">
          <Button size="icon" variant="outline" onPress={() => (setDate((d) => shift(d, -1)), setSlot(''))} accessibilityLabel={t('common.previous')}>
            <Icon as={ChevronLeft} flipRtl className="size-4" />
          </Button>
          <View className="flex-1">
            <DateField value={date} onChange={(d) => (setDate(d), setSlot(''))} />
          </View>
          <Button size="icon" variant="outline" onPress={() => (setDate((d) => shift(d, 1)), setSlot(''))} accessibilityLabel={t('common.next')}>
            <Icon as={ChevronRight} flipRtl className="size-4" />
          </Button>
        </View>
        <Text className="text-sm font-semibold">{new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        <Picker
          value={grade}
          onChange={(v) => {
            setGrade(v);
            setSection('');
            setSlot('');
          }}
          placeholder={a('diary_selectGrade')}
          options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
        />
        {grade ? (
          <Picker
            value={section}
            onChange={(v) => {
              setSection(v);
              setSlot('');
            }}
            placeholder={a('diary_selectSection')}
            options={sectionOptions.map((s) => ({ value: s.id, label: s.name }))}
          />
        ) : null}
        {section ? (
          timetable.isLoading ? (
            <Text variant="muted" className="text-sm">
              {a('diary_loadingSlots')}
            </Text>
          ) : daySlots.length ? (
            <View className="gap-1.5">
              <Label>{a('diary_coursePeriod')}</Label>
              <Picker
                value={slot}
                onChange={setSlot}
                placeholder={a('diary_selectPeriod')}
                options={daySlots.map((s) => ({ value: s.id, label: `${s.subject_name || '—'} — P${s.period_number ?? '?'} — ${s.teacher_name || '—'}` }))}
              />
            </View>
          ) : (
            <Text variant="muted" className="text-sm">
              {a('diary_noSlotsForDay')}
            </Text>
          )
        ) : null}

        {section ? (
          <Panel className="gap-3 p-4">
            <Text className="font-semibold">{editing ? a('diary_editEntry') : a('diary_newEntry')}</Text>
            <View className="gap-1.5">
              <Label>{a('diary_contentLabel')}</Label>
              <RichTextField key={editorKey} value={content} onChange={setContent} placeholder={a('diary_placeholder')} campusId={campusId} />
              <Text variant="muted" className="text-xs">
                {a('diary_contentHint')}
              </Text>
            </View>
            <CheckRow checked={comments} onPress={() => setComments((c) => !c)} label={a('diary_enableComments')} />
            <Button
              variant="outline"
              onPress={async () => {
                const picked = await pickDocuments({ multiple: true });
                setFiles((f) => [...f, ...picked]);
              }}>
              <Icon as={Upload} className="size-4" />
              <Text>{a('diary_attachFiles')}</Text>
            </Button>
            {files.map((f, i) => (
              <View key={`${f.uri}:${i}`} className="flex-row items-center gap-2">
                <Icon as={Paperclip} className="text-muted-foreground size-4" />
                <Text className="flex-1 text-sm" numberOfLines={1}>
                  {f.name}
                </Text>
                <Pressable onPress={() => setFiles((x) => x.filter((_, j) => j !== i))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                  <Icon as={X} className="text-muted-foreground size-4" />
                </Pressable>
              </View>
            ))}
            <View className="flex-row gap-2">
              {editing ? (
                <Button variant="outline" className="flex-1" onPress={clear} disabled={saving}>
                  <Text>{a('diary_cancelEdit')}</Text>
                </Button>
              ) : null}
              <Button className="flex-1" onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator size="small" /> : <Icon as={Save} className="text-primary-foreground size-4" />}
                <Text>{editing ? a('diary_updateEntry') : a('diary_saveEntry')}</Text>
              </Button>
            </View>
          </Panel>
        ) : (
          <Text variant="muted" className="py-6 text-center text-sm">
            {a('diary_chooseGrade')}
          </Text>
        )}

        {section ? (
          entries.isLoading ? (
            <LoadingList rows={2} />
          ) : (entries.data ?? []).length ? (
            <View className="gap-2">
              <Text className="font-semibold">{a('diary_existingEntriesFor', { date })}</Text>
              {(entries.data ?? []).map((e) => (
                <Panel key={e.id} className="gap-2 p-4">
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 text-sm font-medium">{[e.subject?.name, e.teacher?.profile ? `${e.teacher.profile.first_name} ${e.teacher.profile.last_name}` : null].filter(Boolean).join(' — ')}</Text>
                    <Pressable onPress={() => edit(e)} hitSlop={8} accessibilityRole="button" accessibilityLabel={a('diary_editEntry')}>
                      <Icon as={Pencil} className="size-4" />
                    </Pressable>
                    <Pressable onPress={() => remove(e)} accessibilityRole="button" accessibilityLabel={a('diary_deleteEntry')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  </View>
                  <Text className="text-sm">{htmlToText(e.content)}</Text>
                  {(e.files ?? []).map((f) => (
                    <View key={f.id} className="flex-row items-center gap-2">
                      <Pressable onPress={() => WebBrowser.openBrowserAsync(f.file_url)} className="flex-1 flex-row items-center gap-2" accessibilityRole="link">
                        <Icon as={Paperclip} className="text-muted-foreground size-4" />
                        <Text className="text-brand-secondary text-sm" numberOfLines={1}>
                          {f.file_name}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => removeFile(f.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                        <Icon as={X} className="text-destructive size-4" />
                      </Pressable>
                    </View>
                  ))}
                  <Text variant="muted" className="text-xs">
                    {a('diary_createdAt', { timestamp: new Date(e.created_at).toLocaleString(locale) })}
                  </Text>
                </Panel>
              ))}
            </View>
          ) : (
            <Text variant="muted" className="text-center text-sm">
              {a('diary_noEntriesForSection')}
            </Text>
          )
        ) : null}
      </ScrollView>
    </>
  );
}
