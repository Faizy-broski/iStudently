import type { CustomFieldEntity } from '@studently/api-client';
import type { CustomFieldType } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { Plus, Save, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { CheckRow } from '@/features/admin/attendance';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useHostelScope } from '@/features/admin/hostel';
import { adminCustomFields } from '@/lib/api';
import { useApi } from '@/lib/data';

type Entity = Extract<CustomFieldEntity, 'hostel_room' | 'hostel_building'>;

const FIELD_TYPES: CustomFieldType[] = ['select', 'multi-select', 'text', 'long-text', 'checkbox', 'number', 'date', 'file'];
const CATEGORY_ID = 'general';
const CATEGORY_NAME = 'General';

interface Row {
  id: string;
  isNew: boolean;
  label: string;
  type: CustomFieldType;
  options: string;
  required: boolean;
  sort_order: number;
}

const hasOptions = (type: CustomFieldType) => type === 'select' || type === 'multi-select';
const splitOptions = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

/** Extra fields for hostel rooms and buildings; edits are saved together (web: /admin/hostel/fields). */
export default function HostelFields() {
  const { t } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.fields.${k}`, o);
  const toast = useToast();
  const scope = useHostelScope();
  const campusId = scope ? scope.campusId : undefined;
  const [entity, setEntity] = useState<Entity>('hostel_room');
  const defs = useApi(['admin', 'custom-fields', entity, campusId ?? 'school'], ([, , e]) => adminCustomFields.list(e as Entity, campusId));
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [required, setRequired] = useState(false);
  const [sortOrder, setSortOrder] = useState('');

  useEffect(() => {
    if (!defs.data) return;
    setRows(
      [...defs.data]
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((d) => ({ id: d.id, isNew: false, label: d.label, type: d.type, options: (d.options ?? []).join('\n'), required: d.required, sort_order: d.sort_order })),
    );
  }, [defs.data]);

  const resetNew = () => {
    setLabel('');
    setType('text');
    setOptions('');
    setDefaultValue('');
    setRequired(false);
    setSortOrder('');
  };
  useEffect(resetNew, [entity]);

  function addRow() {
    if (!label.trim()) return toast.error(f('msg_field_name_required'));
    const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const row: Row = { id: `new-${Date.now()}`, isNew: true, label: label.trim(), type, options, required, sort_order: sortOrder ? parseInt(sortOrder, 10) || max + 1 : max + 1 };
    setRows((p) => [...p, row].sort((a, b) => a.sort_order - b.sort_order));
    resetNew();
    toast.success(f('msg_field_added'));
  }
  const update = (id: string, patch: Partial<Row>) => setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function save() {
    setSaving(true);
    try {
      const existing = await adminCustomFields.list(entity, campusId);
      const existingIds = new Set((existing.data ?? []).map((d) => d.id));
      const kept = new Set<string>();
      for (const r of rows) {
        const input = { label: r.label, type: r.type, options: splitOptions(r.options), required: r.required, sort_order: r.sort_order };
        const res = r.isNew
          ? await adminCustomFields.create(entity, campusId, { ...input, category_id: CATEGORY_ID, category_name: CATEGORY_NAME })
          : existingIds.has(r.id)
            ? await adminCustomFields.update(campusId, r.id, input)
            : null;
        if (!r.isNew) kept.add(r.id);
        if (res && !res.success) throw new Error(res.error);
      }
      for (const id of existingIds) {
        if (!kept.has(id)) {
          const res = await adminCustomFields.remove(campusId, id);
          if (!res.success) throw new Error(res.error);
        }
      }
      toast.success(f('msg_fields_saved'));
      await defs.mutate();
    } catch {
      toast.error(f('msg_fields_save_error'));
    } finally {
      setSaving(false);
    }
  }

  const entityLabel = f(entity === 'hostel_room' ? 'entity_room' : 'entity_building');
  const typeOptions = FIELD_TYPES.map((x) => ({ value: x, label: f(`type_${x.replace('-', '_')}`) }));

  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: f('header_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <FilterChips
          value={entity}
          onChange={setEntity}
          options={[
            { value: 'hostel_room', label: f('option_room') },
            { value: 'hostel_building', label: f('option_building') },
          ]}
        />
        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{f('card_new_field', { entity: entityLabel })}</Text>
            <Label>{f('label_field_name')}</Label>
            <Input value={label} onChangeText={setLabel} placeholder={f('placeholder_field_name', { example: entity === 'hostel_room' ? 'Room Type' : 'Wing / Block' })} />
            <Label>{f('label_type')}</Label>
            <Picker value={type} onChange={(v) => setType(v as CustomFieldType)} options={typeOptions} />
            {hasOptions(type) ? (
              <>
                <Label>
                  {f('label_options')} <Text className="text-muted-foreground text-xs">{f('desc_options')}</Text>
                </Label>
                <Textarea value={options} onChangeText={setOptions} placeholder={f('placeholder_options')} />
              </>
            ) : null}
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1.5">
                <Label>{f('label_default')}</Label>
                <Input value={defaultValue} onChangeText={setDefaultValue} placeholder={f('placeholder_default')} />
              </View>
              <View className="w-28 gap-1.5">
                <Label>{f('label_sort_order')}</Label>
                <Input value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" placeholder={f('placeholder_sort_order')} />
              </View>
            </View>
            <View className="flex-row items-center justify-between gap-3">
              <CheckRow checked={required} onPress={() => setRequired((v) => !v)} label={f('label_required')} />
              <Button size="sm" variant="outline" onPress={addRow}>
                <Icon as={Plus} className="text-foreground size-4" />
                <Text>{f('btn_add')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {defs.isLoading ? (
          <LoadingList rows={3} />
        ) : !rows.length ? (
          <View className="border-info-soft dark:border-border items-center gap-1 rounded-xl border border-dashed py-8">
            <Text className="text-muted-foreground">{f('msg_no_fields', { entity: entityLabel.toLowerCase() })}</Text>
            <Text className="text-muted-foreground text-center text-xs">{f('msg_no_fields_desc')}</Text>
          </View>
        ) : (
          rows.map((r, idx) => (
            <Card key={r.id}>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-center gap-2">
                  <Input className="flex-1" value={r.label} onChangeText={(v) => update(r.id, { label: v })} placeholder={f('label_field_name')} />
                  <Pressable onPress={() => setRows((p) => p.filter((x) => x.id !== r.id))} accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Picker value={r.type} onChange={(v) => update(r.id, { type: v as CustomFieldType })} options={typeOptions} />
                  </View>
                  <Input className="w-20" value={String(r.sort_order)} onChangeText={(v) => update(r.id, { sort_order: parseInt(v, 10) || idx + 1 })} keyboardType="number-pad" />
                </View>
                <CheckRow checked={r.required} onPress={() => update(r.id, { required: !r.required })} label={f('label_required')} />
                {hasOptions(r.type) ? (
                  <>
                    <Label>
                      {f('label_options')} <Text className="text-muted-foreground text-xs">{f('desc_options')}</Text>
                    </Label>
                    <Textarea value={r.options} onChangeText={(v) => update(r.id, { options: v })} placeholder={f('placeholder_options')} />
                  </>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
        {rows.length ? (
          <Button variant="ghost" className="self-start" onPress={addRow}>
            <Icon as={Plus} className="text-primary size-4" />
            <Text className="text-primary">{f('btn_add_another')}</Text>
          </Button>
        ) : null}
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? f('btn_saving') : f('btn_save')}</Text>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
