import type { DocumentFieldType, LibraryDocumentField } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { AlignLeft, CalendarDays, CheckSquare, Hash, List, ListChecks, Paperclip, Pencil, Plus, Save, Sliders, Trash2, Type, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
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
import { useLibraryCategories } from '@/features/admin/library';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const FIELD_TYPES: { value: DocumentFieldType; icon: LucideIcon }[] = [
  { value: 'select_multiple', icon: ListChecks },
  { value: 'select_single', icon: List },
  { value: 'text', icon: Type },
  { value: 'long_text', icon: AlignLeft },
  { value: 'checkbox', icon: CheckSquare },
  { value: 'number', icon: Hash },
  { value: 'date', icon: CalendarDays },
  { value: 'files', icon: Paperclip },
];
const hasOptions = (t: DocumentFieldType) => t === 'select_multiple' || t === 'select_single';

/** Custom fields for library documents, optionally per category (web: /admin/library/document-fields). */
export default function LibraryDocumentFields() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`admin.library.document_fields.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const fields = useApi(['admin', 'library-doc-fields', 'all'], () => adminLibrary.documentFields());
  const cats = useLibraryCategories();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryDocumentField | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<DocumentFieldType>('text');
  const [categoryId, setCategoryId] = useState('');
  const [required, setRequired] = useState(false);
  const [sort, setSort] = useState('0');
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');
  const [saving, setSaving] = useState(false);

  const list = [...(fields.data ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const catName = (id: string | null) => (id ? (cats.data ?? []).find((c) => c.id === id)?.name : null);

  const openForm = (f: LibraryDocumentField | null) => {
    setEditing(f);
    setName(f?.field_name ?? '');
    setType(f?.field_type ?? 'text');
    setCategoryId(f?.category_id ?? '');
    setRequired(f?.is_required ?? false);
    setSort(String(f ? (f.sort_order ?? 0) : list.length + 1));
    setOptions((f?.options as string[]) ?? []);
    setNewOption('');
    setOpen(true);
  };

  const addOption = () => {
    const v = newOption.trim();
    if (!v) return;
    if (options.includes(v)) return toast.error(d('toast.option_exists'));
    setOptions((p) => [...p, v]);
    setNewOption('');
  };

  async function save() {
    if (!name.trim()) return;
    if (hasOptions(type) && !options.length) return toast.error(d('toast.add_option_required'));
    setSaving(true);
    try {
      const body = { field_name: name.trim(), field_type: type, category_id: categoryId || null, is_required: required, sort_order: parseInt(sort, 10) || 0, options: hasOptions(type) ? options : [] };
      const r = editing ? await adminLibrary.updateDocumentField(editing.id, body) : await adminLibrary.createDocumentField(body);
      if (!r.success) return toast.error(r.error || (editing ? d('toast.update_failed') : d('toast.create_failed')));
      toast.success(editing ? d('toast.updated') : d('toast.created'));
      setOpen(false);
      fields.mutate();
    } catch {
      toast.error(d('toast.generic_error'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(f: LibraryDocumentField) {
    if (!(await confirm({ title: d('delete_confirm', { name: f.field_name }), destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminLibrary.deleteDocumentField(f.id);
    if (!r.success) return toast.error(r.error || d('toast.delete_failed'));
    toast.success(d('toast.deleted'));
    fields.mutate();
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => fields.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{d('subtitle')}</Text>
          <Button size="sm" onPress={() => openForm(null)}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{d('new_field')}</Text>
          </Button>
        </View>
        <View>
          <Text className="font-semibold">{d('all_fields', { count: list.length })}</Text>
          <Text className="text-muted-foreground text-xs">{t('app.lb_tap_to_edit')}</Text>
        </View>
        {fields.isLoading ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={Sliders} title={d('no_fields')} body={d('no_fields_desc')} />
        ) : (
          <Card className="py-0">
            {list.map((f, i) => {
              const ti = FIELD_TYPES.find((x) => x.value === f.field_type);
              const opts = (f.options ?? []) as string[];
              return (
                <View key={f.id}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable onPress={() => openForm(f)} className="active:bg-muted flex-row items-start gap-3 px-4 py-3">
                    <Text className="text-muted-foreground w-5 text-xs">{i + 1}</Text>
                    <View className="flex-1 gap-1">
                      <Text className="font-medium">{f.field_name}</Text>
                      <View className="flex-row items-center gap-1.5">
                        <Icon as={ti?.icon ?? Type} className="text-muted-foreground size-3.5" />
                        <Text className="text-muted-foreground text-xs">{ti ? d(`field_types.${f.field_type}.label`) : f.field_type}</Text>
                      </View>
                      <View className="flex-row flex-wrap items-center gap-1">
                        <View className="bg-secondary rounded px-1.5">
                          <Text className="text-xs">{catName(f.category_id) ?? d('all_categories')}</Text>
                        </View>
                        <View className={cn('rounded px-1.5', f.is_required ? 'bg-primary' : 'border-border border')}>
                          <Text className={cn('text-xs', f.is_required && 'text-primary-foreground')}>{f.is_required ? d('required') : t('common.optional', { defaultValue: 'Optional' })}</Text>
                        </View>
                        {opts.slice(0, 3).map((o) => (
                          <View key={o} className="border-border rounded border px-1.5">
                            <Text className="text-xs">{o}</Text>
                          </View>
                        ))}
                        {opts.length > 3 ? (
                          <View className="border-border rounded border px-1.5">
                            <Text className="text-xs">+{opts.length - 3}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Button size="icon" variant="ghost" onPress={() => openForm(f)} accessibilityLabel={t('common.edit')}>
                      <Icon as={Pencil} className="text-foreground size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => remove(f)} accessibilityLabel={t('common.delete')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              <DialogHeader>
                <DialogTitle>{editing ? d('dialog.edit_title') : d('dialog.new_title')}</DialogTitle>
                <Text className="text-muted-foreground text-sm">{editing ? d('dialog.edit_desc') : d('dialog.new_desc')}</Text>
              </DialogHeader>
              <View className="gap-1.5">
                <Label>{d('table.field_name')} *</Label>
                <Input value={name} onChangeText={setName} placeholder={d('dialog.field_name_placeholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{d('table.data_type')} *</Label>
                <View className="flex-row flex-wrap gap-2">
                  {FIELD_TYPES.map((ft) => {
                    const on = type === ft.value;
                    return (
                      <Pressable key={ft.value} onPress={() => setType(ft.value)} className={cn('min-w-[46%] flex-1 flex-row items-center gap-2 rounded-lg border p-2.5', on ? 'border-primary bg-primary/5' : 'border-border')}>
                        <View className={cn('size-8 items-center justify-center rounded-md', on ? 'bg-primary' : 'bg-muted')}>
                          <Icon as={ft.icon} className={cn('size-4', on ? 'text-primary-foreground' : 'text-muted-foreground')} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-medium">{d(`field_types.${ft.value}.label`)}</Text>
                          <Text className="text-muted-foreground text-[11px]" numberOfLines={2}>
                            {d(`field_types.${ft.value}.description`)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {hasOptions(type) ? (
                <View className="gap-1.5">
                  <Label>{d('table.options')} *</Label>
                  <View className="flex-row gap-2">
                    <Input className="flex-1" value={newOption} onChangeText={setNewOption} onSubmitEditing={addOption} placeholder={d('dialog.option_placeholder')} />
                    <Button variant="outline" onPress={addOption}>
                      <Text>{t('common.add')}</Text>
                    </Button>
                  </View>
                  <View className="flex-row flex-wrap gap-1.5">
                    {options.map((o, i) => (
                      <View key={o} className="bg-secondary flex-row items-center gap-1 rounded-full px-2 py-0.5">
                        <Text className="text-xs">{o}</Text>
                        <Pressable onPress={() => setOptions((p) => p.filter((_, j) => j !== i))} hitSlop={6} accessibilityLabel={t('common.delete')}>
                          <Icon as={X} className="text-muted-foreground size-3" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Label>{d('dialog.category_optional')}</Label>
                  <Picker value={categoryId || 'ALL'} onChange={(x) => setCategoryId(x === 'ALL' ? '' : x)} options={[{ value: 'ALL', label: d('all_categories') }, ...(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
                </View>
                <View className="w-24 gap-1.5">
                  <Label>{d('table.sort_order')}</Label>
                  <Input value={sort} onChangeText={setSort} keyboardType="number-pad" />
                </View>
              </View>
              <View className="border-border gap-1 rounded-lg border p-3">
                <CheckRow checked={required} onPress={() => setRequired((v) => !v)} label={d('required_field')} />
                <Text className="text-muted-foreground text-xs">{d('required_field_desc')}</Text>
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" onPress={() => setOpen(false)} disabled={saving}>
                  <Text>{t('common.cancel')}</Text>
                </Button>
                <Button onPress={save} disabled={!name.trim() || saving}>
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>{editing ? d('dialog.save_changes') : t('common.save')}</Text>
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </DialogContent>
      </Dialog>
    </View>
  );
}
