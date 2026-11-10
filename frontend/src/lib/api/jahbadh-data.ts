// Jahbadh grades, Wave 2 data workflows (backend: jahbadh-data.controller.ts): name import, daily
// attendance, rollover to next year, homeroom teacher. Types come from the shared api-client module.
import type {
  JgAttendanceCalendar, JgAttendanceEntry, JgDailyAttendance, JgHomeroom, JgImportMapping, JgImportPreview,
  JgImportResult, JgRolloverPreview, JgRolloverResult,
} from "@studently/api-client/modules/jahbadh-data";
import { API_URL } from "@/config/api";
import { getAuthToken } from "./schools";
import { jgRequest } from "./jahbadh-grades";

export type * from "@studently/api-client/modules/jahbadh-data";

const BASE = "/jahbadh-grades";
const q = (params: Record<string, string | number | null | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};
const sec = (id: string) => `${BASE}/sections/${encodeURIComponent(id)}`;
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export interface JgImportInput { text?: string; file?: File | null; has_header?: boolean; mapping?: JgImportMapping }

type Result<T> = { success: boolean; data?: T; error?: string; code?: string; details?: unknown };

/** Name import: pasted text goes as JSON, a .csv/.xlsx file as multipart (no JSON content type). */
async function importRequest<T>(path: string, input: JgImportInput, campusId?: string | null): Promise<Result<T>> {
  if (!input.file) {
    return jgRequest<T>(`${path}${q({ campus_id: campusId })}`, json("POST", { text: input.text, has_header: input.has_header, mapping: input.mapping, campus_id: campusId ?? undefined }));
  }
  const token = await getAuthToken();
  if (!token) return { success: false, error: "Authentication required" };
  const form = new FormData();
  form.append("file", input.file);
  if (input.has_header !== undefined) form.append("has_header", String(input.has_header));
  if (input.mapping) form.append("mapping", JSON.stringify(input.mapping));
  if (campusId) form.append("campus_id", campusId);
  try {
    const res = await fetch(`${API_URL}${path}${q({ campus_id: campusId })}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) return { success: false, error: body.error || `HTTP ${res.status}`, code: body.code, details: body.details };
    return { success: true, data: body.data as T };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export const jgDataApi = {
  importPreview: (sectionId: string, input: JgImportInput, campusId?: string | null) => importRequest<JgImportPreview>(`${sec(sectionId)}/import/preview`, input, campusId),
  importApply: (sectionId: string, input: JgImportInput, campusId?: string | null) => importRequest<JgImportResult>(`${sec(sectionId)}/import/apply`, input, campusId),

  attendanceCalendar: (campusId?: string | null, academicYearId?: string | null) =>
    jgRequest<JgAttendanceCalendar>(`${BASE}/attendance-calendar${q({ campus_id: campusId, academic_year_id: academicYearId })}`),
  saveAttendanceCalendar: (
    body: Partial<{ stage_starts: (string | null)[]; year_end: string | null; weekend_days: number[]; holidays: string[]; alert_limit: number }>,
    campusId?: string | null,
    academicYearId?: string | null,
  ) => jgRequest<JgAttendanceCalendar>(`${BASE}/attendance-calendar${q({ campus_id: campusId, academic_year_id: academicYearId })}`, json("PUT", body)),
  dailyAttendance: (sectionId: string, opts: { stage?: number; month?: string } = {}, campusId?: string | null) =>
    jgRequest<JgDailyAttendance>(`${sec(sectionId)}/daily-attendance${q({ stage: opts.stage, month: opts.month, campus_id: campusId })}`),
  saveDailyAttendance: (sectionId: string, entries: JgAttendanceEntry[], campusId?: string | null) =>
    jgRequest<{ saved: number }>(`${sec(sectionId)}/daily-attendance${q({ campus_id: campusId })}`, json("PUT", { entries })),

  rolloverPreview: (sectionId: string, campusId?: string | null) => jgRequest<JgRolloverPreview>(`${sec(sectionId)}/rollover${q({ campus_id: campusId })}`),
  rolloverApply: (sectionId: string, students: { student_id: string; next_grade_id?: string | null; hold?: boolean }[], campusId?: string | null) =>
    jgRequest<JgRolloverResult>(`${sec(sectionId)}/rollover${q({ campus_id: campusId })}`, json("POST", { students })),

  homeroom: (sectionId: string, campusId?: string | null) => jgRequest<JgHomeroom>(`${sec(sectionId)}/homeroom${q({ campus_id: campusId })}`),
  setHomeroom: (sectionId: string, staffId: string | null, campusId?: string | null) =>
    jgRequest<JgHomeroom>(`${sec(sectionId)}/homeroom${q({ campus_id: campusId })}`, json("PUT", { staff_id: staffId })),
};
