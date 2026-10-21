import type { Section } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { HeaderButton, Initials, RowActions, StatTile, StatTiles, UsageBar } from '@/components/app/layout';
import { CARD_LIST_PROPS, Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Form = { grade_level_id: string; name: string; capacity: string };

/** Sections per grade: capacity, strength, free seats (web: /admin/academics/sections). */
export default function Sections() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.sections.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [grade, setGrade] = useState('all');
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const active = (grades.data ?? []).filter((x) => x.is_active !== false);
  const list = useApi(['admin', 'sections', campusId ?? 'school', grade], () => adminAcademics.sections(campusId, grade === 'all' ? undefined : grade));
  const [editing, setEditing] = useState<Section | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const color = (x: Section) => {
    const u = ((x.current_strength ?? 0) / (x.capacity || 1)) * 100;
    return u >= 90 ? 'text-destructive' : u >= 75 ? 'text-warning' : 'text-success';
  };

  async function save() {
    if (!form) return;
    if (!form.grade_level_id) return toast.error(s('grade_required'));
    if (!form.name.trim()) return toast.error(s('name_required'));
    const capacity = parseInt(form.capacity, 10);
    if (!capacity || capacity < 1) return toast.error(s('capacity_min'));
    setSaving(true);
    try {
      const res = editing ? await adminAcademics.updateSection(editing.id, { name: form.name, capacity }) : await adminAcademics.createSection({ grade_level_id: form.grade_level_id, name: form.name, capacity, campus_id: campusId });
      if (!res.success) return toast.error(res.error || s('fetch_error'));
      toast.success(s(editing ? 'update_success' : 'create_success'));
      setForm(null);
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(x: Section) {
    if (!(await confirm({ title: s('delete_confirm_title'), body: s('delete_confirm_desc'), confirmLabel: s('delete'), destructive: true }))) return;
    const res = await adminAcademics.deleteSection(x.id, campusId);
    if (!res.success) return toast.error(res.error || s('fetch_error'));
    toast.success(s('delete_success'));
    list.mutate();
  }

  const rows = list.data ?? [];
  const seats = rows.reduce((n, x) => n + (x.capacity ?? 0), 0);
  const filled = rows.reduce((n, x) => n + (x.current_strength ?? 0), 0);
  const add = () => {
    setEditing(null);
    setForm({ grade_level_id: grade !== 'all' ? grade : '', name: '', capacity: '30' });
  };

  return (
    <>
      <Stack.Screen options={{ title: s('title'), headerRight: () => <HeaderButton icon={Plus} label={s('add_section')} onPress={add} /> }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 px-4 pt-3 pb-3">
              <Text variant="muted" className="text-sm">
                {s('subtitle')}
              </Text>
              <StatTiles>
                <StatTile icon={Users} label={s('title')} value={list.data ? String(rows.length) : '—'} />
                <StatTile tone="success" label={s('strength')} value={list.data ? `${filled}/${seats}` : '—'} />
                <StatTile tone="warning" label={s('available')} value={list.data ? String(Math.max(0, seats - filled)) : '—'} />
              </StatTiles>
              <FilterChips value={grade} onChange={setGrade} options={[{ value: 'all', label: s('all_grades') }, ...active.map((x) => ({ value: x.id, label: x.name }))]} />
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={s('no_sections')}
          keyExtractor={(x) => x.id}
          {...CARD_LIST_PROPS}
          renderItem={(x) => (
            <Panel className="gap-2.5 p-3">
              <View className="flex-row items-center gap-3">
                <Initials name={x.name} size={40} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold" numberOfLines={1}>
                    {x.name}
                  </Text>
                  <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                    {x.grade_name ?? ''}
                  </Text>
                </View>
                <StatusChip label={x.is_active !== false ? s('active') : s('inactive')} tone={x.is_active !== false ? 'success' : 'muted'} className="px-2 py-0.5" />
              </View>
              <UsageBar used={x.current_strength ?? 0} total={x.capacity ?? 0} />
              <View className="flex-row items-center justify-between gap-2">
                <Text className={cn('text-[11px] font-medium', color(x))}>
                  {`${s('strength')} ${x.current_strength ?? 0}/${x.capacity ?? '—'} · ${s('available')} ${s('seats', { count: x.available_seats ?? 0 })}`}
                </Text>
                <RowActions
                  onEdit={() => {
                    setEditing(x);
                    setForm({ grade_level_id: x.grade_level_id, name: x.name, capacity: String(x.capacity ?? '') });
                  }}
                  onDelete={() => remove(x)}
                  editLabel={s('edit_title')}
                  deleteLabel={s('delete')}
                />
              </View>
            </Panel>
          )}
        />
      </View>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? s('edit_title') : s('add_title')}</DialogTitle>
            <DialogDescription>{editing ? s('edit_desc') : s('add_desc')}</DialogDescription>
          </DialogHeader>
          {form ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{s('grade_label')}</Label>
                <Picker value={form.grade_level_id} onChange={(v) => setForm({ ...form, grade_level_id: v })} placeholder={s('select_grade')} options={active.map((x) => ({ value: x.id, label: x.name }))} />
              </View>
              <View className="gap-1.5">
                <Label>{s('name_label')}</Label>
                <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={s('name_placeholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{s('capacity_label')}</Label>
                <Input value={form.capacity} onChangeText={(v) => setForm({ ...form, capacity: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
                <Text className="text-muted-foreground text-xs">{s('capacity_desc')}</Text>
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setForm(null)}>
              <Text>{s('cancel')}</Text>
            </Button>
            <Button onPress={save} disabled={saving}>
              <Text>{saving ? s(editing ? 'updating' : 'creating') : s(editing ? 'update' : 'create')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
