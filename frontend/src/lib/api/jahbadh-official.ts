// Jahbadh grades — Wave 2 official outputs (backend: jahbadh-official.controller.ts). Types come from the
// shared api-client module (type-only: the web does not import packages at runtime).
import type {
  JgFinalSheet, JgGuardianNotices, JgMarkingSheets, JgMonthlyCards, JgMonthlyCurve, JgNoticesSent, JgReviewSheet,
  JgRound2EntrySheet, JgRound2Notices, JgRound2TimetableRow, JgStatistics, JgTopStudents,
} from "@studently/api-client/modules/jahbadh-official";
import type { JgScope } from "@studently/api-client/modules/jahbadh-grades";
import { API_URL } from "@/config/api";
import { jgOpenPdfPath, jgRequest } from "./jahbadh-grades";
import { getAuthToken } from "./schools";

export type * from "@studently/api-client/modules/jahbadh-official";

type Range = { from?: number; to?: number; studentId?: string };
type Q = Record<string, string | number | null | undefined>;

const q = (params: Q) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};
const sec = (id: string) => `/jahbadh-grades/sections/${encodeURIComponent(id)}`;
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });
const range = (r: Range = {}) => ({ from: r.from, to: r.to, student_id: r.studentId });

export const jgOfficialApi = {
  statistics: (s: string, c?: string | null) => jgRequest<JgStatistics>(`${sec(s)}/statistics${q({ campus_id: c })}`),
  topStudents: (s: string, n?: number, c?: string | null) => jgRequest<JgTopStudents>(`${sec(s)}/top-students${q({ n, campus_id: c })}`),
  finalSheet: (s: string, c?: string | null) => jgRequest<JgFinalSheet>(`${sec(s)}/final-sheet${q({ campus_id: c })}`),
  reviewSheet: (s: string, c?: string | null) => jgRequest<JgReviewSheet>(`${sec(s)}/review-sheet${q({ campus_id: c })}`),
  round2EntrySheet: (s: string, c?: string | null) => jgRequest<JgRound2EntrySheet>(`${sec(s)}/second-round/entry-sheet${q({ campus_id: c })}`),
  round2Timetable: (s: string, c?: string | null) => jgRequest<JgRound2TimetableRow[]>(`${sec(s)}/second-round/timetable${q({ campus_id: c })}`),
  saveRound2Timetable: (s: string, entries: { jg_subject_id: string; exam_date?: string | null; exam_time?: string | null; place?: string | null }[], c?: string | null) =>
    jgRequest<JgRound2TimetableRow[]>(`${sec(s)}/second-round/timetable${q({ campus_id: c })}`, json("PUT", { entries })),
  round2Notices: (s: string, c?: string | null) => jgRequest<JgRound2Notices>(`${sec(s)}/second-round/notices${q({ campus_id: c })}`),
  sendRound2Notices: (s: string, c?: string | null) => jgRequest<JgNoticesSent>(`${sec(s)}/second-round/notices/send${q({ campus_id: c })}`, json("POST", {})),
  guardianNotices: (s: string, stage: number, c?: string | null) => jgRequest<JgGuardianNotices>(`${sec(s)}/guardian-notices${q({ stage, campus_id: c })}`),
  sendGuardianNotices: (s: string, stage: number, c?: string | null) =>
    jgRequest<JgNoticesSent>(`${sec(s)}/guardian-notices/send${q({ campus_id: c })}`, json("POST", { stage })),
  monthlyCards: (s: string, query: { stage?: number; month?: number } & Range = {}, c?: string | null) =>
    jgRequest<JgMonthlyCards>(`${sec(s)}/monthly-cards${q({ stage: query.stage, month: query.month, ...range(query), campus_id: c })}`),
  monthlyCurve: (s: string, studentId?: string, c?: string | null) => jgRequest<JgMonthlyCurve>(`${sec(s)}/monthly-curve${q({ student_id: studentId, campus_id: c })}`),
  markingSheets: (s: string, stage: number, subject = "all", c?: string | null) =>
    jgRequest<JgMarkingSheets>(`${sec(s)}/marking-sheets${q({ stage, subject, campus_id: c })}`),
};

/** Official PDFs, opened in a new tab like the other Jahbadh prints. */
export const openOfficialPdf = {
  statistics: (s: string, c?: string | null) => jgOpenPdfPath(`${sec(s)}/statistics.pdf${q({ campus_id: c })}`),
  topStudents: (s: string, n?: number, c?: string | null) => jgOpenPdfPath(`${sec(s)}/top-students.pdf${q({ n, campus_id: c })}`),
  finalSheet: (s: string, c?: string | null) => jgOpenPdfPath(`${sec(s)}/final-sheet.pdf${q({ campus_id: c })}`),
  reviewSheet: (s: string, c?: string | null) => jgOpenPdfPath(`${sec(s)}/review-sheet.pdf${q({ campus_id: c })}`),
  round2EntrySheet: (s: string, c?: string | null) => jgOpenPdfPath(`${sec(s)}/second-round/entry-sheet.pdf${q({ campus_id: c })}`),
  round2Notices: (s: string, c?: string | null) => jgOpenPdfPath(`${sec(s)}/second-round/notices.pdf${q({ campus_id: c })}`),
  guardianNotices: (s: string, stage: number, c?: string | null) => jgOpenPdfPath(`${sec(s)}/guardian-notices.pdf${q({ stage, campus_id: c })}`),
  monthlyCards: (s: string, query: { stage?: number; month?: number } & Range = {}, c?: string | null) =>
    jgOpenPdfPath(`${sec(s)}/monthly-cards.pdf${q({ stage: query.stage, month: query.month, ...range(query), campus_id: c })}`),
  monthlyCurve: (s: string, studentId?: string, c?: string | null) => jgOpenPdfPath(`${sec(s)}/monthly-curve.pdf${q({ student_id: studentId, campus_id: c })}`),
  markingSheets: (s: string, stage: number, subject = "all", c?: string | null) =>
    jgOpenPdfPath(`${sec(s)}/marking-sheets.pdf${q({ stage, subject, campus_id: c })}`),
};

/** «تنزيل الصحائف منفصلة»: ZIP with one PDF per student plus the merged PDF (B6-47). */
export async function downloadReportCardsZip(s: string, scope: JgScope, r: Range = {}, c?: string | null) {
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${sec(s)}/report-cards.zip${q({ scope, ...range(r), campus_id: c })}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-cards-${scope}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
