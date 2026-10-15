import { coursePeriodTeacherName } from '@studently/api-client';
import { parseCsv } from '@studently/shared-utils';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack } from 'expo-router';
import { CheckCircle2, AlertCircle, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { useScopedCoursePeriods } from '@/features/teacher/course-periods';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

/** A, B, … Z, AA, AB … */
function colLetter(i: number) {
  let s = '';
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

type Result = { imported: number; skipped: number; errors: { row: number; reason: string }[] };

/** Grades for a course period's assignments from a CSV sheet, mapped column by column (web: /admin/grades/import-grades). */
export default function ImportGrades() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.import_grades.${k}`, o);
  const tc = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.common.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const cps = useScopedCoursePeriods();
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const [cpId, setCpId] = useState('');
  const [mpId, setMpId] = useState('all');
  const options = useApi(cpId ? ['admin', 'assignment-options', cpId, mpId] : null, ([, , c, m]) => adminGrades.assignmentOptions({ course_period_id: c as string, marking_period_id: m !== 'all' ? (m as string) : undefined }));
  const assignments = (options.data ?? []).filter((a) => a.type === 'assignment');

  const [file, setFile] = useState<{ name: string; rows: string[][] } | null>(null);
  const [firstRow, setFirstRow] = useState(false);
  const [ident, setIdent] = useState<'name' | 'student_number'>('name');
  const [firstCol, setFirstCol] = useState('');
  const [lastCol, setLastCol] = useState('');
  const [numCol, setNumCol] = useState('');
  const [maps, setMaps] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const header = file?.rows[0] ?? [];
  const cols = header.map((h, i) => ({ value: String(i), label: `${colLetter(i)}: ${h || `${tc('column')} ${i + 1}`}` }));
  const colOpts = [{ value: '', label: t('app.ig_select_column') }, ...cols];

  async function pick() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    try {
      const rows = parseCsv(await new File(asset.uri).text()).filter((r) => r.some((c) => c.trim() !== ''));
      if (!rows.length) return toast.error(g('msg_parse_empty'));
      setFile({ name: asset.name, rows });
      setResult(null);
    } catch {
      toast.error(g('msg_parse_csv_failed'));
    }
  }

  const reset = () => {
    setFile(null);
    setFirstRow(false);
    setIdent('name');
    setFirstCol('');
    setLastCol('');
    setNumCol('');
    setMaps({});
    setResult(null);
  };

  async function run() {
    if (!cpId) return toast.error(g('msg_select_cp'));
    if (!file) return toast.error(g('msg_upload_first'));
    const mappings = assignments.filter((a) => maps[a.id] && maps[a.id] !== 'none').map((a) => ({ assignment_id: a.id, column_index: Number(maps[a.id]) }));
    if (!mappings.length) return toast.error(g('msg_map_one_assignment'));
    if (ident === 'name' && !firstCol && !lastCol) return toast.error(g('msg_map_name'));
    if (ident === 'student_number' && !numCol) return toast.error(g('msg_map_number'));
    setBusy(true);
    setResult(null);
    try {
      const r = await adminGrades.importGrades({
        course_period_id: cpId,
        import_first_row: firstRow,
        student_identifier: ident,
        name_columns: ident === 'name' ? { first_name_col: firstCol ? Number(firstCol) : undefined, last_name_col: lastCol ? Number(lastCol) : undefined } : undefined,
        student_number_col: ident === 'student_number' ? Number(numCol) : undefined,
        mappings,
        rows: file.rows,
      });
      if (!r.success || !r.data) return toast.error(r.error || g('msg_import_failed'));
      setResult(r.data);
      if (r.data.imported > 0 && !r.data.errors.length) toast.success(g('msg_import_success', { count: r.data.imported }));
      else if (r.data.imported > 0) toast.success(g('msg_import_partial', { imported: r.data.imported, errors: r.data.errors.length }));
      else toast.error(g('msg_import_none'));
    } finally {
      setBusy(false);
    }
  }

  const mpTitle = (mps.data ?? []).find((m) => m.id === mpId)?.title;
  const importBtn = (
    <Button onPress={run} disabled={busy || !cpId}>
      <Icon as={Upload} className="text-primary-foreground size-4" />
      <Text>{g('btn_import')}</Text>
    </Button>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: mpTitle ? `${g('title')} - ${mpTitle}` : g('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{g('subtitle')}</Text>
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{g('course_period_label')}</Label>
              {cps.isLoading ? (
                <LoadingList rows={1} />
              ) : (
                <Picker
                  value={cpId}
                  onChange={(v) => {
                    setCpId(v);
                    setMaps({});
                  }}
                  placeholder={tc('select_course_period_placeholder')}
                  options={(cps.data ?? []).map((cp) => ({ value: cp.id, label: `${cp.course?.title || 'Course'} — ${coursePeriodTeacherName(cp)}` }))}
                />
              )}
            </View>
            <View className="gap-1.5">
              <Label>{g('marking_period_label')}</Label>
              <Picker value={mpId} onChange={setMpId} options={[{ value: 'all', label: g('marking_period_placeholder') }, ...(mps.data ?? []).map((m) => ({ value: m.id, label: m.title }))]} />
            </View>
            <View className="gap-1.5">
              <Label>{g('upload_file_label')}</Label>
              <Button variant="outline" onPress={pick}>
                <Icon as={FileSpreadsheet} className="text-foreground size-4" />
                <Text numberOfLines={1}>{file?.name || g('choose_file_placeholder')}</Text>
              </Button>
              <Text className="text-muted-foreground text-xs">{t('app.ig_csv_only')}</Text>
            </View>
          </CardContent>
        </Card>

        {file ? (
          <View className="gap-3">
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <Text className="text-xs">
                  {file.name}: {tc('rows_count', { count: file.rows.length })}
                </Text>
              </Badge>
              <Button variant="ghost" size="sm" onPress={reset}>
                <Icon as={RotateCcw} className="text-foreground size-4" />
                <Text>{g('btn_reset')}</Text>
              </Button>
            </View>
            <View className="flex-row items-center gap-3">
              <Switch checked={firstRow} onCheckedChange={setFirstRow} />
              <Text className="flex-1 text-sm">{g('import_first_row')}</Text>
            </View>
            {importBtn}
          </View>
        ) : null}

        {file && cpId ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              <Text className="font-semibold">{g('fields_title')}</Text>
              <View className="gap-1.5">
                <Label>{g('identify_student_label')}</Label>
                <Picker
                  value={ident}
                  onChange={(v) => setIdent(v as 'name' | 'student_number')}
                  options={[
                    { value: 'name', label: g('identify_name') },
                    { value: 'student_number', label: g('identify_student_number') },
                  ]}
                />
              </View>
              {ident === 'name' ? (
                <>
                  <View className="gap-1.5">
                    <Label>{g('first_name_label')}</Label>
                    <Picker value={firstCol} onChange={setFirstCol} options={colOpts} />
                  </View>
                  <View className="gap-1.5">
                    <Label>{g('last_name_label')}</Label>
                    <Picker value={lastCol} onChange={setLastCol} options={colOpts} />
                  </View>
                </>
              ) : (
                <View className="gap-1.5">
                  <Label>{g('student_number_label')}</Label>
                  <Picker value={numCol} onChange={setNumCol} options={colOpts} />
                </View>
              )}
              <Text className="pt-2 font-semibold">{g('assignments_title')}</Text>
              {options.isLoading ? (
                <LoadingList rows={3} />
              ) : !assignments.length ? (
                <Text className="text-muted-foreground text-sm">{g('no_assignments')}</Text>
              ) : (
                assignments.map((a) => (
                  <View key={a.id} className="gap-1.5">
                    <Label>
                      {a.title}
                      {a.points ? ` (${a.points} ${tc('points')})` : ''}
                    </Label>
                    <Picker value={maps[a.id] ?? ''} onChange={(v) => setMaps((m) => ({ ...m, [a.id]: v }))} options={[{ value: '', label: tc('select_column_placeholder') }, { value: 'none', label: g('skip_column') }, ...cols]} />
                  </View>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
        {file && cpId ? importBtn : null}

        {result ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              <View className="flex-row items-center gap-2">
                <Icon as={result.errors.length ? AlertCircle : CheckCircle2} className={result.errors.length ? 'size-5 text-amber-500' : 'size-5 text-green-600'} />
                <Text className="font-semibold">{g('results_title')}</Text>
              </View>
              <View className="flex-row gap-2">
                {[
                  [result.imported, g('students_imported')],
                  [result.skipped, g('skipped_count')],
                  [result.errors.length, g('errors_count')],
                ].map(([n, l]) => (
                  <View key={String(l)} className="border-border flex-1 items-center rounded-lg border p-2">
                    <Text className="text-xl font-bold">{n}</Text>
                    <Text className="text-muted-foreground text-center text-xs">{l}</Text>
                  </View>
                ))}
              </View>
              {result.errors.length ? (
                <View className="gap-1">
                  <Text className="text-sm font-medium">{g('error_details_title')}</Text>
                  {result.errors.map((e, i) => (
                    <Text key={i} className="text-xs">
                      {tc('row')} {e.row}: <Text className="text-destructive text-xs">{e.reason}</Text>
                    </Text>
                  ))}
                </View>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!file && !cps.isLoading ? (
          <Card>
            <CardContent className="items-center gap-2 pt-6 pb-6">
              <Icon as={FileSpreadsheet} className="text-muted-foreground size-8" />
              <Text className="font-medium">{g('empty_state_title')}</Text>
              <Text className="text-muted-foreground text-center text-sm">{g('empty_state_desc')}</Text>
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
