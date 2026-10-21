// Jahbadh grades plugin (backend: /jahbadh-grades). Types come from the shared api-client module
// (type-only: the web does not import packages at runtime).
import type {
  JgAuditEntry, JgCellInput, JgGrade, JgGradeMapEntry, JgGrid, JgLock, JgResults, JgRuleUpdate,
  JgSecondRound, JgSectionListItem, JgSectionOverview, JgSettings, JgSubjectLinks,
  JgActivities, JgActivityInput, JgDashboard, JgEarlyWarning, JgLearningGroups, JgStudentProfile, JgSubjectAnalysisResponse,
  JgTestSummary, JgTest, JgTestInput, JgRubricSummary, JgRubric, JgRubricInput, JgReportCardSettings, JgReportCardPreview, JgReportCardOptions, JgPublication, JgMyReportCard, JgScope,
} from "@studently/api-client/modules/jahbadh-grades";
import { API_URL } from "@/config/api";
import { apiRequest, type ApiResponse } from "./index";
import { getAuthToken } from "./schools";

export type * from "@studently/api-client/modules/jahbadh-grades";

/** Error returned by the API, with its stable code (not_setup, not_mapped, invalid_marks…) and details. */
export interface JgApiError { error: string; code?: string; details?: unknown }

const BASE = "/jahbadh-grades";
const q = (params: Record<string, string | number | null | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};
const sec = (id: string) => `${BASE}/sections/${encodeURIComponent(id)}`;
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

