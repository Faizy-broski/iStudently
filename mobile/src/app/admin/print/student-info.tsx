import type { StudentPrintInfo } from '@studently/api-client';
import { Stack } from 'expo-router';
import { FileDown, Printer } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { MultiChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ENTITY_TABS } from '@/features/admin/field-tabs';
import { readCustomValue } from '@/features/admin/custom-field-values';
import { fullName } from '@/features/admin/people';
import { PeoplePicker } from '@/features/admin/people-picker';
import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminCustomFields, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';

/** Printable information sheets for selected students (web: /admin/students/print-info). */
export default function PrintStudentInfo() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.students.print_info.${k}`, o);
  const f = (k: string) => t(`school.students.fields.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const ctx = usePrintContext();
  const defs = useApi(['admin', 'custom-fields', 'student', campusId ?? 'school'], () => adminCustomFields.list('student', campusId));
  const categories = useMemo(() => {
    const builtIn = ENTITY_TABS.student.map((id) => ({ value: id, label: t(`app.cf_tab_${id}`) }));
    const custom = new Map<string, string>();
    for (const d of defs.data ?? []) if (!ENTITY_TABS.student.includes(d.category_id)) custom.set(d.category_id, d.category_name);
    return [...builtIn, ...[...custom].map(([value, label]) => ({ value, label }))];
  }, [defs.data, t]);
  const [selectedCats, setSelectedCats] = useState<string[]>(['personal', 'academic', 'family']);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);

  function row(label: string, value: unknown) {
    const v = value === null || value === undefined || value === '' ? '—' : String(value);
    return `<tr><td style="color:#555;padding:3px 8px 3px 0;width:38%">${escapeHtml(label)}</td><td style="padding:3px 0">${escapeHtml(v)}</td></tr>`;
  }
  function section(title: string, rows: string) {
    return `<div style="margin-top:12px"><div class="record-subheader">${escapeHtml(title)}</div><table style="width:100%;border-collapse:collapse">${rows}</table></div>`;
  }

  function sheet(s: StudentPrintInfo) {
    const personal = s.custom_fields?.personal ?? {};
    const parts: string[] = [`<div class="record-header"><span>${escapeHtml(fullName(s.profile))}</span><span class="rh-right">${escapeHtml(s.student_number)}</span></div>`];
    for (const cat of selectedCats) {
      const label = categories.find((c) => c.value === cat)?.label ?? cat;
      const customRows = (defs.data ?? [])
        .filter((d) => d.category_id === cat && d.is_active !== false)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((d) => row((locale === 'ar' && d.label_ar) || d.label, readCustomValue(s.custom_fields, d)))
        .join('');
      let rows = '';
      if (cat === 'personal')
        rows =
          row(f('first_name'), s.profile.first_name) + row(f('father_name'), s.profile.father_name) + row(f('grandfather_name'), s.profile.grandfather_name) +
          row(f('last_name'), s.profile.last_name) + row(f('date_of_birth'), personal.date_of_birth ? formatDate(personal.date_of_birth) : '') +
          row(f('gender'), personal.gender) + row(f('email'), s.profile.email) + row(f('phone_number'), s.profile.phone) + row(f('address'), personal.address);
      else if (cat === 'academic')
        rows = row(f('student_number'), s.student_number) + row(f('grade_level'), s.academic.grade_level) + row(f('section'), s.academic.section) +
          row(f('admission_date'), s.academic.admission_date ? formatDate(s.academic.admission_date) : '');
      else if (cat === 'medical')
        rows = row(f('blood_group'), s.medical_info?.blood_group) + row(f('allergies_list'), (s.medical_info?.allergies ?? []).join(', ')) +
          row(f('medical_notes'), s.medical_info?.notes ?? s.medical_info?.emergency_notes);
      else if (cat === 'family')
        rows = s.parent_links.length
          ? s.parent_links.map((l) => row(t(`parents.${l.relationship}`, { defaultValue: l.relationship }), [fullName(l.parent.profile), l.parent.profile.phone, l.parent.profile.email].filter(Boolean).join(' · '))).join('')
          : row(t('school.students.student_details.linked_parent'), t('school.students.student_details.no_parent'));
      else if (cat === 'system') rows = row(f('status'), s.profile.is_active ? f('active') : f('inactive')) + row(t('school.students.student_details.created_at'), formatDate(s.created_at));
      if (rows || customRows) parts.push(section(label, rows + customRows));
    }
    return parts.join('');
  }

  async function run(mode: 'print' | 'pdf') {
    if (selected.size === 0) return toast.error(t('app.pr_pick_students'));
    if (selectedCats.length === 0) return toast.error(t('app.pr_pick_categories'));
    setBusy(mode);
    try {
      const res = await adminStudents.printInfo(campusId, [...selected], selectedCats);
      if (!res.success || !res.data) return toast.error(res.error || t('app.error_title'));
      const html = buildPrintHtml({ title: p('title'), pages: res.data.students.map(sheet), school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader, reportLabel: p('title') });
      if (mode === 'print') await printHtml(html);
      else await sharePdf(html, `student-info-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: p('title') }} />
      <PeoplePicker
        entity="student"
        campusId={campusId}
        selected={selected}
        onChange={setSelected}
        header={
          <View className="gap-2">
            <Label>{p('select_categories')}</Label>
            <MultiChips<string> value={selectedCats} onChange={setSelectedCats} options={categories} />
          </View>
        }
        footer={
          <View className="border-border gap-2 border-t p-4">
            <Text className="text-muted-foreground text-center text-xs">{p('selected_summary', { students: selected.size, categories: selectedCats.length })}</Text>
            <View className="flex-row gap-2">
              <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={!!busy || !ctx.ready}>
                <Icon as={FileDown} className="size-4" />
                <Text>{busy === 'pdf' ? p('generating_pdf') : p('download_pdf')}</Text>
              </Button>
              <Button className="flex-1" onPress={() => run('print')} disabled={!!busy || !ctx.ready}>
                <Icon as={Printer} className="text-primary-foreground size-4" />
                <Text>{p('print')}</Text>
              </Button>
            </View>
          </View>
        }
      />
    </>
  );
}
