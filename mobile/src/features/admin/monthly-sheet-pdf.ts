import type { MonthlySheetModel } from '@studently/api-client';

import { escapeHtml, sharePdf } from '@/lib/print';

// Same model, colors and labels as the web's jsPDF renderer (frontend/src/lib/utils/monthlySheetPdf.ts).
const NON_WORKING = '#e0e0e0';
const HEADER_BG = '#d9e1f2';
const CODE_COLORS: Record<string, string> = { P: '#c6efce', A: '#ffc7ce', EA: '#ffe0b2', L: '#fff2cc', HD: '#ddebf7' };

const LABELS = {
  en: {
    no: '#', id: 'ID', name: 'Name',
    totals: ['Present', 'Absent', 'Excused', 'Tardy', 'Half-day', 'Rate'],
    academicYear: 'Academic Year', month: 'Month', group: 'Class / Section / Dept.', room: 'Room', supervisor: 'Supervisor / Teacher', workingDays: 'Working days',
    legend: 'Legend', preparedBy: 'Prepared by: Teacher / Supervisor', preparedHint: 'Signature & Date',
    approvedBy: 'Approved by: School Principal / HR Manager', approvedHint: 'Signature & Stamp',
  },
  ar: {
    no: '#', id: 'الرقم', name: 'الاسم',
    totals: ['حضور', 'غياب', 'بعذر', 'تأخر', 'خروج مبكر', 'النسبة'],
    academicYear: 'العام الدراسي', month: 'الشهر', group: 'الصف / الشعبة / القسم', room: 'القاعة', supervisor: 'المشرف / المعلم', workingDays: 'أيام الدوام',
    legend: 'المفتاح', preparedBy: 'أعدّه: المعلم / المشرف', preparedHint: 'التوقيع والتاريخ',
    approvedBy: 'اعتمده: مدير المدرسة / الموارد البشرية', approvedHint: 'التوقيع والختم',
  },
};

function sheetHtml(model: MonthlySheetModel) {
  const L = LABELS[model.locale];
  const blank = model.mode === 'blank';
  const h = model.header;
  const dayTh = (bg: string | null, inner: string, cls = '') => `<th class="${cls}"${bg ? ` style="background:${bg}"` : ''}>${inner}</th>`;
  const head1 =
    `<th rowspan="2" class="no">${L.no}</th><th rowspan="2" class="id">${L.id}</th><th rowspan="2" class="name">${L.name}</th>` +
    model.columns.map((c) => dayTh(c.isNonWorking ? NON_WORKING : null, `<span class="vert">${escapeHtml(c.dayName)}</span>`, 'dayname')).join('') +
    L.totals.map((x) => `<th rowspan="2" class="tot">${escapeHtml(x)}</th>`).join('');
  const head2 = model.columns.map((c) => dayTh(c.isNonWorking ? NON_WORKING : null, String(c.day).padStart(2, '0'))).join('');
  const body = (model.rows.length ? model.rows : [null])
    .map((r, i) => {
      if (!r) return `<tr>${'<td>&nbsp;</td>'.repeat(3 + model.columns.length + 6)}</tr>`;
      const days = model.columns
        .map((c, d) => {
          const v = r.cells[d] ?? '';
          const bg = c.isNonWorking ? NON_WORKING : (CODE_COLORS[v] ?? '');
          return `<td class="c"${bg ? ` style="background:${bg}"` : ''}>${escapeHtml(v)}</td>`;
        })
        .join('');
      const tt = r.totals;
      const totals = (blank ? ['', '', '', '', '', ''] : [tt.totalPresent, tt.totalAbsentUnexcused, tt.totalAbsentExcused, tt.totalTardy, tt.totalHalfDay, `${tt.attendanceRate}%`])
        .map((v) => `<td class="c">${escapeHtml(v)}</td>`)
        .join('');
      return `<tr><td class="c">${i + 1}</td><td class="c">${escapeHtml(r.number)}</td><td class="nm">${escapeHtml(r.name)}</td>${days}${totals}</tr>`;
    })
    .join('');
  const legend = model.legend
    .map((it) => `<span class="lg" style="background:${CODE_COLORS[it.code] ?? '#fff'}">${escapeHtml(it.code)} — ${escapeHtml(model.locale === 'ar' ? it.ar : it.en)}</span>`)
    .join('');
  const sign = (title: string, hint: string) => `<div class="sign"><div class="st">${escapeHtml(title)}</div><div class="sb">${escapeHtml(hint)}</div></div>`;
  return `<section class="sheet">
    <div class="hdr">
      ${h.logoUrl ? `<img class="logo" src="${escapeHtml(h.logoUrl)}" />` : ''}
      <div class="school">${escapeHtml(h.schoolName)}</div>
      ${h.address ? `<div class="addr">${escapeHtml(h.address)}</div>` : ''}
      <div class="title">${escapeHtml(h.title)}</div>
      <div class="meta">${L.academicYear}: ${escapeHtml(h.academicYear)} &nbsp;&nbsp; ${L.month}: ${escapeHtml(h.monthLabel)} &nbsp;&nbsp; ${L.group}: ${escapeHtml(h.groupLabel)}</div>
      <div class="meta">${L.room}: ${escapeHtml(h.room || '—')} &nbsp;&nbsp; ${L.supervisor}: ${escapeHtml(h.supervisor || '—')} &nbsp;&nbsp; ${L.workingDays}: ${model.workingDays}</div>
    </div>
    <table><thead><tr>${head1}</tr><tr>${head2}</tr></thead><tbody>${body}</tbody></table>
    <div class="foot">
      <div class="legend"><b>${L.legend}:</b> ${legend}</div>
      <div class="signs">${sign(L.preparedBy, L.preparedHint)}${sign(L.approvedBy, L.approvedHint)}</div>
    </div>
  </section>`;
}

