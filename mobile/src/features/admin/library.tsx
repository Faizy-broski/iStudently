import type { LibraryLoanRow } from '@studently/api-client';
import type { LibraryCategory, LibraryDocumentField } from '@studently/shared-types';
import { BookOpen, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors } from '@/lib/colors';
import { DateField } from '@/components/app/date-field';
import { FilterChips, MultiChips } from '@/components/app/filter-chips';
import { IconTile, Initials } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

export const DOCUMENT_TYPES = ['book', 'magazine', 'cd', 'periodical', 'thesis', 'other'] as const;
export const RETURN_CONDITIONS = ['excellent', 'good', 'fair', 'poor'] as const;
export const PRESET_COLORS = [colors.destructive, colors.warning, colors.brandAccent, colors.warning, colors.success, colors.success, colors.chart7, colors.chart7, colors.brandSecondary, colors.chart6, colors.chart6, colors.chart6, colors.chart6, colors.chart8, colors.destructive, colors.printMuted];

/** Parents followed by their subcategories ("— Child"), like the web's category selects. */
export function orderCategoriesForSelect(categories: LibraryCategory[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const top of categories.filter((c) => !c.parent_category_id)) {
    out.push({ value: top.id, label: top.name });
    for (const child of categories.filter((c) => c.parent_category_id === top.id)) out.push({ value: child.id, label: `— ${child.name}` });
  }
  return out;
}

export function useLibraryCategories() {
  return useApi(['admin', 'library-categories'], () => adminLibrary.categories());
}

/** Refresh every library list after a change. */
export const isLibraryKey = (k: unknown) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && k[1].startsWith('library-');

export interface Borrower {
  id: string;
  name: string;
  detail: string;
}

/** Library student search rows come either flat or with a joined profile; the loan uses the profile id. */
function toBorrower(raw: Record<string, any>, type: 'student' | 'user'): Borrower {
  const first = raw.profile?.first_name ?? raw.first_name ?? '';
  const last = raw.profile?.last_name ?? raw.last_name ?? '';
  const id = type === 'student' ? (raw.profile?.id ?? raw.profile_id ?? raw.id) : raw.id;
  const detail = [raw.student_number ?? raw.admission_number, raw.grade_level ?? raw.class_name, raw.email].filter(Boolean).join(' · ');
  return { id, name: `${first} ${last}`.trim() || 'N/A', detail };
}

