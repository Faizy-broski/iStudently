import type { DisciplineField, DisciplineReferral } from '@studently/api-client';
import { BookOpen, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { cn } from '@/lib/utils';

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** Student or staff display name of a referral (the API returns either shape). */
export function referralPersonName(r: DisciplineReferral): string {
  if (r.students) {
    const s = r.students as NonNullable<DisciplineReferral['students']> & { profile?: { first_name?: string; last_name?: string; father_name?: string } };
    const first = s.first_name ?? s.profile?.first_name ?? '';
    const father = s.profile?.father_name ?? '';
    const last = s.last_name ?? s.profile?.last_name ?? '';
    return [first, father, last].filter(Boolean).join(' ').trim() || s.student_number;
  }
  if (r.staff) {
    const p = r.staff.profile;
    return (p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '') || r.staff.employee_number;
  }
  return r.student_id ?? r.staff_id ?? '';
}

/** Same scoring as backend discipline-score.service (shown live before submitting). */
export function pointsImpact(fields: DisciplineField[], values: Record<string, unknown>) {
  let total = 0;
  for (const f of fields) {
    if (!f.penalty_points) continue;
    const v = values[f.id];
    if (f.field_type === 'multiple_checkbox') total += f.penalty_points * (Array.isArray(v) ? v.length : 0);
    else if ((f.field_type === 'select' || f.field_type === 'multiple_radio') && (Array.isArray(v) ? v[0] : v)) total += f.penalty_points;
  }
  return total;
}

export function PointsBadge({ pts }: { pts: number }) {
  const up = pts > 0;
  return (
    <View className={cn('flex-row items-center gap-1 rounded-full px-2.5 py-1', up ? 'bg-success-soft' : 'bg-destructive-soft')}>
      <Icon as={up ? TrendingUp : TrendingDown} className={cn('size-3', up ? 'text-success' : 'text-destructive')} />
      <Text className={cn('text-[11px] font-semibold', up ? 'text-success' : 'text-destructive')}>{`${up ? '+' : ''}${pts} pts`}</Text>
    </View>
  );
}

/** Input for one custom referral field (all eight field types, like the web form). */
export function DisciplineFieldInput({ field, value, onChange }: { field: DisciplineField; value: any; onChange: (v: any) => void }) {
  const { t } = useTranslation();
  const opts = field.options ?? [];
  switch (field.field_type) {
    case 'text':
      return <Input value={value ?? ''} onChangeText={onChange} placeholder={field.name} maxLength={1000} />;
    case 'textarea':
      return <Textarea value={value ?? ''} onChangeText={onChange} placeholder={field.name} maxLength={5000} className="min-h-20" />;
    case 'numeric':
      return <Input value={value === undefined || value === null ? '' : String(value)} onChangeText={(v) => onChange(v === '' ? '' : Number(v.replace(/[^0-9.-]/g, '')))} keyboardType="numeric" />;
    case 'date':
      return <DateField value={value ?? ''} onChange={onChange} clearable />;
    case 'checkbox':
      return <CheckRow checked={value === true || value === 'Y'} onPress={() => onChange(value === true || value === 'Y' ? 'N' : 'Y')} label={t('discipline.yes')} />;
    case 'select':
      return <Picker value={value || '__na__'} onChange={(v) => onChange(v === '__na__' ? '' : v)} placeholder={t('discipline.select')} options={[{ value: '__na__', label: t('discipline.na') }, ...opts.map((o) => ({ value: o, label: o }))]} />;
    case 'multiple_radio':
      return (
        <View className="flex-row flex-wrap gap-2">
          {opts.map((o) => (
            <Pressable key={o} onPress={() => onChange(o)} accessibilityRole="radio" accessibilityState={{ checked: value === o }} className={cn('flex-row items-center gap-1.5 rounded-full border px-3 py-1.5', value === o ? 'border-brand-secondary bg-info-soft' : 'border-info-soft dark:border-border bg-card')}>
              <View className={cn('size-3.5 rounded-full border-2', value === o ? 'border-brand bg-brand dark:border-brand-secondary dark:bg-brand-secondary' : 'border-info-soft dark:border-border')} />
              <Text className={cn('text-sm', value === o && 'font-semibold text-brand dark:text-brand-secondary')}>{o}</Text>
            </Pressable>
          ))}
        </View>
      );
    case 'multiple_checkbox': {
      const sel: string[] = Array.isArray(value) ? value : [];
      return (
        <View className="flex-row flex-wrap gap-x-4">
          {opts.map((o) => (
            <CheckRow key={o} checked={sel.includes(o)} onPress={() => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o])} label={o} />
          ))}
        </View>
      );
    }
    default:
      return null;
  }
}

export const CHARTABLE_TYPES = ['select', 'multiple_radio', 'multiple_checkbox', 'checkbox'];

/** Values chosen for a field on one referral ("||a||b||" strings and arrays both supported). */
export function chosenValues(field: DisciplineField, raw: unknown, yes: string, no: string): string[] {
  if (raw === null || raw === undefined || raw === '') return [];
  if (field.field_type === 'checkbox') return [raw === 'Y' || raw === true ? yes : no];
  if (field.field_type === 'multiple_checkbox' || Array.isArray(raw)) {
    return Array.isArray(raw) ? raw.map(String) : String(raw).replace(/^\|+|\|+$/g, '').split('||').filter(Boolean);
  }
  return [String(raw)];
}

/** Every option of a chartable field (Yes/No for a checkbox). */
export const fieldOptions = (field: DisciplineField, yes: string, no: string) => (field.field_type === 'checkbox' ? [yes, no] : (field.options ?? []));

/** Log/print formatting used by the web discipline log. */
export function logValue(val: unknown) {
  if (val === null || val === undefined || val === '') return '-';
  if (val === 'Y' || val === true) return 'Y';
  if (val === 'N' || val === false) return 'N';
  if (Array.isArray(val)) return val.join(', ');
  return String(val).replace(/^\|+|\|+$/g, '').replace(/\|\|/g, ', ') || '-';
}

/** "Library-related" (e.g. a damaged or lost book): librarians see only referrals marked this way. */
export function LibraryRelatedSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3">
      <Switch checked={value} onCheckedChange={onChange} />
      <View className="flex-1">
        <Text className="text-sm font-medium" onPress={() => onChange(!value)}>
          {t('app.dc_library_related')}
        </Text>
        <Text className="text-muted-foreground text-xs">{t('app.dc_library_related_hint')}</Text>
      </View>
    </View>
  );
}

/** Small "Library" badge on a referral row. */
export function LibraryBadge() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-info-soft px-2.5 py-1">
      <Icon as={BookOpen} className="size-3 text-brand dark:text-brand-secondary" />
      <Text className="text-[11px] font-semibold text-brand dark:text-brand-secondary">{t('app.dc_library_badge')}</Text>
    </View>
  );
}
