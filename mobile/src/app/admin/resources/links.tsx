import type { ResourceLinkCategory, ResourceLinkInput } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Link2, Pencil, Plus, Save, Tags, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
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
import { Text } from '@/components/ui/text';
import { LinkAudienceEditor } from '@/features/admin/link-audience';
import { useCampus } from '@/features/campus/campus';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Row = ResourceLinkInput & { key: string };
let seq = 0;
const newKey = () => `new-${Date.now()}-${seq++}`;

const ROLE_TONE: Record<string, string> = {
  admin: 'bg-purple-100 dark:bg-purple-900/40',
  teacher: 'bg-amber-100 dark:bg-amber-900/40',
  student: 'bg-green-100 dark:bg-green-900/40',
  parent: 'bg-blue-100 dark:bg-blue-900/40',
  librarian: 'bg-rose-100 dark:bg-rose-900/40',
};

/** Resource links with categories and per-link audience; edits are saved together (web: /admin/resources/links). */
export default function ResourceLinks() {
  const { t } = useTranslation();
  const l = (k: string, o?: Record<string, unknown>) => t(`school.resources.links.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const server = useApi(['admin', 'resource-links', campusId ?? 'school'], () => adminResources.links(campusId), { revalidateOnFocus: false });
  const cats = useApi(['admin', 'resource-link-cats', campusId ?? 'school'], () => adminResources.linkCategories(campusId));
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!server.data) return;
    setRows(
      server.data.map((x) => ({
        key: x.id,
        id: x.id,
        title: x.title,
        url: x.url,
        visible_to: x.visible_to ?? [],
        visible_to_grade_ids: x.visible_to_grade_ids ?? [],
        visible_to_section_ids: x.visible_to_section_ids ?? [],
        visible_to_teacher_ids: x.visible_to_teacher_ids ?? [],
        visible_to_student_ids: x.visible_to_student_ids ?? [],
        sort_order: x.sort_order ?? 0,
        category_id: x.category_id ?? null,
      })),
    );
  }, [server.data]);

  const categories: ResourceLinkCategory[] = cats.data ?? [];
  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => (catFilter === 'all' || r.category_id === catFilter) && (!q || r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)));
  const patch = (key: string, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const add = () => {
    const row: Row = { key: newKey(), title: '', url: '', visible_to: ['admin'], visible_to_grade_ids: [], visible_to_section_ids: [], visible_to_teacher_ids: [], visible_to_student_ids: [], sort_order: rows.length + 1, category_id: null };
    setRows((p) => [...p, row]);
    setEditing(row);
  };

  async function remove(r: Row) {
    if (!(await confirm({ title: l('delete_confirm_title'), body: l('delete_cannot_undo'), destructive: true, confirmLabel: l('btn_delete') }))) return;
    setRows((p) => p.filter((x) => x.key !== r.key));
  }

  async function save() {
    for (const r of rows) {
      if (!r.title.trim()) return toast.error(l('msg_all_required'));
      if (!r.url.trim()) return toast.error(l('msg_url_required'));
    }
    setSaving(true);
    try {
      const res = await adminResources.saveLinks(
        rows.map(({ key: _k, ...r }, i) => ({ ...r, title: r.title.trim(), url: r.url.trim(), sort_order: r.sort_order ?? i + 1 })),
        (server.data ?? []).map((x) => x.id),
      );
      if (!res.success) return toast.error(res.error || l('msg_save_error'));
      toast.success(l('msg_save_success'));
      server.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    const r = await adminResources.createLinkCategory({ name: newCat.trim(), campus_id: campusId, sort_order: categories.length });
    if (!r.success) return toast.error(r.error || l('msg_category_error'));
    setNewCat('');
    cats.mutate();
  }
  async function renameCategory() {
    if (!renaming?.name.trim()) return;
    const r = await adminResources.updateLinkCategory(renaming.id, { name: renaming.name.trim() });
    if (!r.success) return toast.error(r.error || l('msg_category_error'));
    setRenaming(null);
    cats.mutate();
  }
  async function deleteCategory(id: string) {
    const r = await adminResources.deleteLinkCategory(id);
    if (!r.success) return toast.error(r.error || l('msg_category_error'));
    if (catFilter === id) setCatFilter('all');
    setRows((p) => p.map((x) => (x.category_id === id ? { ...x, category_id: null } : x)));
    cats.mutate();
  }

  const roleLabel = (r: string) => l(`role_${r}`, { defaultValue: r });
  const current = editing ? (rows.find((r) => r.key === editing.key) ?? null) : null;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: l('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{l('subtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" onPress={() => setCatsOpen(true)}>
            <Icon as={Tags} className="text-foreground size-4" />
            <Text>{l('manage_categories')}</Text>
          </Button>
          <Button size="sm" variant="outline" onPress={add}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{l('add_resource')}</Text>
          </Button>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <SearchBar value={search} onChangeText={setSearch} placeholder={l('search_placeholder')} />
          </View>
          <View className="w-40">
            <Picker value={catFilter} onChange={setCatFilter} options={[{ value: 'all', label: l('all_categories') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
          </View>
        </View>
        <Text className="text-muted-foreground text-xs">{server.isLoading ? l('loading') : `${rows.length} ${l('resource')}`}</Text>

        {server.isLoading ? (
          <LoadingList />
        ) : !shown.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{l('add_row_prompt')}</Text>
        ) : (
          shown.map((r) => (
            <Card key={r.key}>
              <CardContent className="gap-2 pt-4">
                <View className="flex-row items-start gap-2">
                  <Icon as={Link2} className="text-primary mt-0.5 size-4" />
                  <View className="flex-1">
                    <Text className="font-medium">{r.title || l('resource_name_placeholder')}</Text>
                    <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                      {r.url || l('url_placeholder')}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">#{r.sort_order}</Text>
                  <Button size="icon" variant="ghost" onPress={() => setEditing(r)} accessibilityLabel={t('common.edit')}>
                    <Icon as={Pencil} className="text-foreground size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => remove(r)} accessibilityLabel={l('btn_delete')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Button>
                </View>
                <View className="flex-row flex-wrap gap-1">
                  {r.category_id ? (
                    <View className="border-border rounded border px-1.5">
                      <Text className="text-[11px]">{categories.find((c) => c.id === r.category_id)?.name ?? l('no_category')}</Text>
                    </View>
                  ) : null}
                  {r.visible_to.length ? (
                    r.visible_to.map((ro) => (
                      <View key={ro} className={cn('rounded px-1.5', ROLE_TONE[ro] ?? 'bg-muted')}>
                        <Text className="text-[11px]">{roleLabel(ro)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text className="text-muted-foreground text-[11px]">{l('no_one')}</Text>
                  )}
                  {r.visible_to_student_ids.length ? (
                    <Text className="text-[11px] text-orange-600">· {r.visible_to_student_ids.length} {l('tab_students')}</Text>
                  ) : r.visible_to_section_ids.length ? (
                    <Text className="text-[11px] text-teal-600">· {r.visible_to_section_ids.length} §</Text>
                  ) : r.visible_to_grade_ids.length ? (
                    <Text className="text-[11px] text-indigo-600">· {t('app.rl_grades', { count: r.visible_to_grade_ids.length })}</Text>
                  ) : null}
                  {r.visible_to_teacher_ids.length ? <Text className="text-[11px] text-amber-600">· 👤 {r.visible_to_teacher_ids.length}</Text> : null}
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? l('saving_button') : l('save_button')}</Text>
        </Button>
      </View>

      <Dialog open={!!current} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
              <DialogHeader>
                <DialogTitle>{l('header_title')}</DialogTitle>
              </DialogHeader>
              {current ? (
                <>
                  <View className="gap-1.5">
                    <Label>{l('th_title')}</Label>
                    <Input value={current.title} onChangeText={(v) => patch(current.key, { title: v })} placeholder={l('resource_name_placeholder')} />
                  </View>
                  <View className="gap-1.5">
                    <Label>{l('th_link')}</Label>
                    <Input value={current.url} onChangeText={(v) => patch(current.key, { url: v })} placeholder={l('url_placeholder')} autoCapitalize="none" keyboardType="url" />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="w-20 gap-1.5">
                      <Label>{l('th_order')}</Label>
                      <Input value={String(current.sort_order ?? 0)} onChangeText={(v) => patch(current.key, { sort_order: parseInt(v, 10) || 0 })} keyboardType="number-pad" />
                    </View>
                    <View className="flex-1 gap-1.5">
                      <Label>{l('th_category')}</Label>
                      <Picker value={current.category_id ?? '__none__'} onChange={(v) => patch(current.key, { category_id: v === '__none__' ? null : v })} options={[{ value: '__none__', label: l('no_category') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
                    </View>
                  </View>
                  <Label>{l('th_visible_to')}</Label>
                  <LinkAudienceEditor value={current} onChange={(p) => patch(current.key, p)} />
                  <Button onPress={() => setEditing(null)}>
                    <Text>{l('done')}</Text>
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
            <DialogTitle>{l('manage_categories')}</DialogTitle>
          </DialogHeader>
          <View className="flex-row gap-2">
            <Input className="flex-1" value={newCat} onChangeText={setNewCat} placeholder={l('new_category_placeholder')} onSubmitEditing={addCategory} />
            <Button onPress={addCategory} disabled={!newCat.trim()} accessibilityLabel={t('common.add')}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
            </Button>
          </View>
          {!categories.length ? <Text className="text-muted-foreground text-sm">{l('no_categories_yet')}</Text> : null}
          {categories.map((c) => (
            <View key={c.id} className="flex-row items-center gap-2">
              {renaming?.id === c.id ? (
                <>
                  <Input className="flex-1" value={renaming.name} onChangeText={(v) => setRenaming({ id: c.id, name: v })} autoFocus onSubmitEditing={renameCategory} />
                  <Button size="sm" onPress={renameCategory}>
                    <Text>{l('save_button')}</Text>
                  </Button>
                  <Pressable onPress={() => setRenaming(null)} hitSlop={8}>
                    <Icon as={X} className="text-muted-foreground size-4" />
                  </Pressable>
                </>
              ) : (
                <>
                  <Text className="flex-1">{c.name}</Text>
                  <Pressable onPress={() => setRenaming({ id: c.id, name: c.name })} hitSlop={8} className="p-1" accessibilityLabel={t('common.edit')}>
                    <Icon as={Pencil} className="text-muted-foreground size-4" />
                  </Pressable>
                  <Pressable onPress={() => deleteCategory(c.id)} hitSlop={8} className="p-1" accessibilityLabel={t('common.delete')}>
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
