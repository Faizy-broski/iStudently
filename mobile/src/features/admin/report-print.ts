import type { AdminReportCard } from '@studently/api-client';
import type { TFunction } from 'i18next';

import { colors } from '@/lib/colors';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';

import type { usePrintContext } from './print-context';

const e = escapeHtml;

const studentName = (p?: NonNullable<AdminReportCard['student']>['profile']) => (p ? [p.first_name, p.father_name, p.grandfather_name, p.last_name].filter(Boolean).join(' ') : '') || '—';

/** One card (web: ReportPrintPreview buildCardHtml), labels translated. */
function cardHtml(card: AdminReportCard, title: string, t: TFunction) {
  const c = (k: string) => t(`school.grades_module.common.${k}`);
  const r = (k: string) => t(`app.rp_${k}`);
  const st = card.student;
  const school = card.school || st?.school;
  const opts = (card.options ?? {}) as Record<string, unknown>;
  const grades = card.grades ?? [];
  let h = '<div class="report-card"><div class="report-card-school">';
  if (school?.logo_url) h += `<img src="${e(school.logo_url)}" alt="" class="school-logo" />`;
  h += `<div class="school-info"><div class="school-name">${e(school?.name || '')}</div>`;
  if (school?.address) h += `<div class="school-detail">${e(school.address)}</div>`;
  if (school?.phone) h += `<div class="school-detail">${e(school.phone)}</div>`;
  h += `</div></div><div class="report-title">${e(title)}</div><div class="student-info">`;
  const row = (label: string, value?: string | null) => `<div><span class="label">${e(label)}: </span><span class="value">${e(value || '—')}</span></div>`;
  h += row(c('student'), studentName(st?.profile));
  h += row(c('student_id'), st?.student_number);
  h += row(c('grade_level_header'), st?.section?.grade_level?.name || st?.grade_level);
  h += row(r('section'), st?.section?.name);
  if (card.marking_period) h += row(c('marking_period'), card.marking_period.title || card.marking_period.short_name);
  if (card.academic_year) h += row(r('academic_year'), card.academic_year.name);
  h += '</div>';
  if (grades.length) {
    h += `<table class="grades-table"><thead><tr><th>${e(r('course'))}</th>`;
    if (opts.include_teacher) h += `<th>${e(c('teacher'))}</th>`;
    if (opts.include_percents) h += '<th class="num">%</th>';
    h += `<th class="num">${e(r('grade'))}</th><th class="num">${e(c('gpa'))}</th>`;
    if (opts.include_credits) h += `<th class="num">${e(c('credits'))}</th>`;
    h += '</tr></thead><tbody>';
    for (const g of grades) {
      h += `<tr><td>${e(g.course_title || g.subject_name || '—')}</td>`;
      if (opts.include_teacher) h += `<td>${e(g.teacher_name || '—')}</td>`;
      if (opts.include_percents) h += `<td class="num">${g.percent_grade != null ? `${g.percent_grade}%` : '—'}</td>`;
      h += `<td class="num">${e(g.letter_grade || '—')}</td><td class="num">${g.gpa_value != null ? g.gpa_value.toFixed(2) : '—'}</td>`;
      if (opts.include_credits) h += `<td class="num">${g.credit_hours || '—'}</td>`;
      h += '</tr>';
    }
    h += '</tbody></table>';
  } else {
    h += `<p class="no-grades">${e(r('no_grades'))}</p>`;
  }
  const sum = card.summary;
  if (sum) {
    h += '<div class="summary-row">';
    if (sum.gpa != null) h += `<div class="item"><span class="label">${e(c('gpa'))}:</span><span>${sum.gpa.toFixed(2)}</span></div>`;
    h += `<div class="item"><span class="label">${e(r('credits_attempted'))}:</span><span>${sum.total_credits_attempted ?? 0}</span></div>`;
    h += `<div class="item"><span class="label">${e(r('credits_earned'))}:</span><span>${sum.total_credits_earned ?? 0}</span></div></div>`;
  }
  if (opts.include_comments && grades.some((g) => g.comments?.length)) {
    h += `<div class="comments-section"><h4>${e(c('comments'))}</h4>`;
    for (const g of grades) {
      if (!g.comments?.length) continue;
      h += `<div><strong>${e(g.course_title)}: </strong>${e(
        g.comments
          .map((x) => x.custom_comment || x.comment?.comment_text || '')
          .filter(Boolean)
          .join('; '),
      )}</div>`;
    }
    h += '</div>';
  }
  return `${h}</div>`;
}

