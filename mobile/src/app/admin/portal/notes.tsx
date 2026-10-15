import type { PortalNote } from '@studently/api-client';
import { Stack } from 'expo-router';
import { FileText, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_VISIBILITY, VisibilityPicker, visibilityOf, type VisibilityState } from '@/features/admin/visibility';
import { useCampus } from '@/features/campus/campus';
import { adminPortal, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments } from '@/lib/upload';

interface NoteRow {
  id?: string;
  key: string;
  title: string;
  content: string;
  sort_order: string;
  file_url: string;
  file_name: string;
  embed_link: string;
  visible_from: string;
  visible_until: string;
  visibility: VisibilityState;
}

let seq = 0;
const blank = (sort: number): NoteRow => ({ key: `new-${seq++}`, title: '', content: '', sort_order: String(sort), file_url: '', file_name: '', embed_link: '', visible_from: '', visible_until: '', visibility: EMPTY_VISIBILITY });
/** ISO → YYYY-MM-DD and back, like the web's date inputs. */
const toDay = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
const fromDay = (d: string) => (d ? new Date(d).toISOString() : undefined);

const toRow = (n: PortalNote): NoteRow => ({
  id: n.id,
  key: n.id,
  title: n.title,
  content: n.content,
  sort_order: String(n.sort_order ?? 0),
  file_url: n.file_url || '',
  file_name: n.file_name || '',
  embed_link: n.embed_link || '',
  visible_from: toDay(n.visible_from),
  visible_until: toDay(n.visible_until),
  visibility: visibilityOf(n),
});

