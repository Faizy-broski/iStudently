import type { StudentFee, StudentWithPayments } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FileDown, Printer, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { colors } from '@/lib/colors';
import { DateField } from '@/components/app/date-field';
import { MultiSelect } from '@/components/app/multi-select';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';

type Mode = 'invoices' | 'receipts';
type Payment = StudentWithPayments['payments'][number] & { student: StudentWithPayments };
type Group = { student: StudentWithPayments; payments: Payment[]; totalPaid: number; balance: number };

const CSS = `
.doc{border:2px solid ${colors.printText};padding:24px}
.hd{text-align:center;border-bottom:2px solid ${colors.printText};padding-bottom:14px;margin-bottom:14px}
.hd .dt{font-size:12px;color:${colors.printMuted};margin:0 0 8px}
.hd img{height:64px;display:block;margin:0 auto 8px}
.hd .ini{height:64px;width:64px;line-height:64px;margin:0 auto 8px;background:${colors.brand};color:${colors.white};border-radius:12px;font-size:28px;font-weight:700}
.hd h1{font-size:22px;margin:0 0 4px}
.hd .lb{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${colors.printMuted};margin:0}
.grid{width:100%;margin-bottom:18px}.grid td{vertical-align:top}.grid p{margin:2px 0}
table.t{width:100%;border-collapse:collapse;margin-bottom:18px}table.t th,table.t td{border:1px solid ${colors.printText};padding:7px;text-align:start;font-size:13px}table.t th{background:${colors.printSurface}}
.num{text-align:end !important}.b{font-weight:bold}.red{color:${colors.destructive}}
.box{width:100%;background:${colors.printSurface};border:1px solid ${colors.printBorder};margin-bottom:18px}.box td{text-align:center;padding:16px}.box .l{color:${colors.printMuted};font-size:13px}.box .a{font-size:24px;font-weight:bold;color:${colors.success}}.box .a.due{color:${colors.destructive}}
.ft{border-top:1px solid ${colors.printText};padding-top:12px;font-size:12px;color:${colors.printMuted}}
.sig{display:inline-block;border-top:1px solid ${colors.printText};width:200px;text-align:center;padding-top:4px;margin-top:40px}
.mb h3{display:flex;justify-content:space-between;font-size:14px;margin:12px 0 6px}`;

/**
 * Invoices (one per selected fee) or receipts (one per student, or one per family) as print / PDF,
 * with grade, section, search, date and amount filters and per-row selection (web: print-invoices, print-receipts).
 */
