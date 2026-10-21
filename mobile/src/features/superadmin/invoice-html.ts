import type { BillingRecord } from '@studently/api-client';
import type { TFunction } from 'i18next';

import { colors } from '@/lib/colors';
import i18n from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { escapeHtml } from '@/lib/print';

const STATUS_COLOR: Record<string, string> = { paid: colors.success, unpaid: colors.printMuted, overdue: colors.destructive, pending: colors.warning };

/**
 * Platform invoice for one billing record, same content as the web's "Generate invoice"
 * (superadmin/billing-status): header, invoice details, one line, total, footer. Localized and RTL-aware.
 */
export function buildInvoiceHtml(r: BillingRecord, t: TFunction, supportEmail?: string | null) {
  const rtl = i18n.language === 'ar';
  const status = r.effective_status ?? r.payment_status;
  const money = escapeHtml(formatMoney(r.amount, r.currency));
  const item = (label: string, value: string) => `<div class="item"><div class="label">${escapeHtml(label)}</div><div class="value">${value}</div></div>`;
  return `<!DOCTYPE html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(t('app.bl_invoice_doc_title', { number: r.invoice_number }))}</title>
<style>
body{font-family:-apple-system,Roboto,Arial,sans-serif;margin:40px;color:${colors.printText}}
.header{text-align:center;border-bottom:3px solid ${colors.brand};padding-bottom:20px;margin-bottom:30px}
.brand{font-size:32px;font-weight:bold;color:${colors.brand}}
.grid{display:flex;justify-content:space-between;gap:20px}
.end{text-align:end}
.item{margin-bottom:10px}.label{font-weight:bold;color:${colors.printMuted};font-size:13px}.value{color:${colors.brand};font-weight:600}
table{width:100%;border-collapse:collapse;margin:30px 0}th{background:${colors.brand};color:${colors.white};padding:12px;text-align:start}td{padding:12px;border-bottom:1px solid ${colors.printBorder}}
.num{text-align:end}.total{text-align:end;font-size:24px;font-weight:bold;color:${colors.brand};margin-top:20px}
.footer{margin-top:50px;text-align:center;color:${colors.printMuted};border-top:2px solid ${colors.printBorder};padding-top:20px}
.status{display:inline-block;padding:5px 15px;border-radius:20px;font-weight:bold;color:${colors.white};background:${STATUS_COLOR[status] ?? colors.printMuted}}
</style></head><body>
<div class="header"><div class="brand">STUDENTLY</div><p style="margin:5px 0;color:${colors.printMuted}">${escapeHtml(t('app.bl_invoice_tagline'))}</p></div>
<h2 style="color:${colors.brand};margin-bottom:20px">${escapeHtml(t('app.bl_invoice_heading'))}</h2>
<div class="grid">
<div>
${item(t('app.bl_invoice'), escapeHtml(r.invoice_number))}
${item(t('app.bl_school'), escapeHtml(r.school_name ?? '—'))}
${item(t('app.bl_status'), `<span class="status">${escapeHtml(t(`app.sa_pay_status_${status}`))}</span>`)}
</div>
<div class="end">
${item(t('app.bl_issue_date'), escapeHtml(formatDate(r.start_date || r.due_date)))}
${item(t('app.bl_due_date'), escapeHtml(formatDate(r.due_date)))}
${r.payment_date ? item(t('app.bl_payment_date'), escapeHtml(formatDate(r.payment_date))) : ''}
</div>
</div>
<table><thead><tr><th>${escapeHtml(t('app.bl_description'))}</th><th>${escapeHtml(t('app.bl_cycle'))}</th><th class="num">${escapeHtml(t('app.bl_amount'))}</th></tr></thead>
<tbody><tr><td><strong>${escapeHtml(t('app.bl_invoice_plan_line', { plan: r.subscription_plan || t('app.bl_subscription') }))}</strong><br><span style="color:${colors.printMuted};font-size:14px">${escapeHtml(t('app.bl_invoice_tagline_sub'))}</span></td>
<td>${escapeHtml(t(`app.bl_cycle_${r.billing_cycle}`))}</td><td class="num"><strong>${money}</strong></td></tr></tbody></table>
<div class="total">${escapeHtml(t('app.bl_total_amount'))}: ${money}</div>
<div class="footer"><p>${escapeHtml(t('app.bl_invoice_thanks'))}</p><p style="font-size:12px;color:${colors.printMuted}">${escapeHtml(t('app.bl_invoice_note', { email: supportEmail || 'support@studently.com' }))}</p></div>
</body></html>`;
}
