import type { StaffPerformanceLog } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Printer, RefreshCcw, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { DateField, todayYmd } from '@/components/app/date-field';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { actionName, effectiveFine, effectivePoints, logStaffName } from '@/features/admin/performance';
import { useCampus } from '@/features/campus/campus';
import { adminPerformance } from '@/lib/api';
import { buildPrintHtml, escapeHtml, sharePdf } from '@/lib/print';

/** Performance log grouped by staff member, with PDF (web: /admin/performance/reports/log). */
export default function PerformanceLogReport() {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`app.pe_${k}`, o);
  const toast = useToast();
  const print = usePrintContext();
  const { campusId } = useCampus();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayYmd);
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<StaffPerformanceLog[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await adminPerformance.allLogs({ campusId, startDate: from || undefined, endDate: to || undefined });
      if (!res.success) return toast.error(res.error || p('load_failed'));
      setLogs(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = (logs ?? []).filter((l) => !q || logStaffName(l).toLowerCase().includes(q) || (l.staff?.employee_number ?? '').includes(search.trim()));
  const groups = new Map<string, StaffPerformanceLog[]>();
  for (const l of filtered) groups.set(l.staff_id, [...(groups.get(l.staff_id) ?? []), l]);
  for (const g of groups.values()) g.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const date = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));
  const reporter = (l: StaffPerformanceLog) => (l.reporter ? `${l.reporter.first_name ?? ''} ${l.reporter.last_name ?? ''}`.trim() || '-' : '-');
  const cols = [p('date'), p('action'), p('points'), p('fine'), p('reporter'), p('notes')];
  const cells = (l: StaffPerformanceLog) => [date(l.created_at), actionName(l.action, i18n.language), String(effectivePoints(l)), String(effectiveFine(l)), reporter(l), l.notes || '-'];

  async function sharePrint() {
    setBusy(true);
    try {
      const range = from && to ? `${from} – ${to}` : to ? `≤ ${to}` : '';
      const th = cols.map((c) => `<th style="text-align:start;padding:5px;border-bottom:2px solid #111;font-size:11px">${escapeHtml(c)}</th>`).join('');
      const body =
        `<h2 style="margin:0">${escapeHtml(p('performance_log'))}</h2><p style="color:#666;margin:2px 0 12px">${escapeHtml(range)}</p>` +
        [...groups.values()]
          .map((g) => {
            const f = g[0];
            const head = `<h3 style="margin:14px 0 4px">${escapeHtml(logStaffName(f))} ${f.staff?.employee_number ? `#${escapeHtml(f.staff.employee_number)}` : ''} ${f.staff?.role ? `· ${escapeHtml(f.staff.role)}` : ''} <span style="font-weight:400;color:#666">(${escapeHtml(p('logs_count', { count: g.length }))})</span></h3>`;
            return `${head}<table style="width:100%;border-collapse:collapse"><tr>${th}</tr>${g.map((l) => `<tr>${cells(l).map((c) => `<td style="padding:5px;border-bottom:1px solid #eee;font-size:11px">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</table>`;
          })
          .join('');
      await sharePdf(buildPrintHtml({ title: p('performance_log'), pages: [body], school: print.school, layout: print.layout, withHeader: true, reportLabel: p('performance_log') }), 'performance-log.pdf');
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: p('performance_log') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm uppercase">{p('filters')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={p('from')} value={from} onChange={setFrom} clearable />
              <DateField className="flex-1" label={p('to')} value={to} onChange={setTo} clearable />
            </View>
            <View className="gap-1.5">
              <Label>{p('staff_search')}</Label>
              <SearchBar value={search} onChangeText={setSearch} placeholder={p('staff_search_placeholder')} />
            </View>
            <View className="flex-row gap-2">
              <Button className="flex-1" onPress={run} disabled={loading}>
                <Icon as={Search} className="text-primary-foreground size-4" />
                <Text>{p('search')}</Text>
              </Button>
              <Button
                variant="outline"
                onPress={() => {
                  setFrom('');
                  setTo(todayYmd());
                  setSearch('');
                  setLogs(null);
                }}>
                <Icon as={RefreshCcw} className="text-foreground size-4" />
                <Text>{p('reset')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
        {logs ? (
          groups.size === 0 ? (
            <Text variant="muted" className="py-8 text-center">{p('no_staff_match')}</Text>
          ) : (
            <>
              <Button variant="outline" onPress={sharePrint} disabled={busy || !print.ready}>
                <Icon as={Printer} className="text-foreground size-4" />
                <Text>{p('print_log')}</Text>
              </Button>
              {[...groups.entries()].map(([key, g]) => {
                const f = g[0];
                return (
                  <Card key={key}>
                    <CardHeader className="gap-1.5">
                      <CardTitle>{logStaffName(f)}</CardTitle>
                      <View className="flex-row flex-wrap items-center gap-2">
                        {f.staff?.employee_number ? (
                          <Badge variant="secondary">
                            <Text>{`#${f.staff.employee_number}`}</Text>
                          </Badge>
                        ) : null}
                        {f.staff?.role ? (
                          <Badge variant="outline">
                            <Text>{f.staff.role}</Text>
                          </Badge>
                        ) : null}
                        <Text className="text-muted-foreground text-sm">{p('logs_count', { count: g.length })}</Text>
                      </View>
                    </CardHeader>
                    <CardContent className="gap-2">
                      {g.map((l) => (
                        <View key={l.id} className="border-border gap-0.5 border-t pt-2">
                          {cells(l).map((c, i) => (
                            <Text key={i} className="text-sm">
                              <Text className="text-muted-foreground text-sm">{`${cols[i]}: `}</Text>
                              {c}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )
        ) : null}
      </ScrollView>
    </>
  );
}
