/**
 * Official exam paper HTML (student copy or teacher answer key), ported from the web's
 * frontend/src/lib/utils/examPrintEngine.ts. Question text may carry the teacher's own <b>/<i>/<u>
 * markup, so it is inserted as HTML like on the web; header fields are escaped.
 */
import { colors } from '@/lib/colors';
import { escapeHtml } from '@/lib/print';

export type ExamPrintMode = 'student' | 'teacher_key';

export interface ExamHeaderConfig {
  material: string;
  semester: string;
  exam_type: string;
  exam_date: string;
  school_name: string;
  education_monitoring: string;
  classroom: string;
  duration: string;
  academic_year: string;
  total_marks: number;
  auto_calculate_marks: boolean;
  teacher_name: string;
  exam_instructions: string;
}

export interface ExamItem {
  id: string;
  title: string;
  type: string;
  description?: string;
  allocated_marks: number;
  image_url?: string | null;
  correct_answer?: unknown;
  blank_lines_count: number;
  answer_options?: string[];
}

export function examPaperHtml({ header, items, mode, schoolLogoUrl, ministryLogoUrl }: { header: ExamHeaderConfig; items: ExamItem[]; mode: ExamPrintMode; schoolLogoUrl?: string | null; ministryLogoUrl?: string | null }) {
  const key = mode === 'teacher_key';
  const e = escapeHtml;
  const badge = key ? 'نموذج الإجابة (خاص بالمعلم / لجنة التصحيح)' : 'نسخة الطالب (Student Copy)';
  const schoolLogo = schoolLogoUrl ? `<img src="${e(schoolLogoUrl)}" style="max-height:75px;max-width:130px;object-fit:contain"/>` : `<div style="font-weight:bold;font-size:14px;color:${colors.brand}">${e(header.school_name || 'School')}</div>`;
  const ministryLogo = ministryLogoUrl ? `<img src="${e(ministryLogoUrl)}" style="max-height:75px;max-width:130px;object-fit:contain"/>` : `<div style="font-weight:bold;font-size:12px;color:${colors.printMuted}">مراقبة التعليم<br/>Education Monitoring</div>`;
  const blank = (v: string) => e(v || '________________');
  const head = `
<div style="direction:rtl;text-align:right;margin-bottom:24px;border:2px solid ${colors.brand};padding:16px;border-radius:8px;background:${colors.printSurface}">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${colors.brand};padding-bottom:12px;margin-bottom:12px">
    <div>${schoolLogo}</div>
    <div style="text-align:center">
      <h2 style="margin:0;font-size:18px;font-weight:800;color:${colors.brand}">${e(header.school_name || 'المدرسة')}</h2>
      <div style="font-size:13px;font-weight:600;color:${colors.printMuted};margin-top:4px">${e(header.education_monitoring || 'مراقبة التعليم')}</div>
      <div style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:bold;${key ? `background:${colors.destructiveSoft};color:${colors.destructive};border:1px solid ${colors.destructive}` : `background:${colors.infoSoft};color:${colors.brandSecondary};border:1px solid ${colors.brandSecondary}`}">${badge}</div>
    </div>
    <div>${ministryLogo}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:13px;color:${colors.printText};border-bottom:1px dashed ${colors.printBorder};padding-bottom:12px;margin-bottom:12px">
    <div><strong>المادة (Material):</strong> ${blank(header.material)}</div>
    <div><strong>الصف (Classroom):</strong> ${blank(header.classroom)}</div>
    <div><strong>الفصل (Semester):</strong> ${blank(header.semester)}</div>
    <div><strong>السنة الدراسية (Academic Year):</strong> ${blank(header.academic_year)}</div>
    <div><strong>زمن الامتحان (Duration):</strong> ${blank(header.duration)}</div>
    <div><strong>الدرجة الكلية (Total Score):</strong> <span style="font-weight:bold;color:${colors.brand}">${e(header.total_marks)} نقطة</span></div>
    <div><strong>تاريخ الامتحان (Date):</strong> ${e(header.exam_date || '____ / ____ / ________')}</div>
    <div><strong>استاذ المادة (Teacher):</strong> ${blank(header.teacher_name)}</div>
    <div><strong>نوع الامتحان (Type):</strong> ${e(header.exam_type || 'امتحان نهائي')}</div>
  </div>
  ${key ? '' : `<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;color:${colors.printText}"><div>اسم الطالب (Student Name): ______________________________________</div><div>رقم القيد / رقم الجلوس: ____________</div></div>`}
  ${header.exam_instructions ? `<div style="margin-top:10px;padding:8px 12px;background:${colors.white};border-right:4px solid ${colors.brandAccent};border-radius:4px;font-size:12px;color:${colors.printMuted}"><strong>تعليمات مهمة (Instructions):</strong> ${e(header.exam_instructions)}</div>` : ''}
</div>`;

  const body = items
    .map((q, i) => {
      let answer = '';
      if (q.type === 'select' || q.type === 'multiple') {
        const opts = q.answer_options?.length ? q.answer_options : (q.description || '').split('\n').filter(Boolean);
        const multi = q.type === 'multiple';
        answer = `<div style="margin-top:10px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding-right:20px">${opts
          .map((o) => {
            const ok = key && (multi ? Array.isArray(q.correct_answer) && (q.correct_answer as string[]).includes(o) : q.correct_answer === o);
            return `<div style="display:flex;align-items:center;gap:8px;font-size:13px;${ok ? `color:${colors.destructive};font-weight:bold` : `color:${colors.printText}`}"><span style="display:inline-block;width:18px;height:18px;border:1.5px solid ${ok ? colors.destructive : colors.printMuted};${multi ? 'border-radius:3px' : 'border-radius:50%'};background:${ok ? colors.destructiveSoft : colors.white};text-align:center;line-height:16px;font-size:12px">${ok ? '✓' : ''}</span><span>${e(o)}</span></div>`;
          })
          .join('')}</div>`;
      } else if (q.type === 'textarea' || q.type === 'text') {
        const lines = q.blank_lines_count > 0 ? q.blank_lines_count : 4;
        answer =
          key && q.correct_answer
            ? `<div style="margin-top:10px;padding:10px 14px;background:${colors.destructiveSoft};border-right:3px solid ${colors.destructive};border-radius:6px;font-size:13px;color:${colors.destructive}"><strong>نموذج الإجابة (Answer Key):</strong><br/>${e(String(q.correct_answer))}</div>`
            : `<div style="margin-top:10px;padding-right:15px">${`<div style="border-bottom:1px solid ${colors.printBorder};height:28px;margin-bottom:4px"></div>`.repeat(lines)}</div>`;
      } else {
        answer = `<div style="border-bottom:1px dashed ${colors.printBorder};height:30px;margin-top:8px"></div>`;
      }
      return `<div style="margin-bottom:24px;page-break-inside:avoid;direction:rtl;text-align:right">
  <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid ${colors.printBorder};padding-bottom:6px">
    <div style="font-size:15px;font-weight:bold;color:${colors.brand};flex:1">السؤال ${i + 1}: ${q.title}</div>
    <div style="font-size:12px;font-weight:bold;color:${colors.printMuted};background:${colors.printSurface};padding:2px 8px;border-radius:4px;margin-left:8px">[ ${e(q.allocated_marks)} درجات ]</div>
  </div>
  ${q.image_url ? `<div style="margin-top:10px;text-align:center"><img src="${e(q.image_url)}" style="max-height:220px;max-width:100%;border:1px solid ${colors.printBorder};border-radius:6px;padding:4px"/></div>` : ''}
  ${answer}
</div>`;
    })
    .join('');

  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${e(`${header.material || 'Exam'} - ${key ? 'Answer Key' : 'Student Copy'}`)}</title>
<style>@page{size:A4;margin:15mm}body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:${colors.printText};-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head>
<body>${head}${body}</body></html>`;
}
