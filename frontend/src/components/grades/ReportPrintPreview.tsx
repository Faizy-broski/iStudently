"use client";

// ============================================================================
// Report Print — Direct print, no preview dialog
// Opens a new window with formatted report cards and triggers print immediately
// ============================================================================

import { openPdfDownload, type PrintSchool } from "@/lib/utils/printLayout"
import type { PdfHeaderFooterSettings } from "@/lib/api/school-settings"

export interface ReportCardData {
  student?: {
    id?: string;
    student_number?: string;
    admission_date?: string;
    grade_level?: string;
    profile?: {
      first_name?: string;
      father_name?: string;
      grandfather_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      profile_photo_url?: string;
    };
    section?: { name?: string; grade_level?: { name?: string } };
    school?: {
      name?: string;
      address?: string;
      logo_url?: string;
      phone?: string;
    };
  };
  school?: {
    name?: string;
    address?: string;
    logo_url?: string;
    phone?: string;
  };
  marking_period?: {
    title?: string;
    short_name?: string;
    start_date?: string;
    end_date?: string;
  };
  academic_year?: { name?: string; start_date?: string; end_date?: string };
  grades?: Array<{
    course_title?: string;
    subject_name?: string;
    teacher_name?: string;
    percent_grade?: number | null;
    letter_grade?: string | null;
    gpa_value?: number | null;
    credit_hours?: number;
    comments?: Array<{
      comment?: { comment_text?: string };
      custom_comment?: string;
    }>;
  }>;
  summary?: {
    total_credits_attempted?: number;
    total_credits_earned?: number;
    gpa?: number | null;
  };
  options?: Record<string, unknown>;
  student_id?: string;
  marking_period_id?: string;
  error?: string;
}

function getStudentName(
  profile?: ReportCardData["student"] extends infer S
    ? S extends { profile?: infer P }
      ? P
      : never
    : never
): string {
  if (!profile) return "—";
  const p = profile as Record<string, string | undefined>;
  return [p.first_name, p.father_name, p.grandfather_name, p.last_name]
    .filter(Boolean)
    .join(" ");
}

