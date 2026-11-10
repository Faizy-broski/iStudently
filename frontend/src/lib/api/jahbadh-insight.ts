// Jahbadh grades — Wave 5 insight and administration (backend: jahbadh-insight.controller.ts). Types come from the
// shared api-client module (type-only: the web does not import packages at runtime).
import type {
  JgAbsenceImpact, JgApproval, JgAutoComments, JgCertificates, JgEdge, JgEndOfYear, JgEntryAudit, JgEntryProgress,
  JgExcellence, JgInflation, JgInsightSettings, JgMarkingFairness, JgPrediction, JgPrincipalDashboard,
  JgPublicVerification, JgSectionAllocation, JgSupportPlans, JgVerificationArchive, JgVerificationCheck, JgWeakItems,
  JgWhatIfResult, JgWhatIfSaved, JgWorkflow,
} from "@studently/api-client/modules/jahbadh-insight";
import type { JgPhrase, JgCertificateKind, JgWhatIfScenario } from "@/lib/jahbadh";
import { API_URL } from "@/config/api";
import { jgOpenPdfPath, jgRequest } from "./jahbadh-grades";
import { getAuthToken } from "./schools";

export type * from "@studently/api-client/modules/jahbadh-insight";

type Q = Record<string, string | number | null | undefined>;
const q = (params: Q) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};
const sec = (id: string) => `/jahbadh-grades/sections/${encodeURIComponent(id)}`;
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });
type C = string | null | undefined;

