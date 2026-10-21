import { toCsv } from '@studently/shared-utils';
import type { ExportTemplate, ExportTemplateColumn } from '@studently/api-client';
import { ArrowDown, ArrowUp, Eye, EyeOff, FileSpreadsheet, FileText, Plus, Settings2, Star, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as XLSX from 'xlsx';

import { BottomSheet } from '@/components/app/bottom-sheet';
import { ScrollView } from '@/components/app/keyboard';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { exportTemplates } from '@/lib/api';
import { colors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, sharePdf } from '@/lib/print';
import { shareBase64File, shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

// Excel / PDF exports driven by a column list and the school's saved column presets
// (web: components/shared/ExportButton + ExportTemplateManager + lib/utils/tableExport).

export interface ExportColumn<T> {
  key: string;
  label: string;
  label_ar?: string;
  accessor: (row: T, index: number) => string | number | null | undefined;
}

/** Numbering column ("#"), restarting at 1 for the whole exported set (web serialNumberColumn). */
export function serialColumn<T>(): ExportColumn<T> {
  return { key: '__sn', label: '#', accessor: (_r, i) => i + 1 };
}

const labelOf = <T,>(c: ExportColumn<T>) => (locale === 'ar' && c.label_ar ? c.label_ar : c.label);
const cell = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** The report's saved presets (campus-scoped, like the web hook). */
export function useExportTemplates(reportKey: string) {
  const { campusId } = useCampus();
  const q = useApi(['admin', 'export-templates', reportKey, campusId ?? 'school'], ([, , key]) => exportTemplates.list(key as string, campusId));
  const templates = q.data ?? [];
  return { ...q, templates, defaultTemplate: templates.find((t) => t.is_default) ?? null };
}

/** Columns of the default preset (visible, in its order, with its labels), or every column. */
export function applyTemplate<T>(columns: ExportColumn<T>[], tpl: ExportTemplate | null): ExportColumn<T>[] {
  if (!tpl) return columns;
  const byKey = new Map(columns.map((c) => [c.key, c]));
  return tpl.columns
    .filter((c) => c.visible && byKey.has(c.key))
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const base = byKey.get(c.key) as ExportColumn<T>;
      return { ...base, label: c.label || base.label, label_ar: c.label_ar || base.label_ar };
    });
}

