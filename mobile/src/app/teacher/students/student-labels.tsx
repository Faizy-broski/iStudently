import { Stack } from 'expo-router';
import { FileDown, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { StudentChecklist } from '@/features/admin/scheduling-tools';
import { useTeacherStudents } from '@/features/teacher/students';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';

/** Printable name labels (name, ID, grade) for chosen students, 2–4 per row (web: /teacher/students/student-labels). */
export default function TeacherStudentLabels() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.studentsLabels.${key}`, o);
  const toast = useToast();
  const ctx = usePrintContext();
  const res = useTeacherStudents(true);
  const [cols, setCols] = useState('3');
  const [grade, setGrade] = useState('all');
  const [section, setSection] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const all = res.data ?? [];
  const grades = [...new Set(all.map((s) => s.grade_level).filter((g): g is string => !!g))].sort();
  const sections = [...new Map(all.filter((s) => s.section && (grade === 'all' || s.grade_level === grade)).map((s) => [s.section!.id, s.section!.name])).entries()];
  const shown = all.filter((s) => (grade === 'all' || s.grade_level === grade) && (section === 'all' || s.section_id === section));

  async function run(mode: 'print' | 'pdf') {
    const chosen = all.filter((s) => selected.has(s.id));
    if (!chosen.length) return toast.error(k('selectAtLeastOneStudent'));
    setBusy(true);
    try {
      const width = 100 / Number(cols);
      const labels = chosen
        .map((s) => {
          const name = `${s.profile?.first_name ?? ''} ${s.profile?.last_name ?? ''}`.trim() || s.student_number;
          const initials = name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return `<div style="width:${width}%;box-sizing:border-box;padding:8px;display:inline-block;vertical-align:top"><div style="border:2px dashed #d1d5db;border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px;page-break-inside:avoid"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#57A3CC,#022172);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0">${escapeHtml(initials)}</div><div style="min-width:0"><p style="font-weight:600;font-size:13px;margin:0">${escapeHtml(name)}</p><p style="font-size:11px;color:#6b7280;margin:2px 0 0">#${escapeHtml(s.student_number)}</p>${s.grade_level ? `<p style="font-size:11px;color:#6b7280;margin:0">${escapeHtml(s.grade_level)}</p>` : ''}</div></div></div>`;
        })
        .join('');
      const html = buildPrintHtml({ title: k('studentLabels'), pages: [`<div style="font-size:0">${labels}</div>`], school: ctx.school, layout: ctx.layout, withHeader: false });
      if (mode === 'print') await printHtml(html);
      else await sharePdf(html, `student-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <Card>
          <CardHeader>
            <CardTitle>{k('labelSettings')}</CardTitle>
            <Text className="text-muted-foreground text-sm">{k('labelSettingsDescription')}</Text>
          </CardHeader>
          <CardContent className="gap-3">
            <Label>{k('columnsPerRow')}</Label>
            <FilterChips value={cols} onChange={setCols} options={['2', '3', '4'].map((c) => ({ value: c, label: k('columns', { count: Number(c) }) }))} />
            <Text className="text-muted-foreground text-xs">{`${k('eachLabelIncludes')} ${k('studentFullName')}, ${k('studentIdNumber')}, ${k('gradeLevel')}`}</Text>
            <Text className="text-sm font-medium">{k('studentsSelected', { count: selected.size })}</Text>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{k('selectStudents')}</CardTitle>
            <Text className="text-muted-foreground text-sm">{k('selectStudentsDescription')}</Text>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Label>{k('gradeLevel')}</Label>
                <Picker
                  value={grade}
                  onChange={(v) => {
                    setGrade(v);
                    setSection('all');
                  }}
                  options={[{ value: 'all', label: k('allGrades') }, ...grades.map((g) => ({ value: g, label: g }))]}
                />
              </View>
              <View className="flex-1 gap-1">
                <Label>{k('section')}</Label>
                <Picker value={section} onChange={setSection} options={[{ value: 'all', label: k('allSections') }, ...sections.map(([id, name]) => ({ value: id, label: name }))]} />
              </View>
            </View>
            <StudentChecklist students={shown} loading={res.isLoading} selected={selected} onChange={setSelected} countKey="common.found_students" />
          </CardContent>
        </Card>
        <View className="flex-row gap-2">
          <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={busy || !selected.size}>
            <Icon as={FileDown} className="size-4" />
            <Text>PDF</Text>
          </Button>
          <Button className="flex-1" onPress={() => run('print')} disabled={busy || !selected.size}>
            <Icon as={Printer} className="text-primary-foreground size-4" />
            <Text>{busy ? k('generating') : k('printLabelsCount', { count: selected.size })}</Text>
          </Button>
        </View>
      </ScrollView>
    </>
  );
}