/** Portal notes shown on users' dashboards: inline edit, markdown preview, file, link, dates, audience (web: /admin/portal/notes). */
export default function PortalNotes() {
  const { t } = useTranslation();
  const n = (k: string, o?: Record<string, unknown>) => t(`school.portal_notes.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(campusId ? ['admin', 'portal-notes', campusId] : null, ([, , c]) => adminPortal.notes(String(c)));
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!res.data) return;
    const list = res.data.map(toRow);
    setRows([...list, blank(list.length)]);
  }, [res.data]);

  const update = (key: string, patch: Partial<NoteRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function remove(row: NoteRow) {
    if (row.id) {
      const r = await adminPortal.deleteNote(row.id);
      if (!r.success) return toast.error(r.error || t('common.error'));
      toast.success(n('success_deleted'));
    }
    setRows((prev) => {
      const next = prev.filter((x) => x.key !== row.key);
      return next.length && !next[next.length - 1].id ? next : [...next, blank(next.length)];
    });
  }

  async function attach(row: NoteRow) {
    if (!campusId) return toast.error(n('err_select_campus'));
    const [file] = await pickDocuments({ multiple: false });
    if (!file) return;
    setUploading(row.key);
    try {
      const r = await media.uploadAttachment(file, campusId);
      if (!r.success || !r.data) return toast.error(r.error || t('app.pn_upload_failed'));
      update(row.key, { file_url: r.data.url, file_name: file.name });
      toast.success(file.name);
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!campusId) return toast.error(n('err_select_campus'));
    setSaving(true);
    try {
      for (const row of rows) {
        if (!row.title.trim() && !row.content.trim()) continue;
        const body = {
          title: row.title || 'Untitled',
          content: row.content,
          content_type: 'markdown' as const,
          file_url: row.file_url || undefined,
          file_name: row.file_name || undefined,
          embed_link: row.embed_link || undefined,
          sort_order: parseInt(row.sort_order, 10) || 0,
          is_pinned: false,
          visible_from: fromDay(row.visible_from),
          visible_until: fromDay(row.visible_until),
          visible_to_roles: row.visibility.mode === 'roles' && row.visibility.roles.length ? row.visibility.roles : ['admin', 'teacher', 'student', 'parent'],
          visible_to_grade_ids: row.visibility.gradeIds,
          visible_to_user_ids: row.visibility.mode !== 'roles' ? row.visibility.userIds : [],
          campus_id: campusId,
        };
        const r = row.id ? await adminPortal.updateNote(row.id, body) : await adminPortal.createNote(body);
        if (!r.success) throw new Error(r.error);
      }
      toast.success(n('success_saved'));
      res.mutate();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  const saveBtn = (
    <Button onPress={save} disabled={saving} className="self-end">
      <Text>{saving ? n('btn_saving') : n('btn_save')}</Text>
    </Button>
  );
  const savedCount = rows.filter((r) => r.id).length;

  if (!campusId) return <EmptyState icon={FileText} title={n('prompt_select_campus')} body={n('prompt_select_campus_desc')} />;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: n('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {saveBtn}
        <Text className="text-muted-foreground text-sm italic">{savedCount ? n('notes_found', { count: savedCount }) : n('no_notes')}</Text>
        {res.isLoading && !res.data ? (
          <LoadingList />
        ) : (
          rows.map((row) => (
            <Card key={row.key}>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-center gap-2">
                  {row.id ? (
                    <Button size="icon" variant="ghost" onPress={() => remove(row)} accessibilityLabel={t('common.delete')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  ) : (
                    <Icon as={Plus} className="text-muted-foreground size-5" />
                  )}
                  <View className="flex-1 gap-1">
                    <Label>{n('table_title')}</Label>
                    <Input value={row.title} onChangeText={(v) => update(row.key, { title: v })} />
                  </View>
                  <View className="w-20 gap-1">
                    <Label>{n('table_sort')}</Label>
                    <Input value={row.sort_order} keyboardType="number-pad" onChangeText={(v) => update(row.key, { sort_order: v.replace(/[^0-9-]/g, '') })} />
                  </View>
                </View>
                <View className="gap-1.5">
                  <Label>{n('label_note_content')}</Label>
                  <FilterChips
                    value={preview[row.key] ? 'preview' : 'write'}
                    onChange={(v) => setPreview((p) => ({ ...p, [row.key]: v === 'preview' }))}
                    options={[
                      { value: 'write', label: n('tab_write') },
                      { value: 'preview', label: n('tab_preview') },
                    ]}
                  />
                  {preview[row.key] ? (
                    <View className="border-border min-h-20 rounded-md border p-2">
                      {row.content ? <Text className="text-sm">{row.content}</Text> : <Text className="text-muted-foreground text-sm italic">{n('placeholder_no_content')}</Text>}
                    </View>
                  ) : (
                    <Textarea value={row.content} onChangeText={(v) => update(row.key, { content: v })} className="min-h-20" />
                  )}
                </View>
                <View className="gap-1.5">
                  <Label>{n('table_file')}</Label>
                  {row.file_url ? (
                    <View className="flex-row items-center gap-2">
                      <Icon as={Paperclip} className="text-primary size-4" />
                      <Pressable className="flex-1" onPress={() => Linking.openURL(row.file_url)}>
                        <Text className="text-primary text-sm underline" numberOfLines={1}>
                          {row.file_name || n('table_file')}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => update(row.key, { file_url: '', file_name: '' })} hitSlop={6}>
                        <Icon as={X} className="text-destructive size-4" />
                      </Pressable>
                    </View>
                  ) : (
                    <Button size="sm" variant="outline" className="self-start" disabled={uploading === row.key} onPress={() => attach(row)}>
                      <Icon as={Upload} className="text-foreground size-4" />
                      <Text>{uploading === row.key ? t('common.loading') : t('app.pn_choose_file')}</Text>
                    </Button>
                  )}
                </View>
                <View className="gap-1">
                  <Label>{n('label_embed_link')}</Label>
                  <Input value={row.embed_link} onChangeText={(v) => update(row.key, { embed_link: v })} placeholder={n('placeholder_url')} autoCapitalize="none" keyboardType="url" />
                </View>
                <View className="gap-1">
                  <Label>{n('table_visible_between')}</Label>
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" value={row.visible_from} onChange={(v) => update(row.key, { visible_from: v })} clearable />
                    <DateField className="flex-1" value={row.visible_until} onChange={(v) => update(row.key, { visible_until: v })} clearable />
                  </View>
                </View>
                <View className="gap-1">
                  <Label>{n('table_visible_to')}</Label>
                  <VisibilityPicker value={row.visibility} onChange={(vis) => update(row.key, { visibility: vis })} />
                </View>
              </CardContent>
            </Card>
          ))
        )}
        {saveBtn}
      </ScrollView>
    </View>
  );
}
