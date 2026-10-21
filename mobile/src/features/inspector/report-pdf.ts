import type { CoachingNote, InspectionReportDetail, TeacherEvaluation } from '@studently/api-client';

import { colors } from '@/lib/colors';
import { escapeHtml } from '@/lib/print';

type T = (key: string, o?: Record<string, unknown>) => string;

/** The inspection report document (web: InspectionReportDocument generateReportPdfBlob), as print HTML. */
export function reportPdfHtml({ report, evaluation, notes, t, locale }: { report: InspectionReportDetail; evaluation: TeacherEvaluation; notes: CoachingNote[]; t: T; locale: string }) {
  const r = (k: string, o?: Record<string, unknown>) => t(`inspections.reports.${k}`, o);
  const dt = (d: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
  const scores = new Map(evaluation.scores.map((s) => [s.criterion_id, s]));
  const teacher = report.teacher ? `${report.teacher.first_name} ${report.teacher.last_name}` : '—';
  const cats = (evaluation.rubric_template?.categories ?? [])
    .map(
      (c) => `<div class="cat">${escapeHtml(c.name)} (${c.weight}%)</div>${c.criteria
        .map((cr) => {
          const s = scores.get(cr.id);
          return `<div class="row"><span>${escapeHtml(cr.name)}</span><b>${s ? `${s.score}/5` : '—'}</b></div>${s?.comment ? `<div class="cm">${escapeHtml(s.comment)}</div>` : ''}`;
        })
        .join('')}`,
    )
    .join('');
  const noteRows = notes.length
    ? `<h2>${escapeHtml(t('inspections.coaching.page_title'))}</h2>${notes
        .map((n) => `<div class="row"><b>${escapeHtml(t(`inspections.coaching.note_type_${n.note_type}`))}:</b><span class="grow">${escapeHtml(n.content)}</span></div>`)
        .join('')}`
    : '';
  const byRole = new Map(report.signatures.map((s) => [s.signer_role, s]));
  const sigs = (['teacher', 'principal', 'inspector'] as const)
    .map((role) => {
      const s = byRole.get(role);
      return `<div class="sig"><b>${escapeHtml(r(`role_${role}`))}</b><div>${s ? escapeHtml(s.typed_full_name) : `<span class="muted">${escapeHtml(r('pending_signature'))}</span>`}</div>${s ? `<div class="small">${escapeHtml(dt(s.attested_at))}</div>` : ''}</div>`;
    })
    .join('');
  return `<!doctype html><html dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:12px;color:${colors.printText};margin:32px}
    h1{text-align:center;font-size:20px;margin:0}.school{text-align:center;margin:6px 0 18px}
    h2{font-size:15px;margin:18px 0 8px}.cat{background:${colors.printSurface};font-weight:bold;padding:4px 8px;margin-top:12px}
    .row{display:flex;justify-content:space-between;gap:12px;padding:4px 8px}.grow{flex:1}
    .cm{font-style:italic;font-size:11px;padding:0 12px 4px}.sigs{display:flex;gap:12px}.sig{flex:1}
    .small{font-size:10px;color:${colors.printMuted}}.muted{color:${colors.printMuted}}.foot{text-align:center;font-size:10px;color:${colors.printMuted};margin-top:24px;font-style:italic}
  </style></head><body>
    <h1>${escapeHtml(r('page_title'))}</h1><div class="school">${escapeHtml(report.school?.name ?? '')}</div>
    <div>${escapeHtml(t('app.in_pdf_teacher'))}: ${escapeHtml(teacher)}</div>
    <div>${escapeHtml(t('inspections.dashboard.stat_avg_score'))}: ${evaluation.overall_score !== null ? `${evaluation.overall_score} / 100` : '—'}</div>
    <div>${escapeHtml(dt(evaluation.submitted_at ?? report.created_at))}</div>
    ${cats}${noteRows}
    <h2>${escapeHtml(r('signatures_title'))}</h2><div class="sigs">${sigs}</div>
    <div class="foot">${escapeHtml(dt(new Date().toISOString()))}</div>
  </body></html>`;
}
