import type { ReportRole, ReportRow } from '@studently/api-client';
import { toCsv, toExcelXml } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, FileSpreadsheet, FileText, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, View } from 'react-native';
import QRCode from 'react-qr-code';

import { colors } from '@/lib/colors';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { REPORT_ENTITY } from '@/features/admin/advanced-report';
import { ConfidentialBadge } from '@/features/admin/people-extras';
import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminAnalytics, adminCustomFields, adminMiqat, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, qrSvg, sharePdf } from '@/lib/print';
import { shareTextFile } from '@/lib/share-file';

const ROLES: ReportRole[] = ['student', 'teacher', 'staff', 'librarian', 'parent'];

function parseFields(raw?: string): string[] {
  try {
    const v = JSON.parse(raw ?? '');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** The advanced report itself: search, sort, Miqat QR column and PDF/Excel/CSV export (web: advanced-report/results). */
export default function AdvancedReportResults() {
  const { t } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`admin.reports.advanced_report.${k}`, o);
  const toast = useToast();
  const print = usePrintContext();
  const { campusId } = useCampus();
  const key = campusId ?? 'school';
  const p = useLocalSearchParams<{ role?: string; fields?: string; grade_level_id?: string; section_id?: string; department?: string; user_id?: string; user_label?: string; has_siblings?: string }>();
  const role: ReportRole = ROLES.includes(p.role as ReportRole) ? (p.role as ReportRole) : 'student';
  const fields = parseFields(p.fields);
  const gradeLevelId = p.grade_level_id || undefined;
  const sectionId = p.section_id || undefined;
  const department = p.department || undefined;
  const userId = p.user_id || undefined;
  const hasSiblings = p.has_siblings === 'true' ? true : p.has_siblings === 'false' ? false : undefined;
  const roleLabel = r(`roles.${role}`);
  const entity = REPORT_ENTITY[role] ?? null;

  useEffect(() => {
    if (fields.length === 0) {
      toast.error(r('select_at_least_one'));
      router.back();
    }
    // Only on open: the fields come from the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = useApi(fields.length ? ['admin', 'advanced-report', key, role, gradeLevelId ?? '', sectionId ?? '', department ?? '', userId ?? '', p.has_siblings ?? ''] : null, () =>
    adminAnalytics.advancedReport(role, campusId, { grade_level_id: gradeLevelId, section_id: sectionId, department, user_id: userId, has_siblings: hasSiblings }),
  );
  const defs = useApi(entity ? ['admin', 'custom-fields', entity, key] : null, ([, , kind]) => adminCustomFields.list(kind as 'student' | 'teacher' | 'staff' | 'parent', campusId));
  const rows = report.data ?? [];

  // Miqat QR payloads by profile id, only when the QR column was picked (max 1000 people per call, as on the web).
  const wantsQr = fields.includes('miqat_qr');
  const profileIds = [...new Set(rows.map((row) => row.profile_id).filter((v): v is string => typeof v === 'string' && v.length > 0))];
  const qr = useApi(wantsQr && profileIds.length ? ['admin', 'advanced-report-qr', key, profileIds.join(',')] : null, async () => {
    const merged: Record<string, string> = {};
    let warning: string | undefined;
    for (let i = 0; i < profileIds.length; i += 1000) {
      const res = await adminMiqat.cardQrBatch(profileIds.slice(i, i + 1000), campusId);
      if (!res.success || !res.data) return { success: false as const, error: res.error };
      warning = warning ?? res.data.signing_key_error;
      Object.assign(merged, res.data.qr);
    }
    return { success: true as const, data: { qr: merged, warning } };
  });
  const qrMap = qr.data?.qr ?? {};
  const qrWarning = qr.data?.warning;
  // A stale signing key means no QR for this school; the report itself is still valid (web: a warning toast).
  const qrNotice = qr.error ? qr.error.message || t('app.error_title') : qrWarning;

  // Login credentials, only when the username/password columns were picked (chunks of 200, as on the web).
  const wantsCredentials = fields.includes('username') || fields.includes('password');
  const creds = useApi(wantsCredentials && profileIds.length ? ['admin', 'advanced-report-credentials', key, profileIds.join(',')] : null, async () => {
    const merged: Record<string, { username: string; password: string }> = {};
    for (let i = 0; i < profileIds.length; i += 200) {
      const res = await adminStudents.bulkCredentials(profileIds.slice(i, i + 200));
      if (!res.success || !res.data) return { success: false as const, error: res.error };
      for (const c of res.data.credentials) merged[c.id] = c;
    }
    return { success: true as const, data: merged };
  });
  const credMap = creds.data ?? {};
  const credOf = (row: ReportRow, f: 'username' | 'password') => (typeof row.profile_id === 'string' ? (credMap[row.profile_id]?.[f] ?? '') : '');

  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const custom = defs.data ?? [];
  const label = (f: string) => {
    if (f.startsWith('custom_')) {
      const d = custom.find((x) => `custom_${x.field_key}` === f);
      return (d && ((locale === 'ar' && d.label_ar) || d.label)) || f.slice(7);
    }
    if (f === 'username') return t('common.username');
    if (f === 'password') return t('app.sl_password');
    return r(`fields.${f}`, { defaultValue: f.replace(/_/g, ' ') });
  };
  const raw = (row: ReportRow, f: string): unknown =>
    f === 'username' || f === 'password' ? credOf(row, f) : ((f.startsWith('custom_') ? row.custom_fields?.[f.slice(7)] : row[f]) ?? '');
  // Select options are stored by their English value; show the Arabic option label when there is one (web: getFieldOptions).
  const optionLabel = (f: string, v: unknown): string => {
    const d = custom.find((x) => `custom_${x.field_key}` === f);
    const one = (x: unknown) => {
      const i = d?.options?.indexOf(String(x)) ?? -1;
      return locale === 'ar' && i >= 0 && d?.options_ar?.[i] ? d.options_ar[i] : String(x);
    };
    return Array.isArray(v) ? v.map(one).join(', ') : one(v);
  };
  const display = (row: ReportRow, f: string): string => {
    if (f.startsWith('custom_')) {
      const v = row.custom_fields?.[f.slice(7)];
      return v == null || v === '' ? '—' : optionLabel(f, v);
    }
    if (f === 'username' || f === 'password') return credOf(row, f) || (creds.isLoading ? '…' : '—');
    const v = row[f];
    if (f === 'is_active') return v ? t('common.active') : t('common.inactive');
    if (f === 'confidential_family_status') return v && v !== 'NONE' ? t(`app.pe_cfs_${String(v)}`, { defaultValue: String(v) }) : '—';
    if ((f === 'created_at' || f === 'date_of_birth' || f === 'date_of_joining') && typeof v === 'string' && v) return formatDate(v);
    if (Array.isArray(v)) return v.join(', ');
    return v == null || v === '' ? '—' : String(v);
  };

  const q = query.trim().toLowerCase();
  let shown = q ? rows.filter((row) => fields.some((f) => String(raw(row, f)).toLowerCase().includes(q))) : rows;
  if (sortField) {
    shown = [...shown].sort((a, b) => {
      const x = String(raw(a, sortField));
      const y = String(raw(b, sortField));
      return sortDir === 'asc' ? x.localeCompare(y) : y.localeCompare(x);
    });
  }

  const columns = fields.filter((f) => f !== 'miqat_qr');
  const title = r('results.title', { role: roleLabel });
  const fileBase = `${role}_report_${new Date().toISOString().slice(0, 10)}`;

  async function exportAs(kind: 'pdf' | 'excel' | 'csv') {
    try {
      const header = ['S.N', ...columns.map(label)];
      const data = shown.map((row, i) => [i + 1, ...columns.map((f) => display(row, f))]);
      if (kind === 'csv') return await shareTextFile(`${fileBase}.csv`, toCsv(header, data), 'text/csv', 'public.comma-separated-values-text');
      // Excel leaves the QR column out, as on the web.
      if (kind === 'excel') return await shareTextFile(`${fileBase}.xls`, toExcelXml(title, header, data), 'application/vnd.ms-excel', 'com.microsoft.excel.xls');
      const th = ['S.N', ...fields.map(label)].map((c) => `<th style="text-align:start;padding:4px;border-bottom:2px solid ${colors.printText};font-size:10px">${escapeHtml(c)}</th>`).join('');
      const tr = shown
        .map((row, i) => {
          const cells = fields.map((f) => {
            if (f === 'miqat_qr') {
              const payload = typeof row.profile_id === 'string' ? qrMap[row.profile_id] : undefined;
              return `<td style="padding:4px;border-bottom:1px solid ${colors.printBorder}">${payload ? qrSvg(payload, 2) : '—'}</td>`;
            }
            return `<td style="padding:4px;border-bottom:1px solid ${colors.printBorder};font-size:10px">${escapeHtml(display(row, f))}</td>`;
          });
          return `<tr><td style="padding:4px;border-bottom:1px solid ${colors.printBorder};font-size:10px">${i + 1}</td>${cells.join('')}</tr>`;
        })
        .join('');
      const body = `<h2 style="margin:0 0 10px">${escapeHtml(title)}</h2><table style="width:100%;border-collapse:collapse"><tr>${th}</tr>${tr}</table>`;
      await sharePdf(buildPrintHtml({ title, pages: [body], school: print.school, layout: print.layout, withHeader: true, reportLabel: title }), `${fileBase}.pdf`, { width: 842, height: 595 });
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    }
  }

  if (fields.length === 0) return null;
  if (report.isLoading)
    return (
      <>
        <Stack.Screen options={{ title }} />
        <View className="bg-background flex-1 gap-2 p-4">
          <EmptyState title={r('results.loading', { role: roleLabel })} />
          <LoadingList rows={6} />
        </View>
      </>
    );
  if (report.error)
    return (
      <>
        <Stack.Screen options={{ title }} />
        <ErrorState message={report.error.message} onRetry={() => report.mutate()} />
      </>
    );

  const header = (
    <View className="gap-3 p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-muted-foreground text-sm">
          <Text className="text-primary text-sm font-semibold">{shown.length}</Text>
          {` ${r('results.records')} · ${fields.length} ${r('results.fields')}`}
        </Text>
        {p.user_label ? (
          <Badge variant="secondary">
            <Text>{p.user_label}</Text>
          </Badge>
        ) : null}
        {gradeLevelId && !userId ? (
          <Badge variant="secondary">
            <Text>{r('results.grade_filtered')}</Text>
          </Badge>
        ) : null}
        {department && !userId ? (
          <Badge variant="secondary">
            <Text>{r('results.dept_label', { dept: department })}</Text>
          </Badge>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button variant="outline" size="sm" onPress={() => exportAs('pdf')} disabled={!print.ready || (wantsQr && qr.isLoading)}>
          <Icon as={FileText} className="size-4" />
          <Text>PDF</Text>
        </Button>
        <Button variant="outline" size="sm" onPress={() => exportAs('excel')}>
          <Icon as={FileSpreadsheet} className="size-4" />
          <Text>Excel</Text>
        </Button>
        <Button variant="outline" size="sm" onPress={() => exportAs('csv')}>
          <Icon as={Share2} className="size-4" />
          <Text>CSV</Text>
        </Button>
      </View>
      {wantsQr && qrNotice ? <Text className="text-sm text-warning ">{qrNotice}</Text> : null}
      <SearchBar value={query} onChangeText={setQuery} placeholder={r('results.search_placeholder', { role: roleLabel.toLowerCase() })} />
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Picker value={sortField} onChange={setSortField} placeholder={t('app.ar_sort_by')} options={[{ value: '', label: t('app.ar_sort_none') }, ...fields.filter((f) => f !== 'miqat_qr').map((f) => ({ value: f, label: label(f) }))]} />
        </View>
        <Button
          variant="outline"
          size="icon"
          disabled={!sortField}
          onPress={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          accessibilityLabel={sortDir === 'asc' ? t('app.ar_sort_asc') : t('app.ar_sort_desc')}>
          <Icon as={sortDir === 'asc' ? ArrowUp : ArrowDown} className="size-4" />
        </Button>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        className="bg-background flex-1"
        data={shown}
        keyExtractor={(row, i) => row.id ?? String(i)}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title={rows.length === 0 ? r('results.no_records', { role: roleLabel.toLowerCase() }) : r('results.no_search')} />}
        contentContainerClassName="pb-10"
        initialNumToRender={20}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <Card className="mx-4 my-1 gap-0 py-3">
            <CardContent className="gap-1 px-4">
              <Text className="text-muted-foreground text-xs">{`S.N ${index + 1}`}</Text>
              {fields.map((f) => (
                <View key={f} className="flex-row items-center gap-2">
                  <Text className="text-muted-foreground w-36 text-xs" numberOfLines={2}>
                    {label(f)}
                  </Text>
                  <View className="flex-1">
                    {f === 'miqat_qr' ? (
                      typeof item.profile_id === 'string' && qrMap[item.profile_id] ? (
                        <View className="self-start rounded border border-border bg-white p-1">
                          <QRCode value={qrMap[item.profile_id]} size={72} bgColor={colors.white} fgColor={colors.black} />
                        </View>
                      ) : qr.isLoading ? (
                        <ActivityIndicator className="self-start" />
                      ) : (
                        <Text className="text-muted-foreground text-sm">—</Text>
                      )
                    ) : f === 'confidential_family_status' ? (
                      item[f] && item[f] !== 'NONE' ? <ConfidentialBadge status={String(item[f])} /> : <Text className="text-muted-foreground text-sm">—</Text>
                    ) : f === 'is_active' ? (
                      <Badge variant={item[f] ? 'default' : 'secondary'} className="self-start">
                        <Text>{display(item, f)}</Text>
                      </Badge>
                    ) : (
                      <Text className="text-sm" selectable>
                        {display(item, f)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      />
    </>
  );
}
