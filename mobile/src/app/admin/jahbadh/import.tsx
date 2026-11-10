import type { JgImportField, JgImportMapping, JgImportPreview, JgImportRequest, JgImportResult } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Eye, FileUp, Printer, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { StatTile, StatTiles, StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { usePrintContext } from '@/features/admin/print-context';
import { jahbadhData } from '@/features/jahbadh/data';
import { SectionHeader, useJg, useJgSection } from '@/features/jahbadh/shared';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';
import { pickDocuments, type PickedDocument } from '@/lib/upload';

const ERR_CODES = ['no_name_column', 'empty', 'bad_mapping', 'too_many', 'bad_file', 'not_migrated'];

/** «استيراد الأسماء» (web: /admin/jahbadh-grades/import): paste or upload names, map columns, preview, apply. */
export default function JahbadhImport() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const print = usePrintContext();
  const [text, setText] = useState('');
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [overrides, setOverrides] = useState<JgImportMapping>({});
  const [preview, setPreview] = useState<JgImportPreview | null>(null);
  const [result, setResult] = useState<JgImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const request = (): JgImportRequest => ({
    text: file ? undefined : text,
    file: file ? { uri: file.uri, name: file.name, type: file.type } : undefined,
    has_header: hasHeader,
    mapping: Object.keys(overrides).length ? overrides : undefined,
  });
  const errorText = (code?: string, message?: string) => (code && ERR_CODES.includes(code) ? t(`app.jgd_err_${code}`) : (message ?? t('app.error_title')));

  const pick = async () => {
    const [doc] = await pickDocuments({ multiple: false });
    if (!doc) return;
    setFile(doc);
    setPreview(null);
  };

  const runPreview = async () => {
    const sid = sectionId;
    if (!sid) return;
    if (!file && !text.trim()) return toast.error(t('app.jgd_import_nothing'));
    setBusy(true);
    const res = await jahbadhData.importPreview(sid, request(), campusId);
    setBusy(false);
    if (!res.success) return toast.error(errorText(res.code, res.error));
    setResult(null);
    setPreview(res.data ?? null);
  };

  const apply = async () => {
    const sid = sectionId;
    if (!sid) return;
    setBusy(true);
    const res = await jahbadhData.importApply(sid, request(), campusId);
    setBusy(false);
    if (!res.success) return toast.error(errorText(res.code, res.error));
    setResult(res.data ?? null);
    setPreview(null);
    toast.success(t('app.jgd_import_done'));
  };

  const setColumn = (field: JgImportField, col: number) => {
    setOverrides((o) => ({ ...o, [field]: col }));
    setPreview(null);
  };

  const printCredentials = async () => {
    const creds = result?.credentials ?? [];
    if (!creds.length) return;
    const rows = creds.map((c) => `<tr><td>${c.line}</td><td>${escapeHtml(c.name)}</td><td dir="ltr">${escapeHtml(c.username ?? '—')}</td><td dir="ltr">${escapeHtml(c.password ?? '—')}</td></tr>`).join('');
    const html = `<h2>${escapeHtml(t('app.jgd_credentials_title'))}</h2><table class="table"><thead><tr><th>${escapeHtml(t('app.jgd_line'))}</th><th>${escapeHtml(t('app.jgd_name'))}</th><th>${escapeHtml(t('app.jgd_username'))}</th><th>${escapeHtml(t('app.jgd_password'))}</th></tr></thead><tbody>${rows}</tbody></table>`;
    try {
      await printHtml(buildPrintHtml({ title: t('app.jgd_credentials_title'), pages: [html], school: print.school, layout: print.layout, withHeader: print.withHeader }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    }
  };

  const canApply = !!preview && preview.counts.create + preview.counts.update > 0;
  const colLabel = (p: JgImportPreview, col: number) => (p.has_header && p.headers[col - 1] ? `${col} — ${p.headers[col - 1]}` : String(col));

  return (
    <>
      <Stack.Screen options={{ title: t('app.jgd_import_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-8">
        <Text variant="muted" className="text-xs">
          {t('app.jgd_import_subtitle')}
        </Text>
        <SectionHeader sections={sections} sectionId={sectionId} onChange={(id) => { setSection(id); setPreview(null); setResult(null); }} isAdmin={isAdmin} />

        {sectionId ? (
          <Panel className="gap-3 p-4">
            <Label>{t('app.jgd_import_paste')}</Label>
            <Textarea value={text} onChangeText={(v) => { setText(v); setPreview(null); }} editable={!file} placeholder={t('app.jgd_import_paste_hint')} numberOfLines={6} />
            <View className="flex-row flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onPress={pick}>
                <Icon as={FileUp} className="text-foreground size-4" />
                <Text numberOfLines={1}>{file ? file.name : t('app.jgd_import_file')}</Text>
              </Button>
              {file ? (
                <Button variant="ghost" size="icon" onPress={() => { setFile(null); setPreview(null); }} accessibilityLabel={t('app.jgd_import_clear_file')}>
                  <Icon as={X} className="text-foreground size-4" />
                </Button>
              ) : null}
            </View>
            <View className="flex-row items-center gap-2">
              <Checkbox checked={hasHeader} onCheckedChange={(v) => { setHasHeader(!!v); setPreview(null); }} accessibilityLabel={t('app.jgd_import_has_header')} />
              <Text className="text-sm">{t('app.jgd_import_has_header')}</Text>
            </View>
            <Button onPress={runPreview} disabled={busy}>
              <Icon as={Eye} className="size-4 text-white" />
              <Text>{t('app.jgd_import_preview')}</Text>
            </Button>
          </Panel>
        ) : null}

        {preview ? (
          <>
            <Panel className="gap-3 p-4">
              <Text className="text-base font-bold">{t('app.jgd_import_mapping')}</Text>
              {preview.fields.map((f) => (
                <View key={f.key} className="gap-1">
                  <Text className="text-sm font-semibold">{f.label}</Text>
                  <Picker
                    value={String(preview.mapping[f.key] ?? 0)}
                    onChange={(v) => setColumn(f.key, Number(v))}
                    options={[{ value: '0', label: t('app.jgd_import_not_used') }, ...Array.from({ length: preview.columns }, (_, i) => ({ value: String(i + 1), label: colLabel(preview, i + 1) }))]}
                  />
                  <Text variant="muted" className="text-xs">
                    {`${t('app.jgd_import_detected')}: ${preview.detected[f.key] ? colLabel(preview, preview.detected[f.key]) : '—'} · ${t('app.jgd_import_first_value')}: ${preview.first_values[f.key] ?? '—'}`}
                  </Text>
                </View>
              ))}
              {Object.keys(overrides).length ? <Text variant="muted" className="text-xs">{t('app.jgd_import_rerun')}</Text> : null}
            </Panel>

            <StatTiles>
              <StatTile label={t('app.jgd_count_total')} value={String(preview.counts.total)} />
              <StatTile label={t('app.jgd_count_create')} value={String(preview.counts.create)} tone="success" />
              <StatTile label={t('app.jgd_count_update')} value={String(preview.counts.update)} tone="success" />
              <StatTile label={t('app.jgd_count_errors')} value={String(preview.counts.errors)} tone="destructive" />
              <StatTile label={t('app.jgd_count_warnings')} value={String(preview.counts.warnings)} tone="warning" />
            </StatTiles>

            {preview.rows.map((r) => (
              <Panel key={r.line} className="gap-1.5 p-3">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={2}>{`${r.line}. ${r.values.name ?? '—'}`}</Text>
                  <StatusChip label={t(`app.jgd_action_${r.action}`)} tone={r.action === 'skip' ? 'muted' : 'success'} />
                </View>
                <Text variant="muted" className="text-xs">
                  {[r.values.registration_number ? `${t('app.jgd_registration_number')}: ${r.values.registration_number}` : null, r.match ? `${t('app.jgd_match')}: ${t(`app.jgd_match_by_${r.match.by}`)}` : null].filter(Boolean).join(' · ') || '—'}
                </Text>
                {r.issues.map((i, n) => (
                  <Text key={n} className={i.level === 'error' ? 'text-destructive text-xs' : 'text-warning text-xs'}>{i.message}</Text>
                ))}
              </Panel>
            ))}
          </>
        ) : null}

        {result ? (
          <Panel className="gap-3 p-4">
            <Text className="text-base font-bold">{t('app.jgd_import_summary')}</Text>
            <StatTiles>
              <StatTile label={t('app.jgd_count_created')} value={String(result.created)} tone="success" />
              <StatTile label={t('app.jgd_count_updated')} value={String(result.updated)} tone="success" />
              <StatTile label={t('app.jgd_count_skipped')} value={String(result.skipped)} />
            </StatTiles>
            {result.not_stored.length ? <Text className="bg-warning-soft text-warning rounded-xl p-2.5 text-xs">{t('app.jgd_not_stored', { fields: result.not_stored.join('، ') })}</Text> : null}
            {result.failed.map((f) => (
              <Text key={f.line} className="text-destructive text-xs">{`${t('app.jgd_line_n', { line: f.line })}: ${f.message}`}</Text>
            ))}
            {result.credentials.length ? (
              <>
                <Text variant="muted" className="text-xs">{t('app.jgd_credentials_hint')}</Text>
                {result.credentials.map((c) => (
                  <View key={c.student_id} className="bg-muted gap-0.5 rounded-xl p-2.5">
                    <Text className="text-sm font-semibold">{c.name}</Text>
                    <Text className="text-xs" selectable>{`${t('app.jgd_username')}: ${c.username ?? '—'} · ${t('app.jgd_password')}: ${c.password ?? '—'}`}</Text>
                  </View>
                ))}
                <Button variant="outline" onPress={printCredentials}>
                  <Icon as={Printer} className="text-foreground size-4" />
                  <Text>{t('app.jgd_print_credentials')}</Text>
                </Button>
              </>
            ) : null}
          </Panel>
        ) : null}
      </ScrollView>
      {canApply ? (
        <StickyActions>
          <Button className="flex-1" disabled={busy} onPress={apply}>
            <Text>{t('app.jgd_import_apply', { count: (preview?.counts.create ?? 0) + (preview?.counts.update ?? 0) })}</Text>
          </Button>
        </StickyActions>
      ) : null}
    </>
  );
}