/** Like apiRequest, but keeps the error code and details the grades API returns. */
export async function jgRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T> & { code?: string; details?: unknown }> {
  const token = await getAuthToken();
  if (!token) return { success: false, error: "Authentication required" };
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) return { success: false, error: body.error || `HTTP ${res.status}`, code: body.code, details: body.details };
    return { success: true, data: body.data as T };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export const jgApi = {
  rules: (campusId?: string | null) => apiRequest<{ source: "school" | "template"; grades: JgGrade[] }>(`${BASE}/rules${q({ campus_id: campusId })}`),
  rule: (gradeCode: number, campusId?: string | null) => apiRequest<JgGrade>(`${BASE}/rules/${gradeCode}${q({ campus_id: campusId })}`),
  updateRule: (gradeCode: number, body: JgRuleUpdate, campusId?: string | null) => jgRequest<JgGrade>(`${BASE}/rules/${gradeCode}${q({ campus_id: campusId })}`, json("PUT", body)),
  setup: (campusId?: string | null) => jgRequest<{ created: boolean; grades: number }>(`${BASE}/setup${q({ campus_id: campusId })}`, json("POST", {})),

  settings: (campusId?: string | null) => apiRequest<JgSettings>(`${BASE}/settings${q({ campus_id: campusId })}`),
  saveSettings: (body: Partial<JgSettings>, campusId?: string | null) => jgRequest<JgSettings>(`${BASE}/settings`, json("PUT", { ...body, campus_id: campusId ?? null })),
  gradeMap: (campusId?: string | null) => apiRequest<JgGradeMapEntry[]>(`${BASE}/grade-map${q({ campus_id: campusId })}`),
  saveGradeMap: (entries: { grade_level_id: string; grade_code: number | null }[], campusId?: string | null) =>
    jgRequest<JgGradeMapEntry[]>(`${BASE}/grade-map`, json("PUT", { entries, campus_id: campusId ?? undefined })),
  subjectLinks: (gradeLevelId: string, campusId?: string | null) => jgRequest<JgSubjectLinks>(`${BASE}/subject-links${q({ grade_level_id: gradeLevelId, campus_id: campusId })}`),
  saveSubjectLinks: (gradeLevelId: string, entries: { jg_subject_id: string; subject_id: string | null }[], campusId?: string | null) =>
    jgRequest<JgSubjectLinks>(`${BASE}/subject-links`, json("PUT", { grade_level_id: gradeLevelId, entries, campus_id: campusId ?? undefined })),

  sections: (campusId?: string | null) => apiRequest<JgSectionListItem[]>(`${BASE}/sections${q({ campus_id: campusId })}`),
  sectionSubjects: (sectionId: string, campusId?: string | null) => jgRequest<JgSectionOverview>(`${sec(sectionId)}/subjects${q({ campus_id: campusId })}`),
  grid: (sectionId: string, subjectId: string, campusId?: string | null) =>
    jgRequest<JgGrid>(`${sec(sectionId)}/subjects/${encodeURIComponent(subjectId)}/grid${q({ campus_id: campusId })}`),
  saveMarks: (sectionId: string, subjectId: string, cells: JgCellInput[], campusId?: string | null) =>
    jgRequest<JgGrid>(`${sec(sectionId)}/subjects/${encodeURIComponent(subjectId)}/marks${q({ campus_id: campusId })}`, json("PUT", { cells })),
  saveRound2: (sectionId: string, subjectId: string, entries: { student_id: string; value: number | null }[], campusId?: string | null) =>
    jgRequest<JgGrid>(`${sec(sectionId)}/subjects/${encodeURIComponent(subjectId)}/round2${q({ campus_id: campusId })}`, json("PUT", { entries })),
  locks: (sectionId: string, campusId?: string | null) => apiRequest<JgLock[]>(`${sec(sectionId)}/locks${q({ campus_id: campusId })}`),
  addLock: (sectionId: string, stage: number, subjectId: string | null, campusId?: string | null) =>
    jgRequest<JgLock[]>(`${sec(sectionId)}/locks${q({ campus_id: campusId })}`, json("POST", { stage, subject_id: subjectId })),
  removeLock: (sectionId: string, lockId: string, campusId?: string | null) =>
    jgRequest<JgLock[]>(`${sec(sectionId)}/locks/${encodeURIComponent(lockId)}${q({ campus_id: campusId })}`, { method: "DELETE" }),
  results: (sectionId: string, campusId?: string | null) => jgRequest<JgResults>(`${sec(sectionId)}/results${q({ campus_id: campusId })}`),
  secondRound: (sectionId: string, campusId?: string | null) => jgRequest<JgSecondRound>(`${sec(sectionId)}/second-round${q({ campus_id: campusId })}`),
  activities: (sectionId: string, stage: number, campusId?: string | null) => jgRequest<JgActivities>(`${sec(sectionId)}/activities${q({ stage, campus_id: campusId })}`),
  saveActivities: (sectionId: string, stage: number, body: { school_days?: number | null; entries: JgActivityInput[] }, campusId?: string | null) =>
    jgRequest<JgActivities>(`${sec(sectionId)}/activities${q({ campus_id: campusId })}`, json("PUT", { ...body, stage })),
  reportCardSettings: (sectionId: string, campusId?: string | null) => jgRequest<JgReportCardSettings>(`${sec(sectionId)}/report-card-settings${q({ campus_id: campusId })}`),
  saveReportCardSettings: (sectionId: string, body: Partial<JgReportCardSettings>, campusId?: string | null) =>
    jgRequest<JgReportCardSettings>(`${sec(sectionId)}/report-card-settings${q({ campus_id: campusId })}`, json("PUT", body)),
  reportCards: (sectionId: string, scope: JgScope, campusId?: string | null) =>
    jgRequest<{ cards: JgReportCardPreview[]; options: JgReportCardOptions }>(`${sec(sectionId)}/report-cards${q({ scope, campus_id: campusId })}`),
  publications: (sectionId: string, campusId?: string | null) => jgRequest<JgPublication[]>(`${sec(sectionId)}/publications${q({ campus_id: campusId })}`),
  publish: (sectionId: string, scope: JgScope, campusId?: string | null) => jgRequest<JgPublication[]>(`${sec(sectionId)}/publications${q({ campus_id: campusId })}`, json("POST", { scope })),
  unpublish: (sectionId: string, id: string, campusId?: string | null) =>
    jgRequest<JgPublication[]>(`${sec(sectionId)}/publications/${encodeURIComponent(id)}${q({ campus_id: campusId })}`, { method: "DELETE" }),
  dashboard: (sectionId: string, campusId?: string | null) => jgRequest<JgDashboard>(`${sec(sectionId)}/dashboard${q({ campus_id: campusId })}`),
  earlyWarning: (sectionId: string, campusId?: string | null) => jgRequest<JgEarlyWarning>(`${sec(sectionId)}/early-warning${q({ campus_id: campusId })}`),
  learningGroups: (sectionId: string, subjectId: string | null, campusId?: string | null) =>
    jgRequest<JgLearningGroups>(`${sec(sectionId)}/groups${q({ subject: subjectId, campus_id: campusId })}`),
  studentProfile: (sectionId: string, studentId: string, campusId?: string | null) =>
    jgRequest<JgStudentProfile>(`${sec(sectionId)}/students/${encodeURIComponent(studentId)}/profile${q({ campus_id: campusId })}`),
  subjectAnalysis: (sectionId: string, query: AnalysisQuery, campusId?: string | null) =>
    jgRequest<JgSubjectAnalysisResponse>(`${sec(sectionId)}/subject-analysis${q({ ...query, campus_id: campusId })}`),
  tests: (sectionId: string, campusId?: string | null) => jgRequest<JgTestSummary[]>(`${sec(sectionId)}/tests${q({ campus_id: campusId })}`),
  test: (sectionId: string, id: string, campusId?: string | null) => jgRequest<JgTest>(`${sec(sectionId)}/tests/${encodeURIComponent(id)}${q({ campus_id: campusId })}`),
  saveTest: (sectionId: string, id: string | null, body: JgTestInput, campusId?: string | null) =>
    id
      ? jgRequest<JgTest>(`${sec(sectionId)}/tests/${encodeURIComponent(id)}${q({ campus_id: campusId })}`, json("PUT", body))
      : jgRequest<JgTest>(`${sec(sectionId)}/tests${q({ campus_id: campusId })}`, json("POST", body)),
  deleteTest: (sectionId: string, id: string, campusId?: string | null) =>
    jgRequest<JgTestSummary[]>(`${sec(sectionId)}/tests/${encodeURIComponent(id)}${q({ campus_id: campusId })}`, { method: "DELETE" }),
  rubrics: (sectionId: string, campusId?: string | null) => jgRequest<JgRubricSummary[]>(`${sec(sectionId)}/rubrics${q({ campus_id: campusId })}`),
  rubric: (sectionId: string, id: string, campusId?: string | null) => jgRequest<JgRubric>(`${sec(sectionId)}/rubrics/${encodeURIComponent(id)}${q({ campus_id: campusId })}`),
  saveRubric: (sectionId: string, id: string | null, body: JgRubricInput, campusId?: string | null) =>
    id
      ? jgRequest<JgRubric>(`${sec(sectionId)}/rubrics/${encodeURIComponent(id)}${q({ campus_id: campusId })}`, json("PUT", body))
      : jgRequest<JgRubric>(`${sec(sectionId)}/rubrics${q({ campus_id: campusId })}`, json("POST", body)),
  deleteRubric: (sectionId: string, id: string, campusId?: string | null) =>
    jgRequest<JgRubricSummary[]>(`${sec(sectionId)}/rubrics/${encodeURIComponent(id)}${q({ campus_id: campusId })}`, { method: "DELETE" }),
  applyRubric: (sectionId: string, id: string, subjectId: string, componentId: string, campusId?: string | null) =>
    jgRequest<{ applied: number; component: string }>(`${sec(sectionId)}/rubrics/${encodeURIComponent(id)}/apply${q({ campus_id: campusId })}`, json("POST", { subject_id: subjectId, component_id: componentId })),
  myReportCards: () => jgRequest<JgMyReportCard[]>(`${BASE}/my/report-cards`),
  audit: (sectionId: string, campusId?: string | null) => apiRequest<JgAuditEntry[]>(`${sec(sectionId)}/audit${q({ campus_id: campusId })}`),
};

