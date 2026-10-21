import type { AbsenceFieldType, StaffAbsenceField } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Pencil, Plus, Trash2, ListChecks } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { IconTile } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAttendanceScope } from '@/features/admin/attendance';
import { adminStaffAbsences } from '@/lib/api';
import { useApi } from '@/lib/data';

const TYPES: AbsenceFieldType[] = ['text', 'numeric', 'date', 'textarea', 'radio', 'select', 'autos', 'exports', 'multiple', 'files'];
const WITH_OPTIONS: AbsenceFieldType[] = ['select', 'autos', 'exports', 'multiple'];
const EMPTY = { title: '', type: 'text' as AbsenceFieldType, select_options: '', default_selection: '', sort_order: '', required: false };

/** Custom fields for staff absences (web: /admin/staff-absences/fields). */
export default function AbsenceFields() {
  const { t } = useTranslation();
  const s = (k: string) => t(`staffAbsences.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId, campusId } = useAttendanceScope();
  const list = useApi(schoolId ? ['admin', 'absence-fields', schoolId, campusId ?? 'school'] : null, () => adminStaffAbsences.getFields(schoolId, campusId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = (f: StaffAbsenceField) => {
    setEditingId(f.id);
    setForm({ title: f.title, type: f.type, select_options: f.select_options || '', default_selection: f.default_selection || '', sort_order: f.sort_order?.toString() || '', required: f.required });
  };

  async function save() {
    if (!form) return;
    if (!form.title.trim()) return toast.error(s('fieldValidation.fieldNameRequired'));
    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        campus_id: campusId,
        title: form.title.trim(),
        type: form.type,
        select_options: form.select_options || null,
        default_selection: form.default_selection || null,
        sort_order: form.sort_order ? parseInt(form.sort_order, 10) : null,
        required: form.required,
      };
      const res = editingId ? await adminStaffAbsences.updateField(editingId, payload) : await adminStaffAbsences.createField(payload);
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      toast.success(editingId ? s('toasts.fieldUpdated') : s('toasts.fieldCreated'));
      setForm(null);
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(f: StaffAbsenceField) {
    if (!(await confirm({ title: s('fieldsPage.deleteFieldTitle'), body: s('fieldsPage.deleteFieldDescription'), confirmLabel: s('delete'), destructive: true }))) return;
    const res = await adminStaffAbsences.deleteField(f.id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(s('toasts.fieldDeleted'));
    list.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: s('fieldsPage.title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="p-4">
              <Button
                onPress={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{s('fieldsPage.newField')}</Text>
              </Button>
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={s('fieldsPage.noCustomFields')}
          emptyBody={s('fieldsPage.noCustomFieldsHelp')}
          keyExtractor={(f) => f.id}
          renderItem={(f) => (
            <View className="flex-row items-center gap-3 px-4 py-3">
              <IconTile icon={ListChecks} />
              <View className="flex-1 gap-1">
                <Text className="text-sm font-semibold">{f.title}</Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  <StatusChip label={s(`fieldTypes.${f.type}`)} tone="info" className="px-2 py-0.5" />
                  <Text className="text-muted-foreground text-xs">{`${s('fieldsPage.table.sort')}: ${f.sort_order ?? s('notAvailable')}`}</Text>
                  {f.required ? (
                    <StatusChip label={s('fieldsPage.table.required')} tone="destructive" className="px-2 py-0.5" />
                  ) : null}
                </View>
              </View>
              <Pressable onPress={() => openEdit(f)} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
              </Pressable>
              <Pressable onPress={() => remove(f)} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </View>
          )}
        />
      </View>

      <Dialog open={!!form} onOpenChange={(o) => !o && !saving && setForm(null)}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? s('fieldsPage.editField') : s('fieldsPage.newAbsenceField')}</DialogTitle>
          </DialogHeader>
          {form ? (
            <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              <View className="gap-1.5">
                <Label>{`${s('fieldsPage.fieldName')} *`}</Label>
                <Input value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder={s('fieldsPage.placeholders.fieldName')} />
              </View>
              <View className="gap-1.5">
                <Label>{`${s('fieldsPage.fieldType')} *`}</Label>
                <Picker value={form.type} onChange={(v) => setForm({ ...form, type: v as AbsenceFieldType, select_options: '' })} options={TYPES.map((v) => ({ value: v, label: s(`fieldTypes.${v}`) }))} />
              </View>
              {WITH_OPTIONS.includes(form.type) ? (
                <View className="gap-1.5">
                  <Label>{s('fieldsPage.optionsOnePerLine')}</Label>
                  <Textarea value={form.select_options} onChangeText={(v) => setForm({ ...form, select_options: v })} placeholder={s('fieldsPage.placeholders.options')} className="min-h-24" />
                </View>
              ) : null}
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Label>{s('fieldsPage.defaultValue')}</Label>
                  <Input value={form.default_selection} onChangeText={(v) => setForm({ ...form, default_selection: v })} placeholder={s('fieldsPage.placeholders.optional')} />
                </View>
                <View className="w-28 gap-1.5">
                  <Label>{s('fieldsPage.sortOrder')}</Label>
                  <Input value={form.sort_order} onChangeText={(v) => setForm({ ...form, sort_order: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder={s('fieldsPage.placeholders.sortOrder')} />
                </View>
              </View>
              <View className="flex-row items-center gap-3">
                <Switch checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} />
                <Label>{s('fieldsPage.requiredField')}</Label>
              </View>
            </ScrollView>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setForm(null)}>
              <Text>{s('cancel')}</Text>
            </Button>
            <Button onPress={save} disabled={saving}>
              <Text>{saving ? s('saving') : editingId ? s('saveChanges') : s('fieldsPage.createField')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