/** Renders the monthly sheet(s) as a landscape A4 PDF and opens the share sheet. */
export async function shareMonthlySheetPdf(models: MonthlySheetModel[], baseName: string) {
  if (!models.length) throw new Error('Nothing to export');
  const rtl = models[0].locale === 'ar';
  const css = `@page{size:A4 landscape;margin:7mm}*{box-sizing:border-box}body{font-family:-apple-system,Roboto,"Noto Sans Arabic",Arial,sans-serif;margin:0;color:#141414}
  .sheet{page-break-after:always}.sheet:last-child{page-break-after:auto}
  .hdr{position:relative;text-align:center;margin-bottom:6px}.logo{position:absolute;top:0;${rtl ? 'right' : 'left'}:0;width:70px;height:60px;object-fit:contain}
  .school{font-size:17px;font-weight:600}.addr{font-size:10px;color:#5a5a5a}.title{font-size:14px;color:#8b0000;margin-top:4px}.meta{font-size:10px;margin-top:2px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8px}th,td{border:0.5px solid #808080;padding:1px 2px;overflow:hidden;white-space:nowrap}
  thead th{background:${HEADER_BG};font-weight:400;text-align:center}thead{display:table-header-group}tr{page-break-inside:avoid}
  .no{width:18px}.id{width:52px}.name{width:150px}.tot{width:36px}.dayname{height:52px;vertical-align:middle}
  .vert{display:inline-block;writing-mode:vertical-rl;transform:rotate(180deg);font-size:7px}
  .c{text-align:center}.nm{text-align:start;text-overflow:ellipsis}
  .foot{page-break-inside:avoid;margin-top:8px}.legend{font-size:9px;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
  .lg{border:0.5px solid #808080;padding:2px 6px}.signs{display:flex;gap:16px;margin-top:8px}
  .sign{flex:1;border:0.5px solid #808080}.st{background:${HEADER_BG};text-align:center;font-size:10px;padding:3px;border-bottom:0.5px solid #808080}.sb{height:52px;display:flex;align-items:flex-end;justify-content:center;font-size:9px;color:#787878;padding-bottom:3px}`;
  const html = `<!DOCTYPE html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8"><style>${css}</style></head><body>${models.map(sheetHtml).join('')}</body></html>`;
  await sharePdf(html, `${baseName}.pdf`, { width: 842, height: 595 });
}
