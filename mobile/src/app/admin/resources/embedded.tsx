import type { EmbeddedResourceCategory, EmbeddedResourceInput } from '@studently/api-client';
import { openBrowserAsync } from 'expo-web-browser';
import { Stack } from 'expo-router';
import { ExternalLink, Globe, MonitorPlay, Pencil, Plus, Save, Tags, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusChip } from '@/components/app/status-chip';
import { FilterChips } from '@/components/app/filter-chips';
import { IconTile } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { LinkAudienceEditor, type LinkAudience } from '@/features/admin/link-audience';
import { useCampus } from '@/features/campus/campus';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';

type Row = EmbeddedResourceInput & { id: string | 'new'; dirty: boolean };
type Sort = 'order_asc' | 'title_asc' | 'title_desc' | 'url_asc' | 'url_desc';

const validUrl = (v: string) => {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
};

/** The shared audience editor speaks resource-link field names; map them both ways. */
const toAudience = (r: Row): LinkAudience => ({
  visible_to: r.visible_to_roles,
  visible_to_grade_ids: r.published_grade_ids,
  visible_to_section_ids: r.published_section_ids,
  visible_to_teacher_ids: r.visible_to_teacher_ids,
  visible_to_student_ids: r.visible_to_student_ids,
});
const fromAudience = (p: Partial<LinkAudience>): Partial<Row> => ({
  ...(p.visible_to !== undefined && { visible_to_roles: p.visible_to }),
  ...(p.visible_to_grade_ids !== undefined && { published_grade_ids: p.visible_to_grade_ids }),
  ...(p.visible_to_section_ids !== undefined && { published_section_ids: p.visible_to_section_ids }),
  ...(p.visible_to_teacher_ids !== undefined && { visible_to_teacher_ids: p.visible_to_teacher_ids }),
  ...(p.visible_to_student_ids !== undefined && { visible_to_student_ids: p.visible_to_student_ids }),
});