function buildCardHtml(card: ReportCardData, title: string): string {
  const student = card.student;
  const school = card.school || student?.school;
  const mp = card.marking_period;
  const ay = card.academic_year;
  const grades = card.grades || [];
  const summary = card.summary;
  const opts = (card.options || {}) as Record<string, unknown>;

  let html = `<div class="report-card">`;

  // School header — RosarioSIS-style coloured record band
  html += `<div class="report-card-school">`
  if (school?.logo_url)
    html += `<img src="${school.logo_url}" alt="" class="school-logo" />`
  html += `<div class="school-info"><div class="school-name">${school?.name || "School"}</div>`
  if (school?.address) html += `<div class="school-detail">${school.address}</div>`
  if (school?.phone) html += `<div class="school-detail">${school.phone}</div>`
  html += `</div></div>`

  html += `<div class="report-title">${title}</div>`

  // Student info
  html += `<div class="student-info">`;
  html += `<div><span class="label">Student: </span><span class="value">${getStudentName(student?.profile)}</span></div>`;
  html += `<div><span class="label">ID: </span><span class="value">${student?.student_number || "—"}</span></div>`;
  html += `<div><span class="label">Grade Level: </span><span class="value">${student?.section?.grade_level?.name || student?.grade_level || "—"}</span></div>`;
  html += `<div><span class="label">Section: </span><span class="value">${student?.section?.name || "—"}</span></div>`;
  if (mp)
    html += `<div><span class="label">Marking Period: </span><span class="value">${mp.title || mp.short_name || "—"}</span></div>`;
  if (ay)
    html += `<div><span class="label">Academic Year: </span><span class="value">${ay.name || "—"}</span></div>`;
  html += `</div>`;

  // Grades table
  if (grades.length > 0) {
    html += `<table class="grades-table"><thead><tr>`;
    html += `<th>Course / Subject</th>`;
    if (opts.include_teacher) html += `<th>Teacher</th>`;
    if (opts.include_percents) html += `<th class="num">%</th>`;
    html += `<th class="num">Grade</th>`;
    html += `<th class="num">GPA</th>`;
    if (opts.include_credits) html += `<th class="num">Credits</th>`;
    html += `</tr></thead><tbody>`;

    for (const g of grades) {
      html += `<tr>`;
      html += `<td>${g.course_title || g.subject_name || "—"}</td>`;
      if (opts.include_teacher)
        html += `<td>${g.teacher_name || "—"}</td>`;
      if (opts.include_percents)
        html += `<td class="num">${g.percent_grade != null ? `${g.percent_grade}%` : "—"}</td>`;
      html += `<td class="num">${g.letter_grade || "—"}</td>`;
      html += `<td class="num">${g.gpa_value != null ? g.gpa_value.toFixed(2) : "—"}</td>`;
      if (opts.include_credits)
        html += `<td class="num">${g.credit_hours || "—"}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table>`;
  } else {
    html += `<p class="no-grades">No grades recorded for this period.</p>`;
  }

  // Summary
  if (summary) {
    html += `<div class="summary-row">`;
    if (summary.gpa != null)
      html += `<div class="item"><span class="label">GPA:</span><span>${summary.gpa.toFixed(2)}</span></div>`;
    html += `<div class="item"><span class="label">Credits Attempted:</span><span>${summary.total_credits_attempted ?? 0}</span></div>`;
    html += `<div class="item"><span class="label">Credits Earned:</span><span>${summary.total_credits_earned ?? 0}</span></div>`;
    html += `</div>`;
  }

  // Comments
  if (
    opts.include_comments &&
    grades.some((g) => g.comments && g.comments.length > 0)
  ) {
    html += `<div class="comments-section"><h4>Comments</h4>`;
    for (const g of grades) {
      if (!g.comments || g.comments.length === 0) continue;
      html += `<div><strong>${g.course_title}: </strong>`;
      html += g.comments
        .map((c) => c.custom_comment || c.comment?.comment_text || "")
        .filter(Boolean)
        .join("; ");
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

const REPORT_BODY_STYLES = `
  .report-card { page-break-after: always; padding: 24px 32px; max-width: 800px; margin: 0 auto; }
  .report-card:last-child { page-break-after: avoid; }
  /* School banner at top of each card */
  .report-card-school { display:flex; align-items:center; gap:12px; padding:10px 14px; background:#f0f4f8; border:1px solid #d0dae8; border-radius:6px; margin-bottom:12px; }
  .school-logo { height:48px; width:48px; object-fit:contain; border-radius:4px; flex-shrink:0; }
  .school-info .school-name { font-size:15px; font-weight:700; color:#1e3a5f; }
  .school-info .school-detail { font-size:11px; color:#555; margin-top:2px; }
  .report-title { text-align: center; font-size: 16px; font-weight: 700; color: #333; margin: 12px 0 16px; text-transform: uppercase; letter-spacing: 1px; }
  .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 16px; font-size: 12px; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; }
  .student-info .label { font-weight: 600; color: #555; }
  .student-info .value { color: #1a1a1a; }
  .grades-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
  .grades-table th { background: #1e3a5f; color: white; padding: 6px 10px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  .grades-table td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; }
  .grades-table tr:nth-child(even) { background: #f8fafc; }
  .grades-table .num { text-align: center; }
  .summary-row { display: flex; justify-content: space-between; background: #f0f9ff; padding: 8px 14px; border-radius: 6px; font-size: 12px; border: 1px solid #bae6fd; margin-bottom: 12px; }
  .summary-row .item { display: flex; gap: 6px; }
  .summary-row .label { font-weight: 600; color: #1e3a5f; }
  .comments-section { margin-top: 8px; font-size: 11px; }
  .comments-section h4 { font-size: 12px; font-weight: 600; margin-bottom: 4px; color: #555; }
  .no-grades { font-size: 12px; color: #999; padding: 12px 0; }
`;

/**
 * Generates and downloads a PDF with all report cards.
 * No print dialog — directly downloads as a PDF file.
 */
export async function printReportCards(
  title: string,
  reportCards: ReportCardData[],
  pdfSettings?: PdfHeaderFooterSettings | null,
  campusName?: string,
  school?: PrintSchool,
  pluginActive?: boolean,
): Promise<void> {
  const validCards = reportCards.filter((c) => !c.error);
  if (validCards.length === 0) return;

  const bodyHtml = validCards
    .map((card) => buildCardHtml(card, title))
    .join("\n");

  const resolvedSchool: PrintSchool = school ?? {
    name: campusName || "",
    logo_url: validCards[0]?.school?.logo_url || validCards[0]?.student?.school?.logo_url,
    address: validCards[0]?.school?.address || validCards[0]?.student?.school?.address,
    phone: validCards[0]?.school?.phone || validCards[0]?.student?.school?.phone,
  };

  await openPdfDownload({
    title,
    bodyHtml,
    bodyStyles: REPORT_BODY_STYLES,
    school: resolvedSchool,
    pdfSettings,
    pluginActive,
  });
}

/**
 * Default export kept for backward compat — renders nothing,
 * auto-prints when opened.
 */
export default function ReportPrintPreview({
  open,
  onClose,
  title,
  reportCards,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  reportCards: ReportCardData[];
}) {
  if (open && reportCards.length > 0) {
    setTimeout(() => {
      printReportCards(title, reportCards);
      onClose();
    }, 0);
  }
  return null;
}
