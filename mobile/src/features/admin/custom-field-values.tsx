import type { CustomFieldDefinition } from '@studently/api-client';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { InfoRow } from '@/components/app/info';
import { Panel, PanelTitle } from '@/components/app/panel';
import { locale } from '@/i18n';
import { formatDate } from '@/lib/format';

/**
 * A record's value for a field. The web stores them nested by tab for students
 * (custom_fields[category][key], sometimes as { label, type, value }) and flat for teachers, staff
 * and parents (custom_fields[key]).
 */
export function readCustomValue(values: Record<string, any> | null | undefined, d: Pick<CustomFieldDefinition, 'category_id' | 'field_key'>): unknown {
  const nested = values?.[d.category_id];
  const raw = nested && typeof nested === 'object' && !Array.isArray(nested) && d.field_key in nested ? nested[d.field_key] : values?.[d.field_key];
  return raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw ? (raw as { value: unknown }).value : raw;
}

function display(def: CustomFieldDefinition, stored: unknown, yes: string, no: string): string | undefined {
  const raw = stored;
  if (raw === null || raw === undefined || raw === '') return undefined;
  const ar = locale === 'ar';
  const translate = (v: string) => {
    if (!ar || !def.options_ar || !def.options) return v;
    const i = def.options.indexOf(v);
    return i >= 0 && def.options_ar[i] ? def.options_ar[i] : v;
  };
  switch (def.type) {
    case 'checkbox':
      return raw === true || raw === 'true' ? yes : no;
    case 'date':
      return formatDate(String(raw));
    case 'multi-select':
      return (Array.isArray(raw) ? raw : String(raw).split(',')).map((v) => translate(String(v).trim())).join(', ');
    case 'select':
      return translate(String(raw));
    case 'file':
      return Array.isArray(raw) ? `${raw.length} file(s)` : String(raw).split('/').pop();
    default:
      return String(raw);
  }
}

/**
 * A record's custom field values, one card per category (record.custom_fields[category][key]).
 * `hideEmpty` drops unanswered fields and empty categories (web: StudentCustomFields, read-only portals).
 */
export function CustomFieldValues({ defs, values, hideEmpty }: { defs?: CustomFieldDefinition[]; values?: Record<string, any> | null; hideEmpty?: boolean }) {
  const { t } = useTranslation();
  if (!defs?.length) return null;
  const ar = locale === 'ar';
  const categories = new Map<string, { name: string; order: number; fields: CustomFieldDefinition[] }>();
  const yes = t('school.students.student_details.yes');
  const no = t('school.students.student_details.no');
  const shown = (d: CustomFieldDefinition) => !hideEmpty || display(d, readCustomValue(values, d), yes, no) !== undefined;
  for (const d of defs.filter((x) => x.is_active !== false && shown(x))) {
    const c = categories.get(d.category_id) ?? { name: d.category_name, order: d.category_order ?? 0, fields: [] };
    c.fields.push(d);
    categories.set(d.category_id, c);
  }
  return (
    <>
      {[...categories.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([categoryId, c]) => (
          <Panel key={categoryId}>
            <PanelTitle title={c.name} />
            <View className="px-4 pb-2">
              {c.fields
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((d, i, arr) => (
                  <View key={d.id} className={i < arr.length - 1 ? 'border-info-soft dark:border-border border-b' : undefined}>
                    <InfoRow label={(ar && d.label_ar) || d.label} value={display(d, readCustomValue(values, d), yes, no)} />
                  </View>
                ))}
            </View>
          </Panel>
        ))}
    </>
  );
}
