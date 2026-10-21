import type { BulkTimetableRow } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import * as DocumentPicker from 'expo-document-picker';
import { router, Stack } from 'expo-router';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, Upload, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { adminTimetable } from '@/lib/api';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';
import { isSheetFile, readSheetObjects, SHEET_TYPES } from '@/lib/spreadsheet';

interface ParsedRow extends BulkTimetableRow {
  rowIndex: number;
  errors: string[];
}

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', '0', '1', '2', '3', '4', '5', '6'];
const DAY_LABELS: Record<string, string> = { '0': 'Mon', '1': 'Tue', '2': 'Wed', '3': 'Thu', '4': 'Fri', '5': 'Sat', '6': 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

/** Same checks as the web's validateTimetableRows (messages stay as the web's, in English). */
function validate(rows: Record<string, string>[]): ParsedRow[] {
  return rows.map((raw, i) => {
    const errors: string[] = [];
    const get = (k: string) => (raw[k] ?? '').trim();
    const section = get('section_name');
    const subject = get('subject_name');
    const code = get('subject_code');
    const email = get('teacher_email');
    const name = get('teacher_name');
    const day = get('day_of_week');
    const period = get('period_number');
    if (!section) errors.push('section_name is required');
    if (!subject && !code) errors.push('subject_name or subject_code is required');
    if (!email && !name) errors.push('teacher_email or teacher_name is required');
    if (!day) errors.push('day_of_week is required');
    else if (!VALID_DAYS.includes(day.toLowerCase())) errors.push(`Invalid day_of_week "${day}". Use Monday-Sunday or 0-6`);
    if (!period) errors.push('period_number is required');
    else if (isNaN(Number(period))) errors.push(`Invalid period_number "${period}"`);
    return {
      rowIndex: i + 2,
      errors,
      grade_name: get('grade_name') || undefined,
      section_name: section,
      subject_name: subject || undefined,
      subject_code: code || undefined,
      teacher_email: email || undefined,
      teacher_name: name || undefined,
      day_of_week: day,
      period_number: period,
      room_number: get('room_number') || undefined,
    };
  });
}

type Step = 1 | 2 | 3 | 4;

/** Bulk timetable import from CSV in four steps (web: /admin/timetable/import, TimetableImport). */
export default function TimetableImport() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`school.timetable_import.${k}`, o);
  const toast = useToast();
  const years = useAcademicYear();
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; error: string }[]>([]);
  const [success, setSuccess] = useState(0);
  const yearId = years.id ?? '';

  const valid = rows.filter((r) => !r.errors.length);
  const invalid = rows.length - valid.length;

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({ type: SHEET_TYPES, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (!isSheetFile(asset.name)) return toast.error(m('err_invalid_file'));
    try {
      const objs = await readSheetObjects(asset);
      setRows(validate(objs.filter((o) => Object.values(o).some((v) => v))));
      setStep(2);
    } catch {
      toast.error(m('err_parse_csv'));
    }
  }

  async function template() {
    await shareTextFile(
      'timetable_import_template.csv',
      toCsv(['grade_name', 'section_name', 'subject_name', 'subject_code', 'teacher_email', 'day_of_week', 'period_number', 'room_number'], [['Grade 10', 'A', 'Mathematics', 'MATH10', 'teacher@school.com', 'Monday', '1', 'Room 101']]),
      'text/csv',
      'public.comma-separated-values-text',
    );
  }

  async function runImport() {
    if (!yearId) return toast.error(m('err_select_year'));
    if (!valid.length) return toast.error(m('err_no_valid_rows'));
    setStep(3);
    const r = await adminTimetable.bulkImport(
      valid.map(({ rowIndex: _r, errors: _e, ...rest }) => rest),
      yearId,
    );
    if (!r.success || !r.data) {
      toast.error(r.error || t('common.error'));
      return setStep(2);
    }
    setSuccess(r.data.success_count);
    setErrors(r.data.errors);
    setStep(4);
    if (r.data.success_count > 0) toast.success(m('success_import', { count: r.data.success_count }));
    if (r.data.error_count > 0) toast.error(m('results_failed', { count: r.data.error_count }));
  }

  async function errorReport() {
    await shareTextFile('timetable_import_errors.csv', toCsv(['row', 'error'], errors.map((e) => [e.row, e.error])), 'text/csv', 'public.comma-separated-values-text');
  }

  const reset = () => {
    setRows([]);
    setErrors([]);
    setSuccess(0);
    setStep(1);
  };

  const steps = [m('step_upload'), m('step_preview'), m('step_importing'), m('step_results')];

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: m('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{m('subtitle')}</Text>
        <View className="flex-row flex-wrap items-center gap-2">
          {steps.map((label, i) => {
            const n = (i + 1) as Step;
            const done = step > n;
            const active = step === n;
            return (
              <View key={label} className="flex-row items-center gap-1.5">
                <View className={cn('size-6 items-center justify-center rounded-full', done ? 'bg-success' : active ? 'bg-primary' : 'bg-muted')}>
                  {done ? <Icon as={CheckCircle2} className="size-3.5 text-white" /> : <Text className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-muted-foreground')}>{n}</Text>}
                </View>
                <Text className={cn('text-xs', active ? 'font-medium' : 'text-muted-foreground')}>{label}</Text>
              </View>
            );
          })}
        </View>

        {step === 1 ? (
          <Card>
            <CardContent className="gap-4 pt-4">
              <Text className="text-muted-foreground text-sm">{m('card_desc')}</Text>
              <View className="gap-1.5">
                <Label>{m('label_academic_year')} *</Label>
                <Picker value={yearId} onChange={years.pick} placeholder={m('placeholder_academic_year')} options={years.years.map((y) => ({ value: y.id, label: `${y.name}${y.is_current ? ` (${t('common.active')})` : ''}` }))} />
              </View>
              <Button onPress={pick}>
                <Icon as={Upload} className="text-primary-foreground size-4" />
                <Text>{m('drop_file')}</Text>
              </Button>
              <Text className="text-muted-foreground text-center text-xs">{t('app.tt_csv_only')}</Text>
              <View className="bg-muted/50 gap-1 rounded-md p-3">
                <Text className="text-sm font-medium">{m('required_columns')}</Text>
                <Text className="font-mono text-xs">section_name, subject_name (or subject_code), teacher_email (or teacher_name), day_of_week, period_number</Text>
                <Text className="mt-2 text-sm font-medium">{m('day_format')}</Text>
                <Text className="font-mono text-xs">{m('day_format_desc')}</Text>
              </View>
              <Button variant="outline" size="sm" className="self-start" onPress={template}>
                <Icon as={Download} className="text-foreground size-4" />
                <Text>{m('btn_download_template')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <View className="gap-3">
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="bg-primary flex-row items-center gap-1 rounded-full px-2.5 py-1">
                <Icon as={CheckCircle2} className="text-primary-foreground size-3.5" />
                <Text className="text-primary-foreground text-xs">{m('badge_valid', { count: valid.length })}</Text>
              </View>
              {invalid > 0 ? (
                <View className="bg-destructive flex-row items-center gap-1 rounded-full px-2.5 py-1">
                  <Icon as={XCircle} className="size-3.5 text-white" />
                  <Text className="text-xs text-white">{m('badge_invalid', { count: invalid })}</Text>
                </View>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" onPress={reset}>
                <Icon flipRtl as={ArrowLeft} className="text-foreground size-4" />
                <Text>{m('btn_back')}</Text>
              </Button>
              <Button size="sm" onPress={runImport} disabled={!valid.length || !yearId}>
                <Text>{m('btn_import', { count: valid.length })}</Text>
                <Icon flipRtl as={ArrowRight} className="text-primary-foreground size-4" />
              </Button>
            </View>
            {!yearId ? (
              <View className="flex-row items-center gap-2">
                <Icon as={AlertTriangle} className="text-destructive size-4" />
                <Text className="text-destructive text-sm">{m('err_select_year')}</Text>
              </View>
            ) : null}
            {invalid > 0 ? (
              <Card className="border-destructive/50">
                <CardContent className="gap-1 pt-4">
                  <Text className="text-destructive text-sm font-medium">{m('skipped_rows', { count: invalid })}</Text>
                  {rows
                    .filter((r) => r.errors.length)
                    .map((r) => (
                      <Text key={r.rowIndex} className="text-destructive text-xs">
                        {m('table_row')} {r.rowIndex}: {r.errors.join('; ')}
                      </Text>
                    ))}
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardContent className="gap-0 pt-4">
                <Text className="mb-2 text-sm font-medium">{m('preview_title')}</Text>
                {rows.slice(0, 20).map((r, i) => (
                  <View key={r.rowIndex}>
                    {i > 0 ? <Separator /> : null}
                    <View className={cn('gap-0.5 py-2', r.errors.length && 'bg-destructive/5')}>
                      <View className="flex-row justify-between gap-2">
                        <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
                          {m('table_row')} {r.rowIndex} · {r.grade_name || '—'} / {r.section_name}
                        </Text>
                        <Text className={r.errors.length ? 'text-destructive text-xs' : 'text-xs text-success'}>{r.errors.length ? m('status_error') : m('status_ok')}</Text>
                      </View>
                      <Text className="text-muted-foreground text-xs">
                        {r.subject_name || r.subject_code || '—'} · {r.teacher_email || r.teacher_name || '—'} · {DAY_LABELS[String(r.day_of_week).toLowerCase()] || r.day_of_week} · {m('table_period')} {r.period_number} · {r.room_number || '—'}
                      </Text>
                    </View>
                  </View>
                ))}
                {rows.length > 20 ? <Text className="text-muted-foreground mt-2 text-xs">{m('more_rows', { count: rows.length - 20 })}</Text> : null}
              </CardContent>
            </Card>
          </View>
        ) : null}

        {step === 3 ? (
          <Card>
            <CardContent className="items-center gap-2 py-10">
              <LoadingList rows={2} />
              <Text className="text-sm font-semibold">{m('importing_title')}</Text>
              <Text className="text-muted-foreground text-sm">{m('importing_desc', { count: valid.length })}</Text>
            </CardContent>
          </Card>
        ) : null}

        {step === 4 ? (
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              <View className="bg-primary flex-row items-center gap-1 rounded-full px-3 py-1">
                <Icon as={CheckCircle2} className="text-primary-foreground size-4" />
                <Text className="text-primary-foreground text-sm">{m('results_imported', { count: success })}</Text>
              </View>
              {errors.length ? (
                <View className="bg-destructive flex-row items-center gap-1 rounded-full px-3 py-1">
                  <Icon as={XCircle} className="size-4 text-white" />
                  <Text className="text-sm text-white">{m('results_failed', { count: errors.length })}</Text>
                </View>
              ) : null}
            </View>
            {errors.length ? (
              <Card className="border-destructive/50">
                <CardContent className="gap-2 pt-4">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-destructive text-sm font-medium">{m('failed_rows_title')}</Text>
                    <Button variant="outline" size="sm" onPress={errorReport}>
                      <Icon as={Download} className="text-foreground size-4" />
                      <Text>{m('btn_download_errors')}</Text>
                    </Button>
                  </View>
                  {errors.map((e) => (
                    <Text key={`${e.row}-${e.error}`} className="text-xs">
                      {m('table_row')} {e.row}: {e.error}
                    </Text>
                  ))}
                </CardContent>
              </Card>
            ) : null}
            <View className="flex-row gap-2">
              <Button variant="outline" onPress={reset}>
                <Icon as={Upload} className="text-foreground size-4" />
                <Text>{m('btn_import_more')}</Text>
              </Button>
              <Button onPress={() => router.replace('/admin/timetable')}>
                <Text>{m('btn_view_timetable')}</Text>
              </Button>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
