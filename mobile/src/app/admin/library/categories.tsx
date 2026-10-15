import type { LibraryCategory } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { FolderOpen, Pencil, Plus, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { ColorSwatches, useLibraryCategories } from '@/features/admin/library';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';

const ROLES = ['student', 'teacher', 'parent'] as const;

/** Book categories with colour, sort order and visibility by role / grade (web: /admin/library/categories). */
export default function LibraryCategories() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`admin.library.categories.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const cats = useLibraryCategories();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryCategory | null>(null);
  const [title, setTitle] = useState('');
  const [sort, setSort] = useState('0');
  const [color, setColor] = useState('#3B82F6');
  const [roles, setRoles] = useState<string[]>([]);
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const list = [...(cats.data ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const gradeName = (id: string) => (grades.data ?? []).find((g) => g.id === id)?.name ?? id;
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const openForm = (cat: LibraryCategory | null) => {
    setEditing(cat);
    setTitle(cat?.name ?? '');
    setSort(String(cat ? (cat.sort_order ?? 0) : list.length + 1));
    setColor(cat?.color_code || '#3B82F6');
    setRoles(cat?.visible_to_roles ?? []);
    setGradeIds(cat?.visible_to_grade_levels ?? []);
    setOpen(true);
  };

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body = { name: title.trim(), sort_order: parseInt(sort, 10) || 0, color_code: color, visible_to_roles: roles, visible_to_grade_levels: gradeIds };
      const r = editing ? await adminLibrary.updateCategory(editing.id, body) : await adminLibrary.createCategory(body);
      if (!r.success) return toast.error(r.error || (editing ? c('toast.update_failed') : c('toast.create_failed')));
      toast.success(editing ? c('toast.updated') : c('toast.created'));
      setOpen(false);
      cats.mutate();
    } catch {
      toast.error(c('toast.generic_error'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(cat: LibraryCategory) {
    if (!(await confirm({ title: c('delete_confirm', { name: cat.name }), destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminLibrary.deleteCategory(cat.id);
    if (!r.success) return toast.error(r.error || c('toast.delete_failed'));
    toast.success(c('toast.deleted'));
    cats.mutate();
  }

  const tag = (text: string, outline = false) => (
    <View key={text} className={outline ? 'border-border rounded border px-1.5' : 'bg-secondary rounded px-1.5'}>
      <Text className="text-xs">{text}</Text>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: c('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => cats.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{c('subtitle')}</Text>
          <Button size="sm" onPress={() => openForm(null)}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{c('new_category')}</Text>
          </Button>
        </View>
        <View>
          <Text className="font-semibold">{c('all_categories', { count: list.length })}</Text>
          <Text className="text-muted-foreground text-xs">{t('app.lb_tap_to_edit')}</Text>
        </View>
        {cats.isLoading ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={FolderOpen} title={c('no_categories')} body={c('no_categories_desc')} />
        ) : (
          <Card className="py-0">
            {list.map((cat, i) => (
              <View key={cat.id}>
                {i > 0 ? <Separator /> : null}
                <Pressable onPress={() => openForm(cat)} className="active:bg-muted flex-row items-start gap-3 px-4 py-3">
                  <Text className="text-muted-foreground w-5 text-xs">{i + 1}</Text>
                  <View className="mt-1 size-4 rounded-full" style={{ backgroundColor: cat.color_code || '#6B7280' }} />
                  <View className="flex-1 gap-1">
                    <Text className="font-medium">{cat.name}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {c('table.sort_order')}: {cat.sort_order ?? 0}
                    </Text>
                    <View className="flex-row flex-wrap items-center gap-1">
                      <Text className="text-muted-foreground text-xs">{c('table.visible_roles')}:</Text>
                      {(cat.visible_to_roles ?? []).length ? cat.visible_to_roles.map((r) => tag(c(`roles.${r}`, { defaultValue: r }))) : <Text className="text-muted-foreground text-xs">{t('common.all')}</Text>}
                    </View>
                    <View className="flex-row flex-wrap items-center gap-1">
                      <Text className="text-muted-foreground text-xs">{c('table.grade_levels')}:</Text>
                      {(cat.visible_to_grade_levels ?? []).length ? (
                        <>
                          {cat.visible_to_grade_levels.slice(0, 3).map((g) => tag(gradeName(g), true))}
                          {cat.visible_to_grade_levels.length > 3 ? tag(`+${cat.visible_to_grade_levels.length - 3}`, true) : null}
                        </>
                      ) : (
                        <Text className="text-muted-foreground text-xs">{t('common.all')}</Text>
                      )}
                    </View>
                  </View>
                  <Button size="icon" variant="ghost" onPress={() => openForm(cat)} accessibilityLabel={t('common.edit')}>
                    <Icon as={Pencil} className="text-foreground size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => remove(cat)} accessibilityLabel={t('common.delete')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Button>
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <KeyboardAvoidingView>
            <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              <DialogHeader>
                <DialogTitle>{editing ? c('dialog.edit_title') : c('dialog.new_title')}</DialogTitle>
                <Text className="text-muted-foreground text-sm">{editing ? c('dialog.edit_desc') : c('dialog.new_desc')}</Text>
              </DialogHeader>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Label>{c('table.title')} *</Label>
                  <Input value={title} onChangeText={setTitle} placeholder={c('dialog.title_placeholder')} />
                </View>
                <View className="w-24 gap-1.5">
                  <Label>{c('table.sort_order')}</Label>
                  <Input value={sort} onChangeText={setSort} keyboardType="number-pad" />
                </View>
              </View>
              <View className="gap-1.5">
                <Label>{c('table.color')}</Label>
                <ColorSwatches value={color} onChange={setColor} />
              </View>
              <View className="gap-1.5">
                <Label>{c('dialog.visible_roles')}</Label>
                <Text className="text-muted-foreground text-xs">{c('dialog.visible_roles_hint')}</Text>
                {ROLES.map((r) => (
                  <CheckRow key={r} checked={roles.includes(r)} onPress={() => setRoles((p) => toggle(p, r))} label={c(`roles.${r}`)} />
                ))}
              </View>
              <View className="gap-1.5">
                <Label>{c('dialog.limit_grade_levels')}</Label>
                <Text className="text-muted-foreground text-xs">{c('dialog.limit_grade_levels_hint')}</Text>
                {!(grades.data ?? []).length ? (
                  <Text className="text-muted-foreground text-sm">{c('dialog.no_grade_levels')}</Text>
                ) : (
                  (grades.data ?? []).map((g) => <CheckRow key={g.id} checked={gradeIds.includes(g.id)} onPress={() => setGradeIds((p) => toggle(p, g.id))} label={g.name} />)
                )}
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" onPress={() => setOpen(false)} disabled={saving}>
                  <Text>{t('common.cancel')}</Text>
                </Button>
                <Button onPress={save} disabled={!title.trim() || saving}>
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>{editing ? c('dialog.save_changes') : t('common.save')}</Text>
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </DialogContent>
      </Dialog>
    </View>
  );
}
