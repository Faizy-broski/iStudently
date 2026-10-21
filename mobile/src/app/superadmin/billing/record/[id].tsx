import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, CalendarClock, CalendarDays, CheckCircle2, CreditCard, FileDown, FileText, Hash, Pencil, Printer, Repeat, StickyNote, Tag, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { useToast } from '@/components/app/toast';
import { ErrorState, LoadingList } from '@/components/app/states';
import { HeroCard } from '@/components/app/layout';
import { InfoRow, Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PAY_TONE, useRefreshBilling } from '@/features/superadmin/billing';
import { buildInvoiceHtml } from '@/features/superadmin/invoice-html';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/format';
import { printHtml, sharePdf } from '@/lib/print';
import { useAction } from '@/lib/use-action';

export default function BillingRecordDetail() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const toast = useToast();
  const [making, setMaking] = useState(false);
  const refreshAll = useRefreshBilling();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: r, error, isLoading, mutate } = useApi(['platform', 'record', id], () => platform.getRecord(id));

  const markPaid = useAction(platform.markRecordPaid, {
    success: t('app.bl_marked_paid'),
    onSuccess: () => {
      mutate();
      refreshAll();
    },
  });
  const remove = useAction(platform.deleteRecord, { success: t('app.bl_deleted') });

  if (isLoading && !r) return <LoadingList rows={4} />;
  if (error && !r) return <ErrorState message={error.message} offline={error.offline} onRetry={() => mutate()} />;
  if (!r) return null;

  // Web: "Generate invoice" opens a print window; here: share as PDF or send to the system print dialog.
  async function invoice(mode: 'share' | 'print') {
    if (!r) return;
    setMaking(true);
    try {
      const settings = await platform.getPlatformSettings();
      const html = buildInvoiceHtml(r, t, settings.success ? settings.data?.support_email : null);
      if (mode === 'share') await sharePdf(html, `invoice-${r.invoice_number}.pdf`);
      else await printHtml(html);
    } catch {
      toast.error(t('app.bl_invoice_failed'));
    } finally {
      setMaking(false);
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: t('app.bl_delete_invoice_title', { number: r!.invoice_number }),
      body: t('app.bl_delete_invoice_body'),
      destructive: true,
      confirmLabel: t('app.bl_delete'),
    });
    if (!ok) return;
    if ((await remove.run(r!.id)).ok) {
      refreshAll();
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: r.invoice_number }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <HeroCard>
          <View className="flex-row items-start justify-between gap-2">
            <Text numberOfLines={2} className="flex-1 text-lg font-semibold text-white">
              {r.school_name ?? '—'}
            </Text>
            <StatusChip label={t(`app.sa_pay_status_${r.effective_status ?? r.payment_status}`)} tone={PAY_TONE[r.effective_status ?? r.payment_status]} />
          </View>
          <Text className="text-3xl font-bold text-white">{formatMoney(r.amount, r.currency)}</Text>
          <Text className="text-xs text-white/80">{r.invoice_number}</Text>
        </HeroCard>

        <Panel>
          <InfoRow icon={FileText} label={t('app.bl_invoice')} value={r.invoice_number} />
          <InfoRow icon={Tag} label={t('app.bl_plan')} value={r.subscription_plan} />
          <InfoRow icon={Repeat} label={t('app.bl_cycle')} value={t(`app.bl_cycle_${r.billing_cycle}`)} />
          <InfoRow icon={CalendarDays} label={t('app.bl_start_date')} value={formatDate(r.start_date)} />
          <InfoRow icon={CalendarClock} label={t('app.bl_due_date')} value={formatDate(r.due_date)} />
          <InfoRow icon={CalendarCheck} label={t('app.bl_payment_date')} value={r.payment_date ? formatDate(r.payment_date) : null} />
          <InfoRow icon={CreditCard} label={t('app.bl_payment_method')} value={r.payment_method} />
          <InfoRow icon={Hash} label={t('app.bl_transaction_id')} value={r.transaction_id} />
          <InfoRow icon={StickyNote} label={t('app.bl_notes')} value={r.notes} last />
        </Panel>

        {r.payment_status !== 'paid' ? (
          <Button onPress={() => markPaid.run(r.id)} disabled={markPaid.running}>
            <Icon as={CheckCircle2} className="text-primary-foreground size-4" />
            <Text>{t('app.bl_mark_paid')}</Text>
          </Button>
        ) : null}
        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={() => invoice('share')} disabled={making}>
            <Icon as={FileDown} className="size-4" />
            <Text>{t('app.bl_invoice_pdf')}</Text>
          </Button>
          <Button variant="outline" className="flex-1" onPress={() => invoice('print')} disabled={making}>
            <Icon as={Printer} className="size-4" />
            <Text>{t('app.bl_invoice_print')}</Text>
          </Button>
        </View>
        <Button variant="outline" onPress={() => router.push({ pathname: '/superadmin/billing/record-form', params: { id: r.id } })}>
          <Icon as={Pencil} className="size-4" />
          <Text>{t('app.bl_edit')}</Text>
        </Button>
        <Button variant="ghost" className="bg-destructive-soft rounded-full" onPress={onDelete}>
          <Icon as={Trash2} className="text-destructive size-4" />
          <Text className="text-destructive">{t('app.bl_delete')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
