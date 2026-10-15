import type { GradeLevel } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { BookOpen, FolderDown, GraduationCap, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { usePluginActive } from '@/features/admin/plugins';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';

type Form = { name: string; order_index: string; capacity: string; is_active: boolean; base_fee: number };

/** Grade levels: order, capacity, next grade, marking-period group, status, CSV (web: /admin/academics/grades). */
export default function GradeLevels() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`school.grades.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const groupsOn = usePluginActive('marking_period_groups');
  const list = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const groups = useApi(groupsOn ? ['admin', 'mp-groups', campusId ?? 'school'] : null, () => adminAcademics.markingPeriodGroups(campusId));
  const grades = [...(list.data ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const [editing, setEditing] = useState<GradeLevel | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  async function patch(id: string, body: { next_grade_id?: string | null; group_id?: string | null }, okKey: string) {
    const res = await adminAcademics.updateGrade(id, body);
    if (!res.success) return toast.error(res.error || g('fetch_error'));
    toast.success(g(okKey));
    list.mutate();
  }

  function open(grade?: GradeLevel) {
    setEditing(grade ?? null);
    setForm(grade ? { name: grade.name, order_index: String(grade.order_index ?? 0), capacity: grade.capacity == null ? '' : String(grade.capacity), is_active: grade.is_active !== false, base_fee: grade.base_fee ?? 0 } : { name: '', order_index: String(grades.length + 1), capacity: '30', is_active: true, base_fee: 0 });
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) return toast.error(g('name_required'));
    setSaving(true);
    try {
      const body = { name: form.name, order_index: parseFloat(form.order_index) || 0, capacity: form.capacity === '' ? undefined : parseInt(form.capacity, 10) || 0, is_active: form.is_active, base_fee: form.base_fee };
      const res = editing ? await adminAcademics.updateGrade(editing.id, body) : await adminAcademics.createGrade({ ...body, campus_id: campusId });
      if (!res.success) return toast.error(res.error || g('fetch_error'));
      toast.success(g(editing ? 'update_success' : 'create_success'));
      setForm(null);
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(grade: GradeLevel) {
    if (!(await confirm({ title: g('delete_confirm_title'), body: g('delete_confirm_desc'), confirmLabel: g('delete'), destructive: true }))) return;
    const res = await adminAcademics.deleteGrade(grade.id, campusId);
    if (!res.success) return toast.error(res.error || g('fetch_error'));
    toast.success(g('delete_success'));
    list.mutate();
  }

  async function exportCsv() {
    if (!grades.length) return;
    const csv = toCsv(
      [g('order'), g('name'), g('capacity'), g('sections'), g('subjects'), g('next_grade'), g('status')],
      grades.map((x) => [x.order_index ?? '', x.name, x.capacity ?? '', x.sections_count || 0, x.subjects_count || 0, x.next_grade_id ? (grades.find((y) => y.id === x.next_grade_id)?.name ?? '') : g('graduate'), x.is_active !== false ? g('active') : g('inactive')]),
    );
    await shareTextFile('grade_levels.csv', csv, 'text/csv', 'public.comma-separated-values-text');
    toast.success(g('export_success'));
  }

  return (
    <>
      <Stack.Screen options={{ title: g('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted">{g('subtitle')}</Text>
              <Button onPress={() => open()}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{g('add_grade')}</Text>
              </Button>
              <View className="flex-row items-center justify-between">
                <Text className="font-medium">{grades.length === 1 ? g('found_singular') : g('found_plural', { count: grades.length })}</Text>
                <Pressable onPress={exportCsv} hitSlop={8} accessibilityLabel={g('export_csv')}>
                  <Icon as={FolderDown} className="size-7 text-yellow-500" />
                </Pressable>
              </View>
            </View>
          }
          items={list.data ? grades : undefined}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={g('no_grades')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <View className="gap-2 px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-muted-foreground w-6 font-medium">{x.order_index}</Text>
                <Icon as={GraduationCap} className="text-muted-foreground size-4" />
                <Text className="flex-1 font-medium">{x.name}</Text>
                <Badge variant={x.is_active !== false ? 'default' : 'secondary'}>
                  <Text>{x.is_active !== false ? g('active') : g('inactive')}</Text>
                </Badge>
              </View>
              <View className="flex-row flex-wrap items-center gap-3">
                <Text className="text-muted-foreground text-xs">{`${g('capacity')}: ${x.capacity ?? '—'}`}</Text>
                <View className="flex-row items-center gap-1">
                  <Icon as={Users} className="text-muted-foreground size-3" />
                  <Text className="text-muted-foreground text-xs">{`${g('sections')}: ${x.sections_count || 0}`}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Icon as={BookOpen} className="text-muted-foreground size-3" />
                  <Text className="text-muted-foreground text-xs">{`${g('subjects')}: ${x.subjects_count || 0}`}</Text>
                </View>
              </View>
              <View className="gap-1">
                <Text className="text-muted-foreground text-xs">{g('next_grade')}</Text>
                <Picker
                  value={x.next_grade_id || 'graduate'}
                  onChange={(v) => patch(x.id, { next_grade_id: v === 'graduate' ? null : v }, 'next_grade_success')}
                  options={[{ value: 'graduate', label: g('graduate') }, ...grades.filter((y) => (y.order_index ?? 0) > (x.order_index ?? 0)).map((y) => ({ value: y.id, label: y.name }))]}
                />
              </View>
              {groupsOn ? (
                <View className="gap-1">
                  <Text className="text-muted-foreground text-xs">{g('mp_group')}</Text>
                  <Picker value={x.group_id ?? 'default'} onChange={(v) => patch(x.id, { group_id: v === 'default' ? null : v }, 'update_success')} options={[{ value: 'default', label: g('mp_group_default') }, ...(groups.data ?? []).map((y) => ({ value: y.id, label: y.name }))]} />
                </View>
              ) : null}
              <View className="flex-row justify-end gap-4">
                <Pressable onPress={() => open(x)} hitSlop={8}>
                  <Icon as={Pencil} className="text-muted-foreground size-4" />
                </Pressable>
                <Pressable onPress={() => remove(x)} hitSlop={8}>
                  <Icon as={Trash2} className="text-destructive size-4" />
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? g('edit_title') : g('add_title')}</DialogTitle>
            <DialogDescription>{editing ? g('edit_desc') : g('add_desc')}</DialogDescription>
          </DialogHeader>
          {form ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{g('name_label')}</Label>
                <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={g('name_placeholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{g('capacity_label')}</Label>
                <Input value={form.capacity} onChangeText={(v) => setForm({ ...form, capacity: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
                <Text className="text-muted-foreground text-xs">{g('capacity_desc')}</Text>
              </View>
              <View className="gap-1.5">
                <Label>{g('order_label')}</Label>
                <Input value={form.order_index} onChangeText={(v) => setForm({ ...form, order_index: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" placeholder={g('order_placeholder')} />
                <Text className="text-muted-foreground text-xs">{g('order_desc')}</Text>
              </View>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Label>{g('status_label')}</Label>
                  <Text className="text-muted-foreground text-xs">{g('status_desc')}</Text>
                </View>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setForm(null)}>
              <Text>{g('cancel')}</Text>
            </Button>
            <Button onPress={save} disabled={saving}>
              <Text>{saving ? g(editing ? 'updating' : 'creating') : g(editing ? 'update' : 'create')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
