import type { Grievance } from '@studently/api-client';
import { toCsv, toExcelXml } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Download, FileSpreadsheet, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '@/lib/colors';
import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { PriorityPill, StatusPill } from '@/features/grievances/ui';
import { complaints } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, sharePdf } from '@/lib/print';
import { usePrintContext } from '@/features/admin/print-context';
import { shareTextFile } from '@/lib/share-file';
import { useDebounced } from '@/lib/use-debounced';

const COLUMNS = ['Number', 'Title', 'Category', 'Priority', 'Status', 'Department', 'Submitted', 'Due Date'];

/** Complaint KPIs and list with PDF / Excel / CSV export (web: /admin/grievances/reports). */
export default function GrievanceReports() {
  const { t, i18n } = useTranslation();
  const r = (k: string) => t(`grievances.reports.${k}`);
  const toast = useToast();
  const print = usePrintContext();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [departmentRaw, setDepartment] = useState('');
  const [statusRaw, setStatus] = useState('');
  const department = useDebounced(departmentRaw.trim());
  const status = useDebounced(statusRaw.trim());
  const categories = useApi(['grievance-categories'], () => complaints.getCategories());
  const report = useApi(['grievance-report', from, to, categoryId, department, status], () =>
    complaints.getReport({ from: from || undefined, to: to || undefined, category_id: categoryId || undefined, department: department || undefined, status: status || undefined }),
  );
  const rows = report.data?.rows ?? [];
  const date = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));
  const toRows = (list: Grievance[]) => list.map((g) => [g.complaint_number, g.title, g.category?.name || '', g.priority, g.status.replace(/_/g, ' '), g.department || '', date(g.submitted_at), g.due_date ? date(g.due_date) : '']);

  async function exportAs(kind: 'pdf' | 'excel' | 'csv') {
    try {
      if (kind === 'csv') return await shareTextFile('grievance_report.csv', toCsv(COLUMNS, toRows(rows)), 'text/csv', 'public.comma-separated-values-text');
      if (kind === 'excel') return await shareTextFile('grievance_report.xls', toExcelXml('Grievances', COLUMNS, toRows(rows)), 'application/vnd.ms-excel', 'com.microsoft.excel.xls');
      const th = COLUMNS.map((c) => `<th style="text-align:start;padding:4px;border-bottom:2px solid ${colors.printText};font-size:10px">${escapeHtml(c)}</th>`).join('');
      const body = `<h2 style="margin:0 0 10px">Complaints &amp; Grievances Report</h2><table style="width:100%;border-collapse:collapse"><tr>${th}</tr>${toRows(rows)
        .map((rw) => `<tr>${rw.map((c) => `<td style="padding:4px;border-bottom:1px solid ${colors.printBorder};font-size:10px">${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')}</table>`;
      await sharePdf(buildPrintHtml({ title: r('title'), pages: [body], school: print.school, layout: print.layout, withHeader: true, reportLabel: r('title') }), 'grievance_report.pdf', { width: 842, height: 595 });
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    }
  }

  const k = report.data?.kpis;
  const kpis = k
    ? [
        [r('kpi_total'), k.total],
        [r('kpi_open'), k.open],
        [r('kpi_overdue'), k.overdue],
        [r('kpi_resolved'), k.resolved],
        [r('kpi_avg_resolution'), k.avg_resolution_days],
        [r('kpi_sla_compliance'), `${k.sla_compliance_rate}%`],
      ]
    : [];

  return (
    <>
      <Stack.Screen options={{ title: r('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted" className="text-sm">{r('subtitle')}</Text>
              <View className="flex-row gap-2">
                <DateField className="flex-1" label={r('label_from')} value={from} onChange={setFrom} clearable />
                <DateField className="flex-1" label={r('label_to')} value={to} onChange={setTo} max={todayYmd()} clearable />
              </View>
              <View className="gap-1.5">
                <Label>{r('label_category')}</Label>
                <Picker value={categoryId || '__all__'} onChange={(v) => setCategoryId(v === '__all__' ? '' : v)} options={[{ value: '__all__', label: r('all') }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1.5">
                  <Label>{r('label_department')}</Label>
                  <Input value={departmentRaw} onChangeText={setDepartment} placeholder={r('any')} />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{r('label_status')}</Label>
                  <Input value={statusRaw} onChangeText={setStatus} placeholder={r('any')} autoCapitalize="none" />
                </View>
              </View>
              {k ? (
                <View className="flex-row flex-wrap gap-2">
                  {kpis.map(([label, value]) => (
                    <View key={String(label)} className="border-info-soft dark:border-border bg-card rounded-xl border p-3" style={{ width: '31%' }}>
                      <Text className="text-muted-foreground text-[11px]">{label}</Text>
                      <Text className="text-lg font-bold">{value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {report.data ? (
                <View className="flex-row flex-wrap gap-2">
                  <Button variant="outline" size="sm" onPress={() => exportAs('pdf')} disabled={!print.ready}>
                    <Icon as={FileText} className="text-foreground size-4" />
                    <Text>{r('btn_export_pdf')}</Text>
                  </Button>
                  <Button variant="outline" size="sm" onPress={() => exportAs('excel')}>
                    <Icon as={FileSpreadsheet} className="text-foreground size-4" />
                    <Text>{r('btn_export_excel')}</Text>
                  </Button>
                  <Button variant="outline" size="sm" onPress={() => exportAs('csv')}>
                    <Icon as={Download} className="text-foreground size-4" />
                    <Text>{r('btn_export_csv')}</Text>
                  </Button>
                </View>
              ) : null}
            </View>
          }
          items={report.data ? rows : undefined}
          error={report.error}
          isLoading={report.isLoading}
          onRefresh={() => report.mutate()}
          emptyTitle={t('grievances.list.no_complaints')}
          keyExtractor={(g) => g.id}
          renderItem={(g) => (
            <View className="gap-1 px-4 py-3">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-muted-foreground font-mono text-xs">{g.complaint_number}</Text>
                <PriorityPill priority={g.priority} />
                <StatusPill status={g.status} />
              </View>
              <Text className="text-sm font-semibold">{g.title}</Text>
              <Text className="text-muted-foreground text-xs">{`${g.category?.name || '—'} · ${date(g.submitted_at)}`}</Text>
            </View>
          )}
        />
      </View>
    </>
  );
}
