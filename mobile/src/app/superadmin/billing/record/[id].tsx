import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, FileDown, Pencil, Printer, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { useToast } from '@/components/app/toast';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PAY_VARIANT, useRefreshBilling } from '@/features/superadmin/billing';
import { buildInvoiceHtml } from '@/features/superadmin/invoice-html';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/format';
import { printHtml, sharePdf } from '@/lib/print';
import { useAction } from '@/lib/use-action';

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between gap-4 py-2">
      <Text className="text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-end font-medium" selectable>
        {value}
      </Text>
    </View>
  );
}

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
        <Card className="py-4">
          <CardContent className="gap-1 px-4">
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="large" numberOfLines={2} className="flex-1">
                {r.school_name ?? '—'}
              </Text>
              <Badge variant={PAY_VARIANT[r.effective_status ?? r.payment_status]}>
                <Text>{t(`app.sa_pay_status_${r.effective_status ?? r.payment_status}`)}</Text>
              </Badge>
            </View>
            <Text className="text-2xl font-bold">{formatMoney(r.amount, r.currency)}</Text>
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardContent className="px-4">
            <Row label={t('app.bl_invoice')} value={r.invoice_number} />
            <Row label={t('app.bl_plan')} value={r.subscription_plan} />
            <Row label={t('app.bl_cycle')} value={t(`app.bl_cycle_${r.billing_cycle}`)} />
            <Row label={t('app.bl_start_date')} value={formatDate(r.start_date)} />
            <Row label={t('app.bl_due_date')} value={formatDate(r.due_date)} />
            <Row label={t('app.bl_payment_date')} value={r.payment_date ? formatDate(r.payment_date) : null} />
            <Row label={t('app.bl_payment_method')} value={r.payment_method} />
            <Row label={t('app.bl_transaction_id')} value={r.transaction_id} />
            <Row label={t('app.bl_notes')} value={r.notes} />
          </CardContent>
        </Card>

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
        <Button variant="ghost" onPress={onDelete}>
          <Icon as={Trash2} className="text-destructive size-4" />
          <Text className="text-destructive">{t('app.bl_delete')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
