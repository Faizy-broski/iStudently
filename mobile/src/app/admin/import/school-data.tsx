import { IMPORT_DONE, type GeneratedCredential, type ValidationReport } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, KeyRound, RotateCcw, Upload, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Panel } from '@/components/app/panel';
import { Screen } from '@/components/app/screen';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminSchoolDataImport } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile, shareTextFile } from '@/lib/share-file';
import { pickDocuments, type PickedDocument } from '@/lib/upload';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEETS = ['Grades', 'Sections', 'Subjects', 'FeeCategories', 'FeeStructures', 'Teachers', 'Staff', 'Students', 'Parents', 'Invoices', 'Payments'];

/** Migrate a whole school from one workbook: template, validate, import job, generated logins, undo (web: /admin/setup/import-school-data). */
export default function SchoolDataImport() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.sdi_${key}`, o);
  const sheet = (s: string) => (SHEETS.includes(s) ? k(`sheet_${s}`) : s);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [busy, setBusy] = useState<'template' | 'validate' | 'commit' | 'rollback' | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  // The job is polled every 3 s until it finishes (web pollJob).
  const [done, setDone] = useState(false);
  const job = useApi(jobId ? ['admin', 'school-import-job', jobId] : null, ([, , j]) => adminSchoolDataImport.job(j as string, campusId), { refreshInterval: done ? 0 : 3000 });
  const j = job.data;
  if (j && !done && IMPORT_DONE.includes(j.status)) setDone(true);

  const reset = () => {
    setFile(null);
    setToken(null);
    setReport(null);
    setJobId(null);
    setDone(false);
  };

  async function template() {
    setBusy('template');
    try {
      await shareApiFile(adminSchoolDataImport.templatePath, 'studently-school-data-import-template.xlsx', XLSX);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : k('template_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function choose() {
    const [picked] = await pickDocuments({ multiple: false });
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.xlsx')) return toast.error(k('xlsx_only'));
    setFile(picked);
    setToken(null);
    setReport(null);
  }

  async function validate() {
    if (!file) return;
    setBusy('validate');
    const r = await adminSchoolDataImport.validate(file, campusId);
    setBusy(null);
    if (!r.success || !r.data) return toast.error(r.error || k('validation_failed'));
    setToken(r.data.token);
    setReport(r.data.report);
  }

  async function commit() {
    if (!token) return;
    setBusy('commit');
    const r = await adminSchoolDataImport.commit(token, file?.name, campusId);
    setBusy(null);
    if (!r.success || !r.data) return toast.error(r.error || k('start_failed'));
    setJobId(r.data.job_id);
  }

  async function rollback() {
    if (!jobId) return;
    if (!(await confirm({ title: k('undo'), body: k('undo_confirm'), destructive: true, confirmLabel: k('undo') }))) return;
    setBusy('rollback');
    const r = await adminSchoolDataImport.rollback(jobId, campusId);
    setBusy(null);
    if (!r.success || !r.data) return toast.error(r.error || k('rollback_failed'));
    if (!r.data.rolled_back) return toast.error(k('rollback_partial', { count: r.data.errors.length }));
    toast.success(k('rolled_back'));
    job.mutate();
  }

  async function shareCredentials(creds: GeneratedCredential[]) {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = creds.map((c) => [c.entity, esc(c.name), c.username, c.password || ''].join(','));
    // UTF-8 BOM so Excel reads Arabic names correctly (same as the web).
    await shareTextFile('school-data-import-credentials.csv', `﻿entity,name,username,password\n${rows.join('\n')}`, 'text/csv', 'public.comma-separated-values-text');
  }

  const step = jobId ? (done ? 'results' : 'running') : report ? 'validated' : 'upload';

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{k('subtitle')}</Text>

        {step === 'upload' ? (
          <>
            <Panel className="gap-3 p-4">
              <Text className="font-semibold">{k('step1')}</Text>
              <Text variant="muted" className="text-sm">
                {k('step1_desc')}
              </Text>
              <Button variant="outline" onPress={template} disabled={busy === 'template'}>
                {busy === 'template' ? <ActivityIndicator size="small" /> : <Icon as={Download} className="size-4" />}
                <Text>{k('download_template')}</Text>
              </Button>
            </Panel>
            <Panel className="gap-3 p-4">
              <Text className="font-semibold">{k('step2')}</Text>
              <Pressable onPress={choose} className="border-border items-center gap-2 rounded-xl border-2 border-dashed p-8 active:opacity-70" accessibilityRole="button">
                <Icon as={Upload} className="text-muted-foreground size-8" />
                {file ? (
                  <View className="flex-row items-center gap-2">
                    <Icon as={FileSpreadsheet} className="size-4" />
                    <Text className="text-sm font-medium">{file.name}</Text>
                  </View>
                ) : (
                  <Text variant="muted" className="text-sm">
                    {k('choose')}
                  </Text>
                )}
              </Pressable>
              <Button onPress={validate} disabled={!file || busy === 'validate'}>
                {busy === 'validate' ? <ActivityIndicator size="small" /> : null}
                <Text>{k('validate')}</Text>
              </Button>
            </Panel>
          </>
        ) : null}

        {step === 'validated' && report ? (
          <Panel className="gap-3 p-4">
            <View className="flex-row items-center gap-2">
              <Icon as={report.ok_to_commit ? CheckCircle2 : AlertTriangle} className={report.ok_to_commit ? 'text-success size-5' : 'text-warning size-5'} />
              <Text className="font-semibold">{k('report_title')}</Text>
            </View>
            <Text variant="muted" className="text-sm">
              {k('report_summary', { valid: report.total_valid, invalid: report.total_invalid, sheets: report.sheets.length })}
              {!report.ok_to_commit ? ` ${k('report_fix')}` : ''}
            </Text>
            {report.sheets
              .filter((s) => s.valid_count > 0 || s.invalid_count > 0)
              .map((s) => (
                <View key={s.sheet} className="border-border gap-1 rounded-xl border p-3">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-sm font-semibold">{sheet(s.sheet)}</Text>
                    <StatusChip label={k('valid_n', { count: s.valid_count })} tone="success" className="px-2 py-0.5" />
                    {s.invalid_count > 0 ? <StatusChip label={k('invalid_n', { count: s.invalid_count })} tone="destructive" className="px-2 py-0.5" /> : null}
                  </View>
                  {s.errors.slice(0, 20).map((e, i) => (
                    <Text key={i} variant="muted" className="text-xs">{`• ${k('row_error', { row: e.row, error: e.error })}`}</Text>
                  ))}
                  {s.errors.length > 20 ? (
                    <Text variant="muted" className="text-xs">
                      {k('more_errors', { count: s.errors.length - 20 })}
                    </Text>
                  ) : null}
                </View>
              ))}
            <Button onPress={commit} disabled={!report.ok_to_commit || busy === 'commit'}>
              {busy === 'commit' ? <ActivityIndicator size="small" /> : null}
              <Text>{k('confirm_import')}</Text>
            </Button>
            <Button variant="outline" onPress={reset}>
              <Text>{k('start_over')}</Text>
            </Button>
          </Panel>
        ) : null}

        {step === 'running' ? (
          <Panel className="gap-3 p-4">
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" />
              <Text className="font-semibold">{k('running_title')}</Text>
            </View>
            <Text variant="muted" className="text-sm">
              {k('running_desc')}
            </Text>
            <Progress value={j?.progress_percent ?? 0} />
            <Text variant="muted" className="text-sm">
              {`${j?.current_phase ? k('currently', { phase: sheet(j.current_phase) }) : k('starting')} — ${j?.progress_percent ?? 0}%`}
            </Text>
          </Panel>
        ) : null}

        {step === 'results' && j ? (
          <Panel className="gap-3 p-4">
            <View className="flex-row items-center gap-2">
              <Icon as={j.status === 'completed' ? CheckCircle2 : XCircle} className={j.status === 'completed' ? 'text-success size-5' : 'text-destructive size-5'} />
              <Text className="font-semibold">{k(`status_${j.status}`, { defaultValue: j.status })}</Text>
            </View>
            {j.error_message ? <Text className="text-destructive text-sm">{j.error_message}</Text> : null}
            {(j.result_summary?.sheets ?? []).map((s) => (
              <View key={s.sheet} className="border-border flex-row flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                <Text className="text-sm font-semibold">{sheet(s.sheet)}</Text>
                <View className="flex-row gap-1.5">
                  <StatusChip label={k('created_n', { count: s.created })} tone="success" className="px-2 py-0.5" />
                  {s.skipped > 0 ? <StatusChip label={k('skipped_n', { count: s.skipped })} tone="muted" className="px-2 py-0.5" /> : null}
                  {s.failed > 0 ? <StatusChip label={k('failed_n', { count: s.failed })} tone="destructive" className="px-2 py-0.5" /> : null}
                </View>
              </View>
            ))}
            {j.result_summary?.generated_credentials.length ? (
              <View className="border-border gap-2 rounded-xl border p-3">
                <View className="flex-row items-center gap-2">
                  <Icon as={KeyRound} className="size-4" />
                  <Text className="flex-1 text-sm font-semibold">{k('logins', { count: j.result_summary.generated_credentials.length })}</Text>
                </View>
                <Text variant="muted" className="text-xs">
                  {k('logins_hint')}
                </Text>
                <Button size="sm" variant="outline" onPress={() => shareCredentials(j.result_summary?.generated_credentials ?? [])}>
                  <Icon as={Download} className="size-4" />
                  <Text>{k('download_csv')}</Text>
                </Button>
                {j.result_summary.generated_credentials.map((c, i) => (
                  <View key={i} className="border-border border-t pt-2">
                    <Text className="text-sm font-medium">{`${c.name} · ${t(`app.role_${c.entity}`, { defaultValue: c.entity })}`}</Text>
                    <Text selectable className="font-mono text-xs">{`${c.username} / ${c.password || '—'}`}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Button variant="outline" onPress={reset}>
              <Text>{k('another')}</Text>
            </Button>
            {j.status !== 'rolled_back' ? (
              <Button variant="destructive" onPress={rollback} disabled={busy === 'rollback'}>
                {busy === 'rollback' ? <ActivityIndicator size="small" /> : <Icon as={RotateCcw} className="size-4" />}
                <Text>{k('undo')}</Text>
              </Button>
            ) : null}
          </Panel>
        ) : null}
      </Screen>
    </>
  );
}
