import type { CustomFieldDefinition } from '@studently/api-client';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FilterChips, MultiChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { readCustomValue } from '@/features/admin/custom-field-values';
import { locale } from '@/i18n';

/** Where values are written: nested by tab (students) or flat by key (teachers, staff, parents), like the web. */
export type CustomValueLayout = 'nested' | 'flat';
export type CustomValues = Record<string, any>;

/** Current values for the given fields, read from a record's custom_fields (any stored shape). */
export function initialCustomValues(defs: CustomFieldDefinition[] | undefined, stored: Record<string, any> | null | undefined): Record<string, unknown> {
  return Object.fromEntries((defs ?? []).map((d) => [d.id, readCustomValue(stored, d)]));
}

/** Merge edited values back into the record's custom_fields, keeping everything else. */
export function mergeCustomValues(
  defs: CustomFieldDefinition[] | undefined,
  edited: Record<string, unknown>,
  stored: Record<string, any> | null | undefined,
  layout: CustomValueLayout,
): Record<string, any> {
  const out: Record<string, any> = JSON.parse(JSON.stringify(stored ?? {}));
  for (const d of defs ?? []) {
    if (!(d.id in edited) || d.type === 'file') continue;
    const value = edited[d.id];
    if (layout === 'flat') out[d.field_key] = value;
    else {
      const cat = out[d.category_id] && typeof out[d.category_id] === 'object' ? out[d.category_id] : {};
      out[d.category_id] = { ...cat, [d.field_key]: value };
    }
  }
  return out;
}

const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Labels of required fields that are still empty (the web blocks saving the same way). */
export function missingRequired(defs: CustomFieldDefinition[] | undefined, values: Record<string, unknown>) {
  const ar = locale === 'ar';
  return (defs ?? []).filter((d) => d.required && d.is_active !== false && d.type !== 'file' && empty(values[d.id])).map((d) => (ar && d.label_ar) || d.label);
}

function FieldInput({ def, value, onChange }: { def: CustomFieldDefinition; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useTranslation();
  const ar = locale === 'ar';
  const options = (def.options ?? []).map((o, i) => ({ value: o, label: (ar && def.options_ar?.[i]) || o }));
  switch (def.type) {
    case 'long-text':
      return <Textarea value={value == null ? '' : String(value)} onChangeText={onChange} />;
    case 'number':
      return <Input value={value == null ? '' : String(value)} onChangeText={(v) => onChange(v.replace(/[^0-9.-]/g, ''))} keyboardType="decimal-pad" />;
    case 'date':
      return <Input value={value == null ? '' : String(value).slice(0, 10)} onChangeText={onChange} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />;
    case 'checkbox':
      return <Switch checked={value === true || value === 'true'} onCheckedChange={onChange} />;
    case 'select':
      return options.length > 6 ? (
        <Picker value={value == null ? '' : String(value)} onChange={onChange} options={options} />
      ) : (
        <FilterChips<string> value={value == null ? '' : String(value)} onChange={onChange} options={options} />
      );
    case 'multi-select':
      return <MultiChips<string> value={Array.isArray(value) ? value.map(String) : value ? String(value).split(',').map((x) => x.trim()) : []} onChange={onChange} options={options} />;
    case 'file':
      return <Text className="text-muted-foreground text-sm">{t('app.cf_file_on_web')}</Text>;
    default:
      return <Input value={value == null ? '' : String(value)} onChangeText={onChange} />;
  }
}

/** Inputs for a record's custom fields, one card per tab. */
export function CustomFieldInputs({
  defs,
  values,
  onChange,
  tabName,
}: {
  defs?: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  tabName: (categoryId: string, fallback: string) => string;
}) {
  const ar = locale === 'ar';
  const active = (defs ?? []).filter((d) => d.is_active !== false);
  if (active.length === 0) return null;
  const groups = new Map<string, { name: string; order: number; fields: CustomFieldDefinition[] }>();
  for (const d of active) {
    const g = groups.get(d.category_id) ?? { name: d.category_name, order: d.category_order ?? 0, fields: [] };
    g.fields.push(d);
    groups.set(d.category_id, g);
  }
  return (
    <>
      {[...groups.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([categoryId, g]) => (
          <Card key={categoryId} className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle>{tabName(categoryId, g.name)}</CardTitle>
            </CardHeader>
            <CardContent className="gap-3 px-4">
              {g.fields
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((d) => (
                  <View key={d.id} className="gap-1.5">
                    <Label>{((ar && d.label_ar) || d.label) + (d.required ? ' *' : '')}</Label>
                    <FieldInput def={d} value={values[d.id]} onChange={(v) => onChange(d.id, v)} />
                  </View>
                ))}
            </CardContent>
          </Card>
        ))}
    </>
  );
}
