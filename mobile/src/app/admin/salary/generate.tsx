import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { FormError } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { MonthYearPicker, monthLabel } from '@/features/admin/salary';
import { useCampus } from '@/features/campus/campus';
import { adminSalary } from '@/lib/api';

/** Create the month's salary records for every staff member with a salary structure (web: /admin/salary/generate). */
export default function GenerateSalaries() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`admin.salary.generate.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { scopeId } = useCampus();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const period = monthLabel(t, month, year);

  async function run() {
    if (!scopeId) return toast.error(g('toast.missing_school'));
    if (!(await confirm({ title: g('actions.generate_all'), body: period, confirmLabel: g('actions.generate_all') }))) return;
    setBusy(true);
    setResult(null);
    const res = await adminSalary.generateBulk(scopeId, month, year);
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.error || g('toast.generate_error'));
    setResult(res.data);
    if (res.data.success > 0) toast.success(g('toast.generated_success', { count: res.data.success }));
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'salary-dashboard');
    mutate((k) => typeof k === 'string' && k.startsWith('admin-salary-records'));
  }

  return (
    <>
      <Stack.Screen options={{ title: g('title') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{g('card.description')}</Text>
        <MonthYearPicker
          month={month}
          year={year}
          onChange={(m, y) => {
            setMonth(m);
            setYear(y);
          }}
        />
        <Card className="py-3">
          <CardContent className="gap-1 px-4">
            <Text className="text-sm">{g('summary.intro', { monthYear: period })}</Text>
            {[1, 2, 3, 4, 5].map((i) => (
              <Text key={i} className="text-muted-foreground text-sm">{`• ${g(`summary.item_${i}`)}`}</Text>
            ))}
          </CardContent>
        </Card>
        <Button onPress={run} disabled={busy || !scopeId}>
          <Text>{busy ? g('actions.generating') : g('actions.generate_all')}</Text>
        </Button>
        {result ? (
          <View className="gap-2">
            <Text className="text-success font-semibold">{g('result.success_count', { count: result.success })}</Text>
            {result.failed > 0 ? <FormError message={`${g('result.failed_count', { count: result.failed })}:\n${result.errors.slice(0, 20).join('\n')}`} /> : null}
          </View>
        ) : null}
      </Screen>
    </>
  );
}
