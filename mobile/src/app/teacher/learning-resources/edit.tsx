import type { LearningResourceType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Book, FileText, HeartPulse, Link2, PenLine, Tag, Video, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { FormSection, StickyActions } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { AttachmentField } from '@/features/teacher/homework';
import { learningResources, media, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import type { PickedDocument } from '@/lib/upload';

const TYPES: [LearningResourceType, string][] = [
  ['link', 'typeLink'],
  ['book', 'typeBook'],
  ['post', 'typePost'],
  ['file', 'typeFile'],
  ['video', 'typeVideo'],
  ['anatomy', 'typeAnatomy'],
];
/** 3D models the web viewer has (frontend lib/anatomy/anatomy-data organStructures). */
const ORGANS = ['heart', 'brain', 'lungs', 'liver', 'kidneys', 'eyeball', 'intestine', 'pancreas', 'skin'];
const TYPE_ICON: Record<LearningResourceType, LucideIcon> = {
  link: Link2,
  book: Book,
  post: PenLine,
  file: FileText,
  video: Video,
  anatomy: HeartPulse,
};
const NONE = '__all__';
const MAX = 25 * 1024 * 1024;

type Form = {
  type: LearningResourceType;
  title: string;
  description: string;
  section: string;
  subject: string;
  url: string;
  content: string;
  bookTitle: string;
  bookAuthor: string;
  bookIsbn: string;
  tags: string;
  pinned: boolean;
  published: boolean;
  files: string[];
};
const EMPTY: Form = {
  type: 'link',
  title: '',
  description: '',
  section: '',
  subject: '',
  url: '',
  content: '',
  bookTitle: '',
  bookAuthor: '',
  bookIsbn: '',
  tags: '',
  pinned: false,
  published: true,
  files: [],
};

/** Share a new learning resource or edit one (`?id=`): type, section / subject, per-type fields, tags, pin, publish (web: /teacher/learning-resources dialog). */
export default function TeacherLearningResourceForm() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.learningResources.${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const { campusId } = useCampus();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useApi(id ? ['teacher', 'lr-item', id] : null, ([, , r]) => learningResources.get(r as string));
  const subjects = useApi(['teacher', 'my-subjects'], () => teacher.mySubjects());
  const [form, setForm] = useState<Form | null>(id ? null : EMPTY);
  const [picked, setPicked] = useState<PickedDocument[]>([]);
  const [busy, setBusy] = useState<'' | 'uploading' | 'saving'>('');
  const r = existing.data;
  if (id && !form && r) {
    setForm({
      type: r.resource_type,
      title: r.title,
      description: r.description ?? '',
      section: r.section_id ?? '',
      subject: r.subject_id ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
      bookTitle: r.book_title ?? '',
      bookAuthor: r.book_author ?? '',
      bookIsbn: r.book_isbn ?? '',
      tags: r.tags?.join(', ') ?? '',
      pinned: r.is_pinned,
      published: r.is_published,
      files: r.file_urls ?? [],
    });
  }
  const assigned = subjects.data ?? [];
  const sections = [...new Map(assigned.filter((a) => a.section).map((a) => [a.section!.id, `${a.section!.grade_level?.name ? `${a.section!.grade_level.name} - ` : ''}${a.section!.name}`])).entries()];
  const subjectList = [...new Map(assigned.filter((a) => a.subject).map((a) => [a.subject!.id, a.subject!.name])).entries()];

  if (!form) return <LoadingList rows={5} />;
  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));

  async function save() {
    if (!form || !profile?.staff_id || !profile.school_id) return;
    if (!form.title.trim()) return toast.error(k('enterTitleError'));
    if (!form.section) return toast.error(k('selectSectionError'));
    if (form.type === 'anatomy' && !form.content) return toast.error(k('selectAnatomyOrganError'));
    const uploaded: string[] = [];
    if (form.type === 'file' && picked.length) {
      setBusy('uploading');
      for (const f of picked) {
        const up = await media.uploadAttachment({ uri: f.uri, name: f.name, type: f.type }, campusId ?? undefined);
        if (!up.success || !up.data) {
          setBusy('');
          return toast.error(up.error || k('uploadFilesError'));
        }
        uploaded.push(up.data.url);
      }
    }
    setBusy('saving');
    const assignment = assigned.find((a) => a.section_id === form.section);
    const files = [...form.files, ...uploaded];
    const body = {
      school_id: profile.school_id,
      campus_id: profile.campus_id ?? null,
      academic_year_id: assignment?.academic_year_id || assigned[0]?.academic_year_id || '',
      teacher_id: profile.staff_id,
      section_id: form.section,
      subject_id: form.subject || undefined,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      resource_type: form.type,
      url: form.url.trim() || undefined,
      content: form.type === 'post' || form.type === 'anatomy' ? form.content : undefined,
      file_urls: files.length ? files : undefined,
      book_title: form.bookTitle.trim() || undefined,
      book_author: form.bookAuthor.trim() || undefined,
      book_isbn: form.bookIsbn.trim() || undefined,
      tags: form.tags
        ? form.tags
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        : undefined,
      is_pinned: form.pinned,
      is_published: form.published,
    };
    const out = id ? await learningResources.update(id, body) : await learningResources.create(body);
    setBusy('');
    if (!out.success) return toast.error(out.error || k('saveResourceError'));
    toast.success(id ? k('resourceUpdatedSuccess') : k('resourceSharedSuccess'));
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: id ? k('editResource') : k('shareNewResource') }} />
      <KeyboardAvoidingView className="bg-background flex-1">
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <FormSection title={id ? k('editResource') : k('shareNewResource')} description={id ? k('updateResourceDescription') : k('shareResourceDescription')} icon={TYPE_ICON[form.type]}>
            <View className="gap-1.5">
              <Label>{k('resourceType')}</Label>
              <FilterChips
                value={form.type}
                onChange={(type) => set({ type })}
                options={TYPES.map(([type, key]) => ({
                  value: type,
                  label: k(key),
                }))}
              />
            </View>
            <View className="gap-1.5">
              <Label>{k('titleField')}</Label>
              <Input value={form.title} onChangeText={(v) => set({ title: v })} placeholder={k('titlePlaceholder')} />
            </View>
            <View className="gap-1.5">
              <Label>{k('description')}</Label>
              <Textarea value={form.description} onChangeText={(v) => set({ description: v })} placeholder={k('descriptionPlaceholder')} />
            </View>
            <View className="gap-1.5">
              <Label>{k('sectionField')}</Label>
              <Picker
                value={form.section || null}
                onChange={(v) => set({ section: v })}
                placeholder={k('selectSectionPlaceholder')}
                options={sections.map(([sid, name]) => ({
                  value: sid,
                  label: name,
                }))}
              />
            </View>
            <View className="gap-1.5">
              <Label>{k('subjectFieldOptional')}</Label>
              <Picker
                value={form.subject || NONE}
                onChange={(v) => set({ subject: v === NONE ? '' : v })}
                options={[
                  { value: NONE, label: k('allSubjects') },
                  ...subjectList.map(([sid, name]) => ({
                    value: sid,
                    label: name,
                  })),
                ]}
              />
            </View>
          </FormSection>
          <FormSection title={k(TYPES.find(([ty]) => ty === form.type)?.[1] ?? 'resourceType')} icon={TYPE_ICON[form.type]}>
            {form.type === 'link' || form.type === 'video' ? (
              <View className="gap-1.5">
                <Label>{k('urlField')}</Label>
                <Input value={form.url} onChangeText={(v) => set({ url: v })} placeholder={form.type === 'video' ? 'https://youtube.com/...' : 'https://...'} autoCapitalize="none" keyboardType="url" />
              </View>
            ) : null}
            {form.type === 'book' ? (
              <>
                <View className="gap-1.5">
                  <Label>{k('bookTitle')}</Label>
                  <Input value={form.bookTitle} onChangeText={(v) => set({ bookTitle: v })} placeholder={k('bookTitle')} />
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1.5">
                    <Label>{k('author')}</Label>
                    <Input value={form.bookAuthor} onChangeText={(v) => set({ bookAuthor: v })} placeholder={k('authorNamePlaceholder')} />
                  </View>
                  <View className="flex-1 gap-1.5">
                    <Label>{k('isbnOptional')}</Label>
                    <Input value={form.bookIsbn} onChangeText={(v) => set({ bookIsbn: v })} placeholder={k('isbn')} />
                  </View>
                </View>
                <View className="gap-1.5">
                  <Label>{k('purchaseLinkOptional')}</Label>
                  <Input value={form.url} onChangeText={(v) => set({ url: v })} placeholder="https://..." autoCapitalize="none" keyboardType="url" />
                </View>
              </>
            ) : null}
            {form.type === 'post' ? (
              <View className="gap-1.5">
                <Label>{k('content')}</Label>
                <HtmlEditorField value={form.content} onChange={(v) => set({ content: v })} />
              </View>
            ) : null}
            {form.type === 'file' ? (
              <View className="gap-1.5">
                <Label>{k('files')}</Label>
                {form.files.length ? <Text className="text-muted-foreground text-sm font-medium">{k('existingFiles')}</Text> : null}
                <AttachmentField
                  existing={form.files}
                  onRemoveExisting={(i) => set({ files: form.files.filter((_, j) => j !== i) })}
                  picked={picked}
                  onPick={(docs) => setPicked((x) => [...x, ...docs])}
                  onTooLarge={(name) => toast.error(k('fileTooLargeError', { fileName: name }))}
                  onRemove={(i) => setPicked((x) => x.filter((_, j) => j !== i))}
                  maxBytes={MAX}
                />
              </View>
            ) : null}
            {form.type === 'anatomy' ? (
              <View className="gap-1.5">
                <Label>{k('anatomyOrganField')}</Label>
                <Picker
                  value={form.content || null}
                  onChange={(v) => set({ content: v })}
                  placeholder={k('selectAnatomyOrganPlaceholder')}
                  options={ORGANS.map((o) => ({
                    value: o,
                    label: t(`app.te_lr_organ_${o}`),
                  }))}
                />
                <Text className="text-muted-foreground text-xs">{k('anatomyOrganHint')}</Text>
              </View>
            ) : null}
          </FormSection>
          <FormSection title={k('tagsField')} icon={Tag}>
            <View className="gap-1.5">
              <Label>{k('tagsField')}</Label>
              <Input value={form.tags} onChangeText={(v) => set({ tags: v })} placeholder={k('tagsPlaceholder')} />
            </View>
            <View className="flex-row items-center gap-3">
              <Switch checked={form.pinned} onCheckedChange={(v) => set({ pinned: v })} />
              <Text className="flex-1 text-sm">{k('pinToTop')}</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Switch checked={form.published} onCheckedChange={(v) => set({ published: v })} />
              <Text className="flex-1 text-sm">{k('publishImmediately')}</Text>
            </View>
          </FormSection>
        </ScrollView>
        <StickyActions>
          <Button variant="outline" className="flex-1" onPress={() => router.back()} disabled={!!busy}>
            <Text>{k('cancel')}</Text>
          </Button>
          <Button className="flex-1" onPress={save} disabled={!!busy}>
            <Text>{busy === 'uploading' ? k('uploading') : busy === 'saving' ? k('saving') : id ? k('updateResource') : k('shareResource')}</Text>
          </Button>
        </StickyActions>
      </KeyboardAvoidingView>
    </>
  );
}