export const jgInsightApi = {
  settings: () => jgRequest<JgInsightSettings>(`/jahbadh-grades/insight-settings`),
  saveSettings: (body: Partial<JgInsightSettings>) => jgRequest<JgInsightSettings>(`/jahbadh-grades/insight-settings`, json("PUT", body)),
  phraseBank: () => jgRequest<JgPhrase[]>(`/jahbadh-grades/phrase-bank`),
  savePhraseBank: (phrases: { key: string; m: string; f: string }[]) => jgRequest<JgPhrase[]>(`/jahbadh-grades/phrase-bank`, json("PUT", { phrases })),
  excellenceCategories: () => jgRequest<string[]>(`/jahbadh-grades/excellence-categories`),
  saveExcellenceCategories: (names: string[]) => jgRequest<string[]>(`/jahbadh-grades/excellence-categories`, json("PUT", { names })),

  principalDashboard: (c?: C) => jgRequest<JgPrincipalDashboard>(`/jahbadh-grades/principal-dashboard${q({ campus_id: c })}`),
  sectionAllocation: (query: { from: string; repeat?: string | null; names: string[] }, c?: C) =>
    jgRequest<JgSectionAllocation>(`/jahbadh-grades/section-allocation${q({ from: query.from, repeat: query.repeat, names: query.names.join(","), campus_id: c })}`),
  markingFairness: (gradeLevelId: string, threshold?: number, c?: C) =>
    jgRequest<JgMarkingFairness>(`/jahbadh-grades/marking-fairness${q({ grade_level_id: gradeLevelId, threshold, campus_id: c })}`),

  workflow: (s: string, c?: C) => jgRequest<JgWorkflow>(`${sec(s)}/workflow${q({ campus_id: c })}`),
  prediction: (s: string, studentId?: string | null, c?: C) => jgRequest<JgPrediction>(`${sec(s)}/prediction${q({ student_id: studentId, campus_id: c })}`),
  edgeStudents: (s: string, opts: { margin?: number; need?: number } = {}, c?: C) =>
    jgRequest<JgEdge>(`${sec(s)}/edge-students${q({ margin: opts.margin, need: opts.need, campus_id: c })}`),
  inflation: (s: string, gap?: number, c?: C) => jgRequest<JgInflation>(`${sec(s)}/inflation${q({ gap, campus_id: c })}`),
  autoComments: (s: string, stage: number, c?: C) => jgRequest<JgAutoComments>(`${sec(s)}/auto-comments${q({ stage, campus_id: c })}`),
  weakItems: (s: string, subject: string, stage: number, c?: C) => jgRequest<JgWeakItems>(`${sec(s)}/weak-items${q({ subject, stage, campus_id: c })}`),
  whatIf: (s: string, scenario: JgWhatIfScenario, c?: C) => jgRequest<JgWhatIfResult>(`${sec(s)}/what-if${q({ campus_id: c })}`, json("POST", scenario)),
  whatIfScenarios: (s: string, c?: C) => jgRequest<JgWhatIfSaved[]>(`${sec(s)}/what-if/scenarios${q({ campus_id: c })}`),
  createWhatIfScenario: (s: string, body: { name: string; params: JgWhatIfScenario }, c?: C) =>
    jgRequest<JgWhatIfSaved[]>(`${sec(s)}/what-if/scenarios${q({ campus_id: c })}`, json("POST", body)),
  updateWhatIfScenario: (s: string, id: string, body: { name: string; params: JgWhatIfScenario }, c?: C) =>
    jgRequest<JgWhatIfSaved[]>(`${sec(s)}/what-if/scenarios/${encodeURIComponent(id)}${q({ campus_id: c })}`, json("PUT", body)),
  deleteWhatIfScenario: (s: string, id: string, c?: C) =>
    jgRequest<JgWhatIfSaved[]>(`${sec(s)}/what-if/scenarios/${encodeURIComponent(id)}${q({ campus_id: c })}`, { method: "DELETE" }),
  entryAudit: (s: string, c?: C) => jgRequest<JgEntryAudit>(`${sec(s)}/entry-audit${q({ campus_id: c })}`),
  approval: (s: string, c?: C) => jgRequest<JgApproval>(`${sec(s)}/approval${q({ campus_id: c })}`),
  approve: (s: string, note?: string | null, c?: C) => jgRequest<JgApproval>(`${sec(s)}/approval${q({ campus_id: c })}`, json("POST", { note: note ?? null })),
  verificationArchive: (s: string, c?: C) => jgRequest<JgVerificationArchive>(`${sec(s)}/verification${q({ campus_id: c })}`),
  issueVerificationCodes: (s: string, scope: string, c?: C) =>
    jgRequest<{ codes: Record<string, string> }>(`${sec(s)}/verification${q({ campus_id: c })}`, json("POST", { scope })),
  checkVerificationCode: (s: string, code: string, studentNumber?: string | null, c?: C) =>
    jgRequest<JgVerificationCheck>(`${sec(s)}/verification/check${q({ code, student_number: studentNumber, campus_id: c })}`),
  certificates: (s: string, scope: number | "final", c?: C) => jgRequest<JgCertificates>(`${sec(s)}/certificates${q({ scope, campus_id: c })}`),
  supportPlans: (s: string, opts: { weeks?: number; studentId?: string } = {}, c?: C) =>
    jgRequest<JgSupportPlans>(`${sec(s)}/support-plans${q({ weeks: opts.weeks, student_id: opts.studentId, campus_id: c })}`),
  saveSupportPlan: (s: string, studentId: string, body: { weeks?: number; school_actions?: string[]; home_actions?: string[] }, c?: C) =>
    jgRequest<JgSupportPlans>(`${sec(s)}/support-plans/${encodeURIComponent(studentId)}${q({ campus_id: c })}`, json("PUT", body)),
  absenceImpact: (s: string, c?: C) => jgRequest<JgAbsenceImpact>(`${sec(s)}/absence-impact${q({ campus_id: c })}`),
  entryProgress: (s: string, c?: C) => jgRequest<JgEntryProgress>(`${sec(s)}/entry-progress${q({ campus_id: c })}`),
  sendEntryReminders: (s: string, all: boolean, c?: C) => jgRequest<{ sent: number; rows: number }>(`${sec(s)}/entry-progress/reminders${q({ campus_id: c })}`, json("POST", { all })),
  stageDeadlines: (s: string, c?: C) => jgRequest<Record<number, string | null>>(`${sec(s)}/stage-deadlines${q({ campus_id: c })}`),
  saveStageDeadlines: (s: string, deadlines: Record<number, string | null>, c?: C) =>
    jgRequest<Record<number, string | null>>(`${sec(s)}/stage-deadlines${q({ campus_id: c })}`, json("PUT", deadlines)),
  excellence: (s: string, period: { from?: string; to?: string } = {}, c?: C) =>
    jgRequest<JgExcellence>(`${sec(s)}/excellence${q({ from: period.from, to: period.to, campus_id: c })}`),
  addExcellencePoints: (s: string, body: { student_id: string; category: number; points: number; note?: string; awarded_on?: string }, c?: C) =>
    jgRequest<JgExcellence>(`${sec(s)}/excellence${q({ campus_id: c })}`, json("POST", body)),
  deleteExcellencePoints: (s: string, entryId: string, c?: C) =>
    jgRequest<JgExcellence>(`${sec(s)}/excellence/${encodeURIComponent(entryId)}${q({ campus_id: c })}`, { method: "DELETE" }),
  endOfYear: (s: string, c?: C) => jgRequest<JgEndOfYear>(`${sec(s)}/end-of-year${q({ campus_id: c })}`),
  saveEndOfYear: (s: string, manual: Record<string, number | string>, c?: C) =>
    jgRequest<JgEndOfYear>(`${sec(s)}/end-of-year${q({ campus_id: c })}`, json("PUT", { manual })),
};

