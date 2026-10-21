import type { Payslip, SalaryRecord, SalaryStatus } from '@studently/api-client';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '@/lib/colors';
import { Picker } from '@/components/app/picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { escapeHtml } from '@/lib/print';

export const SALARY_STATUS_VARIANT: Record<SalaryStatus, 'default' | 'secondary' | 'outline'> = { pending: 'secondary', approved: 'outline', paid: 'default' };

export const monthLabel = (t: TFunction, month: number, year?: number) => `${t(`common.months.${month - 1}`)}${year ? ` ${year}` : ''}`;

export function staffName(r: Pick<SalaryRecord, 'staff' | 'staff_id'>) {
  const p = r.staff?.profile ?? r.staff?.profiles;
  return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || r.staff?.employee_number || r.staff_id;
}

/** Month picker plus a 4-digit year (the web offers a fixed list of years; any year works here). */
export function MonthYearPicker({ month, year, onChange }: { month: number; year: number; onChange: (month: number, year: number) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-2">
      <View className="flex-1 gap-1.5">
        <Label>{t('admin.salary.page.filters.month')}</Label>
        <Picker value={String(month)} onChange={(v) => onChange(Number(v), year)} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthLabel(t, i + 1) }))} />
      </View>
      <View className="w-28 gap-1.5">
        <Label>{t('admin.salary.page.filters.year')}</Label>
        <Input
          defaultValue={String(year)}
          onChangeText={(v) => {
            const y = parseInt(v.replace(/\D/g, ''), 10);
            if (y >= 2000 && y <= 2100) onChange(month, y);
          }}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    </View>
  );
}

type Row = { label: string; amount: number; sub?: boolean };

/** Earnings and deductions in the same order as the web pay stub (PayslipDocument). */
export function payslipRows(p: Payslip, t: TFunction) {
  const earnings: Row[] = [{ label: t('payslip.label_base_salary'), amount: p.base_salary }];
  for (const a of p.allowances_breakdown ?? []) earnings.push({ label: a.description || a.allowance_type, amount: a.amount });
  const rewards = (p.performance_log_items ?? []).filter((x) => x.action_type === 'reward_redemption' && x.fine > 0);
  if (rewards.length) {
    earnings.push({ label: t('app.sl_performance_bonuses'), amount: rewards.reduce((s, r) => s + r.fine, 0) });
    for (const r of rewards) earnings.push({ label: r.action_name, amount: r.fine, sub: true });
  }
  const commissions = p.commissions_breakdown ?? [];
  const commissionTotal = commissions.reduce((s, c) => s + c.amount, 0);
  if (commissions.length) {
    earnings.push({ label: t('app.sl_commissions'), amount: commissionTotal });
    for (const c of commissions) earnings.push({ label: `${c.description} (${c.hours}h × ${c.rate})`, amount: c.amount, sub: true });
  }
  const totalEarnings = p.base_salary + (p.total_allowances || 0) + (p.performance_bonuses || 0) + commissionTotal;

  const deductions: Row[] = [];
  const attendance = (p.deductions_breakdown ?? []).filter((d) => d.deduction_type === 'absence' || d.deduction_type === 'late');
  if (attendance.length) {
    deductions.push({ label: t('app.sl_attendance_deductions'), amount: attendance.reduce((s, d) => s + d.amount, 0) });
    for (const d of attendance) deductions.push({ label: d.description, amount: d.amount, sub: true });
  }
  const fines = (p.performance_log_items ?? []).filter((x) => x.action_type === 'violation_demerit' && x.fine > 0);
  if (fines.length) {
    deductions.push({ label: t('app.sl_performance_fines'), amount: fines.reduce((s, f) => s + f.fine, 0) });
    for (const f of fines) deductions.push({ label: f.action_name, amount: f.fine, sub: true });
  }
  for (const d of (p.deductions_breakdown ?? []).filter((x) => x.deduction_type !== 'absence' && x.deduction_type !== 'late'))
    deductions.push({ label: d.description || d.deduction_type, amount: d.amount });
  if ((p.advance_deduction || 0) > 0) deductions.push({ label: t('payslip.label_advance_recovery'), amount: p.advance_deduction });

  return { earnings, deductions, totalEarnings, totalDeductions: p.total_deductions || 0, net: p.net_salary || 0 };
}

/** One pay stub as a print page (used by buildPrintHtml; one page per staff member when printing in bulk). */
export function payslipPageHtml(p: Payslip, t: TFunction, money: (n: number) => string) {
  const { earnings, deductions, totalEarnings, totalDeductions, net } = payslipRows(p, t);
  const name = staffName(p);
  const rows = (list: Row[], color: string) =>
    list
      .map(
        (r) =>
          `<tr><td style="padding:4px ${r.sub ? '0 4px 16px' : '0'};border-bottom:1px solid ${colors.printBorder};${r.sub ? `color:${colors.printMuted};font-size:11px` : ''}">${escapeHtml(r.label)}</td><td style="padding:4px 0;border-bottom:1px solid ${colors.printBorder};text-align:end;color:${color};${r.sub ? 'font-size:11px' : ''}">${escapeHtml(money(r.amount))}</td></tr>`,
      )
      .join('');
  const table = (title: string, list: Row[], total: number, color: string, empty?: string) =>
    `<table style="width:100%;border-collapse:collapse;margin-top:14px"><tr><th colspan="2" style="text-align:start;padding:6px 0;border-bottom:2px solid ${color};color:${color};font-size:12px">${escapeHtml(title)}</th></tr>${
      list.length ? rows(list, color) : `<tr><td colspan="2" style="padding:12px 0;color:${colors.printMuted};text-align:center">${escapeHtml(empty ?? '')}</td></tr>`
    }<tr><td style="padding:6px 0;font-weight:700">${escapeHtml(t('payslip.label_total'))}</td><td style="padding:6px 0;text-align:end;font-weight:700;color:${color}">${escapeHtml(money(total))}</td></tr></table>`;
  return `<div class="record-header"><span>${escapeHtml(t('payslip.title', { name, period: monthLabel(t, p.month, p.year) }))}</span><span class="rh-right">${escapeHtml(t(`common.${p.status}`))}</span></div>
    <table style="width:100%;margin-top:10px"><tr>
      <td style="vertical-align:top"><div style="color:${colors.printMuted};font-size:10px">${escapeHtml(t('payslip.label_employee'))}</div><div style="font-weight:600">${escapeHtml(name)}</div><div style="color:${colors.printMuted}">${escapeHtml(p.staff?.title ?? p.staff?.designation ?? '')}</div></td>
      <td style="vertical-align:top;text-align:end"><div style="color:${colors.printMuted};font-size:10px">${escapeHtml(t('payslip.label_id_period'))}</div><div style="font-weight:600">${escapeHtml(p.staff?.employee_number ?? '')}</div><div style="color:${colors.printMuted}">${escapeHtml(monthLabel(t, p.month, p.year))}</div></td>
    </tr></table>
    ${table(t('payslip.label_earnings'), earnings, totalEarnings, colors.success)}
    ${table(t('payslip.label_deductions'), deductions, totalDeductions, colors.destructive, t('payslip.label_no_deductions'))}
    <div style="margin-top:18px;padding:12px;border:2px solid ${colors.printText};display:flex;justify-content:space-between;font-weight:700;font-size:15px"><span>${escapeHtml(t('payslip.label_net_salary'))}</span><span>${escapeHtml(money(net))}</span></div>`;
}
