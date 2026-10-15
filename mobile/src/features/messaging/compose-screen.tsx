import type { MessageTemplate, RecipientType, UploadedAttachment } from '@studently/api-client';
import { htmlToText, textToHtml } from '@studently/shared-utils';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Paperclip, Pencil, Save, Send, Trash2, Users, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { substitutionGroups } from '@/features/messaging/substitutions';
import { adminAcademics, media, messaging } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { pickDocuments } from '@/lib/upload';
import { useResetOn } from '@/lib/use-reset-on';

const MAX_ATTACHMENTS = 10;
const PAGE_SIZE = 25;
const NO_TEMPLATE = '__none__';


/**
 * Write a message: recipients by tab (grade/section filters for students and parents), saved
 * templates, personalisation tokens and attachments. Shared by every role
 * (web: components/messaging/MessageCompose). Rich formatting and voice notes stay web-only.
 */
export function MessagingComposeScreen({ inboxHref }: { inboxHref: Href }) {
  const { t } = useTranslation();
  const w = (k: string, o?: Record<string, unknown>) => t(`teacherPages.messagingWrite.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { me } = useSession();
  const role = me.status === 'ready' ? me.me.profile.role : null;
  const isTeacher = role === 'teacher';
  const canMessageStudents = role === 'admin' || role === 'teacher' || role === 'super_admin';
  const { campusId } = useCampus();
  const params = useLocalSearchParams<{ reply_to?: string; reply_name?: string; reply_to_message_id?: string; subject?: string }>();

  const [subject, setSubject] = useState(params.subject ?? '');
  const [body, setBody] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [tabState, setTab] = useState<RecipientType>(isTeacher ? 'students' : 'teachers');
  // Teachers can't message teachers or parents here: fall back to students.
  const tab: RecipientType = isTeacher && (tabState === 'teachers' || tabState === 'parents') ? 'students' : tabState;
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput.trim(), 300);
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [pickedSections, setSectionIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(params.reply_to ? [params.reply_to] : []));
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [templateId, setTemplateId] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const templates = useApi(['messaging', 'templates'], () => messaging.listTemplates());
  const tplList = useMemo(() => [...(templates.data ?? [])].sort((a, b) => a.title.localeCompare(b.title)), [templates.data]);
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const allSections = useApi(['admin', 'sections', campusId ?? 'school', 'all'], () => adminAcademics.sections(campusId));
  const filterApplies = tab === 'students' || tab === 'parents';
  const sections = useMemo(() => {
    const list = (allSections.data ?? []).filter((s) => gradeIds.includes(s.grade_level_id));
    if (gradeIds.length <= 1) return list;
    return list.map((s) => ({ ...s, name: `${(grades.data ?? []).find((g) => g.id === s.grade_level_id)?.name ?? ''} - ${s.name}` }));
  }, [allSections.data, gradeIds, grades.data]);
  // Only sections still offered for the chosen grades count.
  const sectionIds = useMemo(() => pickedSections.filter((id) => sections.some((s) => s.id === id)), [pickedSections, sections]);

  const recKey = ['messaging', 'recipients', tab, search, campusId ?? '', filterApplies ? gradeIds.join(',') : '', filterApplies ? sectionIds.join(',') : ''];
  const recipients = useApi(recKey, ([, , tb, s, , g, sec]) =>
    messaging.listRecipients(tb as RecipientType, {
      search: String(s) || undefined,
      campusId,
      gradeLevelIds: g ? String(g).split(',') : undefined,
      sectionIds: sec ? String(sec).split(',') : undefined,
      page: 1,
      limit: 1000,
    }),
  );
  useResetOn(JSON.stringify([tab, search, campusId, gradeIds, sectionIds]), () => setPage(1));
  const options = recipients.data ?? [];
  const totalPages = Math.max(1, Math.ceil(options.length / PAGE_SIZE));
  const visible = options.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allSelected = options.length > 0 && options.every((o) => selected.has(o.profileId));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const o of options) (allSelected ? next.delete(o.profileId) : next.add(o.profileId));
      return next;
    });

  function insertToken(token: string) {
    const at = selection?.start ?? body.length;
    const end = selection?.end ?? at;
    setBody(body.slice(0, at) + token + body.slice(end));
  }

  function applyTemplate(id: string) {
    if (id === NO_TEMPLATE) {
      setTemplateId('');
      setTemplateTitle('');
      return;
    }
    setTemplateId(id);
    const tpl = tplList.find((x) => x.id === id);
    if (tpl) {
      setSubject(tpl.subject || '');
      setBody(htmlToText(tpl.body || ''));
      setTemplateTitle(tpl.title);
    }
  }

  async function saveTemplate() {
    if (!templateTitle.trim()) return toast.error(w('enterTemplateTitleFirst'));
    if (!subject.trim() && !body.trim()) return toast.error(w('writeSubjectOrMessageBeforeSaving'));
    setSavingTpl(true);
    try {
      const r = await messaging.saveTemplate({ title: templateTitle.trim(), subject, body: textToHtml(body), campus_id: campusId });
      if (!r.success) return toast.error(r.error || w('failedToSaveTemplate'));
      toast.success(w('templateSaved'));
      templates.mutate();
    } finally {
      setSavingTpl(false);
    }
  }

  async function updateCurrentTemplate() {
    const current = tplList.find((x) => x.id === templateId);
    if (!current) return;
    setSavingTpl(true);
    try {
      const r = await messaging.updateTemplate(templateId, { title: templateTitle.trim() || current.title, subject, body: textToHtml(body) });
      if (!r.success) return toast.error(r.error || w('failedToUpdateTemplate'));
      toast.success(w('templateUpdated'));
      templates.mutate();
    } finally {
      setSavingTpl(false);
    }
  }

  async function attach() {
    if (attachments.length >= MAX_ATTACHMENTS) return toast.error(w('canAttachUpTo', { max: MAX_ATTACHMENTS }));
    const files = (await pickDocuments({ multiple: true })).slice(0, MAX_ATTACHMENTS - attachments.length);
    for (const file of files) {
      setUploading((n) => n + 1);
      try {
        const r = await media.uploadAttachment(file, campusId);
        if (!r.success || !r.data) toast.error(r.error || w('failedToUpload', { fileName: file.name }));
        else setAttachments((a) => [...a, { ...r.data!, name: r.data!.name || file.name }]);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function send() {
    if (!subject.trim()) return toast.error(w('subjectRequired'));
    if (!body.trim()) return toast.error(w('messageRequired'));
    if (!selected.size) return toast.error(w('selectAtLeastOneRecipient'));
    if (uploading > 0) return toast.error(w('waitForAttachmentsToFinish'));
    setSending(true);
    try {
      const r = await messaging.sendMessage({
        recipient_ids: [...selected],
        subject: subject.trim(),
        body: textToHtml(body),
        campus_id: campusId,
        reply_to_message_id: params.reply_to_message_id,
        attachments: attachments.map((a) => ({ url: a.url, name: a.name, mime_type: a.mime_type, size: a.size, path: a.path })),
      });
      if (!r.success) return toast.error(r.error || w('failedToSendMessage'));
      toast.success(w('messageSent'));
      router.replace(inboxHref);
    } finally {
      setSending(false);
    }
  }

  const tabs: RecipientType[] = [...(!isTeacher ? (['teachers'] as const) : []), 'staff', ...(!isTeacher ? (['parents'] as const) : []), ...(canMessageStudents ? (['students'] as const) : [])];
  const tabLabel = (x: RecipientType) => (x === 'staff' && isTeacher ? w('adminAndApprovedStaff') : x === 'students' && isTeacher ? w('myStudents') : w(x));

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <Card>
        <CardContent className="gap-3 pt-4">
          <Text className="font-semibold">{w('newMessage')}</Text>
          {params.reply_name ? <Text className="text-muted-foreground text-xs">→ {params.reply_name}</Text> : null}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Label>{w('useATemplate')}</Label>
              <Pressable onPress={() => setManageOpen(true)}>
                <Text className="text-primary text-xs">{w('manageTemplates')}</Text>
              </Pressable>
            </View>
            <Picker value={templateId || NO_TEMPLATE} onChange={applyTemplate} placeholder={w('chooseASavedTemplate')} options={[{ value: NO_TEMPLATE, label: tplList.length ? w('chooseASavedTemplate') : w('noTemplatesSaved') }, ...tplList.map((x) => ({ value: x.id, label: x.title }))]} />
          </View>
          <View className="gap-1.5">
            <Label>
              {w('subject')} <Text className="text-destructive">*</Text>
            </Label>
            <Input value={subject} onChangeText={setSubject} placeholder={w('messageSubject')} />
          </View>
          <View className="gap-1.5">
            <Label>
              {w('message')} <Text className="text-destructive">*</Text>
            </Label>
            <Textarea value={body} onChangeText={setBody} onSelectionChange={(e) => setSelection(e.nativeEvent.selection)} className="min-h-40" />
          </View>
          <View className="gap-1.5">
            <Text className="text-muted-foreground text-xs">{t('app.msg_tokens_hint')}</Text>
            {substitutionGroups(tab).map((g) => (
              <View key={g.key} className="gap-1">
                <Text className="text-xs font-medium">{t(`app.msg_group_${g.key}`)}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0" style={{ flexGrow: 0 }} contentContainerClassName="gap-1.5">
                  {g.fields.map((f) => (
                    <Pressable key={f} onPress={() => insertToken(f)} className="border-border rounded-full border px-2.5 py-1">
                      <Text className="text-xs">{t(`app.msg_tok_${f.replace(/_/g, '').toLowerCase()}`)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Button size="sm" variant="outline" disabled={uploading > 0 || attachments.length >= MAX_ATTACHMENTS} onPress={attach}>
                <Icon as={Paperclip} className="text-foreground size-4" />
                <Text>{w('attachFiles')}</Text>
              </Button>
              {uploading > 0 ? <Text className="text-muted-foreground text-xs">{w('uploadingCount', { count: uploading })}</Text> : null}
            </View>
            {attachments.length ? (
              <View className="flex-row flex-wrap gap-2">
                {attachments.map((a) => (
                  <View key={a.path} className="bg-muted flex-row items-center gap-1.5 rounded-md px-2.5 py-1.5">
                    <Text className="max-w-40 text-xs" numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Pressable onPress={() => setAttachments((p) => p.filter((x) => x.path !== a.path))} hitSlop={6} accessibilityLabel={w('removeAttachment')}>
                      <Icon as={X} className="text-muted-foreground size-3.5" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <Separator />
          <View className="gap-1.5">
            <Label>{templateId ? w('templateTitle') : w('saveThisAsATemplate')}</Label>
            <Input value={templateTitle} onChangeText={setTemplateTitle} placeholder={w('templateTitle')} />
            <View className="flex-row flex-wrap gap-2">
              {templateId ? (
                <Button size="sm" variant="outline" disabled={savingTpl} onPress={updateCurrentTemplate}>
                  <Icon as={Pencil} className="text-foreground size-4" />
                  <Text>{w('updateCurrentTemplate')}</Text>
                </Button>
              ) : null}
              <Button size="sm" variant="outline" disabled={savingTpl} onPress={saveTemplate}>
                <Icon as={Save} className="text-foreground size-4" />
                <Text>{templateId ? w('templateSavedAsNew') : w('saveTemplate')}</Text>
              </Button>
            </View>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="gap-3 pt-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Icon as={Users} className="text-foreground size-5" />
            <Text className="font-semibold">{w('recipients')}</Text>
            {selected.size ? (
              <View className="bg-primary rounded-full px-2 py-0.5">
                <Text className="text-primary-foreground text-xs">{w('selectedCount', { count: selected.size })}</Text>
              </View>
            ) : null}
            <View className="flex-1" />
            {selected.size ? (
              <Button size="sm" variant="ghost" onPress={() => setSelected(new Set())}>
                <Icon as={X} className="text-foreground size-4" />
                <Text>{w('clear')}</Text>
              </Button>
            ) : null}
          </View>
          <FilterChips value={tab} onChange={setTab} options={tabs.map((x) => ({ value: x, label: tabLabel(x) }))} />
          <SearchBar value={searchInput} onChangeText={setSearchInput} placeholder={w('searchRecipientTab', { tab: w(tab) })} />
          {filterApplies ? (
            <View className="gap-2">
              <MultiSelect options={(grades.data ?? []).map((g) => ({ id: g.id, label: g.name }))} value={gradeIds} onChange={setGradeIds} placeholder={w('allGrades')} title={w('allGrades')} emptyMessage={w('allGrades')} />
              {gradeIds.length ? <MultiSelect options={sections.map((s) => ({ id: s.id, label: s.name }))} value={sectionIds} onChange={setSectionIds} placeholder={w('allSections')} title={w('allSections')} emptyMessage={w('allSections')} /> : null}
            </View>
          ) : null}
          {recipients.isLoading ? (
            <LoadingList rows={4} />
          ) : !options.length ? (
            <Text className="text-muted-foreground py-6 text-center text-sm">{w('noResultsFound')}</Text>
          ) : (
            <View>
              <CheckRow checked={allSelected} onPress={toggleAll} label={w('selectAllResults', { count: options.length })} />
              <Separator className="my-1" />
              {visible.map((o) => (
                <Pressable key={o.profileId} onPress={() => toggle(o.profileId)} className="flex-row items-center gap-3 py-2">
                  <CheckRow checked={selected.has(o.profileId)} onPress={() => toggle(o.profileId)} label="" />
                  <View className="flex-1">
                    <Text className="text-sm font-medium">{o.name || w('unnamed')}</Text>
                    {o.subtitle ? <Text className="text-muted-foreground text-xs">{o.subtitle}</Text> : null}
                  </View>
                </Pressable>
              ))}
              {totalPages > 1 ? (
                <View className="flex-row items-center justify-end gap-2 pt-2">
                  <Button size="icon" variant="outline" disabled={page === 1} onPress={() => setPage(page - 1)}>
                    <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
                  </Button>
                  <Text className="text-xs">
                    {page} / {totalPages}
                  </Text>
                  <Button size="icon" variant="outline" disabled={page === totalPages} onPress={() => setPage(page + 1)}>
                    <Icon as={ChevronRight} className="text-foreground size-4 rtl:rotate-180" />
                  </Button>
                </View>
              ) : null}
            </View>
          )}
        </CardContent>
      </Card>

      <Button onPress={send} disabled={sending || uploading > 0 || selected.size === 0}>
        <Icon as={Send} className="text-primary-foreground size-4" />
        <Text>{sending ? w('sending') : w('send')}</Text>
      </Button>

      <ManageTemplates
        open={manageOpen}
        templates={tplList}
        onClose={() => setManageOpen(false)}
        onUse={(id) => {
          applyTemplate(id);
          setManageOpen(false);
        }}
        onChanged={() => templates.mutate()}
        onDeleted={(id) => {
          if (id === templateId) applyTemplate(NO_TEMPLATE);
        }}
        confirmDelete={(title) => confirm({ title: w('confirmDeleteTemplate', { title }), destructive: true, confirmLabel: t('common.delete') })}
      />
    </ScrollView>
  );
}

function ManageTemplates({
  open,
  templates,
  onClose,
  onUse,
  onChanged,
  onDeleted,
  confirmDelete,
}: {
  open: boolean;
  templates: MessageTemplate[];
  onClose: () => void;
  onUse: (id: string) => void;
  onChanged: () => void;
  onDeleted: (id: string) => void;
  confirmDelete: (title: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const w = (k: string, o?: Record<string, unknown>) => t(`teacherPages.messagingWrite.${k}`, o);
  const toast = useToast();
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState({ title: '', subject: '', body: '' });
  const [busy, setBusy] = useState(false);

  async function saveEdit() {
    if (!editing) return;
    if (!form.title.trim()) return toast.error(w('templateTitle'));
    setBusy(true);
    try {
      const r = await messaging.updateTemplate(editing.id, { title: form.title.trim(), subject: form.subject, body: textToHtml(form.body) });
      if (!r.success) return toast.error(r.error || w('failedToUpdateTemplate'));
      toast.success(w('templateUpdated'));
      setEditing(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(tpl: MessageTemplate) {
    if (!(await confirmDelete(tpl.title || 'Template'))) return;
    const r = await messaging.deleteTemplate(tpl.id);
    if (!r.success) return toast.error(r.error || w('failedToDeleteTemplate'));
    toast.success(w('templateDeleted'));
    onDeleted(tpl.id);
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? w('editTemplate') : w('manageTemplates')}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[460px]" contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
          {editing ? (
            <>
              <Label>{w('templateTitle')}</Label>
              <Input value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
              <Label>{w('subject')}</Label>
              <Input value={form.subject} onChangeText={(v) => setForm((f) => ({ ...f, subject: v }))} />
              <Label>{w('message')}</Label>
              <Textarea value={form.body} onChangeText={(v) => setForm((f) => ({ ...f, body: v }))} className="min-h-32" />
            </>
          ) : !templates.length ? (
            <Text className="text-muted-foreground py-4 text-center text-sm">{w('noTemplatesSaved')}</Text>
          ) : (
            templates.map((tpl) => (
              <View key={tpl.id} className="border-border gap-1 rounded-md border p-3">
                <Text className="font-medium">{tpl.title}</Text>
                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                  {w('subject')}: {tpl.subject}
                </Text>
                <View className="flex-row justify-end gap-1">
                  <Button size="sm" variant="outline" onPress={() => onUse(tpl.id)}>
                    <Text>{w('chooseASavedTemplate', { defaultValue: 'Use' })}</Text>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onPress={() => {
                      setEditing(tpl);
                      setForm({ title: tpl.title, subject: tpl.subject, body: htmlToText(tpl.body) });
                    }}
                    accessibilityLabel={w('editTemplate')}>
                    <Icon as={Pencil} className="text-foreground size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => remove(tpl)} accessibilityLabel={w('deleteTemplate')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Button>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => (editing ? setEditing(null) : onClose())}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          {editing ? (
            <Button onPress={saveEdit} disabled={busy}>
              <Text>{w('updateTemplate')}</Text>
            </Button>
          ) : null}
        </View>
      </DialogContent>
    </Dialog>
  );
}
