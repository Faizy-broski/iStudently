import type { MonthlySheetParams } from '@studently/api-client';
import { attendanceDownloads } from '@studently/api-client';
import { Stack } from 'expo-router';
import { FileSpreadsheet, FileText, Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { monthNames } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { shareMonthlySheetPdf } from '@/features/admin/monthly-sheet-pdf';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminAttendance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

type Scope = 'section' | 'grade' | 'staff';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Monthly attendance sheet as Excel or PDF, blank or filled (web: /admin/attendance/monthly-sheet). */
export default function MonthlySheet() {
  const { t, i18n } = useTranslation();
  const m = (k: string) => t(`attendanceMonthlySheet.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const uiLocale = i18n.language === 'ar' ? 'ar' : 'en';
  const now = new Date();
  const [scope, setScope] = useState<Scope>('section');
  const [gradeId, setGradeIdRaw] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [department, setDepartment] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [mode, setMode] = useState<'blank' | 'filled'>('blank');
  const [sheetLocale, setSheetLocale] = useState<'en' | 'ar'>(uiLocale);
  const [supervisor, setSupervisor] = useState('');
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);

  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const sections = useApi(gradeId ? ['admin', 'sections', campusId ?? 'school', gradeId] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));
  const gradeList = (grades.data ?? []).filter((g) => g.is_active !== false);
  const sectionList = (sections.data ?? []).filter((s) => s.is_active);
  const setGradeId = (g: string) => {
    setGradeIdRaw(g);
    setSectionId('');
  };

  const months = monthNames(uiLocale === 'ar' ? 'ar-u-nu-latn' : 'en-GB');
  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);
  const ready = (scope === 'section' && !!sectionId) || (scope === 'grade' && !!gradeId) || scope === 'staff';
  const params = (): MonthlySheetParams => ({
    scope,
    sectionId: scope === 'section' ? sectionId : undefined,
    gradeId: scope === 'grade' ? gradeId : undefined,
    department: scope === 'staff' ? department.trim() || undefined : undefined,
    month,
    year,
    mode,
    locale: sheetLocale,
    campusId,
    supervisor: supervisor.trim() || undefined,
    room: room.trim() || undefined,
  });
  const baseName = `attendance-sheet-${year}-${String(month).padStart(2, '0')}-${mode}`;

  async function excel() {
    setBusy('excel');
    try {
      await shareApiFile(attendanceDownloads.monthlySheetExcel(params()), `${baseName}.xlsx`, XLSX);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : m('exportFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function pdf() {
    setBusy('pdf');
    try {
      const res = await adminAttendance.getMonthlySheet(params());
      if (!res.success || !res.data) throw new Error(res.error || m('exportFailed'));
      await shareMonthlySheetPdf(res.data, baseName);
    } catch (e) {
      toast.error(e instanceof Error && e.message !== 'print-unavailable' ? e.message : t('app.pr_rebuild'));
    } finally {
      setBusy(null);
    }
  }

  const field = (label: string, child: React.ReactNode, hint?: React.ReactNode) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {child}
      {hint}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: m('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{m('subtitle')}</Text>
        <Card>
          <CardHeader>
            <CardTitle>{m('whoTitle')}</CardTitle>
            <CardDescription>{m('whoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {field(
              m('scope'),
              <Picker
                value={scope}
                onChange={(v) => setScope(v as Scope)}
                options={[
                  { value: 'section', label: m('scopeSection') },
                  { value: 'grade', label: m('scopeGrade') },
                  { value: 'staff', label: m('scopeStaff') },
                ]}
              />,
            )}
            {scope !== 'staff'
              ? field(m('grade'), <Picker value={gradeId} onChange={setGradeId} placeholder={m('selectGrade')} options={gradeList.map((g) => ({ value: g.id, label: g.name }))} />, scope === 'grade' ? <Text className="text-muted-foreground text-xs">{m('gradeHint')}</Text> : null)
              : null}
            {scope === 'section'
              ? field(
                  m('section'),
                  <Picker value={sectionId} onChange={setSectionId} placeholder={gradeId ? m('selectSection') : m('selectGradeFirst')} options={sectionList.map((s) => ({ value: s.id, label: s.name }))} />,
                  gradeId && sections.data && sectionList.length === 0 ? (
                    <View className="gap-1">
                      <Text className="text-xs text-warning">{m('noSectionsHint')}</Text>
                      <Button variant="link" size="sm" className="self-start px-0" onPress={() => setScope('grade')}>
                        <Text className="text-xs">{m('useWholeGrade')}</Text>
                      </Button>
                    </View>
                  ) : null,
                )
              : null}
            {scope === 'staff'
              ? field(m('department'), <Input value={department} onChangeText={setDepartment} placeholder={m('departmentPlaceholder')} maxLength={120} />, <Text className="text-muted-foreground text-xs">{m('departmentHint')}</Text>)
              : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m('optionsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1">{field(m('month'), <Picker value={String(month)} onChange={(v) => setMonth(Number(v))} options={months.map((n, i) => ({ value: String(i + 1), label: n }))} />)}</View>
              <View className="w-28">{field(m('year'), <Picker value={String(year)} onChange={(v) => setYear(Number(v))} options={years.map((y) => ({ value: String(y), label: String(y) }))} />)}</View>
            </View>
            {field(
              m('content'),
              <Picker
                value={mode}
                onChange={(v) => setMode(v as 'blank' | 'filled')}
                options={[
                  { value: 'blank', label: m('modeBlank') },
                  { value: 'filled', label: m('modeFilled') },
                ]}
              />,
            )}
            {field(
              m('sheetLanguage'),
              <Picker
                value={sheetLocale}
                onChange={(v) => setSheetLocale(v as 'en' | 'ar')}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ar', label: 'العربية' },
                ]}
              />,
            )}
            {field(m('supervisor'), <Input value={supervisor} onChangeText={setSupervisor} placeholder={m('autoFilled')} maxLength={120} />)}
            {field(m('room'), <Input value={room} onChangeText={setRoom} placeholder={m('autoFilled')} maxLength={60} />)}
            {scope === 'staff' && mode === 'filled' ? (
              <View className="flex-row gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3">
                <Icon as={Info} className="size-4 text-warning" />
                <Text className="flex-1 text-xs text-warning">{m('staffFilledNote')}</Text>
              </View>
            ) : null}
          </CardContent>
        </Card>

        <Button onPress={excel} disabled={!ready || busy !== null}>
          <Icon as={FileSpreadsheet} className="text-primary-foreground size-4" />
          <Text>{m('downloadExcel')}</Text>
        </Button>
        <Button variant="outline" onPress={pdf} disabled={!ready || busy !== null}>
          <Icon as={FileText} className="text-foreground size-4" />
          <Text>{m('downloadPdf')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
