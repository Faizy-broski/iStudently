import type { Subject, SubjectType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react-native';
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
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';

type SortField = 'name' | 'code' | 'grade_name' | 'subject_type' | 'is_active';
type Form = { grade_level_id: string; name: string; code: string; subject_type: SubjectType };
const TYPES: SubjectType[] = ['theory', 'lab', 'practical'];

/** Subjects per grade with sorting and type (web: /admin/academics/subjects). */
export default function Subjects() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.subjects.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [grade, setGrade] = useState('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const active = (grades.data ?? []).filter((x) => x.is_active !== false).sort((a, b) => (parseInt(a.name.replace(/\D/g, ''), 10) || 0) - (parseInt(b.name.replace(/\D/g, ''), 10) || 0));
  const list = useApi(['admin', 'subjects', campusId ?? 'school', grade], () => adminAcademics.subjects(campusId, grade === 'all' ? undefined : grade));
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = [...(list.data ?? [])].sort((a, b) => {
    const va = String(a[sortField] ?? '');
    const vb = String(b[sortField] ?? '');
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  async function save() {
    if (!form) return;
    if (!form.grade_level_id) return toast.error(s('grade_required'));
    if (!form.name.trim()) return toast.error(s('name_required'));
    if (!form.code.trim()) return toast.error(s('code_required'));
    setSaving(true);
    try {
      const res = editing ? await adminAcademics.updateSubject(editing.id, { name: form.name, code: form.code, subject_type: form.subject_type }) : await adminAcademics.createSubject({ ...form, campus_id: campusId });
      if (!res.success) return toast.error(res.error || s('fetch_error'));
      toast.success(s(editing ? 'update_success' : 'create_success'));
      setForm(null);
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(x: Subject) {
    if (!(await confirm({ title: s('delete_confirm_title'), body: s('delete_confirm_desc'), confirmLabel: s('delete'), destructive: true }))) return;
    const res = await adminAcademics.deleteSubject(x.id, campusId);
    if (!res.success) return toast.error(res.error || s('fetch_error'));
    toast.success(s('delete_success'));
    list.mutate();
  }

  const sortLabels: Record<SortField, string> = { name: s('name'), code: s('code'), grade_name: s('grade'), subject_type: s('type'), is_active: s('status') };

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted">{s('subtitle')}</Text>
              <Button
                onPress={() => {
                  setEditing(null);
                  setForm({ grade_level_id: grade !== 'all' ? grade : '', name: '', code: '', subject_type: 'theory' });
                }}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{s('add_subject')}</Text>
              </Button>
              <Picker value={grade} onChange={setGrade} options={[{ value: 'all', label: s('all_grades') }, ...active.map((x) => ({ value: x.id, label: x.name }))]} />
              <View className="flex-row items-center gap-2">
                <Picker className="flex-1" value={sortField} onChange={(v) => setSortField(v as SortField)} options={(Object.keys(sortLabels) as SortField[]).map((f) => ({ value: f, label: sortLabels[f] }))} />
                <Pressable onPress={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="border-border rounded-md border p-2.5" accessibilityRole="button">
                  <Icon as={sortDir === 'asc' ? ArrowUp : ArrowDown} className="text-foreground size-4" />
                </Pressable>
              </View>
            </View>
          }
          items={list.data ? rows : undefined}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={s('no_subjects')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <View className="gap-1.5 px-4 py-3">
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Text className="font-medium">{x.name}</Text>
                  <Text className="text-muted-foreground text-xs">{[x.code, x.grade_name].filter(Boolean).join(' · ')}</Text>
                </View>
                {x.subject_type ? (
                  <Badge variant={x.subject_type === 'theory' ? 'default' : x.subject_type === 'lab' ? 'secondary' : 'outline'}>
                    <Text>{s(x.subject_type)}</Text>
                  </Badge>
                ) : null}
                <Badge variant={x.is_active !== false ? 'default' : 'secondary'}>
                  <Text>{x.is_active !== false ? s('active') : s('inactive')}</Text>
                </Badge>
              </View>
              <View className="flex-row justify-end gap-4">
                <Pressable
                  onPress={() => {
                    setEditing(x);
                    setForm({ grade_level_id: x.grade_level_id ?? '', name: x.name, code: x.code ?? '', subject_type: x.subject_type ?? 'theory' });
                  }}
                  hitSlop={8}>
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
            <DialogTitle>{editing ? s('edit_title') : s('add_title')}</DialogTitle>
            <DialogDescription>{editing ? s('edit_desc') : s('add_desc')}</DialogDescription>
          </DialogHeader>
          {form ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{s('grade_label')}</Label>
                <Picker value={form.grade_level_id} onChange={(v) => setForm({ ...form, grade_level_id: v })} placeholder={s('select_grade')} options={active.map((x) => ({ value: x.id, label: x.name }))} />
                <Text className="text-muted-foreground text-xs">{s('grade_desc')}</Text>
              </View>
              <View className="gap-1.5">
                <Label>{s('name_label')}</Label>
                <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={s('name_placeholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{s('code_label')}</Label>
                <Input value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} placeholder={s('code_placeholder')} autoCapitalize="characters" />
                <Text className="text-muted-foreground text-xs">{s('code_desc')}</Text>
              </View>
              <View className="gap-1.5">
                <Label>{s('type_label')}</Label>
                <Picker value={form.subject_type} onChange={(v) => setForm({ ...form, subject_type: v as SubjectType })} options={TYPES.map((x) => ({ value: x, label: s(x) }))} />
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
