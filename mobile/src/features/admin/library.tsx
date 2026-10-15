import type { LibraryLoanRow } from '@studently/api-client';
import type { LibraryCategory, LibraryDocumentField } from '@studently/shared-types';
import { BookOpen, User, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { FilterChips, MultiChips } from '@/components/app/filter-chips';
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
export const PRESET_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#78716C'];

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
      <View className="border-border flex-row items-center gap-3 rounded-md border px-3 py-2">
        <Icon as={User} className="text-muted-foreground size-4" />
        <View className="flex-1">
          <Text className="font-medium">{value.name}</Text>
          {value.detail ? <Text className="text-muted-foreground text-xs">{value.detail}</Text> : null}
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={t('app.ss_change')}>
          <Icon as={X} className="text-muted-foreground size-5" />
        </Pressable>
      </View>
    );
  }
  const rows = ((res.data ?? []) as Record<string, any>[]).map((r) => toBorrower(r, type));
  return (
    <View className="gap-1">
      <SearchBar value={q} onChangeText={setQ} placeholder={type === 'student' ? t('app.lb_search_student') : t('app.lb_search_user')} />
      {res.isLoading ? <Text className="text-muted-foreground px-2 text-sm">{t('app.lb_searching')}</Text> : null}
      {rows.map((b, i) => (
        <View key={b.id}>
          {i > 0 ? <Separator /> : null}
          <Pressable className="px-2 py-2.5" onPress={() => onChange(b)}>
            <Text>{b.name}</Text>
            {b.detail ? <Text className="text-muted-foreground text-xs">{b.detail}</Text> : null}
          </Pressable>
        </View>
      ))}
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
      <View className="border-border flex-row items-center gap-3 rounded-md border px-3 py-2">
        <Icon as={BookOpen} className="text-muted-foreground size-4" />
        <View className="flex-1">
          <Text className="font-medium">{value.book_title}</Text>
          <Text className="text-muted-foreground text-xs">
            {value.student_name} · {value.accession_number}
          </Text>
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={t('app.ss_change')}>
          <Icon as={X} className="text-muted-foreground size-5" />
        </Pressable>
      </View>
    );
  }
  const rows = res.data ?? [];
  return (
    <View className="gap-1">
      <SearchBar value={q} onChangeText={setQ} placeholder={t('app.lb_search_loan')} />
      {res.isLoading ? <Text className="text-muted-foreground px-2 text-sm">{t('app.lb_searching')}</Text> : null}
      {rows.map((l, i) => (
        <View key={l.id}>
          {i > 0 ? <Separator /> : null}
          <Pressable className="px-2 py-2.5" onPress={() => onChange(l)}>
            <Text className="font-medium">{l.book_title}</Text>
            <Text className="text-muted-foreground text-xs">
              {l.student_name} | {l.accession_number} | {t('app.lb_due')}: {date(l.due_date)}
            </Text>
          </Pressable>
        </View>
      ))}
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
            className={value.toLowerCase() === c.toLowerCase() ? 'border-primary size-8 rounded-full border-2' : 'size-8 rounded-full border border-black/10'}
            style={{ backgroundColor: c }}
          />
        ))}
      </View>
      <View className="flex-row items-center gap-2">
        <View className="size-8 rounded-md border border-black/10" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(value) ? value : '#6B7280' }} />
        <Input className="flex-1 font-mono" value={value} onChangeText={onChange} autoCapitalize="none" maxLength={7} />
      </View>
    </View>
  );
}