/** Student or staff/other search for loans (web: Issue Book / Quick Loan borrower pickers). */
export function BorrowerSearch({ type, value, onChange }: { type: 'student' | 'user'; value: Borrower | null; onChange: (b: Borrower | null) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 400);
  const res = useApi(term && !value ? ['admin', 'library-borrower-search', type, term] : null, ([, , ty, s]) =>
    ty === 'student' ? adminLibrary.searchStudents(s as string) : adminLibrary.searchBorrowers(s as string, 'user'),
  );
  if (value) {
    return (
      <View className="border-brand-secondary bg-info-soft flex-row items-center gap-3 rounded-2xl border p-2.5">
        <Initials name={value.name} />
        <View className="flex-1">
          <Text className="text-sm font-semibold">{value.name}</Text>
          {value.detail ? <Text className="text-muted-foreground text-[11px]">{value.detail}</Text> : null}
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={t('app.ss_change')} className="bg-card size-8 items-center justify-center rounded-full active:opacity-70">
          <Icon as={X} className="text-muted-foreground size-4" />
        </Pressable>
      </View>
    );
  }
  const rows = ((res.data ?? []) as Record<string, any>[]).map((r) => toBorrower(r, type));
  return (
    <View className="gap-1">
      <SearchBar value={q} onChangeText={setQ} placeholder={type === 'student' ? t('app.lb_search_student') : t('app.lb_search_user')} />
      {res.isLoading ? <Text className="text-muted-foreground px-2 text-sm">{t('app.lb_searching')}</Text> : null}
      {rows.length ? (
        <View className="border-info-soft dark:border-border bg-card overflow-hidden rounded-2xl border">
          {rows.map((b, i) => (
            <View key={b.id}>
              {i > 0 ? <Separator /> : null}
              <Pressable className="flex-row items-center gap-3 px-3 py-2.5 active:opacity-70" onPress={() => onChange(b)}>
                <Initials name={b.name} size={32} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{b.name}</Text>
                  {b.detail ? <Text className="text-muted-foreground text-[11px]">{b.detail}</Text> : null}
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {term && !res.isLoading && !rows.length ? <Text className="text-muted-foreground px-2 text-sm">{t('app.lb_no_results')}</Text> : null}
    </View>
  );
}

/** Search active loans by book, borrower or accession number and pick one (web: Return / Mark Lost dialogs). */
export function ActiveLoanSearch({ initial = '', value, onChange }: { initial?: string; value: LibraryLoanRow | null; onChange: (l: LibraryLoanRow | null) => void }) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState(initial);
  const term = useDebounced(q.trim(), 300);
  const res = useApi(term && !value ? ['admin', 'library-loan-search', term] : null, ([, , s]) => adminLibrary.loans({ search: s as string, status: 'active' }));
  const date = (d: string) => new Date(d).toLocaleDateString(i18n.language);
  if (value) {
    return (
      <View className="border-brand-secondary bg-info-soft flex-row items-center gap-3 rounded-2xl border p-2.5">
        <IconTile icon={BookOpen} size={36} />
        <View className="flex-1">
          <Text className="text-sm font-semibold">{value.book_title}</Text>
          <Text className="text-muted-foreground text-[11px]">
            {value.student_name} · {value.accession_number}
          </Text>
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={t('app.ss_change')} className="bg-card size-8 items-center justify-center rounded-full active:opacity-70">
          <Icon as={X} className="text-muted-foreground size-4" />
        </Pressable>
      </View>
    );
  }
  const rows = res.data ?? [];
  return (
    <View className="gap-1">
      <SearchBar value={q} onChangeText={setQ} placeholder={t('app.lb_search_loan')} />
      {res.isLoading ? <Text className="text-muted-foreground px-2 text-sm">{t('app.lb_searching')}</Text> : null}
      {rows.length ? (
        <View className="border-info-soft dark:border-border bg-card overflow-hidden rounded-2xl border">
          {rows.map((l, i) => (
            <View key={l.id}>
              {i > 0 ? <Separator /> : null}
              <Pressable className="flex-row items-center gap-3 px-3 py-2.5 active:opacity-70" onPress={() => onChange(l)}>
                <IconTile icon={BookOpen} size={32} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{l.book_title}</Text>
                  <Text className="text-muted-foreground text-[11px]">
                    {l.student_name} | {l.accession_number} | {t('app.lb_due')}: {date(l.due_date)}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {term && !res.isLoading && !rows.length ? <Text className="text-muted-foreground px-2 text-sm">{t('app.lb_no_results')}</Text> : null}
    </View>
  );
}

/** Input for a library document field (web: UploadDocumentDialog renderFieldInput). */
export function DocumentFieldInput({ field, value, onChange }: { field: LibraryDocumentField; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useTranslation();
  const options = ((field.options ?? []) as string[]).map((o) => ({ value: o, label: o }));
  const str = value == null ? '' : String(value);
  switch (field.field_type) {
    case 'long_text':
      return <Textarea value={str} onChangeText={onChange} placeholder={t('app.lb_enter_field', { field: field.field_name.toLowerCase() })} />;
    case 'number':
      return <Input value={str} onChangeText={(v) => onChange(v === '' ? '' : Number(v.replace(/[^0-9.-]/g, '')))} keyboardType="decimal-pad" placeholder="0" />;
    case 'date':
      return <DateField value={str || null} onChange={onChange} clearable />;
    case 'checkbox':
      return (
        <View className="flex-row items-center gap-2">
          <Switch checked={!!value} onCheckedChange={onChange} />
          <Text className="text-sm">{t('common.yes')}</Text>
        </View>
      );
    case 'select_single':
      return options.length > 6 ? <Picker value={str} onChange={onChange} placeholder={t('app.lb_select')} options={options} /> : <FilterChips<string> value={str} onChange={onChange} options={options} />;
    case 'select_multiple':
      return <MultiChips<string> value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} options={options} />;
    case 'files':
      return <Text className="text-muted-foreground text-sm">{t('app.cf_file_on_web')}</Text>;
    default:
      return <Input value={str} onChangeText={onChange} placeholder={t('app.lb_enter_field', { field: field.field_name.toLowerCase() })} />;
  }
}

/** Color swatches plus a hex input (web: PRESET_COLORS + color input). */
export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityLabel={c}
            className={value.toLowerCase() === c.toLowerCase() ? 'border-brand dark:border-brand-secondary size-8 rounded-full border-2' : 'size-8 rounded-full border border-black/10'}
            style={{ backgroundColor: c }}
          />
        ))}
      </View>
      <View className="flex-row items-center gap-2">
        <View className="size-8 rounded-xl border border-black/10" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(value) ? value : colors.printMuted }} />
        <Input className="flex-1 font-mono" value={value} onChangeText={onChange} autoCapitalize="none" maxLength={7} />
      </View>
    </View>
  );
}
