import type { PaymentMethod, StudentLedger, StudentPayment } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, FileText, Paperclip, Pencil, Plus, Printer, Trash2, Undo2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, RefreshControl, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminFees, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';
import { pickDocuments } from '@/lib/upload';
import { cn } from '@/lib/utils';

const METHODS: PaymentMethod[] = ['cash', 'online', 'bank_deposit', 'cheque'];
const METHOD_KEY: Record<string, string> = { cash: 'cash', online: 'online', bank_deposit: 'bank', cheque: 'cheque' };
type Edit = { id: string; amount: string; payment_date: string; comment: string; payment_method: PaymentMethod; is_lunch_payment: boolean; manual_receipt_number: string };

/**
 * One student's payments (web: /admin/fees/payments/[studentId]): totals, previous/next student,
 * original/expanded view, inline edit, attachments, refunds (net of earlier refunds), delete,
 * per-payment receipt and the all-payments statement.
 */
export default function StudentLedgerScreen() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`fees.payments.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { me } = useSession();
  const isAdmin = me.status === 'ready' && me.me.profile.role === 'admin';
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scopeId, campus } = useCampus();
  const { money } = useCurrency();
  const print = usePrintContext();
  const ledger = useApi(scopeId ? ['admin', 'ledger', scopeId, id] : null, ([, , sid, sId]) => adminFees.ledger(sid as string, sId as string));
  // Same list as the web's previous/next (first 500 students of the campus).
  const roster = useApi(scopeId ? ['admin', 'pay-students', scopeId, '', ''] : null, ([, , sid]) => adminFees.paymentStudents(sid as string, { limit: 500 }));
  const [view, setView] = useState<'original' | 'expanded'>('original');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<StudentPayment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const refresh = () => {
    ledger.mutate();
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && k[1].startsWith('fees-'));
  };

  if (ledger.isLoading) return <LoadingList rows={6} />;
  if (ledger.error || !ledger.data) return <ErrorState message={ledger.error?.message} onRetry={() => ledger.mutate()} />;
  const data: StudentLedger = ledger.data;
  const info = data.studentInfo;
  const name = info ? `${info.first_name} ${info.last_name}`.trim() : '';
  const payments = data.payments;
  const methodLabel = (m?: string | null) => (m ? p(METHOD_KEY[m] ?? m) : p('cash'));

  const list = roster.data ?? [];
  const idx = list.findIndex((s) => s.id === id);
  const prevId = idx > 0 ? list[idx - 1].id : null;
  const nextId = idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null;

  // A refund is a negative payment linked to the original; what is left to refund excludes earlier refunds.
  const refunded = new Map<string, number>();
  for (const x of payments) if (x.refund_of) refunded.set(x.refund_of, (refunded.get(x.refund_of) ?? 0) + Math.abs(Number(x.amount)));
  const refundable = (x: StudentPayment) => Math.max(0, Math.round((Number(x.amount) - (refunded.get(x.id) ?? 0)) * 100) / 100);

  async function receipt(pay: StudentPayment, mode: 'print' | 'pdf') {
    const rows: [string, string][] = [
      [p('th_paymentReceipt'), pay.receipt_number ?? pay.manual_receipt_number ?? '—'],
      [p('th_paymentDate'), formatDate(pay.payment_date)],
      [p('student'), `${name} (${info?.student_number ?? ''})`],
      [p('th_method'), methodLabel(pay.payment_method)],
      [p('amountPaid'), money(pay.amount)],
      [p('balance'), money(data.summary.balance)],
      ...(pay.comment ? ([[p('th_comment'), pay.comment]] as [string, string][]) : []),
      ...(pay.created_by_profile ? ([[p('receivedBy'), `${pay.created_by_profile.first_name} ${pay.created_by_profile.last_name}`]] as [string, string][]) : []),
    ];
    const body = `<div class="record-header"><span>${escapeHtml(p('paymentReceipts'))}</span><span class="rh-right">${escapeHtml(pay.receipt_number ?? '')}</span></div>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">${rows
        .map(([k, v]) => `<tr><td style="color:#555;padding:6px 8px 6px 0;width:40%;border-bottom:1px solid #eee">${escapeHtml(k)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(v)}</td></tr>`)
        .join('')}</table>
      <p style="margin-top:28px;color:#777;font-size:11px">${escapeHtml(p('computerGenerated'))}</p>`;
    await output(buildPrintHtml({ title: p('paymentReceipts'), pages: [body], school: print.school, layout: print.layout, withHeader: true, reportLabel: p('paymentReceipts') }), mode, `receipt-${pay.receipt_number ?? pay.id.slice(0, 8)}.pdf`);
  }

  /** Web "Print Receipt(s)": every payment on one page with the running balance. */
  async function statement(mode: 'print' | 'pdf') {
    let paid = 0;
    const rows = [...payments]
      .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
      .map((x) => {
        paid += x.amount;
        return `<tr><td>${escapeHtml(formatDate(x.payment_date))}</td><td>${escapeHtml(x.receipt_number || `RCP-${x.id.substring(0, 8).toUpperCase()}`)}</td><td>${escapeHtml(x.payment_method || '-')}</td><td>${escapeHtml(money(x.amount))}</td><td>${escapeHtml(money(data.summary.totalFees - paid))}</td><td>${escapeHtml(x.comment || '-')}</td></tr>`;
      })
      .join('');
    const cellCss = 'border:1px solid #333;padding:8px;text-align:start;font-size:13px';
    const body = `<div style="border:2px solid #333;padding:24px">
      <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:16px"><h1 style="font-size:24px;margin:0 0 4px">${escapeHtml(campus?.name ?? print.school?.name ?? '')}</h1><p style="color:#666;margin:0">${escapeHtml(p('feeChallan'))}</p></div>
      <table style="width:100%;margin-bottom:24px"><tr><td><p><strong>${escapeHtml(p('student'))}:</strong> ${escapeHtml(name || '-')}</p><p><strong>${escapeHtml(p('istudentlyId'))}:</strong> ${escapeHtml(info?.student_number || '-')}</p></td><td style="text-align:end"><p><strong>${escapeHtml(p('th_createdAt'))}:</strong> ${escapeHtml(formatDate(new Date().toISOString()))}</p></td></tr></table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tr>${[p('th_paymentDate'), p('th_receipt'), p('th_method'), p('th_amount'), p('th_balance'), p('th_comment')].map((h) => `<th style="${cellCss};background:#f0f0f0">${escapeHtml(h)}</th>`).join('')}</tr>${rows.replace(/<td>/g, `<td style="${cellCss}">`)}</table>
      <table style="width:100%;background:#f0f0f0;border:1px solid #ddd;margin-bottom:24px"><tr><td style="text-align:center;padding:24px"><p style="color:#666;font-size:14px">${escapeHtml(p('th_amount'))}</p><p style="font-size:28px;font-weight:bold;color:#16a34a">${escapeHtml(money(data.summary.totalPayments))}</p></td><td style="text-align:center;padding:24px"><p style="color:#666;font-size:14px">${escapeHtml(p('th_balance'))}</p><p style="font-size:28px;font-weight:bold;color:#16a34a">${escapeHtml(money(data.summary.balance))}</p></td></tr></table>
      <table style="width:100%;border-top:1px solid #333"><tr><td style="font-size:12px;color:#666;padding-top:16px">${escapeHtml(p('computerGenerated'))}</td><td style="text-align:end;padding-top:64px"><div style="display:inline-block;border-top:1px solid #333;width:200px;text-align:center;padding-top:4px">${escapeHtml(p('authorizedSignature'))}</div></td></tr></table></div>`;
    await output(buildPrintHtml({ title: p('paymentReceipts'), pages: [body], school: print.school, layout: print.layout, withHeader: false }), mode, `payments-${info?.student_number ?? id}.pdf`);
  }

  async function output(html: string, mode: 'print' | 'pdf', file: string) {
    try {
      if (mode === 'print') await printHtml(html);
      else await sharePdf(html, file);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    }
  }

  async function saveEdit() {
    if (!edit || !scopeId) return;
    const amount = parseFloat(edit.amount);
    if (!(amount > 0)) return toast.error(p('enterAtLeastOne'));
    setSavingEdit(true);
    const res = await adminFees.updatePayment(scopeId, edit.id, {
      amount,
      payment_date: new Date(edit.payment_date).toISOString(),
      comment: edit.comment || null,
      is_lunch_payment: edit.is_lunch_payment,
      payment_method: edit.payment_method,
      manual_receipt_number: edit.manual_receipt_number || null,
    });
    setSavingEdit(false);
    if (!res.success) return toast.error(res.error || p('saveFailed'));
    toast.success(p('paymentSaved'));
    setEdit(null);
    refresh();
  }

  async function attach(pay: StudentPayment) {
    if (!scopeId) return;
    const [file] = await pickDocuments({ multiple: false });
    if (!file) return;
    setUploadingFor(pay.id);
    const up = await media.uploadAttachment({ uri: file.uri, name: file.name, type: file.type }, scopeId);
    const url = up.success ? up.data?.url : undefined;
    const res = url ? await adminFees.updatePayment(scopeId, pay.id, { file_url: url }) : up;
    setUploadingFor(null);
    if (!res.success) return toast.error(res.error || p('uploadFailed'));
    toast.success(p('uploadSuccess'));
    refresh();
  }

  async function remove(pay: StudentPayment) {
    if (!scopeId) return;
    if (!(await confirm({ title: p('deleteConfirm'), body: money(pay.amount), destructive: true, confirmLabel: t('app.bl_delete') }))) return;
    const res = await adminFees.deletePayment(scopeId, pay.id);
    if (!res.success) return toast.error(res.error || p('deleteFailed'));
    toast.success(p('paymentDeleted'));
    refresh();
  }

  async function submitRefund() {
    if (!refunding || !scopeId) return;
    const amt = parseFloat(refundAmount);
    if (!(amt > 0) || amt > refundable(refunding)) return toast.error(p('refundInvalidAmount'));
    setRefundBusy(true);
    const res = await adminFees.refundPayment(scopeId, refunding.id, amt, refundReason.trim());
    setRefundBusy(false);
    if (!res.success) return toast.error(res.error || p('refundFailed'));
    toast.success(p('refundSuccess'));
    setRefunding(null);
    refresh();
  }

  const line = (label: string, value?: string | null) => (
    <View className="flex-row gap-2">
      <Text className="text-muted-foreground w-28 text-xs">{label}</Text>
      <Text className="flex-1 text-xs" selectable>
        {value || '-'}
      </Text>
    </View>
  );

  function paymentCard(pay: StudentPayment) {
    const isRefund = !!pay.refund_of;
    const done = refunded.get(pay.id) ?? 0;
    if (edit?.id === pay.id) {
      return (
        <Card key={pay.id} className="border-primary py-3">
          <CardContent className="gap-2 px-4">
            <Label>{p('th_mrn')}</Label>
            <Input value={edit.manual_receipt_number} onChangeText={(v) => setEdit({ ...edit, manual_receipt_number: v })} />
            <Label>{p('th_amount')}</Label>
            <Input value={edit.amount} onChangeText={(v) => setEdit({ ...edit, amount: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" />
            <Label>{p('paymentDate')}</Label>
            <DateField value={edit.payment_date} onChange={(v) => setEdit({ ...edit, payment_date: v ?? edit.payment_date })} />
            <Label>{p('th_comment')}</Label>
            <Input value={edit.comment} onChangeText={(v) => setEdit({ ...edit, comment: v })} />
            <Label>{p('th_method')}</Label>
            <Picker value={edit.payment_method} onChange={(v) => setEdit({ ...edit, payment_method: v as PaymentMethod })} options={METHODS.map((m) => ({ value: m, label: methodLabel(m) }))} />
            <View className="flex-row items-center justify-between">
              <Label>{p('th_lunchPayment')}</Label>
              <Switch checked={edit.is_lunch_payment} onCheckedChange={(v) => setEdit({ ...edit, is_lunch_payment: v })} />
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={() => setEdit(null)}>
                <Icon as={X} className="size-4" />
                <Text>{t('common.cancel')}</Text>
              </Button>
              <Button className="flex-1" onPress={saveEdit} disabled={savingEdit}>
                <Icon as={Check} className="text-primary-foreground size-4" />
                <Text>{p('codes_save')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card key={pay.id} className="py-3">
        <CardContent className="gap-1 px-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className={cn('font-semibold', isRefund && 'text-destructive')}>{money(pay.amount)}</Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {isRefund ? (
                <Badge variant="destructive">
                  <Text>{p('refundBadge')}</Text>
                </Badge>
              ) : null}
              {pay.is_lunch_payment ? (
                <Badge variant="outline">
                  <Text>{p('th_lunchPayment')}</Text>
                </Badge>
              ) : null}
            </View>
          </View>
          {!isRefund && done > 0 ? <Text className="text-destructive text-xs">{p('refundedNote', { amount: money(done) })}</Text> : null}
          {line(p('th_receipt'), pay.receipt_number)}
          {line(p('th_mrn'), pay.manual_receipt_number)}
          {line(p('paymentDate'), formatDate(pay.payment_date))}
          {line(p('th_method'), methodLabel(pay.payment_method))}
          {line(p('th_comment'), pay.comment)}
          {view === 'expanded' ? (
            <>
              {line(p('th_createdBy'), pay.created_by_profile ? `${pay.created_by_profile.first_name} ${pay.created_by_profile.last_name}` : null)}
              {line(p('th_createdAt'), formatDate(pay.created_at))}
            </>
          ) : null}
          <View className="flex-row items-center gap-2">
            <Text className="text-muted-foreground w-28 text-xs">{p('th_attachment')}</Text>
            {pay.file_url ? (
              <Pressable onPress={() => Linking.openURL(pay.file_url as string)} accessibilityRole="link" hitSlop={6}>
                <Text className="text-primary text-xs underline">{p('view')}</Text>
              </Pressable>
            ) : (
              <Text className="text-muted-foreground text-xs">-</Text>
            )}
            {isAdmin ? (
              uploadingFor === pay.id ? (
                <ActivityIndicator size="small" />
              ) : (
                <Pressable onPress={() => attach(pay)} accessibilityRole="button" accessibilityLabel={pay.file_url ? p('replaceFile') : p('attachFile')} hitSlop={8}>
                  <Icon as={Paperclip} className="text-muted-foreground size-4" />
                </Pressable>
              )
            ) : null}
          </View>
          <View className="flex-row flex-wrap items-center gap-4 pt-1">
            <Pressable hitSlop={8} onPress={() => receipt(pay, 'pdf')} accessibilityRole="button">
              <Text className="text-primary text-sm">{p('printReceipt')}</Text>
            </Pressable>
            {isAdmin ? (
              <Pressable
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.edit')}
                onPress={() =>
                  setEdit({
                    id: pay.id,
                    amount: String(pay.amount),
                    payment_date: pay.payment_date.slice(0, 10),
                    comment: pay.comment ?? '',
                    payment_method: (pay.payment_method ?? 'cash') as PaymentMethod,
                    is_lunch_payment: pay.is_lunch_payment,
                    manual_receipt_number: pay.manual_receipt_number ?? '',
                  })
                }>
                <Icon as={Pencil} className="text-muted-foreground size-4" />
              </Pressable>
            ) : null}
            {isAdmin && !isRefund && refundable(pay) > 0 ? (
              <Pressable
                hitSlop={8}
                accessibilityRole="button"
                onPress={() => {
                  setRefundAmount(String(refundable(pay)));
                  setRefundReason('');
                  setRefunding(pay);
                }}>
                <View className="flex-row items-center gap-1">
                  <Icon as={Undo2} className="text-muted-foreground size-4" />
                  <Text className="text-muted-foreground text-sm">{p('refund')}</Text>
                </View>
              </Pressable>
            ) : null}
            {isAdmin ? (
              <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={t('app.bl_delete')} onPress={() => remove(pay)}>
                <Icon as={Trash2} className="text-muted-foreground size-4" />
              </Pressable>
            ) : null}
          </View>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: name || p('title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/billing/record', params: { studentId: id } })} accessibilityLabel={p('addPayment')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={ledger.isValidating} onRefresh={refresh} />}>
        <View className="flex-row items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={!prevId} onPress={() => prevId && router.replace({ pathname: '/admin/billing/student/[id]', params: { id: prevId } })}>
            <Icon as={ChevronLeft} className="size-4 rtl:rotate-180" />
            <Text>{t('common.previous')}</Text>
          </Button>
          <Text className="text-muted-foreground flex-1 text-center text-sm" numberOfLines={1}>
            {`${name.toUpperCase()}${info ? ` · ${info.student_number}` : ''}`}
          </Text>
          <Button variant="outline" size="sm" disabled={!nextId} onPress={() => nextId && router.replace({ pathname: '/admin/billing/student/[id]', params: { id: nextId } })}>
            <Text>{t('common.next')}</Text>
            <Icon as={ChevronRight} className="size-4 rtl:rotate-180" />
          </Button>
        </View>

        <View className="flex-row gap-3">
          <StatCard icon={FileText} label={p('totalFees')} value={money(data.summary.totalFees)} />
          <StatCard icon={FileText} label={p('lessTotalPayments')} value={money(data.summary.totalPayments)} />
        </View>
        <StatCard icon={FileText} label={p('balance')} value={money(data.summary.balance)} tone={data.summary.balance > 0 ? 'warning' : undefined} />

        <View className="flex-row flex-wrap gap-2">
          <Button className="flex-1" onPress={() => router.push({ pathname: '/admin/billing/record', params: { studentId: id } })}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{p('addPayment')}</Text>
          </Button>
          <Button variant="outline" onPress={() => statement('print')} disabled={!payments.length || !print.ready}>
            <Icon as={Printer} className="size-4" />
            <Text>{`${p('printReceipt')}${payments.length > 1 ? 's' : ''}`}</Text>
          </Button>
          <Button variant="outline" onPress={() => statement('pdf')} disabled={!payments.length || !print.ready}>
            <Icon as={FileText} className="size-4" />
            <Text>PDF</Text>
          </Button>
        </View>
        <FilterChips<'original' | 'expanded'>
          value={view}
          onChange={setView}
          options={[
            { value: 'original', label: p('originalView') },
            { value: 'expanded', label: p('expandedView') },
          ]}
        />

        {payments.length === 0 ? <EmptyState title={p('noPayments')} /> : payments.map(paymentCard)}
      </ScrollView>

      <Dialog open={!!refunding} onOpenChange={(o) => !o && setRefunding(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{p('refundPayment')}</DialogTitle>
          </DialogHeader>
          <Label>{p('refundAmount')}</Label>
          <Input value={refundAmount} onChangeText={(v) => setRefundAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
          {refunding ? <Text className="text-muted-foreground text-xs">{p('refundMaxHint', { amount: money(refundable(refunding)) })}</Text> : null}
          <Label>{p('refundReason')}</Label>
          <Input value={refundReason} onChangeText={setRefundReason} />
          <DialogFooter>
            <Button variant="outline" onPress={() => setRefunding(null)} disabled={refundBusy}>
              <Text>{p('cancel')}</Text>
            </Button>
            <Button variant="destructive" disabled={refundBusy} onPress={submitRefund}>
              <Text>{p('refundConfirm')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
