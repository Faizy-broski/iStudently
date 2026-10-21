import type { HostelRentalFee } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { CreditCard, DollarSign, Hash, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Initials, StatTile, StatTiles } from '@/components/app/layout';
import { FilterChips } from '@/components/app/filter-chips';
import { Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { scopeKey, useHostelScope } from '@/features/admin/hostel';
import { useCurrency } from '@/features/admin/use-currency';
import { adminHostel } from '@/lib/api';
import { useApi } from '@/lib/data';

const STATUSES = ['pending', 'partial', 'paid', 'waived'] as const;
const FEE_CHIP = { pending: 'warning', partial: 'info', paid: 'success', waived: 'muted' } as const;

/** Room rental fees: generate for a period, record payments, filter by status (web: /admin/hostel/fees). */
export default function HostelFees() {
  const { t, i18n } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.fees.${k}`, o);
  const toast = useToast();
  const { money } = useCurrency();
  const scope = useHostelScope();
  const key = scopeKey(scope);
  const [status, setStatus] = useState('');
  const fees = useApi(key ? ['admin', 'hostel-fees', key, status] : null, ([, , , st]) => adminHostel.fees(scope!, { status: (st as string) || undefined }));
  const buildings = useApi(key ? ['admin', 'hostel-buildings', key] : null, () => adminHostel.buildings(scope!));

  const [genOpen, setGenOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [factor, setFactor] = useState('1');
  const [genBuilding, setGenBuilding] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ fees_created: number; total_amount: number } | null>(null);

  const [paying, setPaying] = useState<HostelRentalFee | null>(null);
  const [amount, setAmount] = useState('0');
  const [payNotes, setPayNotes] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  async function generate() {
    if (!scope || !start || !end) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const r = await adminHostel.generateFees(scope, { period_start: start, period_end: end, factor: parseFloat(factor) || 0, building_id: genBuilding || undefined });
      if (!r.success || !r.data) return toast.error(r.error || f('msg_generate_error'));
      setGenResult(r.data);
      fees.mutate();
    } finally {
      setGenerating(false);
    }
  }

  const openPay = (x: HostelRentalFee) => {
    setPaying(x);
    setAmount(String(Math.max(0, Number(x.final_amount) - Number(x.amount_paid))));
    setPayNotes('');
  };

  async function pay() {
    const value = parseFloat(amount) || 0;
    if (!paying || value <= 0) return;
    setSavingPay(true);
    try {
      const r = await adminHostel.recordPayment({ fee_id: paying.id, amount: value, notes: payNotes || undefined });
      if (!r.success) return toast.error(r.error || f('msg_payment_error'));
      toast.success(f('msg_payment_success'));
      setPaying(null);
      fees.mutate();
    } finally {
      setSavingPay(false);
    }
  }

  const list = fees.data ?? [];
  const outstanding = list.filter((x) => x.status === 'pending' || x.status === 'partial').reduce((s, x) => s + (Number(x.final_amount) - Number(x.amount_paid)), 0);
  const collected = list.reduce((s, x) => s + Number(x.amount_paid), 0);
  const date = (d: string) => new Date(d).toLocaleDateString(i18n.language);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('header_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => fees.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{f('header_subtitle')}</Text>
          <Button
            size="sm"
            onPress={() => {
              setGenResult(null);
              setGenOpen(true);
            }}>
            <Icon as={Sparkles} className="text-primary-foreground size-4" />
            <Text>{f('btn_generate')}</Text>
          </Button>
        </View>
        <StatTiles>
          <StatTile icon={DollarSign} tone="success" label={f('stat_collected')} value={money(collected)} />
          <StatTile icon={CreditCard} tone={outstanding > 0 ? 'warning' : 'muted'} label={f('stat_outstanding')} value={money(outstanding)} />
          <StatTile icon={Hash} label={f('stat_total')} value={String(list.length)} />
        </StatTiles>
        <FilterChips value={status || 'ALL'} onChange={(x) => setStatus(x === 'ALL' ? '' : x)} options={[{ value: 'ALL', label: f('filter_all') }, ...STATUSES.map((s) => ({ value: s, label: f(`filter_${s}`) }))]} />
        {fees.isLoading || !scope ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={DollarSign} title={f('msg_no_data')} body={f('msg_no_data_desc')} />
        ) : (
          <Panel>
            {list.map((x, i) => (
              <View key={x.id}>
                {i > 0 ? <Separator /> : null}
                <View className="flex-row items-center gap-3 px-4 py-3">
                  <Initials name={x.student_name || '?'} />
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-sm font-semibold">{x.student_name || x.student_id}</Text>
                      <StatusChip label={f(`filter_${x.status}`)} tone={FEE_CHIP[x.status as keyof typeof FEE_CHIP] ?? 'muted'} />
                    </View>
                    <Text className="text-muted-foreground text-sm">
                      {[x.room_number ? `${f('th_room')} ${x.room_number}` : null, `${date(x.period_start)} — ${date(x.period_end)}`].filter(Boolean).join(' · ')}
                    </Text>
                    <Text className="text-xs">
                      {f('th_base')}: {money(x.base_amount)} · {f('th_final')}: {money(x.final_amount)} · {f('th_paid')}: {money(x.amount_paid)}
                    </Text>
                  </View>
                  {x.status !== 'paid' && x.status !== 'waived' ? (
                    <Button size="sm" variant="ghost" onPress={() => openPay(x)}>
                      <Icon as={CreditCard} className="text-foreground size-4" />
                      <Text>{f('btn_pay')}</Text>
                    </Button>
                  ) : null}
                </View>
              </View>
            ))}
          </Panel>
        )}
      </ScrollView>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{f('dialog_generate_title')}</DialogTitle>
          </DialogHeader>
          <View className="flex-row gap-3">
            <DateField className="flex-1" label={f('label_period_start')} value={start} onChange={setStart} />
            <DateField className="flex-1" label={f('label_period_end')} value={end} onChange={setEnd} min={start || undefined} />
          </View>
          <View className="gap-1.5">
            <Label>{f('label_factor')}</Label>
            <Input value={factor} onChangeText={setFactor} keyboardType="decimal-pad" className="w-28" />
            <Text className="text-muted-foreground text-xs">{f('desc_factor')}</Text>
          </View>
          <View className="gap-1.5">
            <Label>{f('label_building')}</Label>
            <Picker value={genBuilding || 'ALL'} onChange={(x) => setGenBuilding(x === 'ALL' ? '' : x)} options={[{ value: 'ALL', label: f('option_all_buildings') }, ...(buildings.data ?? []).map((b) => ({ value: b.id, label: b.name }))]} />
          </View>
          {genResult ? (
            <View className="rounded-md bg-success-soft p-3 ">
              <Text className="text-sm text-success ">✅ {f('msg_generate_success_count', { count: genResult.fees_created, amount: money(genResult.total_amount) })}</Text>
            </View>
          ) : null}
          <Button onPress={generate} disabled={generating || !start || !end}>
            <Text>{generating ? f('btn_generating') : f('btn_create')}</Text>
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{f('dialog_payment_title')}</DialogTitle>
          </DialogHeader>
          {paying ? (
            <View className="bg-muted gap-1 rounded-md p-3">
              <Text className="text-sm">
                {f('label_student')} <Text className="text-sm font-bold">{paying.student_name}</Text>
              </Text>
              <Text className="text-sm">
                {f('label_room')} <Text className="text-sm font-bold">{paying.room_number}</Text>
              </Text>
              <Text className="text-sm">
                {f('label_outstanding')} <Text className="text-sm font-bold">{money(Number(paying.final_amount) - Number(paying.amount_paid))}</Text>
              </Text>
            </View>
          ) : null}
          <View className="gap-1.5">
            <Label>{f('label_amount')}</Label>
            <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>
          <View className="gap-1.5">
            <Label>{f('label_notes')}</Label>
            <Input value={payNotes} onChangeText={setPayNotes} placeholder={f('placeholder_notes')} />
          </View>
          <Button onPress={pay} disabled={savingPay || !(parseFloat(amount) > 0)}>
            <Text>{savingPay ? f('btn_processing') : f('btn_record_payment')}</Text>
          </Button>
        </DialogContent>
      </Dialog>
    </View>
  );
}