/** Websites embedded for chosen audiences, with categories; changed rows are saved together (web: /admin/resources/embedded). */
export default function EmbeddedResources() {
  const { t } = useTranslation();
  const e = (k: string, o?: Record<string, unknown>) => t(`school.resources.embedded.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const server = useApi(['admin', 'embedded', campusId ?? 'school'], () => adminResources.embedded(campusId), { revalidateOnFocus: false });
  const cats = useApi(['admin', 'embedded-cats', campusId ?? 'school'], () => adminResources.embeddedCategories(campusId));
  const [rows, setRows] = useState<Row[]>([]);
  const [sort, setSort] = useState<Sort>('order_asc');
  const [catFilter, setCatFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!server.data) return;
    setRows(
      server.data.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        visible_to_roles: r.visible_to_roles ?? [],
        published_grade_ids: r.published_grade_ids ?? [],
        published_section_ids: r.published_section_ids ?? [],
        visible_to_teacher_ids: r.visible_to_teacher_ids ?? [],
        visible_to_student_ids: r.visible_to_student_ids ?? [],
        sort_order: r.sort_order ?? 0,
        category_id: r.category_id ?? null,
        dirty: false,
      })),
    );
  }, [server.data]);

  const categories: EmbeddedResourceCategory[] = cats.data ?? [];
  const update = (id: string, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p, dirty: true } : r)));
  const shown = useMemo(() => {
    const fresh = rows.find((r) => r.id === 'new');
    const list = rows.filter((r) => r.id !== 'new' && (catFilter === 'all' || r.category_id === catFilter));
    list.sort((a, b) =>
      sort === 'order_asc' ? a.sort_order - b.sort_order || a.title.localeCompare(b.title) : sort === 'title_asc' ? a.title.localeCompare(b.title) : sort === 'title_desc' ? b.title.localeCompare(a.title) : sort === 'url_asc' ? a.url.localeCompare(b.url) : b.url.localeCompare(a.url),
    );
    return fresh ? [...list, fresh] : list;
  }, [rows, sort, catFilter]);

  const addRow = () => {
    if (rows.some((r) => r.id === 'new')) return setEditing('new');
    const next = rows.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;
    setRows((p) => [...p, { id: 'new', title: '', url: '', visible_to_roles: [], published_grade_ids: [], published_section_ids: [], visible_to_teacher_ids: [], visible_to_student_ids: [], sort_order: next, category_id: null, dirty: true }]);
    setEditing('new');
  };

  async function saveAll() {
    const dirty = rows.filter((r) => r.dirty);
    if (!dirty.length) return toast.info(e('msg_no_changes'));
    for (const r of dirty) {
      if (r.id === 'new') continue;
      if (!r.title.trim()) return toast.error(e('msg_title_empty'));
      if (!r.url.trim() || !validUrl(r.url)) return toast.error(e('msg_url_invalid', { url: r.url }));
    }
    setSaving(true);
    let failed = false;
    try {
      for (const { id, dirty: _d, ...body } of dirty) {
        if (id === 'new') {
          if (!body.title.trim() || !body.url.trim()) continue;
          if (!validUrl(body.url)) {
            toast.error(e('msg_url_invalid', { url: body.url }));
            failed = true;
            continue;
          }
          const r = await adminResources.createEmbedded(body, campusId);
          if (!r.success) {
            toast.error(r.error || e('msg_create_error'));
            failed = true;
          }
        } else {
          const r = await adminResources.updateEmbedded(id, body, campusId);
          if (!r.success) {
            toast.error(r.error || e('msg_update_error'));
            failed = true;
          }
        }
      }
      if (!failed) toast.success(e('msg_save_success'));
      server.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Row) {
    if (r.id === 'new') return setRows((p) => p.filter((x) => x.id !== 'new'));
    if (!(await confirm({ title: e('delete_confirm_title'), body: e('delete_confirm_desc'), destructive: true, confirmLabel: e('btn_delete') }))) return;
    const res = await adminResources.deleteEmbedded(r.id, campusId);
    if (!res.success) return toast.error(res.error || e('msg_delete_error'));
    toast.success(e('msg_delete_success'));
    setRows((p) => p.filter((x) => x.id !== r.id));
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    const r = await adminResources.createEmbeddedCategory({ name: newCat.trim(), sort_order: categories.length }, campusId);
    if (!r.success) return toast.error(r.error || t('app.error_title'));
    setNewCat('');
    cats.mutate();
  }
  async function renameCategory() {
    if (!renaming?.name.trim()) return;
    const r = await adminResources.updateEmbeddedCategory(renaming.id, { name: renaming.name.trim() }, campusId);
    if (!r.success) return toast.error(r.error || t('app.error_title'));
    setRenaming(null);
    cats.mutate();
  }
  async function deleteCategory(id: string) {
    const r = await adminResources.deleteEmbeddedCategory(id, campusId);
    if (!r.success) return toast.error(r.error || t('app.error_title'));
    if (catFilter === id) setCatFilter('all');
    setRows((p) => p.map((x) => (x.category_id === id ? { ...x, category_id: null } : x)));
    cats.mutate();
  }

  const current = editing ? (rows.find((r) => r.id === editing) ?? null) : null;
  const roleLabel = (r: string) => e(`role_${r}`, { defaultValue: r });

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: e('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start gap-2">
          <Icon as={Globe} className="text-primary mt-0.5 size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">{e('subtitle')}</Text>
        </View>
        <View className="rounded-md bg-info-soft p-3 ">
          <Text className="text-xs text-brand dark:text-brand-secondary ">{e('note_audience_banner')}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" onPress={() => setCatsOpen(true)}>
            <Icon as={Tags} className="text-foreground size-4" />
            <Text>{e('manage_categories')}</Text>
          </Button>
          <Button size="sm" variant="outline" onPress={addRow}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{e('btn_add_row')}</Text>
          </Button>
        </View>
        <FilterChips value={catFilter} onChange={setCatFilter} options={[{ value: 'all', label: e('all_categories') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Picker
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[
                { value: 'order_asc', label: t('app.er_sort_order') },
                { value: 'title_asc', label: t('app.er_sort_title_az') },
                { value: 'title_desc', label: t('app.er_sort_title_za') },
                { value: 'url_asc', label: t('app.er_sort_url_az') },
                { value: 'url_desc', label: t('app.er_sort_url_za') },
              ]}
            />
          </View>
        </View>

        {server.isLoading ? (
          <LoadingList />
        ) : !shown.length ? (
          <EmptyState icon={MonitorPlay} title={e('no_resources_empty')} />
        ) : (
          shown.map((r) => (
            <Card key={r.id} className={r.dirty ? 'border-warning ' : ''}>
              <CardContent className="gap-2 pt-4">
                <View className="flex-row items-center gap-3">
                  <IconTile icon={MonitorPlay} tone={r.dirty ? 'warning' : 'brand'} size={40} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{r.title || e('resource_title_placeholder')}</Text>
                    <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                      {r.url || e('url_placeholder')}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">#{r.sort_order}</Text>
                  {r.url && r.id !== 'new' ? (
                    <Pressable onPress={() => openBrowserAsync(r.url)} accessibilityLabel={e('link_label')} hitSlop={4} className="bg-muted size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={ExternalLink} className="text-foreground size-4" />
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => setEditing(r.id)} accessibilityLabel={t('common.edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                  </Pressable>
                  <Pressable onPress={() => remove(r)} accessibilityLabel={e('btn_delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
                <View className="flex-row flex-wrap gap-1">
                  {r.category_id ? (
                    <View className="border-border rounded border px-1.5">
                      <Text className="text-[11px]">{categories.find((c) => c.id === r.category_id)?.name ?? e('no_category')}</Text>
                    </View>
                  ) : null}
                  {r.visible_to_roles.length ? (
                    r.visible_to_roles.map((ro) => (
                      <View key={ro} className="bg-muted rounded px-1.5">
                        <Text className="text-[11px]">{roleLabel(ro)}</Text>
                      </View>
                    ))
                  ) : (
                    <StatusChip label={String(e('all_roles'))} tone="muted" className="px-2 py-0.5" />
                  )}
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
        <Button onPress={saveAll} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? e('saving_button') : e('save_button')}</Text>
        </Button>
      </View>

      <Dialog open={!!current} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <KeyboardAvoidingView>
            <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
              <DialogHeader>
                <DialogTitle>{e('title')}</DialogTitle>
              </DialogHeader>
              {current ? (
                <>
                  <View className="gap-1.5">
                    <Label>{e('th_title_header')}</Label>
                    <Input value={current.title} maxLength={60} onChangeText={(v) => update(current.id, { title: v })} placeholder={e('resource_title_placeholder')} />
                  </View>
                  <View className="gap-1.5">
                    <Label>{e('th_link_header')}</Label>
                    <Input value={current.url} onChangeText={(v) => update(current.id, { url: v })} placeholder={e('url_placeholder')} autoCapitalize="none" keyboardType="url" />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="w-20 gap-1.5">
                      <Label>{e('th_order_header')}</Label>
                      <Input value={String(current.sort_order)} onChangeText={(v) => update(current.id, { sort_order: parseInt(v, 10) || 0 })} keyboardType="number-pad" />
                    </View>
                    <View className="flex-1 gap-1.5">
                      <Label>{e('th_category')}</Label>
                      <Picker value={current.category_id ?? '__none__'} onChange={(v) => update(current.id, { category_id: v === '__none__' ? null : v })} options={[{ value: '__none__', label: e('no_category') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
                    </View>
                  </View>
                  <Label>{e('th_audience')}</Label>
                  <LinkAudienceEditor value={toAudience(current)} onChange={(p) => update(current.id, fromAudience(p))} />
                  <Button onPress={() => setEditing(null)}>
                    <Text>{e('done')}</Text>
                  </Button>
                </>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </DialogContent>
      </Dialog>

      <Dialog open={catsOpen} onOpenChange={setCatsOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{e('manage_categories')}</DialogTitle>
          </DialogHeader>
          <View className="flex-row gap-2">
            <Input className="flex-1" value={newCat} onChangeText={setNewCat} placeholder={e('new_category_placeholder')} onSubmitEditing={addCategory} />
            <Button onPress={addCategory} disabled={!newCat.trim()} accessibilityLabel={t('common.add')}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
            </Button>
          </View>
          {!categories.length ? <Text className="text-muted-foreground text-sm">{e('no_categories_yet')}</Text> : null}
          {categories.map((c) => (
            <View key={c.id} className="flex-row items-center gap-2">
              {renaming?.id === c.id ? (
                <>
                  <Input className="flex-1" value={renaming.name} onChangeText={(v) => setRenaming({ id: c.id, name: v })} autoFocus onSubmitEditing={renameCategory} />
                  <Button size="sm" onPress={renameCategory}>
                    <Text>{e('save_button')}</Text>
                  </Button>
                  <Pressable onPress={() => setRenaming(null)} hitSlop={8}>
                    <Icon as={X} className="text-muted-foreground size-4" />
                  </Pressable>
                </>
              ) : (
                <>
                  <Text className="flex-1">{c.name}</Text>
                  <Pressable onPress={() => setRenaming({ id: c.id, name: c.name })} accessibilityLabel={t('common.edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                  </Pressable>
                  <Pressable onPress={() => deleteCategory(c.id)} accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </DialogContent>
      </Dialog>
    </View>
  );
}
