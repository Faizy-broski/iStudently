import type { SalaryAdvance } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DataList } from '@/components/app/data-list';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { MonthYearPicker, monthLabel } from '@/features/admin/salary';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminSalary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';

const advanceName = (a: SalaryAdvance) => {
  const p = a.staff?.profile ?? a.staff?.profiles;
  return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || a.staff_id;
};

/** Pending salary advance requests: approve with a recovery month, or reject (web: /admin/salary/advances). */
export default function SalaryAdvances() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`admin.salary.advances.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const list = useApi(scopeId ? ['admin', 'salary-advances', scopeId] : null, ([, , sid]) => adminSalary.pendingAdvances(sid as string));
  const [open, setOpen] = useState<{ advance: SalaryAdvance; action: 'approve' | 'reject' } | null>(null);
  // Recovery defaults to next month, like the web.
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  const [recovery, setRecovery] = useState({ month: next.getMonth() + 1, year: next.getFullYear() });
  const process = useAction(
    (adv: SalaryAdvance, action: 'approve' | 'reject') => adminSalary.processAdvance(scopeId!, adv.id, action, action === 'approve' ? recovery : undefined),
    {
      onSuccess: () => {
        list.mutate();
        mutate((k) => Array.isArray(k) && k[1] === 'salary-dashboard');
      },
    },
  );

  return (
    <>
      <Stack.Screen options={{ title: a('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={<Text className="text-muted-foreground px-4 pt-4 pb-2 text-sm">{a('table.description')}</Text>}
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={a('table.empty')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <View className="gap-1 px-4 py-3">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 font-medium">{advanceName(x)}</Text>
                <Text className="font-semibold">{money(x.amount)}</Text>
              </View>
              <Text className="text-muted-foreground text-xs">{[x.staff?.title, `${a('table.request_date')}: ${formatDate(x.request_date)}`].filter(Boolean).join(' · ')}</Text>
              {x.reason ? <Text className="text-sm">{x.reason}</Text> : null}
              <View className="flex-row gap-4 pt-1">
                <Pressable hitSlop={8} onPress={() => setOpen({ advance: x, action: 'approve' })} accessibilityRole="button">
                  <Text className="text-primary text-sm">{t('app.sl_approve')}</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => setOpen({ advance: x, action: 'reject' })} accessibilityRole="button">
                  <Text className="text-destructive text-sm">{t('app.sl_reject')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{open?.action === 'reject' ? a('dialog.reject_title') : a('dialog.approve_title')}</DialogTitle>
          </DialogHeader>
          {open ? <Text>{`${advanceName(open.advance)} · ${money(open.advance.amount)}`}</Text> : null}
          {open?.action === 'approve' ? (
            <View className="gap-2">
              <Text className="text-sm font-medium">{a('dialog.recovery_month')}</Text>
              <MonthYearPicker month={recovery.month} year={recovery.year} onChange={(m, y) => setRecovery({ month: m, year: y })} />
              <Text className="text-muted-foreground text-xs">{a('dialog.recovery_note', { monthYear: monthLabel(t, recovery.month, recovery.year) })}</Text>
            </View>
          ) : null}
          <DialogFooter>
            <Button
              variant={open?.action === 'reject' ? 'destructive' : 'default'}
              disabled={process.running}
              onPress={async () => {
                if (!open) return;
                const { ok } = await process.run(open.advance, open.action);
                if (!ok) return;
                toast.success(open.action === 'approve' ? a('toast.approved') : a('toast.rejected'));
                setOpen(null);
              }}>
              <Text>{process.running ? a('dialog.processing') : open?.action === 'reject' ? t('app.sl_reject') : t('app.sl_approve')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
