import type { DisciplineReferral } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Printer, RefreshCcw, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { DateField, formatYmd, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow, useAttendanceScope } from '@/features/admin/attendance';
import { logValue, referralPersonName } from '@/features/admin/discipline';
import { usePrintContext } from '@/features/admin/print-context';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, sharePdf } from '@/lib/print';

/** Discipline log grouped by person, with column choice and PDF (web: /admin/discipline/reports/log). */
export default function DisciplineLog() {
  const { t, i18n } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`discipline.${k}`, o);
  const toast = useToast();
  const print = usePrintContext();
  const { schoolId, campusId } = useAttendanceScope();
  const [reporter, setReporter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayYmd);
  const [search, setSearch] = useState('');
  const [include, setInclude] = useState<Record<string, boolean>>({ entry_date: true, reporter: true });
  const [referrals, setReferrals] = useState<DisciplineReferral[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const fieldsRes = useApi(schoolId ? ['admin', 'discipline-all-fields', schoolId] : null, () => adminDiscipline.getAllFields(schoolId));
  const fields = fieldsRes.data ?? [];
  useEffect(() => {
    if (!fieldsRes.data) return;
    setInclude({ entry_date: true, reporter: true, ...Object.fromEntries(fieldsRes.data.map((f) => [f.id, f.field_type === 'textarea'])) });
  }, [fieldsRes.data]);

  async function run() {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await adminDiscipline.getReportReferrals({ school_id: schoolId, campus_id: campusId, start_date: from || undefined, end_date: to || undefined });
      if (!res.success) return toast.error(res.error || d('errors.loadReferrals'));
      setReferrals(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setReporter('all');
    setFrom('');
    setTo(todayYmd());
    setSearch('');
    setReferrals(null);
  }

  const reporters = [...new Map((referrals ?? []).filter((r) => r.reporter).map((r) => [r.reporter!.id, r.reporter!.full_name])).entries()];
  const q = search.trim().toLowerCase();
  const filtered = (referrals ?? []).filter((r) => {
    if (reporter !== 'all' && r.reporter?.id !== reporter) return false;
    if (q && !referralPersonName(r).toLowerCase().includes(q) && !(r.students?.student_number ?? '').includes(search.trim())) return false;
    return true;
  });
  const groups = new Map<string, DisciplineReferral[]>();
  for (const r of filtered) {
    const k = r.student_id ?? r.staff_id ?? r.id;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const list of groups.values()) list.sort((a, b) => b.incident_date.localeCompare(a.incident_date));
  const active = fields.filter((f) => include[f.id]);
  const columns = [...(include.entry_date ? [d('incidentDate')] : []), ...(include.reporter ? [d('reporter')] : []), ...active.map((f) => f.name)];
  const cells = (r: DisciplineReferral) => [
    ...(include.entry_date ? [formatYmd(r.incident_date, i18n.language)] : []),
    ...(include.reporter ? [r.reporter?.full_name ?? '-'] : []),
    ...active.map((f) => logValue(r.field_values?.[f.id])),
  ];

  async function sharePrint() {
    setBusy(true);
    try {
      const range = from && to ? `${from} ${d('to')} ${to}` : to ? `${d('upTo')} ${to}` : '';
      const th = columns.map((c) => `<th style="text-align:start;padding:5px;border-bottom:2px solid #111;font-size:11px">${escapeHtml(c)}</th>`).join('');
      const body =
        `<h2 style="margin:0">${escapeHtml(d('title'))}</h2><p style="color:#666;margin:2px 0 12px">${escapeHtml(range)}</p>` +
        [...groups.values()]
          .map((list) => {
            const first = list[0];
            const head = `<h3 style="margin:14px 0 4px">${escapeHtml(referralPersonName(first))} ${first.students?.student_number ? `#${escapeHtml(first.students.student_number)}` : ''} ${first.students?.grade_level ? `· ${escapeHtml(first.students.grade_level)}` : ''} <span style="font-weight:400;color:#666">(${escapeHtml(d('referralsCount', { count: list.length }))})</span></h3>`;
            const rows = list.map((r) => `<tr>${cells(r).map((c) => `<td style="padding:5px;border-bottom:1px solid #eee;font-size:11px">${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
            return `${head}<table style="width:100%;border-collapse:collapse"><tr>${th}</tr>${rows}</table>`;
          })
          .join('') +
        `<p style="margin-top:14px;color:#666">${escapeHtml(d('referralsAcrossStudents', { referrals: filtered.length, students: groups.size }))}</p>`;
      await sharePdf(buildPrintHtml({ title: d('title'), pages: [body], school: print.school, layout: print.layout, withHeader: true, reportLabel: d('title') }), 'discipline-log.pdf');
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm uppercase">{d('filters')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="gap-1.5">
              <Label>{d('reporter')}</Label>
              <Picker value={reporter} onChange={setReporter} placeholder={d('notSpecified')} options={[{ value: 'all', label: d('allReporters') }, ...reporters.map(([id, name]) => ({ value: id, label: name }))]} />
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={d('incidentDateMin')} value={from} onChange={setFrom} clearable />
              <DateField className="flex-1" label={d('incidentDateMax')} value={to} onChange={setTo} clearable />
            </View>
            <View className="gap-1.5">
              <Label>{d('studentSearch')}</Label>
              <SearchBar value={search} onChangeText={setSearch} placeholder={d('search_placeholder')} />
            </View>
            <View className="gap-1">
              <Text className="text-muted-foreground text-xs font-semibold uppercase">{d('email.includeInLog')}</Text>
              <View className="flex-row flex-wrap gap-x-4">
                <CheckRow checked={!!include.entry_date} onPress={() => setInclude((x) => ({ ...x, entry_date: !x.entry_date }))} label={d('entryDate')} />
                <CheckRow checked={!!include.reporter} onPress={() => setInclude((x) => ({ ...x, reporter: !x.reporter }))} label={d('reporter')} />
                {fields.map((f) => (
                  <CheckRow key={f.id} checked={!!include[f.id]} onPress={() => setInclude((x) => ({ ...x, [f.id]: !x[f.id] }))} label={f.name} />
                ))}
              </View>
            </View>
            <View className="flex-row gap-2">
              <Button className="flex-1" onPress={run} disabled={loading}>
                <Icon as={Search} className="text-primary-foreground size-4" />
                <Text>{d('search')}</Text>
              </Button>
              <Button variant="outline" onPress={reset}>
                <Icon as={RefreshCcw} className="text-foreground size-4" />
                <Text>{d('reset')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {referrals ? (
          groups.size === 0 ? (
            <Text variant="muted" className="py-8 text-center">{d('noStudentsMatchingFilters')}</Text>
          ) : (
            <>
              <Button variant="outline" onPress={sharePrint} disabled={busy || !print.ready}>
                <Icon as={Printer} className="text-foreground size-4" />
                <Text>{d('printLog')}</Text>
              </Button>
              {[...groups.entries()].map(([key, list]) => {
                const first = list[0];
                return (
                  <Card key={key}>
                    <CardHeader className="gap-1.5">
                      <CardTitle>{referralPersonName(first)}</CardTitle>
                      <View className="flex-row flex-wrap items-center gap-2">
                        {first.students?.student_number ? (
                          <Badge variant="secondary">
                            <Text>{`#${first.students.student_number}`}</Text>
                          </Badge>
                        ) : null}
                        {first.students?.grade_level ? (
                          <Badge variant="outline">
                            <Text>{first.students.grade_level}</Text>
                          </Badge>
                        ) : null}
                        <Text className="text-muted-foreground text-sm">{d('referralsCount', { count: list.length })}</Text>
                      </View>
                    </CardHeader>
                    <CardContent className="gap-2">
                      {list.map((r) => (
                        <View key={r.id} className="border-border gap-0.5 border-t pt-2">
                          {cells(r).map((c, i) => (
                            <Text key={i} className="text-sm">
                              <Text className="text-muted-foreground text-sm">{`${columns[i]}: `}</Text>
                              {c}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
              <Text variant="muted" className="text-center">{d('referralsAcrossStudents', { referrals: filtered.length, students: groups.size })}</Text>
            </>
          )
        ) : null}
      </ScrollView>
    </>
  );
}
