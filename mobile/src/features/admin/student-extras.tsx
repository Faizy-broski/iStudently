import type { Parent, SchoolService } from '@studently/api-client';
import { Check, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { SearchBar } from '@/components/app/search-bar';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { adminParents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

// Sections of the web AddStudentForm / EditStudentForm that the basic student form lacks:
// parent link or new parent, emergency contacts, previous school, services + first fee challan.

export type EmergencyContact = { name: string; relationship: string; phone: string; address: string };
export type PreviousSchool = { schoolName: string; transferDate: string; lastGradeCompleted: string };
export type RelationType = 'father' | 'mother' | 'guardian' | 'other';
export type NewParent = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  cnic: string;
  relationship: 'Father' | 'Mother' | 'Guardian' | 'Other';
  occupation: string;
  workplace: string;
  income: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
};
export const EMPTY_PARENT: NewParent = {
  first_name: '', last_name: '', email: '', phone: '', password: '', cnic: '', relationship: 'Father',
  occupation: '', workplace: '', income: '', address: '', city: '', state: '', zip_code: '', country: '',
};
export const EMPTY_SCHOOL: PreviousSchool = { schoolName: '', transferDate: '', lastGradeCompleted: '' };

/** The web's checks for a new parent: names, relationship, CNIC, street address and city (translation keys). */
export function newParentError(p: NewParent): string | null {
  if (!p.first_name.trim() || !p.last_name.trim() || !p.relationship) return 'common.fill_required_fields';
  if (!p.cnic.trim()) return 'common.cnic_required';
  if (!p.address.trim() || !p.city.trim()) return 'common.address_required';
  return null;
}

/** Web default: due on the 10th, of next month once the 5th has passed. */
export function defaultChallanDue() {
  const d = new Date();
  d.setDate(10);
  if (new Date().getDate() > 5) d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Web: academic year runs April–March ("2026-2027"), fee month is the current month. */
export function firstFeePeriod() {
  const now = new Date();
  const y = now.getFullYear();
  return { fee_month: `${y}-${String(now.getMonth() + 1).padStart(2, '0')}`, academic_year: now.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}` };
}

const parentName = (p: Parent) => `${p.profile?.first_name ?? ''} ${p.profile?.last_name ?? ''}`.trim() || p.profile?.email || '—';

function Field({ label, value, onChange, required, ...rest }: { label: string; value: string; onChange: (v: string) => void; required?: boolean } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChangeText' | 'onChange'>) {
  return (
    <View className="gap-1.5">
      <Label>{`${label}${required ? ' *' : ''}`}</Label>
      <Input value={value} onChangeText={onChange} {...rest} />
    </View>
  );
}

/** Family: link an existing parent (search) with a relationship, or create a new parent (web AddStudentForm). */
export function ParentLinkCard({
  linked,
  onLink,
  relation,
  onRelation,
  creating,
  onCreating,
  parent,
  onParent,
}: {
  linked: Parent | null;
  onLink: (p: Parent | null) => void;
  relation: RelationType;
  onRelation: (r: RelationType) => void;
  creating: boolean;
  onCreating: (v: boolean) => void;
  parent: NewParent;
  onParent: (p: NewParent) => void;
}) {
  const { t } = useTranslation();
  const a = (k: string) => t(`school.students.add_student.${k}`);
  const f = (k: string) => t(`school.students.fields.${k}`);
  const c = (k: string) => t(`common.${k}`);
  const [q, setQ] = useState('');
  const term = q.trim();
  const results = useApi(!creating && term.length >= 2 ? ['admin', 'parent-search', term] : null, ([, , s]) => adminParents.search(s as string));
  const set = (k: keyof NewParent) => (v: string) => onParent({ ...parent, [k]: v });
  const relations: { value: RelationType; label: string }[] = [
    { value: 'father', label: f('father') },
    { value: 'mother', label: f('mother') },
    { value: 'guardian', label: f('guardian') },
    { value: 'other', label: f('other') },
  ];

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle>{f('link_parent')}</CardTitle>
        <Button size="sm" variant={creating ? 'ghost' : 'outline'} onPress={() => onCreating(!creating)}>
          <Icon as={creating ? Trash2 : Plus} className="size-4" />
          <Text>{creating ? a('btn_cancel_creation') : a('btn_create_parent')}</Text>
        </Button>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        {creating ? (
          <>
            <Text className="text-sm font-semibold">{a('new_parent_details')}</Text>
            <Field label={f('first_name')} required value={parent.first_name} onChange={set('first_name')} />
            <Field label={f('last_name')} required value={parent.last_name} onChange={set('last_name')} />
            <Field label={c('email')} value={parent.email} onChange={set('email')} keyboardType="email-address" autoCapitalize="none" />
            <Field label={c('phone')} value={parent.phone} onChange={set('phone')} keyboardType="phone-pad" />
            <Field label={f('password')} value={parent.password} onChange={set('password')} placeholder={a('placeholder_auto_password')} secureTextEntry autoComplete="new-password" />
            <Field label={c('cnic')} required value={parent.cnic} onChange={set('cnic')} placeholder={a('placeholder_cnic')} />
            <View className="gap-1.5">
              <Label>{`${f('relationship_type')} *`}</Label>
              <FilterChips<NewParent['relationship']>
                value={parent.relationship}
                onChange={(v) => onParent({ ...parent, relationship: v })}
                options={[
                  { value: 'Father', label: f('father') },
                  { value: 'Mother', label: f('mother') },
                  { value: 'Guardian', label: f('guardian') },
                  { value: 'Other', label: f('other') },
                ]}
              />
            </View>
            <Text variant="muted" className="text-xs font-semibold">
              {a('professional_info')}
            </Text>
            <Field label={f('occupation')} value={parent.occupation} onChange={set('occupation')} />
            <Field label={f('workplace')} value={parent.workplace} onChange={set('workplace')} />
            <Field label={f('income')} value={parent.income} onChange={set('income')} />
            <Text variant="muted" className="text-xs font-semibold">
              {`${c('address')} *`}
            </Text>
            <Field label={c('street_address')} required value={parent.address} onChange={set('address')} />
            <Field label={c('city')} required value={parent.city} onChange={set('city')} />
            <Field label={c('state')} value={parent.state} onChange={set('state')} />
            <Field label={c('zip_code')} value={parent.zip_code} onChange={set('zip_code')} />
            <Field label={c('country')} value={parent.country} onChange={set('country')} />
          </>
        ) : (
          <>
            <Label>{a('parent_search_title')}</Label>
            {linked ? (
              <View className="bg-success-soft flex-row items-center gap-2 rounded-xl px-3 py-2.5">
                <Icon as={Check} className="text-success size-4" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{parentName(linked)}</Text>
                  {linked.profile?.email ? (
                    <Text variant="muted" className="text-xs">
                      {linked.profile.email}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => onLink(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={c('clear')}>
                  <Icon as={X} className="text-muted-foreground size-4" />
                </Pressable>
              </View>
            ) : (
              <>
                <SearchBar value={q} onChangeText={setQ} placeholder={a('parent_search_placeholder')} />
                {term.length < 2 ? (
                  <Text variant="muted" className="text-xs">
                    {a('search_type_min')}
                  </Text>
                ) : results.isLoading ? (
                  <Text variant="muted" className="text-xs">
                    {c('loading')}
                  </Text>
                ) : !(results.data ?? []).length ? (
                  <Text variant="muted" className="text-xs">
                    {a('no_parents_found')}
                  </Text>
                ) : (
                  <View className="border-border overflow-hidden rounded-xl border">
                    {(results.data ?? []).slice(0, 10).map((p, i) => (
                      <Pressable key={p.id} onPress={() => onLink(p)} className={cn('px-3 py-2.5 active:opacity-70', i > 0 && 'border-border border-t')} accessibilityRole="button">
                        <Text className="text-sm font-medium">{parentName(p)}</Text>
                        {p.profile?.email || p.cnic ? (
                          <Text variant="muted" className="text-xs">
                            {[p.profile?.email, p.cnic].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
            {linked ? (
              <View className="gap-1.5">
                <Label>{`${f('relationship_type')} *`}</Label>
                <FilterChips<RelationType> value={relation} onChange={onRelation} options={relations} />
              </View>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Emergency contacts list (name, relationship, phone, address). */
export function EmergencyContactsCard({ value, onChange }: { value: EmergencyContact[]; onChange: (v: EmergencyContact[]) => void }) {
  const { t } = useTranslation();
  const a = (k: string) => t(`school.students.add_student.${k}`);
  const update = (i: number, k: keyof EmergencyContact, v: string) => onChange(value.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle>{t('school.students.fields.emergency_contacts')}</CardTitle>
        <Button size="sm" variant="outline" onPress={() => onChange([...value, { name: '', relationship: '', phone: '', address: '' }])}>
          <Icon as={Plus} className="size-4" />
          <Text>{a('btn_add_contact')}</Text>
        </Button>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        {value.map((c, i) => (
          <View key={i} className="border-border gap-2 rounded-xl border p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold">{`#${i + 1}`}</Text>
              <Pressable onPress={() => onChange(value.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </View>
            <Field label={t('common.name')} value={c.name} onChange={(v) => update(i, 'name', v)} placeholder={a('placeholder_full_name')} />
            <Field label={t('school.students.fields.relationship_type')} value={c.relationship} onChange={(v) => update(i, 'relationship', v)} placeholder={a('placeholder_relationship_example')} />
            <Field label={t('common.phone')} value={c.phone} onChange={(v) => update(i, 'phone', v)} placeholder={a('placeholder_phone')} keyboardType="phone-pad" />
            <Field label={t('common.address')} value={c.address} onChange={(v) => update(i, 'address', v)} />
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

/** Previous school: name, transfer date, last grade completed. */
export function PreviousSchoolCard({ value, onChange }: { value: PreviousSchool; onChange: (v: PreviousSchool) => void }) {
  const { t } = useTranslation();
  const s = (k: string) => t(`school.students.${k}`);
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{s('fields.previous_school')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        <Field label={s('previous_school_name')} value={value.schoolName} onChange={(v) => onChange({ ...value, schoolName: v })} />
        <DateField label={s('transfer_date')} value={value.transferDate || null} onChange={(v) => onChange({ ...value, transferDate: v })} clearable />
        <Field label={s('last_grade_completed')} value={value.lastGradeCompleted} onChange={(v) => onChange({ ...value, lastGradeCompleted: v })} />
      </CardContent>
    </Card>
  );
}

/** Services to subscribe the new student to, and the optional first fee challan (web: Services tab). */
export function ServicesCard({
  services,
  gradeId,
  selected,
  onSelected,
  challan,
  onChallan,
  dueDate,
  onDueDate,
  money,
}: {
  services: SchoolService[];
  gradeId: string;
  selected: string[];
  onSelected: (ids: string[]) => void;
  challan: boolean;
  onChallan: (v: boolean) => void;
  dueDate: string;
  onDueDate: (v: string) => void;
  money: (n: number) => string;
}) {
  const { t } = useTranslation();
  const a = (k: string) => t(`school.students.add_student.${k}`);
  const toggle = (id: string) => onSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{a('services_tab')}</CardTitle>
        <CardDescription>{a('services_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="gap-2 px-4">
        {!services.length ? (
          <Text variant="muted" className="py-3 text-center text-sm">
            {a('no_services_available')}
          </Text>
        ) : (
          services.map((s) => {
            const on = selected.includes(s.id);
            const amount = s.grade_charges?.find((g) => g.grade_level_id === gradeId)?.charge_amount ?? s.default_charge;
            return (
              <Pressable
                key={s.id}
                onPress={() => toggle(s.id)}
                className={cn('flex-row items-center gap-3 rounded-xl border p-3', on ? 'border-brand bg-info-soft' : 'border-border')}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-semibold">{s.name}</Text>
                    {s.is_mandatory ? <StatusChip label={t('common.mandatory')} tone="destructive" className="px-1.5 py-0" /> : null}
                  </View>
                  <Text variant="muted" className="text-xs">{`${t(`common.freq_${s.charge_frequency}`, { defaultValue: t('app.st_freq_one_time') })} ${t('common.charge')}`}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-brand dark:text-brand-secondary font-bold">{money(amount)}</Text>
                  <View className={cn('size-5 items-center justify-center rounded border', on ? 'bg-brand border-brand' : 'border-border')}>{on ? <Icon as={Check} className="text-white size-3.5" /> : null}</View>
                </View>
              </Pressable>
            );
          })
        )}
        <View className="border-border mt-2 gap-2 border-t pt-3">
          <CheckRow checked={challan} onPress={() => onChallan(!challan)} label={`${a('generate_challan_title')} (${t('common.optional')})`} />
          <Text variant="muted" className="text-xs">
            {a('generate_challan_desc')}
          </Text>
          {challan ? <DateField label={a('challan_due_date')} value={dueDate} onChange={onDueDate} /> : null}
        </View>
      </CardContent>
    </Card>
  );
}