export async function exportExcel<T>(columns: ExportColumn<T>[], rows: T[], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([columns.map(labelOf), ...rows.map((r, i) => columns.map((c) => c.accessor(r, i) ?? ''))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  if (locale === 'ar') wb.Workbook = { Views: [{ RTL: true }] };
  await shareBase64File(`${filename}.xlsx`, XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function exportCsv<T>(columns: ExportColumn<T>[], rows: T[], filename: string) {
  await shareTextFile(`${filename}.csv`, toCsv(columns.map(labelOf), rows.map((r, i) => columns.map((c) => cell(c.accessor(r, i))))), 'text/csv', 'public.comma-separated-values-text');
}

/** Toolbar: Excel, PDF, CSV and "Manage presets" for one report (web ExportButton). */
export function ExportMenu<T>({ reportKey, columns, fetchRows, filename, title, csv = true }: { reportKey: string; columns: ExportColumn<T>[]; fetchRows: () => Promise<T[]>; filename: string; title: string; csv?: boolean }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.ex_${key}`);
  const toast = useToast();
  const ctx = usePrintContext();
  const tpl = useExportTemplates(reportKey);
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | 'csv' | null>(null);
  const [manage, setManage] = useState(false);
  const cols = applyTemplate(columns, tpl.defaultTemplate);

  async function run(kind: 'xlsx' | 'pdf' | 'csv') {
    setBusy(kind);
    try {
      const rows = await fetchRows();
      if (kind === 'xlsx') await exportExcel(cols, rows, filename);
      else if (kind === 'csv') await exportCsv(cols, rows, filename);
      else {
        const table = `<h2 style="margin:0 0 8px">${escapeHtml(title)}</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>${cols
          .map((c) => `<th style="border:1px solid ${colors.printBorder};padding:4px;text-align:start">${escapeHtml(labelOf(c))}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map((r, i) => `<tr>${cols.map((c) => `<td style="border:1px solid ${colors.printBorder};padding:4px">${escapeHtml(cell(c.accessor(r, i)))}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`;
        await sharePdf(buildPrintHtml({ title, pages: [table], school: ctx.school, layout: ctx.layout, withHeader: true, reportLabel: title }), `${filename}.pdf`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : k(kind === 'pdf' ? 'pdf_failed' : 'excel_failed'));
    } finally {
      setBusy(null);
    }
  }

  const btn = (kind: 'xlsx' | 'pdf' | 'csv', icon: typeof FileText, label: string) => (
    <Button size="sm" variant="outline" className="rounded-full" onPress={() => run(kind)} disabled={!!busy}>
      {busy === kind ? <ActivityIndicator size="small" /> : <Icon as={icon} className="text-brand dark:text-brand-secondary size-4" />}
      <Text>{label}</Text>
    </Button>
  );

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {btn('xlsx', FileSpreadsheet, 'Excel')}
      {btn('pdf', FileText, 'PDF')}
      {csv ? btn('csv', FileSpreadsheet, 'CSV') : null}
      <Pressable onPress={() => setManage(true)} accessibilityRole="button" accessibilityLabel={k('manage')} className="bg-info-soft flex-row items-center gap-1 rounded-full px-3 py-2 active:opacity-70">
        <Icon as={Settings2} className="text-brand dark:text-brand-secondary size-3.5" />
        <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{tpl.defaultTemplate ? tpl.defaultTemplate.name : k('manage')}</Text>
      </Pressable>
      {manage ? <TemplateManager reportKey={reportKey} columns={columns} onClose={() => setManage(false)} /> : null}
    </View>
  );
}

type Draft = ExportTemplateColumn;

function buildDraft<T>(columns: ExportColumn<T>[], from?: ExportTemplateColumn[]): Draft[] {
  if (!from?.length) return columns.map((c, i) => ({ key: c.key, label: c.label, label_ar: c.label_ar ?? '', visible: true, order: i }));
  // The preset's order first, then columns added since it was saved (visible, at the end).
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const draft = from.filter((c) => byKey.has(c.key)).sort((a, b) => a.order - b.order).map((c) => ({ ...c }));
  const seen = new Set(draft.map((c) => c.key));
  for (const c of columns) if (!seen.has(c.key)) draft.push({ key: c.key, label: c.label, label_ar: c.label_ar ?? '', visible: true, order: draft.length });
  return draft;
}

/** Create, edit, delete and set the default preset (web ExportTemplateManager; reorder with arrows instead of drag). */
function TemplateManager<T>({ reportKey, columns, onClose }: { reportKey: string; columns: ExportColumn<T>[]; onClose: () => void }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.ex_${key}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const tpl = useExportTemplates(reportKey);
  const initial = tpl.defaultTemplate;
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [draft, setDraft] = useState<Draft[]>(() => buildDraft(columns, initial?.columns));
  const [saving, setSaving] = useState(false);

  const select = (id: string | null) => {
    const found = tpl.templates.find((x) => x.id === id) ?? null;
    setSelectedId(found?.id ?? null);
    setName(found?.name ?? '');
    setDraft(buildDraft(columns, found?.columns));
  };
  const move = (i: number, d: -1 | 1) =>
    setDraft((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((c, n) => ({ ...c, order: n }));
    });
  const patch = (key: string, p: Partial<Draft>) => setDraft((list) => list.map((c) => (c.key === key ? { ...c, ...p } : c)));

  async function save(asDefault: boolean) {
    if (!name.trim()) return toast.error(k('name_required'));
    setSaving(true);
    const body = { name: name.trim(), columns: draft, is_default: asDefault };
    const r = selectedId ? await exportTemplates.update(selectedId, body) : await exportTemplates.create({ report_key: reportKey, ...body }, campusId);
    setSaving(false);
    if (!r.success) return toast.error(r.error || k('save_failed'));
    if (!selectedId && r.data) setSelectedId(r.data.id);
    toast.success(k('saved'));
    tpl.mutate();
  }

  async function remove() {
    if (!selectedId) return;
    setSaving(true);
    const r = await exportTemplates.remove(selectedId);
    setSaving(false);
    if (!r.success) return toast.error(r.error || k('delete_failed'));
    toast.success(k('deleted'));
    tpl.mutate();
    select(null);
  }

  return (
    <BottomSheet open onClose={onClose} title={k('manage_title')}>
      <ScrollView contentContainerClassName="gap-3 pb-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row flex-wrap gap-2">
          {tpl.templates.map((x) => (
            <Pressable
              key={x.id}
              onPress={() => select(x.id)}
              className={cn('flex-row items-center gap-1 rounded-full border px-3 py-1.5', selectedId === x.id ? 'border-brand-secondary bg-info-soft' : 'border-info-soft dark:border-border bg-card')}
              accessibilityRole="button">
              {x.is_default ? <Icon as={Star} className="text-warning size-3" /> : null}
              <Text className={cn('text-xs font-semibold', selectedId === x.id ? 'text-brand dark:text-brand-secondary' : 'text-muted-foreground')}>{x.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => select(null)} className="border-brand-secondary flex-row items-center gap-1 rounded-full border border-dashed px-3 py-1.5" accessibilityRole="button">
            <Icon as={Plus} className="text-brand dark:text-brand-secondary size-3" />
            <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{k('new')}</Text>
          </Pressable>
        </View>
        <Input value={name} onChangeText={setName} placeholder={k('name_placeholder')} />
        {draft.map((c, i) => (
          <View key={c.key} className={cn('border-info-soft dark:border-border bg-card gap-2 rounded-2xl border p-2.5', !c.visible && 'opacity-50')}>
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => patch(c.key, { visible: !c.visible })} hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: c.visible }} className="bg-info-soft size-8 items-center justify-center rounded-full">
                <Icon as={c.visible ? Eye : EyeOff} className="text-brand dark:text-brand-secondary size-4" />
              </Pressable>
              <Input className="h-9 flex-1" value={c.label} onChangeText={(v) => patch(c.key, { label: v })} placeholder="English" />
              <Pressable onPress={() => move(i, -1)} hitSlop={6} accessibilityRole="button" accessibilityLabel={k('move_up')} className="bg-muted size-8 items-center justify-center rounded-full">
                <Icon as={ArrowUp} className="text-muted-foreground size-4" />
              </Pressable>
              <Pressable onPress={() => move(i, 1)} hitSlop={6} accessibilityRole="button" accessibilityLabel={k('move_down')} className="bg-muted size-8 items-center justify-center rounded-full">
                <Icon as={ArrowDown} className="text-muted-foreground size-4" />
              </Pressable>
            </View>
            <Input className="h-9" value={c.label_ar ?? ''} onChangeText={(v) => patch(c.key, { label_ar: v })} placeholder="العربية" />
          </View>
        ))}
        <View className="flex-row flex-wrap gap-2">
          {selectedId ? (
            <Button variant="outline" onPress={remove} disabled={saving}>
              <Icon as={Trash2} className="text-destructive size-4" />
              <Text className="text-destructive">{t('common.delete')}</Text>
            </Button>
          ) : null}
          <Button variant="outline" className="flex-1" onPress={() => save(false)} disabled={saving}>
            <Text>{k('save')}</Text>
          </Button>
          <Button className="flex-1" onPress={() => save(true)} disabled={saving}>
            <Text>{k('save_default')}</Text>
          </Button>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
