import type { GradeLevel } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { BookOpen, FolderDown, GitBranch, GraduationCap, Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { HeaderButton, RoundIcon, RowActions, StatTile, StatTiles } from '@/components/app/layout';
import { CARD_LIST_PROPS, Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  const active = grades.filter((x) => x.is_active !== false).length;
  const sectionsTotal = grades.reduce((n, x) => n + (x.sections_count || 0), 0);
  const subjectsTotal = grades.reduce((n, x) => n + (x.subjects_count || 0), 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: g('title'),
          headerRight: () => (
            <View className="flex-row items-center">
              <HeaderButton icon={GitBranch} label={t('app.gp_open')} onPress={() => router.push('/admin/settings/grade-progression')} />
              <HeaderButton icon={Plus} label={g('add_grade')} onPress={() => open()} />
            </View>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 px-4 pt-3 pb-3">
              <Text variant="muted" className="text-sm">
                {g('subtitle')}
              </Text>
              <StatTiles>
                <StatTile icon={GraduationCap} label={g('title')} value={list.data ? String(grades.length) : '—'} note={`${g('active')}: ${active}`} />
                <StatTile icon={Users} tone="success" label={g('sections')} value={list.data ? String(sectionsTotal) : '—'} />
                <StatTile icon={BookOpen} tone="warning" label={g('subjects')} value={list.data ? String(subjectsTotal) : '—'} />
              </StatTiles>
              <View className="flex-row items-center justify-between">
                <StatusChip label={grades.length === 1 ? g('found_singular') : g('found_plural', { count: grades.length })} tone="info" className="px-2.5 py-1" />
                <RoundIcon icon={FolderDown} label={g('export_csv')} onPress={exportCsv} />
              </View>
            </View>
          }
          items={list.data ? grades : undefined}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={g('no_grades')}
          keyExtractor={(x) => x.id}
          {...CARD_LIST_PROPS}
          renderItem={(x) => (
            <Panel className="gap-3 p-3">
              <View className="flex-row items-center gap-3">
                <View className="bg-info-soft size-10 items-center justify-center rounded-xl">
                  <Text className="text-brand dark:text-brand-secondary text-sm font-bold">{String(x.order_index ?? '')}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold" numberOfLines={1}>
                    {x.name}
                  </Text>
                  <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                    {[`${g('capacity')} ${x.capacity ?? '—'}`, `${g('sections')} ${x.sections_count || 0}`, `${g('subjects')} ${x.subjects_count || 0}`].join(' · ')}
                  </Text>
                </View>
                <StatusChip label={x.is_active !== false ? g('active') : g('inactive')} tone={x.is_active !== false ? 'success' : 'muted'} className="px-2 py-0.5" />
              </View>
              <View className="gap-1">
                <Text variant="muted" className="text-[11px]">
                  {g('next_grade')}
                </Text>
                <Picker
                  value={x.next_grade_id || 'graduate'}
                  onChange={(v) => patch(x.id, { next_grade_id: v === 'graduate' ? null : v }, 'next_grade_success')}
                  options={[{ value: 'graduate', label: g('graduate') }, ...grades.filter((y) => (y.order_index ?? 0) > (x.order_index ?? 0)).map((y) => ({ value: y.id, label: y.name }))]}
                />
              </View>
              {groupsOn ? (
                <View className="gap-1">
                  <Text variant="muted" className="text-[11px]">
                    {g('mp_group')}
                  </Text>
                  <Picker value={x.group_id ?? 'default'} onChange={(v) => patch(x.id, { group_id: v === 'default' ? null : v }, 'update_success')} options={[{ value: 'default', label: g('mp_group_default') }, ...(groups.data ?? []).map((y) => ({ value: y.id, label: y.name }))]} />
                </View>
              ) : null}
              <RowActions onEdit={() => open(x)} onDelete={() => remove(x)} editLabel={g('edit_title')} deleteLabel={g('delete')} />
            </Panel>
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
