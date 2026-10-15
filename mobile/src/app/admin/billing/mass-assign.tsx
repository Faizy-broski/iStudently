import type { StudentForAssign } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminBillingElements } from '@/lib/api';
import { useApi } from '@/lib/data';

/**
 * Charge an element (or a custom fee) to many students: element, title, amount, due date, comment;
 * students by grade, section and search (web: /admin/billing-elements/mass-assign).
 */
export default function MassAssign() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`admin.billing_elements.mass_assign.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { money } = useCurrency();
  const { campusId } = useCampus();
  const elements = useApi(['admin', 'billing-elements'], () => adminBillingElements.elements());
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [elementId, setElementId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('0');
  const [due, setDue] = useState('');
  const [comment, setComment] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const sections = useApi(gradeId ? ['admin', 'sections', campusId ?? 'school', gradeId] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));
  const students = useApi(['admin', 'be-assign-students', gradeId, sectionId], ([, , g, s]) => adminBillingElements.studentsForAssign((g as string) || undefined, (s as string) || undefined));

  const q = search.trim().toLowerCase();
  const filtered = (students.data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || (s.admission_number ?? '').toLowerCase().includes(q));
  const allOn = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function pickElement(id: string) {
    setElementId(id);
    const el = (elements.data ?? []).find((x) => x.id === id);
    setTitle(el?.title ?? '');
    setAmount(el ? String(el.amount) : '0');
  }

  async function assign() {
    if (selected.size === 0) return toast.error(m('toast.select_student'));
    if (!title.trim()) return toast.error(m('toast.title_required'));
    setBusy(true);
    const res = await adminBillingElements.massAssign([...selected], {
      billing_element_id: elementId || null,
      element_title: title.trim(),
      amount: Number(amount) || 0,
      due_date: due || null,
      comment: comment.trim() || null,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error || m('toast.operation_failed'));
    toast.success(m('toast.assigned_count', { count: res.data?.count ?? res.data?.assigned ?? selected.size }));
    setSelected(new Set());
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && k[1].startsWith('student-elements'));
  }

  const header = (
    <View className="gap-3 p-4">
      <Text variant="muted">{m('subtitle')}</Text>
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle>{m('element_and_fee')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-2 px-4">
          <Label>{m('element')}</Label>
          <Picker
            value={elementId}
            onChange={pickElement}
            options={[{ value: '', label: '—' }, ...(elements.data ?? []).filter((e) => e.is_active).map((e) => ({ value: e.id, label: `${e.title} · ${money(e.amount)}` }))]}
          />
          <Input value={title} onChangeText={setTitle} placeholder={m('fee_title_placeholder')} />
          <Label>{t('fees.payments.th_amount')}</Label>
          <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
          <Label>{m('due_date')}</Label>
          <DateField value={due || null} onChange={(v) => setDue(v ?? '')} clearable />
          <Label>{m('comment')}</Label>
          <Input value={comment} onChangeText={setComment} />
        </CardContent>
      </Card>
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Label>{m('grade')}</Label>
          <Picker
            value={gradeId}
            onChange={(v) => {
              setGradeId(v);
              setSectionId('');
              setSelected(new Set());
            }}
            options={[{ value: '', label: t('fees.generate.allGrades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
          />
        </View>
        <View className="flex-1 gap-1">
          <Label>{m('section')}</Label>
          <Picker
            value={sectionId}
            onChange={(v) => {
              setSectionId(v);
              setSelected(new Set());
            }}
            options={[{ value: '', label: t('common.all_sections') }, ...(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          />
        </View>
      </View>
      <SearchBar value={search} onChangeText={setSearch} />
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-sm">{`${m('students_found', { count: filtered.length })} ${m('selected_count', { count: selected.size })}`}</Text>
        <Pressable
          onPress={() => setSelected(allOn ? new Set() : new Set(filtered.map((s) => s.id)))}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allOn }}
          className="flex-row items-center gap-2">
          <Checkbox checked={allOn} onCheckedChange={() => setSelected(allOn ? new Set() : new Set(filtered.map((s) => s.id)))} />
          <Text className="text-sm">{t('fees.generate.selectAll')}</Text>
        </Pressable>
      </View>
    </View>
  );

  const toggle = (s: StudentForAssign) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s.id)) next.delete(s.id);
      else next.add(s.id);
      return next;
    });

  return (
    <>
      <Stack.Screen options={{ title: m('title') }} />
      <View className="bg-background flex-1">
        <FlatList
          data={students.isLoading ? [] : filtered}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={header}
          ListEmptyComponent={students.isLoading ? <LoadingList rows={6} /> : <EmptyState title={m('no_students')} />}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={25}
          renderItem={({ item: s }) => (
            <Pressable onPress={() => toggle(s)} accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(s.id) }} className="active:bg-muted border-border flex-row items-center gap-3 border-b px-4 py-3">
              <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s)} />
              <View className="flex-1">
                <Text className="font-medium">{s.name}</Text>
                <Text className="text-muted-foreground text-xs">{[`${m('admission_no')}: ${s.admission_number || '—'}`, s.grade_level, s.section_name].filter(Boolean).join(' · ')}</Text>
              </View>
            </Pressable>
          )}
        />
        <View className="border-border border-t p-4">
          <Button onPress={assign} disabled={busy || selected.size === 0}>
            <Text>{m('assign_button')}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
