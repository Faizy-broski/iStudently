import type { DeductionType, PayrollRules } from '@studently/api-client';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';

/** The web's defaults for a school without saved payroll settings. */
export const DEFAULT_RULES: PayrollRules = {
  grace_late_count: 3,
  late_threshold_minutes: 15,
  deduction_type: 'per_minute',
  deduction_value: 1,
  absence_deduction_percent: 100,
  attendance_bonus_enabled: false,
  attendance_bonus_amount: 0,
  monthly_bonus_enabled: false,
  monthly_bonus_amount: 0,
  monthly_bonus_reason: '',
  monthly_deduction_enabled: false,
  monthly_deduction_amount: 0,
  monthly_deduction_reason: '',
  max_advance_percent: 50,
  expected_check_in: '08:00',
  working_days_per_month: 22,
};

/** Only the rule fields (the API rows also carry ids, names and timestamps). */
export function pickRules(src: Partial<PayrollRules> | null | undefined): PayrollRules {
  const out = { ...DEFAULT_RULES };
  for (const k of Object.keys(DEFAULT_RULES) as (keyof PayrollRules)[]) {
    const v = src?.[k];
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v;
  }
  // Postgres TIME comes back as HH:MM:SS
  out.expected_check_in = String(out.expected_check_in).slice(0, 5);
  return out;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const rulesValid = (r: PayrollRules) => HHMM.test(r.expected_check_in);

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
      </CardHeader>
      <CardContent className="gap-3 px-4">{children}</CardContent>
    </Card>
  );
}

function Num({ label, hint, value, onChange, decimal }: { label: string; hint?: string; value: number; onChange: (n: number) => void; decimal?: boolean }) {
  return (
    <View className="flex-1 gap-1.5">
      <Label>{label}</Label>
      <Input
        defaultValue={String(value ?? 0)}
        onChangeText={(v) => {
          const n = decimal ? parseFloat(v.replace(/[^0-9.]/g, '')) : parseInt(v.replace(/\D/g, ''), 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      />
      {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Label className="flex-1">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </View>
  );
}

/**
 * Payroll rules (web: SettingsForm in /admin/salary/settings). Inputs are uncontrolled after mount,
 * so give the form a `key` that changes when `value` is replaced from the server.
 */
export function PayrollRulesForm({ value, onChange, currency }: { value: PayrollRules; onChange: (patch: Partial<PayrollRules>) => void; currency: string }) {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`salary.settings.${k}`, o);
  const symbol = currency || '';
  return (
    <View className="gap-3">
      <Section title={s('attendanceRulesTitle')} hint={s('attendanceRulesSubtitle')}>
        <View className="flex-row gap-2">
          <Num label={s('graceLateCount')} hint={s('graceLateCountHint')} value={value.grace_late_count} onChange={(n) => onChange({ grace_late_count: n })} />
          <Num label={s('lateThreshold')} hint={s('lateThresholdHint')} value={value.late_threshold_minutes} onChange={(n) => onChange({ late_threshold_minutes: n })} />
        </View>
        <Label>{s('deductionType')}</Label>
        <FilterChips<DeductionType>
          value={value.deduction_type}
          onChange={(v) => onChange({ deduction_type: v })}
          options={[
            { value: 'per_minute', label: s('perMinute') },
            { value: 'percentage', label: s('percentage') },
            { value: 'fixed', label: s('fixedAmount') },
          ]}
        />
        <View className="flex-row gap-2">
          <Num label={s('deductionValue')} value={value.deduction_value} onChange={(n) => onChange({ deduction_value: n })} decimal />
          <Num label={s('absenceDeductionPercent')} hint={s('absenceDeductionHint')} value={value.absence_deduction_percent} onChange={(n) => onChange({ absence_deduction_percent: n })} decimal />
        </View>
      </Section>

      <Section title={s('attendanceBonusTitle')} hint={s('attendanceBonusHint')}>
        <Toggle label={s('enableAttendanceBonus')} value={value.attendance_bonus_enabled} onChange={(v) => onChange({ attendance_bonus_enabled: v })} />
        {value.attendance_bonus_enabled ? (
          <Num label={s('bonusAmount', { symbol })} value={value.attendance_bonus_amount} onChange={(n) => onChange({ attendance_bonus_amount: n })} decimal />
        ) : null}
      </Section>

      <Section title={s('monthlyBonusTitle')} hint={s('monthlyBonusSubtitle')}>
        <Toggle label={s('enableMonthlyBonus')} value={value.monthly_bonus_enabled} onChange={(v) => onChange({ monthly_bonus_enabled: v })} />
        {value.monthly_bonus_enabled ? (
          <>
            <Num label={s('amount', { symbol })} value={value.monthly_bonus_amount} onChange={(n) => onChange({ monthly_bonus_amount: n })} decimal />
            <Label>{s('reason')}</Label>
            <Input defaultValue={value.monthly_bonus_reason} onChangeText={(v) => onChange({ monthly_bonus_reason: v })} placeholder={s('monthlyBonusReasonPlaceholder')} />
          </>
        ) : null}
      </Section>

      <Section title={s('monthlyDeductionTitle')} hint={s('monthlyDeductionSubtitle')}>
        <Toggle label={s('enableMonthlyDeduction')} value={value.monthly_deduction_enabled} onChange={(v) => onChange({ monthly_deduction_enabled: v })} />
        {value.monthly_deduction_enabled ? (
          <>
            <Num label={s('amount', { symbol })} value={value.monthly_deduction_amount} onChange={(n) => onChange({ monthly_deduction_amount: n })} decimal />
            <Label>{s('reason')}</Label>
            <Input defaultValue={value.monthly_deduction_reason} onChangeText={(v) => onChange({ monthly_deduction_reason: v })} placeholder={s('monthlyDeductionReasonPlaceholder')} />
          </>
        ) : null}
      </Section>

      <Section title={s('salaryAdvanceTitle')} hint={s('salaryAdvanceSubtitle')}>
        <Num label={s('maxAdvance')} hint={s('maxAdvanceHint')} value={value.max_advance_percent} onChange={(n) => onChange({ max_advance_percent: n })} decimal />
      </Section>

      <Section title={s('workingHoursTitle')} hint={s('workingHoursSubtitle')}>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Label>{s('expectedCheckIn')}</Label>
            <Input defaultValue={value.expected_check_in} onChangeText={(v) => onChange({ expected_check_in: v.trim() })} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5} />
            {!HHMM.test(value.expected_check_in) ? <Text className="text-destructive text-xs">{t('app.sl_time_hint')}</Text> : null}
          </View>
          <Num label={s('workingDaysPerMonth')} value={value.working_days_per_month} onChange={(n) => onChange({ working_days_per_month: n })} />
        </View>
      </Section>
    </View>
  );
}