export default function PrintFeeDocuments() {
  const { t } = useTranslation();
  const toast = useToast();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = params.mode === 'receipts' ? 'receipts' : 'invoices';
  const inv = (k: string, o?: Record<string, unknown>) => t(`fees.printInvoices.${k}`, o);
  const rec = (k: string, o?: Record<string, unknown>) => t(`fees.printReceipts.${k}`, o);
  const pay = (k: string, o?: Record<string, unknown>) => t(`fees.payments.${k}`, o);
  const { scopeId } = useCampus();
  const key = scopeId ?? 'none';
  const { money } = useCurrency();
  const print = usePrintContext();
  const grades = useApi(scopeId ? ['admin', 'grades', key] : null, ([, , sid]) => adminAcademics.grades(sid as string));
  const allSections = useApi(scopeId ? ['admin', 'sections', key, 'all'] : null, ([, , sid]) => adminAcademics.sections(sid as string));
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [family, setFamily] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  const g = gradeIds.join(',');
  const sec = sectionIds.join(',');
  const sections = (allSections.data ?? []).filter((x) => gradeIds.length === 0 || gradeIds.includes(x.grade_level_id));

  // Web: up to 500 fee records for the grades/sections, everything else filtered on the device.
  const fees = useApi(mode === 'invoices' && scopeId ? ['admin', 'print-fees', key, g, sec] : null, ([, , sid, gg, ss]) =>
    adminFees.feesByGrade(sid as string, { grade_level_id: gg ? (gg as string).split(',') : undefined, section_id: ss ? (ss as string).split(',') : undefined, limit: 500 }),
  );
  const students = useApi(mode === 'receipts' && scopeId ? ['admin', 'print-receipts', key, g, sec] : null, ([, , sid, gg, ss]) =>
    adminFees.paymentsWithStudents(sid as string, gg ? (gg as string).split(',') : undefined, ss ? (ss as string).split(',') : undefined),
  );

  const q = search.trim().toLowerCase();
  const nameOf = (p?: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}` : '');
  const invoices = (fees.data ?? []).filter((f) => {
    const n = nameOf(f.students?.profiles).toLowerCase();
    if (q && !n.includes(q) && !(f.students?.student_number ?? '').toLowerCase().includes(q)) return false;
    if (from && f.due_date < from) return false;
    if (to && f.due_date > to) return false;
    const bal = f.balance || 0;
    if (min && bal < parseFloat(min)) return false;
    if (max && bal > parseFloat(max)) return false;
    return true;
  });
  const payments: Payment[] = (students.data ?? []).flatMap((s) => s.payments.map((p) => ({ ...p, student: s })));
  const receipts = payments.filter((p) => {
    const n = nameOf(p.student.profiles).toLowerCase();
    if (q && !n.includes(q) && !(p.student.student_number ?? '').toLowerCase().includes(q) && !(p.receipt_number ?? '').toLowerCase().includes(q)) return false;
    if (from && p.payment_date < from) return false;
    if (to && p.payment_date > to) return false;
    if (min && (p.amount || 0) < parseFloat(min)) return false;
    if (max && (p.amount || 0) > parseFloat(max)) return false;
    return true;
  });
  const rows = mode === 'invoices' ? invoices.map((f) => f.id) : receipts.map((p) => p.id);
  const allOn = rows.length > 0 && rows.every((id) => selected.has(id));
  const loading = mode === 'invoices' ? fees.isLoading : students.isLoading;

  function reset() {
    setGradeIds([]);
    setSectionIds([]);
    setSearch('');
    setFrom('');
    setTo('');
    setMin('');
    setMax('');
    setSelected(new Set());
  }
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const school = print.school;
  const today = formatDate(new Date().toISOString());
  const header = (label: string) =>
    `<div class="hd"><p class="dt">${escapeHtml(today)}</p>${school?.logo_url ? `<img src="${escapeHtml(school.logo_url)}"/>` : `<div class="ini">${escapeHtml((school?.name || 'S').charAt(0).toUpperCase())}</div>`}<h1>${escapeHtml(school?.name ?? '')}</h1><p class="lb">${escapeHtml(label)}</p></div>`;

  function invoicePage(f: StudentFee) {
    const items = f.fee_breakdown?.length ? f.fee_breakdown.map((b) => [b.category_name, b.amount] as [string, number]) : [[t('app.fr_base_fee'), f.final_amount] as [string, number]];
    const extras: [string, number][] = [
      [t('app.fr_sibling_discount'), -(f.sibling_discount || 0)],
      [t('app.fr_custom_discount'), -(f.custom_discount || 0)],
      [t('app.fr_late_fee'), f.late_fee_applied || 0],
    ].filter(([, v]) => v) as [string, number][];
    return `<div class="doc">${header(inv('invoiceVoucher'))}
      <table class="grid"><tr><td><p><b>${escapeHtml(pay('student'))}:</b> ${escapeHtml(nameOf(f.students?.profiles))}</p><p><b>${escapeHtml(pay('istudentlyId'))}:</b> ${escapeHtml(f.students?.student_number || '-')}</p><p><b>${escapeHtml(t('common.grade_level'))}:</b> ${escapeHtml(f.students?.grade_levels?.name || '-')}</p></td>
      <td style="text-align:end"><p><b>${escapeHtml(inv('invoiceNo'))}:</b> INV-${escapeHtml(f.id.substring(0, 8).toUpperCase())}</p><p><b>${escapeHtml(inv('th_feeMonth'))}:</b> ${escapeHtml(f.fee_month || '-')}</p><p><b>${escapeHtml(inv('th_dueDate'))}:</b> ${escapeHtml(f.due_date ? formatDate(f.due_date) : '-')}</p></td></tr></table>
      <table class="t"><tr><th>${escapeHtml(inv('description'))}</th><th class="num">${escapeHtml(pay('th_amount'))}</th></tr>
      ${[...items, ...extras].map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td class="num">${escapeHtml(money(v))}</td></tr>`).join('')}
      <tr class="b"><td>${escapeHtml(inv('totalAmount'))}</td><td class="num">${escapeHtml(money(f.final_amount))}</td></tr>
      <tr><td>${escapeHtml(inv('amountPaid'))}</td><td class="num">${escapeHtml(money(f.amount_paid))}</td></tr>
      <tr class="b red"><td>${escapeHtml(inv('balanceDue'))}</td><td class="num">${escapeHtml(money(f.balance))}</td></tr></table>
      <div class="ft" style="text-align:center"><p>${escapeHtml(inv('pleasePayBy'))}</p><p>${escapeHtml(inv('generatedOn'))}: ${escapeHtml(today)}</p></div></div>`;
  }

  const paymentsTable = (list: Payment[]) =>
    `<table class="t"><tr>${[rec('th_paymentDate'), rec('th_receipt'), rec('th_mrn'), rec('th_method'), rec('th_comment'), rec('amountPaid')].map((h, i) => `<th${i === 5 ? ' class="num"' : ''}>${escapeHtml(h)}</th>`).join('')}</tr>
    ${list.map((p) => `<tr><td>${escapeHtml(formatDate(p.payment_date))}</td><td>${escapeHtml(p.receipt_number || `RCP-${p.id.substring(0, 8).toUpperCase()}`)}</td><td>${escapeHtml(p.manual_receipt_number || '-')}</td><td>${escapeHtml(p.payment_method || pay('cash'))}</td><td>${escapeHtml(p.comment || '-')}</td><td class="num">${escapeHtml(money(p.amount))}</td></tr>`).join('')}
    <tr class="b"><td colspan="5">${escapeHtml(rec('totalPaid'))}</td><td class="num">${escapeHtml(money(list.reduce((s, p) => s + p.amount, 0)))}</td></tr></table>`;
  const footer = `<table class="ft" style="width:100%"><tr><td>${escapeHtml(rec('generatedOn'))}: ${escapeHtml(today)}</td><td style="text-align:end"><div class="sig">${escapeHtml(rec('authorizedSignature'))}</div></td></tr></table>`;

  const studentPage = (gr: Group) =>
    `<div class="doc">${header(rec('receiptTitle'))}
      <table class="grid"><tr><td><p><b>${escapeHtml(rec('student'))}:</b> ${escapeHtml(nameOf(gr.student.profiles))}</p><p><b>ID:</b> ${escapeHtml(gr.student.student_number || '-')}</p><p><b>${escapeHtml(rec('th_gradeLevel'))}:</b> ${escapeHtml(gr.student.grade_levels?.name || '-')}</p></td></tr></table>
      ${paymentsTable(gr.payments)}
      <table class="box"><tr><td><div class="l">${escapeHtml(rec('totalPaid'))}</div><div class="a">${escapeHtml(money(gr.totalPaid))}</div></td><td><div class="l">${escapeHtml(rec('remainingBalance'))}</div><div class="a${gr.balance > 0 ? ' due' : ''}">${escapeHtml(money(gr.balance))}</div></td></tr></table>${footer}</div>`;

  function receiptPages() {
    const chosen = receipts.filter((p) => selected.has(p.id));
    const groups = new Map<string, Group>();
    for (const p of chosen) {
      const gr = groups.get(p.student.id) ?? { student: p.student, payments: [], totalPaid: 0, balance: p.student.balance };
      gr.payments.push(p);
      gr.totalPaid += p.amount;
      groups.set(p.student.id, gr);
    }
    const studentGroups = [...groups.values()];
    if (!family) return studentGroups.map(studentPage);
    // Family receipts include every sibling on the loaded list so the family total is complete (as on the web).
    const famOf = new Map<string, { id: string; name: string }>();
    for (const s of students.data ?? []) {
      const link = s.parent_student_links?.[0];
      if (link?.parents) famOf.set(s.id, { id: link.parent_id, name: nameOf(link.parents.profiles) || rec('title') });
    }
    const families = new Map<string, { name: string; ids: Set<string> }>();
    for (const gr of studentGroups) {
      const f = famOf.get(gr.student.id);
      if (!f) continue;
      const entry = families.get(f.id) ?? { name: f.name, ids: new Set<string>() };
      entry.ids.add(gr.student.id);
      families.set(f.id, entry);
    }
    for (const s of students.data ?? []) {
      const f = famOf.get(s.id);
      if (f && families.has(f.id)) families.get(f.id)!.ids.add(s.id);
    }
    const familyPages = [...families.values()].map((fam) => {
      const members = [...fam.ids].map((sid) => groups.get(sid) ?? { student: (students.data ?? []).find((s) => s.id === sid)!, payments: [], totalPaid: 0, balance: (students.data ?? []).find((s) => s.id === sid)?.balance ?? 0 });
      const total = members.reduce((s, m) => s + m.balance, 0);
      return `<div class="doc">${header(rec('familyReceiptLabel'))}<p style="text-align:center;font-weight:600;margin-bottom:12px">${escapeHtml(pay('familyOf', { name: fam.name }))}</p>
        ${members
          .map(
            (m) =>
              `<div class="mb"><h3><span>${escapeHtml(`${nameOf(m.student.profiles)} (${m.student.student_number || '-'}) — ${m.student.grade_levels?.name || '-'}`)}</span><span class="${m.balance > 0 ? 'red' : ''}">${escapeHtml(rec('remainingBalance'))}: ${escapeHtml(money(m.balance))}</span></h3>${m.payments.length ? paymentsTable(m.payments) : `<p style="font-style:italic;color:${colors.printMuted};font-size:13px">${escapeHtml(rec('noPayments'))}</p>`}</div>`,
          )
          .join('')}
        <table class="box"><tr><td><div class="l">${escapeHtml(rec('familyTotalBalance'))}</div><div class="a${total > 0 ? ' due' : ''}">${escapeHtml(money(total))}</div></td></tr></table>${footer}</div>`;
    });
    return [...familyPages, ...studentGroups.filter((gr) => !famOf.has(gr.student.id)).map(studentPage)];
  }

  async function run(kind: 'print' | 'pdf') {
    if (selected.size === 0) return toast.error(mode === 'invoices' ? inv('noFees') : rec('noPayments'));
    setBusy(kind);
    try {
      const pages = mode === 'invoices' ? invoices.filter((f) => selected.has(f.id)).map(invoicePage) : receiptPages();
      const title = mode === 'invoices' ? inv('title') : rec('title');
      const html = buildPrintHtml({ title, pages: pages.map((p) => `<style>${CSS}</style>${p}`), school: print.school, layout: print.layout, withHeader: false });
      if (kind === 'print') await printHtml(html);
      else await sharePdf(html, `${mode}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(null);
    }
  }

  const head = (
    <View className="gap-3 p-4">
      <Text variant="muted">{mode === 'invoices' ? inv('subtitle') : rec('subtitle')}</Text>
      <Card className="gap-3 py-4">
        <CardHeader className="flex-row items-center justify-between px-4">
          <CardTitle>{mode === 'invoices' ? inv('filterInvoices') : rec('filterPayments')}</CardTitle>
          <Button variant="ghost" size="sm" onPress={reset}>
            <Icon as={RefreshCw} className="size-4" />
            <Text>{inv('reset')}</Text>
          </Button>
        </CardHeader>
        <CardContent className="gap-2 px-4">
          <Label>{t('fees.balances.th_gradeLevel')}</Label>
          <MultiSelect
            options={(grades.data ?? []).map((x) => ({ id: x.id, label: x.name }))}
            value={gradeIds}
            onChange={(ids) => {
              setGradeIds(ids);
              const visible = new Set((allSections.data ?? []).filter((x) => ids.length === 0 || ids.includes(x.grade_level_id)).map((x) => x.id));
              setSectionIds((prev) => prev.filter((id) => visible.has(id)));
              setSelected(new Set());
            }}
            placeholder={inv('allGrades')}
          />
          <Label>{t('common.section')}</Label>
          <MultiSelect
            options={sections.map((x) => ({ id: x.id, label: x.name }))}
            value={sectionIds}
            onChange={(ids) => {
              setSectionIds(ids);
              setSelected(new Set());
            }}
            placeholder={inv('allSections')}
            emptyMessage={gradeIds.length ? inv('allSections') : inv('selectGradeFirst')}
          />
          <Label>{inv('searchStudent')}</Label>
          <SearchBar value={search} onChangeText={setSearch} placeholder={mode === 'invoices' ? inv('searchPlaceholder') : rec('searchPlaceholder')} />
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Label>{mode === 'invoices' ? inv('dueDateFrom') : rec('paymentDateFrom')}</Label>
              <DateField value={from || null} onChange={(v) => setFrom(v ?? '')} clearable />
            </View>
            <View className="flex-1 gap-1">
              <Label>{mode === 'invoices' ? inv('dueDateTo') : rec('paymentDateTo')}</Label>
              <DateField value={to || null} onChange={(v) => setTo(v ?? '')} clearable />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Label>{mode === 'invoices' ? inv('minBalance') : rec('minAmount')}</Label>
              <Input value={min} onChangeText={(v) => setMin(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
            </View>
            <View className="flex-1 gap-1">
              <Label>{mode === 'invoices' ? inv('maxBalance') : rec('maxAmount')}</Label>
              <Input value={max} onChangeText={(v) => setMax(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
            </View>
          </View>
          {mode === 'receipts' ? (
            <View className="flex-row items-center justify-between pt-1">
              <Label className="flex-1">{rec('combineByFamily')}</Label>
              <Switch checked={family} onCheckedChange={setFamily} />
            </View>
          ) : null}
        </CardContent>
      </Card>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => setSelected(allOn ? new Set() : new Set(rows))} accessibilityRole="checkbox" accessibilityState={{ checked: allOn }} className="flex-row items-center gap-2">
          <Checkbox checked={allOn} onCheckedChange={() => setSelected(allOn ? new Set() : new Set(rows))} />
          <Text className="text-sm">{`${t('fees.generate.selectAll')} (${selected.size}/${rows.length})`}</Text>
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={!!busy || loading || !print.ready || selected.size === 0}>
          <Icon as={FileDown} className="size-4" />
          <Text>{busy === 'pdf' ? t('app.ar_running') : inv('downloadPdf')}</Text>
        </Button>
        <Button className="flex-1" onPress={() => run('print')} disabled={!!busy || loading || !print.ready || selected.size === 0}>
          <Icon as={Printer} className="text-primary-foreground size-4" />
          <Text>{t('school.students.print_info.print')}</Text>
        </Button>
      </View>
    </View>
  );

  const empty = loading ? <LoadingList rows={5} /> : <EmptyState title={mode === 'invoices' ? inv('noFees') : rec('noPayments')} />;

  return (
    <>
      <Stack.Screen options={{ title: mode === 'invoices' ? inv('title') : rec('title') }} />
      {mode === 'invoices' ? (
        <FlatList
          className="bg-background flex-1"
          data={loading ? [] : invoices}
          keyExtractor={(f) => f.id}
          ListHeaderComponent={head}
          ListEmptyComponent={empty}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: f }) => (
            <Pressable onPress={() => toggle(f.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(f.id) }} className="active:bg-muted border-border flex-row items-center gap-3 border-b px-4 py-3">
              <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} />
              <View className="flex-1">
                <Text className="text-sm font-semibold">{nameOf(f.students?.profiles)}</Text>
                <Text className="text-muted-foreground text-xs">
                  {[f.students?.student_number, f.students?.grade_levels?.name, f.fee_month, f.due_date ? formatDate(f.due_date) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text className={f.balance > 0 ? 'font-semibold text-destructive ' : 'font-semibold'}>{money(f.balance)}</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          className="bg-background flex-1"
          data={loading ? [] : receipts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={head}
          ListEmptyComponent={empty}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: p }) => (
            <Pressable onPress={() => toggle(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(p.id) }} className="active:bg-muted border-border flex-row items-center gap-3 border-b px-4 py-3">
              <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
              <View className="flex-1">
                <Text className="text-sm font-semibold">{nameOf(p.student.profiles)}</Text>
                <Text className="text-muted-foreground text-xs">
                  {[p.student.student_number, p.student.grade_levels?.name, formatDate(p.payment_date), p.receipt_number, p.manual_receipt_number, p.payment_method || pay('cash'), p.comment].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text className="font-semibold text-success ">{money(p.amount)}</Text>
            </Pressable>
          )}
        />
      )}
    </>
  );
}