/** Insight PDFs, opened in a new tab like the other Jahbadh prints. */
export const openInsightPdf = {
  prediction: (s: string, studentId?: string, c?: C) => jgOpenPdfPath(`${sec(s)}/prediction.pdf${q({ student_id: studentId, campus_id: c })}`),
  edge: (s: string, c?: C) => jgOpenPdfPath(`${sec(s)}/edge-students.pdf${q({ campus_id: c })}`),
  inflation: (s: string, c?: C) => jgOpenPdfPath(`${sec(s)}/inflation.pdf${q({ campus_id: c })}`),
  autoComments: (s: string, stage: number, c?: C) => jgOpenPdfPath(`${sec(s)}/auto-comments.pdf${q({ stage, campus_id: c })}`),
  weakItems: (s: string, subject: string, stage: number, c?: C) => jgOpenPdfPath(`${sec(s)}/weak-items.pdf${q({ subject, stage, campus_id: c })}`),
  audit: (s: string, c?: C) => jgOpenPdfPath(`${sec(s)}/entry-audit.pdf${q({ campus_id: c })}`),
  approval: (s: string, c?: C) => jgOpenPdfPath(`${sec(s)}/approval.pdf${q({ campus_id: c })}`),
  verification: (s: string, c?: C) => jgOpenPdfPath(`${sec(s)}/verification.pdf${q({ campus_id: c })}`),
  certificates: (s: string, kind: JgCertificateKind, scope: number | "final", c?: C) => jgOpenPdfPath(`${sec(s)}/certificates.pdf${q({ kind, scope, campus_id: c })}`),
  supportPlans: (s: string, studentId?: string, c?: C) => jgOpenPdfPath(`${sec(s)}/support-plans.pdf${q({ student_id: studentId, campus_id: c })}`),
  absenceImpact: (s: string, c?: C) => jgOpenPdfPath(`${sec(s)}/absence-impact.pdf${q({ campus_id: c })}`),
  entryProgress: (s: string, c?: C) => jgOpenPdfPath(`${sec(s)}/entry-progress.pdf${q({ campus_id: c })}`),
  excellence: (s: string, period: { from?: string; to?: string } = {}, c?: C) => jgOpenPdfPath(`${sec(s)}/excellence.pdf${q({ from: period.from, to: period.to, campus_id: c })}`),
  endOfYear: (s: string, c?: C) => jgOpenPdfPath(`${sec(s)}/end-of-year.pdf${q({ campus_id: c })}`),
  principalDashboard: (c?: C) => jgOpenPdfPath(`/jahbadh-grades/principal-dashboard.pdf${q({ campus_id: c })}`),
  allocation: (query: { from: string; repeat?: string | null; names: string[] }, c?: C) =>
    jgOpenPdfPath(`/jahbadh-grades/section-allocation.pdf${q({ from: query.from, repeat: query.repeat, names: query.names.join(","), campus_id: c })}`),
  fairness: (gradeLevelId: string, threshold?: number, c?: C) => jgOpenPdfPath(`/jahbadh-grades/marking-fairness.pdf${q({ grade_level_id: gradeLevelId, threshold, campus_id: c })}`),
};

/** What-if PDF: the scenario goes in a POST body, so fetch a blob and open it (opened synchronously in the click). */
export async function openWhatIfPdf(sectionId: string, scenario: JgWhatIfScenario, campusId?: C) {
  const win = window.open("", "_blank");
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${sec(sectionId)}/what-if.pdf${q({ campus_id: campusId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify(scenario),
  });
  if (!res.ok) {
    win?.close();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const url = URL.createObjectURL(await res.blob());
  if (win) win.location.href = url;
  else window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Public (no sign-in): the page behind the QR printed on report cards. */
export async function publicVerifyReportCard(code: string): Promise<JgPublicVerification> {
  const res = await fetch(`${API_URL}/jahbadh-verify/${encodeURIComponent(code)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.error || `HTTP ${res.status}`);
  return body.data as JgPublicVerification;
}
