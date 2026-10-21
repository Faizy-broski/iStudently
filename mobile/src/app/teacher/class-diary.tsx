import { Stack } from 'expo-router';
import { BookOpen, NotebookPen, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FormSection, IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademic } from '@/features/portal/academic';
import { classDiary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import { StatusChip } from '@/components/app/status-chip';
import i18n from '@/i18n';

/** Daily class notes per class: pick a class, write an entry, list its entries (web: /teacher/class-diary). */
export default function TeacherClassDiary() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.classDiary.${key}`);
  const toast = useToast();
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const { campusId } = useCampus();
  const academic = usePortalAcademic();
  const cps = { data: academic.coursePeriods };
  const [cpId, setCpId] = useState('');
  const cp = (cps.data ?? []).find((c) => c.id === cpId) ?? null;
  const sectionId = cp?.section_id ?? null;
  const entries = useApi(cpId && staffId ? ['teacher', 'diary', cpId, staffId] : null, () => classDiary.getDiaryEntries({ section_id: sectionId ?? undefined, teacher_id: staffId ?? undefined }));
  const [form, setForm] = useState<{ content: string; date: string; comments: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const loc = i18n.language === 'ar' ? 'ar' : 'en';

  async function save() {
    if (!form?.content.trim()) return toast.error(k('enterContentWarning'));
    if (!sectionId || !staffId) return toast.error(k('missingClassOrTeacher'));
    setBusy(true);
    const r = await classDiary.createDiaryEntry({ content: form.content.trim(), section_id: sectionId, teacher_id: staffId, diary_date: form.date, enable_comments: form.comments, campus_id: campusId ?? undefined });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('createEntryFailed'));
    toast.success(k('entryCreated'));
    setForm(null);
    entries.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => entries.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('pageSubtitle')}</Text>
        <Panel className="gap-1.5 p-4">
          <Label>{k('selectClass')}</Label>
          <Picker
            value={cpId || null}
            onChange={setCpId}
            placeholder={k('chooseClassPlaceholder')}
            options={(cps.data ?? []).map((c) => ({ value: c.id, label: `${c.course?.title || c.title || k('unnamed')}${c.section?.name ? ` — ${c.section.name}` : ''}` }))}
          />
        </Panel>
        {cpId ? (
          <Button variant={form ? 'outline' : 'default'} size="sm" className="self-start" onPress={() => setForm(form ? null : { content: '', date: todayYmd(), comments: false })}>
            <Icon as={form ? X : Plus} className={form ? 'size-4' : 'text-primary-foreground size-4'} />
            <Text>{form ? k('cancel') : k('newEntry')}</Text>
          </Button>
        ) : null}
        {form ? (
          <FormSection title={k('newDiaryEntry')} icon={NotebookPen}>
            <DateField label={k('date')} value={form.date} onChange={(d) => d && setForm({ ...form, date: d })} />
            <View className="gap-1.5">
              <Label>{`${k('content')} *`}</Label>
              <Textarea value={form.content} onChangeText={(v) => setForm({ ...form, content: v })} placeholder={k('contentPlaceholder')} />
            </View>
            <View className="flex-row items-center gap-3">
              <Text className="flex-1 text-sm font-medium">{k('allowStudentComments')}</Text>
              <Switch checked={form.comments} onCheckedChange={(v) => setForm({ ...form, comments: v })} />
            </View>
            <Button onPress={save} disabled={busy}>
              <Text>{busy ? k('saving') : k('saveEntry')}</Text>
            </Button>
          </FormSection>
        ) : null}
        {!cpId ? (
          <EmptyState icon={BookOpen} title={k('selectClassHint')} />
        ) : entries.isLoading ? (
          <LoadingList rows={3} />
        ) : !(entries.data ?? []).length ? (
          <EmptyState icon={NotebookPen} title={k('noDiaryEntries')} />
        ) : (
          <Panel>
            {(entries.data ?? []).map((e, i, arr) => (
              <View key={e.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                <IconTile icon={NotebookPen} size={40} />
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-semibold">{new Date(`${e.diary_date.slice(0, 10)}T00:00:00`).toLocaleDateString(loc, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                  {e.is_published || e.enable_comments ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {e.is_published ? <StatusChip label={k('published')} tone="success" /> : null}
                      {e.enable_comments ? <StatusChip label={k('commentsOn')} tone="info" /> : null}
                    </View>
                  ) : null}
                  <Text className="text-muted-foreground text-sm">{e.content}</Text>
                </View>
              </View>
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