export type AnalysisQuery = { subject?: string; measure?: string; compare?: string; pass?: number }

/** Analytics PDFs: student profile, subject analysis card, test item analysis. */
export function openAnalyticsPdf(
  kind: { type: "profile"; studentId: string } | { type: "analysis"; query: AnalysisQuery } | { type: "test"; testId: string },
  sectionId: string,
  campusId?: string | null,
) {
  const path =
    kind.type === "profile"
      ? `${sec(sectionId)}/students/${encodeURIComponent(kind.studentId)}/profile/pdf${q({ campus_id: campusId })}`
      : kind.type === "analysis"
        ? `${sec(sectionId)}/subject-analysis/pdf${q({ ...kind.query, campus_id: campusId })}`
        : `${sec(sectionId)}/tests/${encodeURIComponent(kind.testId)}/pdf${q({ campus_id: campusId })}`;
  return jgOpenPdfPath(path);
}

/** Opens a server PDF (results, second round, sample card) in a new tab. */
export async function openJgPdf(kind: "results" | "second-round" | "sample", sectionId?: string, campusId?: string | null) {
  const path = kind === "sample" ? `${BASE}/sample-report-card.pdf` : `${sec(sectionId!)}/${kind}.pdf`;
  return jgOpenPdfPath(`${path}${q({ campus_id: campusId })}`);
}

/** Report cards of a section as one PDF (scope, optional list-number range or one student). */
export function openReportCardsPdf(sectionId: string, scope: JgScope, range: { from?: number; to?: number; studentId?: string }, campusId?: string | null) {
  return jgOpenPdfPath(`${sec(sectionId)}/report-cards.pdf${q({ scope, from: range.from, to: range.to, student_id: range.studentId, campus_id: campusId })}`);
}

/** A released report card (students and parents). */
export function openMyReportCard(studentId: string, scope: JgScope) {
  return jgOpenPdfPath(`${BASE}/my/report-cards/${encodeURIComponent(studentId)}/${scope}`);
}

export async function jgOpenPdfPath(pathWithQuery: string) {
  // Open the tab synchronously (inside the click) so pop-up blockers allow it, then load the PDF into it.
  const win = window.open("", "_blank");
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${pathWithQuery}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
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
