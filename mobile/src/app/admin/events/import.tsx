import type { BulkEventRow, MarkingPeriod } from '@studently/api-client';
import { csvToObjects, toCsv } from '@studently/shared-utils';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, Stack } from 'expo-router';
import { AlertCircle, CheckCircle2, Download, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { EVENT_CATEGORIES } from '@/features/admin/events';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGrades, events } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';

interface ParsedRow extends BulkEventRow {
  gradeNames: string[];
  error?: string;
}

/** Cell value -> YYYY-MM-DD (ISO strings and DD/MM/YYYY), same as the web. */
function toIsoDate(v: string) {
  const s = (v ?? '').trim();
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return s.slice(0, 10);
}

const outside = (r: { start_date: string; end_date?: string }, mp?: MarkingPeriod) =>
  !!mp?.start_date && !!mp.end_date && !!r.start_date && (r.start_date < mp.start_date || (r.end_date || r.start_date) > mp.end_date);

/** Import school events from a CSV for one marking period (web: ImportEventsDialog). */
export default function ImportEvents() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`app.evi_${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const periods = (mps.data ?? []).filter((p) => p.start_date && p.end_date);
  const gradesRes = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const grades = gradesRes.data ?? [];
  const [periodId, setPeriodId] = useState('');
  const [raw, setRaw] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [serverErrors, setServerErrors] = useState<{ row: number; error: string }[]>([]);
  const period = periods.find((p) => p.id === periodId);
  const periodMsg = period ? m('outside', { start: period.start_date, end: period.end_date }) : '';

  // Re-check dates whenever the marking period changes (web: effect on period id).
  const rows = useMemo(() => raw.map((r) => (r.error && r.error !== '__outside__' ? r : { ...r, error: outside(r, period) ? '__outside__' : undefined })), [raw, period]);
  const valid = rows.filter((r) => !r.error);
  const invalid = rows.length - valid.length;

  async function downloadTemplate() {
    const example = period?.start_date ?? '2026-09-20';
    const csv = toCsv(
      ['Title', 'Category', 'Start Date', 'End Date', 'Grades', 'Description', 'Color'],
      [
        ['Mid-term exams', 'exam', example, example, '', 'Exam week', '#dc2626'],
        ['Parents meeting', 'meeting', example, example, grades[0]?.name ?? 'Grade 1', '', ''],
      ],
    );
    await shareTextFile('events-import-template.csv', csv, 'text/csv', 'public.comma-separated-values-text');
  }

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setFileName(asset.name);
    setServerErrors([]);
    try {
      const { rows: objs } = csvToObjects(await new File(asset.uri).text());
      const norm = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.trim().toLowerCase().replace(/[\s_]+/g, ''), v]));
      const get = (o: Record<string, string>, ...keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined) ?? '';
      const byName = new Map(grades.map((g) => [g.name.trim().toLowerCase(), g.id]));
      const parsed: ParsedRow[] = objs
        .map((o0, i) => {
          const o = norm(o0);
          const gradeNames = get(o, 'grades', 'grade', 'targetgrades')
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean);
          const unknown = gradeNames.filter((n) => !byName.has(n.toLowerCase()));
          const start = toIsoDate(get(o, 'startdate', 'start'));
          const row: ParsedRow = {
            row: i + 2,
            title: get(o, 'title', 'event', 'name').trim(),
            category: get(o, 'category', 'type').trim().toLowerCase(),
            start_date: start,
            end_date: toIsoDate(get(o, 'enddate', 'end')) || start,
            description: get(o, 'description', 'notes').trim(),
            color_code: get(o, 'color', 'colour', 'colorcode').trim(),
            gradeNames,
            target_grades: gradeNames.map((n) => byName.get(n.toLowerCase())).filter(Boolean) as string[],
          };
          if (!row.title && !row.start_date && !row.category) row.error = '__empty__';
          else if (unknown.length) row.error = m('unknown_grade', { names: unknown.join(', ') });
          return row;
        })
        .filter((r) => r.error !== '__empty__');
      setRaw(parsed);
      if (!parsed.length) toast.error(m('no_rows'));
    } catch {
      toast.error(m('read_failed'));
    }
  }

  async function runImport() {
    if (!periodId || !valid.length) return;
    setImporting(true);
    try {
      const res = await events.bulkCreateEvents({
        marking_period_id: periodId,
        campus_id: campusId ?? null,
        events: valid.map(({ gradeNames: _g, error: _e, ...r }) => r),
      });
      if (!res.success || !res.data) return toast.error(res.error || m('failed'));
      const { created, errors } = res.data;
      setServerErrors(errors);
      if (created > 0) {
        toast.success(m('imported', { count: created }));
        await mutate((k) => Array.isArray(k) && k[0] === 'admin' && ['events-month', 'events-all', 'event-counts', 'acal-events'].includes(k[1]));
      }
      if (!errors.length) router.back();
      else toast.error(m('skipped', { count: errors.length }));
    } finally {
      setImporting(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: m('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{m('desc')}</Text>
        <Card>
          <CardContent className="gap-4 pt-4">
            <View className="gap-1.5">
              <Label>{m('step_period')}</Label>
              <Picker value={periodId} onChange={setPeriodId} placeholder={m('period_ph')} options={periods.map((p) => ({ value: p.id, label: `${p.title} (${p.start_date} → ${p.end_date})` }))} />
              {!mps.isLoading && periods.length === 0 ? <Text className="text-muted-foreground text-xs">{m('no_periods')}</Text> : null}
            </View>
            <View className="gap-1.5">
              <Label>{m('step_file')}</Label>
              <View className="flex-row flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onPress={downloadTemplate}>
                  <Icon as={Download} className="text-foreground size-4" />
                  <Text>{m('template')}</Text>
                </Button>
                <Button size="sm" disabled={!periodId} onPress={pick}>
                  <Icon as={Upload} className="text-primary-foreground size-4" />
                  <Text>{m('choose')}</Text>
                </Button>
              </View>
              {fileName ? <Text className="text-muted-foreground text-sm">{fileName}</Text> : null}
            </View>
            <View className="bg-muted/50 gap-1 rounded-md p-3">
              <Text className="text-xs font-semibold">{m('columns')}</Text>
              <Text className="text-muted-foreground text-xs">{m('col_title')}</Text>
              <Text className="text-muted-foreground text-xs">{m('col_category', { list: EVENT_CATEGORIES.join(', ') })}</Text>
              <Text className="text-muted-foreground text-xs">{m('col_dates')}</Text>
              <Text className="text-muted-foreground text-xs">{m('col_grades')}</Text>
              <Text className="text-muted-foreground text-xs">{m('col_other')}</Text>
            </View>
          </CardContent>
        </Card>

        {rows.length ? (
          <View className="gap-2">
            <View className="flex-row flex-wrap gap-2">
              <View className="bg-muted flex-row items-center gap-1 rounded-full px-2.5 py-1">
                <Icon as={CheckCircle2} className="text-foreground size-3.5" />
                <Text className="text-xs">{m('ready', { count: valid.length })}</Text>
              </View>
              {invalid > 0 ? (
                <View className="bg-destructive flex-row items-center gap-1 rounded-full px-2.5 py-1">
                  <Icon as={AlertCircle} className="size-3.5 text-white" />
                  <Text className="text-xs text-white">{m('problems', { count: invalid })}</Text>
                </View>
              ) : null}
            </View>
            <Card>
              {rows.map((r, i) => (
                <View key={r.row}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-0.5 px-4 py-2.5">
                    <View className="flex-row justify-between gap-2">
                      <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
                        {m('row_n', { n: r.row })} · {r.title || '-'}
                      </Text>
                      <Text className={r.error ? 'text-destructive text-xs' : 'text-xs text-green-600'}>{r.error ? (r.error === '__outside__' ? periodMsg : r.error) : m('ok')}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">
                      {r.category || '-'} · {r.start_date}
                      {r.end_date && r.end_date !== r.start_date ? ` → ${r.end_date}` : ''} · {r.gradeNames.length ? r.gradeNames.join(', ') : m('all')}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {serverErrors.length ? (
          <View className="border-destructive/40 bg-destructive/5 gap-1 rounded-md border p-3">
            <Text className="text-destructive text-xs font-medium">{m('server_skipped')}</Text>
            {serverErrors.map((e) => (
              <Text key={e.row} className="text-xs">
                {m('row_n', { n: e.row })}: {e.error}
              </Text>
            ))}
          </View>
        ) : null}

        <Button onPress={runImport} disabled={!periodId || !valid.length || importing}>
          <Text>{valid.length ? m('import_n', { count: valid.length }) : m('import_events')}</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
