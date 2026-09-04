import { apiRequest, type ApiResponse } from "./index";
import { getAuthToken } from "./schools";
import { getImpersonationHeaders } from "./abortable-fetch";
import { API_URL } from "@/config/api";

export interface QirtasiWorksheet {
  id: string;
  code: string;
  title_ar: string;
  title_en: string | null;
  description: string | null;
  worksheet_type: string;
  owner_id: string | null;
  school_id: string | null;
  grade_id: string;
  subject_id: string;
  track_id: string | null;
  term_id: string | null;
  unit_id: string | null;
  lesson_id: string | null;
  visibility_scope: "private" | "school" | "marketplace" | "public";
  status: string;
  moderation_status: string;
  quality_score: number;
  current_version_id: string | null;
  download_count: number;
  rating_avg: number;
  created_at: string;
  updated_at: string;
}

export interface QirtasiWorksheetDetail extends QirtasiWorksheet {
  assets: { id: string; asset_role: string; mime_type: string; file_size: number }[];
  facet_values: { facet_value_id: string; assigned_by: string; qirtasi_facet_values: { id: string; value_key: string; label_ar: string; label_en: string | null; facet_id: string } }[];
}

export interface WorksheetListFilters {
  grade_id?: string;
  subject_id?: string;
  track_id?: string;
  term_id?: string;
  unit_id?: string;
  lesson_id?: string;
  worksheet_type?: string;
  facet_value_ids?: string[];
  search?: string;
  campus_id?: string;
  limit?: number;
  offset?: number;
}

export interface UploadWorksheetInput {
  title_ar: string;
  title_en?: string;
  description?: string;
  worksheet_type: string;
  grade_id: string;
  subject_id: string;
  track_id?: string | null;
  term_id?: string | null;
  unit_id?: string | null;
  lesson_id?: string | null;
  visibility_scope?: "private" | "school" | "public";
  facet_value_ids?: string[];
  file: File;
  thumbnail?: File | null;
  answerKey?: File | null;
}

export interface UpdateWorksheetDTO {
  title_ar?: string;
  title_en?: string;
  description?: string;
  worksheet_type?: string;
  grade_id?: string;
  subject_id?: string;
  track_id?: string | null;
  term_id?: string | null;
  unit_id?: string | null;
  lesson_id?: string | null;
  visibility_scope?: "private" | "school" | "public";
  status?: string;
  facet_value_ids?: string[];
}

export function listWorksheets(
  filters: WorksheetListFilters = {}
): Promise<ApiResponse<QirtasiWorksheet[]> & { count?: number }> {
  const qs = new URLSearchParams();
  if (filters.grade_id) qs.set("grade_id", filters.grade_id);
  if (filters.subject_id) qs.set("subject_id", filters.subject_id);
  if (filters.track_id) qs.set("track_id", filters.track_id);
  if (filters.term_id) qs.set("term_id", filters.term_id);
  if (filters.unit_id) qs.set("unit_id", filters.unit_id);
  if (filters.lesson_id) qs.set("lesson_id", filters.lesson_id);
  if (filters.worksheet_type) qs.set("worksheet_type", filters.worksheet_type);
  if (filters.facet_value_ids?.length) qs.set("facet_value_ids", filters.facet_value_ids.join(","));
  if (filters.search) qs.set("search", filters.search);
  if (filters.campus_id) qs.set("campus_id", filters.campus_id);
  if (filters.limit !== undefined) qs.set("limit", String(filters.limit));
  if (filters.offset !== undefined) qs.set("offset", String(filters.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest<QirtasiWorksheet[]>(`/qirtasi/worksheets${suffix}`);
}

// campus_id is required on every call below so an admin's request checks the
// right active_plugins row in requireQirtasiEnabled — see
// qirtasi-curriculum.ts's withCampus() comment for the full rationale.
function withCampus(path: string, campusId?: string): string {
  if (!campusId) return path
  return `${path}${path.includes("?") ? "&" : "?"}campus_id=${campusId}`
}

export function getWorksheet(id: string, campusId?: string): Promise<ApiResponse<QirtasiWorksheetDetail>> {
  return apiRequest<QirtasiWorksheetDetail>(withCampus(`/qirtasi/worksheets/${id}`, campusId));
}

/**
 * Multipart upload — bypasses apiRequest (which hardcodes
 * Content-Type: application/json) with a raw fetch, matching
 * inspection-evaluation.ts's uploadEvidenceFile pattern.
 */
export async function uploadWorksheet(input: UploadWorksheetInput, campusId?: string): Promise<ApiResponse<QirtasiWorksheet>> {
  const token = await getAuthToken();
  if (!token) return { success: false, error: "Authentication required" };

  const formData = new FormData();
  if (campusId) formData.append("campus_id", campusId);
  formData.append("title_ar", input.title_ar);
  if (input.title_en) formData.append("title_en", input.title_en);
  if (input.description) formData.append("description", input.description);
  formData.append("worksheet_type", input.worksheet_type);
  formData.append("grade_id", input.grade_id);
  formData.append("subject_id", input.subject_id);
  if (input.track_id) formData.append("track_id", input.track_id);
  if (input.term_id) formData.append("term_id", input.term_id);
  if (input.unit_id) formData.append("unit_id", input.unit_id);
  if (input.lesson_id) formData.append("lesson_id", input.lesson_id);
  if (input.visibility_scope) formData.append("visibility_scope", input.visibility_scope);
  if (input.facet_value_ids?.length) formData.append("facet_value_ids", JSON.stringify(input.facet_value_ids));
  formData.append("file", input.file);
  if (input.thumbnail) formData.append("thumbnail", input.thumbnail);
  if (input.answerKey) formData.append("answerKey", input.answerKey);

  try {
    const res = await fetch(withCampus(`${API_URL}/qirtasi/worksheets`, campusId), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...getImpersonationHeaders() },
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json?.error || "Upload failed" };
    return json;
  } catch {
    return { success: false, error: "Network error" };
  }
}

export function updateWorksheet(id: string, dto: UpdateWorksheetDTO, campusId?: string): Promise<ApiResponse<QirtasiWorksheet>> {
  return apiRequest<QirtasiWorksheet>(withCampus(`/qirtasi/worksheets/${id}`, campusId), { method: "PUT", body: JSON.stringify(dto) });
}

export function deleteWorksheet(id: string, campusId?: string): Promise<ApiResponse<{ success: true }>> {
  return apiRequest(withCampus(`/qirtasi/worksheets/${id}`, campusId), { method: "DELETE" });
}

export function getWorksheetDownloadUrl(id: string, campusId?: string): Promise<ApiResponse<{ url: string; title: string }>> {
  return apiRequest(withCampus(`/qirtasi/worksheets/${id}/download`, campusId));
}

export function getWorksheetThumbnailUrl(id: string, campusId?: string): Promise<ApiResponse<{ url: string | null }>> {
  return apiRequest(withCampus(`/qirtasi/worksheets/${id}/thumbnail`, campusId));
}

export function getWorksheetAnswerKeyUrl(id: string, campusId?: string): Promise<ApiResponse<{ url: string | null }>> {
  return apiRequest(withCampus(`/qirtasi/worksheets/${id}/answer-key`, campusId));
}
