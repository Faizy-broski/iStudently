import { CURRENCY_OPTIONS, DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT, formatDatePattern, PAYMENT_METHODS } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Bell, Calendar, CreditCard, DollarSign, Save, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { setHijriOffset } from '@/lib/hijri';

/** Campus-wide preferences: date format, Hijri offset, payment reminder, currency, payment method (web: /admin/settings). */
export default function SystemSettings() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`admin.settings.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId, campus } = useCampus();
  const res = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const [dateFormat, setDateFormat] = useState<string>(DEFAULT_DATE_FORMAT);
  const [hijri, setHijri] = useState(0);
  const [reminder, setReminder] = useState(true);
  const [dismiss, setDismiss] = useState(5);
  const [currency, setCurrency] = useState('USD');
  const [method, setMethod] = useState<string>('cash');
  const [saving, setSaving] = useState<string | null>(null);

  const data = res.data;
  const dataKey = data ? JSON.stringify([data.preferred_date_format, data.hijri_offset, data.enable_payment_reminder, data.auto_dismiss_seconds, data.default_currency, data.default_payment_method]) : null;
  useEffect(() => {
    if (!data) return;
    if (typeof data.preferred_date_format === 'string' && data.preferred_date_format) setDateFormat(data.preferred_date_format);
    if (typeof data.hijri_offset === 'number') setHijri(data.hijri_offset);
    if (typeof data.enable_payment_reminder === 'boolean') setReminder(data.enable_payment_reminder);
    if (typeof data.auto_dismiss_seconds === 'number') setDismiss(data.auto_dismiss_seconds);
    if (typeof data.default_currency === 'string' && data.default_currency) setCurrency(data.default_currency);
    if (typeof data.default_payment_method === 'string' && data.default_payment_method) setMethod(data.default_payment_method);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  async function save(key: string, body: Record<string, unknown>, ok: string, fail: string, after?: () => void) {
    setSaving(key);
    try {
      const r = await adminSchool.updateSettings(body, campusId);
      if (!r.success) return toast.error(r.error || fail);
      after?.();
      toast.success(ok);
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'school-settings');
    } finally {
      setSaving(null);
    }
  }

  if (res.isLoading) return <LoadingList />;
  const campusName = campus ? campus.name : null;
  const cur = CURRENCY_OPTIONS.find((o) => o.value === currency);

  const section = (icon: LucideIcon, title: string, desc: string, children: ReactNode) => (
    <Card>
      <CardContent className="gap-3 pt-4">
        <View className="flex-row items-center gap-2">
          <Icon as={icon} className="text-primary size-5" />
          <Text className="font-semibold">{title}</Text>
        </View>
        <Text className="text-muted-foreground text-sm">{desc}</Text>
        {children}
      </CardContent>
    </Card>
  );
  const note = (text: string) => (
    <View className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
      <Text className="text-sm text-blue-900 dark:text-blue-100">
        <Text className="text-sm font-bold text-blue-900 dark:text-blue-100">{s('note')}</Text> {text}
      </Text>
    </View>
  );
  const saveBtn = (key: string, label: string, onPress: () => void) => (
    <Button className="self-start" onPress={onPress} disabled={saving === key}>
      <Icon as={Save} className="text-primary-foreground size-4" />
      <Text>{saving === key ? s('saving') : label}</Text>
    </Button>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{s('subtitle')}</Text>

        {section(
          Calendar,
          s('dateFormat.title'),
          s('dateFormat.description'),
          <>
            <Label>{s('dateFormat.label')}</Label>
            <Picker value={dateFormat} onChange={setDateFormat} placeholder={s('dateFormat.placeholder')} options={DATE_FORMAT_OPTIONS.map((p) => ({ value: p, label: formatDatePattern(new Date(2026, 7, 26), p) }))} />
            <Text className="text-muted-foreground text-sm">
              {s('dateFormat.preview')} <Text className="text-sm font-bold">{formatDatePattern(new Date(), dateFormat)}</Text>
            </Text>
            {note(s('dateFormat.note'))}
            {saveBtn('date', s('dateFormat.save'), () => save('date', { preferred_date_format: dateFormat }, s('dateFormat.toast_success'), s('dateFormat.toast_error')))}
          </>,
        )}

        {section(
          Calendar,
          s('hijri.title'),
          s('hijri.description'),
          <>
            <Label>{s('hijri.label')}</Label>
            <Picker
              value={String(hijri)}
              onChange={(v) => setHijri(parseInt(v, 10))}
              placeholder={s('hijri.placeholder')}
              options={Array.from({ length: 11 }, (_, i) => i - 5).map((o) => ({ value: String(o), label: o === 0 ? s('hijri.noAdjustment') : `${o > 0 ? '+' : ''}${o} ${Math.abs(o) > 1 ? s('hijri.days') : s('hijri.day')}` }))}
            />
            {note(s('hijri.note'))}
            {saveBtn('hijri', s('hijri.save'), () => save('hijri', { hijri_offset: hijri }, s('hijri.toast_success'), s('hijri.toast_error'), () => setHijriOffset(hijri)))}
          </>,
        )}

        {section(
          Bell,
          s('paymentReminder.title'),
          s('paymentReminder.description'),
          <>
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-semibold">{s('paymentReminder.enableLabel')}</Text>
                <Text className="text-muted-foreground text-sm">{s('paymentReminder.enableDescription')}</Text>
              </View>
              <Switch checked={reminder} onCheckedChange={setReminder} />
            </View>
            <Label>{s('paymentReminder.durationLabel')}</Label>
            <View className={reminder ? '' : 'opacity-50'} pointerEvents={reminder ? 'auto' : 'none'}>
              <Picker value={String(dismiss)} onChange={(v) => setDismiss(parseInt(v, 10))} placeholder={s('paymentReminder.durationPlaceholder')} options={[3, 4, 5, 6, 7, 8, 10, 15].map((x) => ({ value: String(x), label: `${x} ${s('paymentReminder.seconds')} ${x === 5 ? s('paymentReminder.default') : ''}`.trim() }))} />
            </View>
            <Text className="text-muted-foreground text-xs">{s('paymentReminder.durationHint')}</Text>
            {saveBtn('reminder', s('paymentReminder.save'), () => save('reminder', { enable_payment_reminder: reminder, auto_dismiss_seconds: dismiss }, s('paymentReminder.toast_success'), s('paymentReminder.toast_error')))}
          </>,
        )}

        {section(
          DollarSign,
          s('currency.title'),
          s('currency.description', { campus: campusName ?? s('currency.yourSchool') }),
          <>
            <Label>{s('currency.label')}</Label>
            <Picker value={currency} onChange={setCurrency} placeholder={s('currency.placeholder')} options={CURRENCY_OPTIONS.map((o) => ({ value: o.value, label: `${o.symbol}  ${o.value} — ${o.label}` }))} />
            <Text className="text-muted-foreground text-sm">
              {s('currency.selected')} <Text className="text-sm font-bold">{cur ? `${cur.symbol} ${cur.value} — ${cur.label}` : currency}</Text>
            </Text>
            {note(s('currency.note'))}
            {saveBtn('currency', s('currency.save'), () => save('currency', { default_currency: currency }, campusId ? s('currency.toast_success_campus') : s('currency.toast_success'), s('currency.toast_error')))}
          </>,
        )}

        {section(
          CreditCard,
          s('paymentMethod.title'),
          s('paymentMethod.description', { campus: campusName ?? s('paymentMethod.yourSchool') }),
          <>
            <Label>{s('paymentMethod.label')}</Label>
            <Picker value={method} onChange={setMethod} placeholder={s('paymentMethod.placeholder')} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`app.pm_${m}`) }))} />
            {note(s('paymentMethod.note'))}
            {saveBtn('method', s('paymentMethod.save'), () => save('method', { default_payment_method: method }, campusId ? s('paymentMethod.toast_success_campus') : s('paymentMethod.toast_success'), s('paymentMethod.toast_error')))}
          </>,
        )}
      </ScrollView>
    </View>
  );
}