const STYLES = `.report-card{page-break-after:always;padding:8px 4px}.report-card:last-child{page-break-after:avoid}.report-card-school{display:flex;align-items:center;gap:12px;padding:10px 14px;background:${colors.printSurface};border:1px solid ${colors.infoSoft};border-radius:6px;margin-bottom:12px}.school-logo{height:48px;width:48px;object-fit:contain;border-radius:4px}.school-info .school-name{font-size:15px;font-weight:700;color:${colors.brand}}.school-info .school-detail{font-size:11px;color:${colors.printMuted};margin-top:2px}.report-title{text-align:center;font-size:16px;font-weight:700;color:${colors.printText};margin:12px 0 16px;text-transform:uppercase;letter-spacing:1px}.student-info{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:16px;font-size:12px;background:${colors.printSurface};padding:10px 14px;border-radius:6px;border:1px solid ${colors.printBorder}}.student-info .label{font-weight:600;color:${colors.printMuted}}.grades-table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}.grades-table th{background:${colors.brand};color:${colors.white};padding:6px 10px;text-align:start;font-weight:600;font-size:11px;text-transform:uppercase}.grades-table td{padding:5px 10px;border-bottom:1px solid ${colors.printBorder}}.grades-table tr:nth-child(even){background:${colors.printSurface}}.grades-table .num{text-align:center}.summary-row{display:flex;justify-content:space-between;background:${colors.infoSoft};padding:8px 14px;border-radius:6px;font-size:12px;border:1px solid ${colors.infoSoft};margin-bottom:12px}.summary-row .item{display:flex;gap:6px}.summary-row .label{font-weight:600;color:${colors.brand}}.comments-section{margin-top:8px;font-size:11px}.comments-section h4{font-size:12px;font-weight:600;margin-bottom:4px;color:${colors.printMuted}}.no-grades{font-size:12px;color:${colors.printMuted};padding:12px 0}`;
const TWO_COPIES = `@page{size:landscape}.two-copies-row{display:flex;align-items:flex-start;page-break-after:always}.two-copies-row:last-child{page-break-after:avoid}.copy-cell{flex:1;min-width:0;padding:12px 14px}.copy-divider{width:1px;background:${colors.printBorder};align-self:stretch;margin:8px 0}.report-card{page-break-after:unset!important;padding:0}.report-card-school{padding:7px 10px;margin-bottom:8px}.school-logo{height:36px;width:36px}.school-info .school-name{font-size:12px}.school-info .school-detail{font-size:9px}.report-title{font-size:12px;margin:8px 0 10px}.student-info{font-size:10px;padding:7px 10px;margin-bottom:10px;gap:3px 12px}.grades-table{font-size:10px;margin-bottom:10px}.grades-table th{padding:4px 7px;font-size:9px}.grades-table td{padding:3px 7px}.summary-row{font-size:10px;padding:5px 10px;margin-bottom:8px}.comments-section{font-size:9px}.comments-section h4{font-size:10px}.no-grades{font-size:10px}`;

/** Print or share as PDF the cards the API returned (web: printReportCards), optionally two copies per landscape page. */
export async function outputReports(o: { title: string; cards: AdminReportCard[]; ctx: ReturnType<typeof usePrintContext>; t: TFunction; mode: 'print' | 'pdf'; twoCopies?: boolean; fileName: string }) {
  const valid = o.cards.filter((c) => !c.error);
  if (!valid.length) return 0;
  const body = valid
    .map((c) => {
      const html = cardHtml(c, o.title, o.t);
      return o.twoCopies ? `<div class="two-copies-row"><div class="copy-cell">${html}</div><div class="copy-divider"></div><div class="copy-cell">${html}</div></div>` : html;
    })
    .join('');
  const doc = buildPrintHtml({ title: o.title, pages: [body], school: o.ctx.school, layout: o.ctx.layout, withHeader: o.ctx.withHeader, extraCss: STYLES + (o.twoCopies ? TWO_COPIES : '') });
  if (o.mode === 'print') await printHtml(doc);
  else await sharePdf(doc, o.fileName, o.twoCopies ? { width: 842, height: 595 } : undefined);
  return valid.length;
}
