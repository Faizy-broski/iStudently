import { apiRequest, type ApiResponse } from "./index";

export type CurriculumLevel = "stages" | "grades" | "tracks" | "subjects" | "terms" | "units" | "lessons" | "outcomes";

export interface CurriculumNode {
  id: string;
  code?: string;
  key?: string;
  name_ar: string;
  name_en: string | null;
  sort_order: number;
  stage_id?: string;
  grade_id?: string;
  track_id?: string | null;
  subject_id?: string;
  term_id?: string | null;
  unit_id?: string;
  lesson_id?: string;
}

// campus_id is threaded through explicitly on every call because
// requireQirtasiEnabled resolves it from req.query.campus_id (admin
// accounts don't get campus_id auto-populated on req.profile the way
// teacher/student/parent/staff/librarian accounts do — see auth.middleware.ts)
// — without it, an admin's requests only ever check the school-wide
// (campus_id IS NULL) active_plugins row, even when the module was enabled
// on a specific campus.

function withCampus(path: string, campusId?: string): string {
  if (!campusId) return path
  return `${path}${path.includes("?") ? "&" : "?"}campus_id=${campusId}`
}

export function listCurriculumNodes(level: CurriculumLevel, parentId?: string, campusId?: string): Promise<ApiResponse<CurriculumNode[]>> {
  const suffix = parentId ? `?parent_id=${parentId}` : "";
  return apiRequest<CurriculumNode[]>(withCampus(`/qirtasi/curriculum/${level}${suffix}`, campusId));
}

export function createCurriculumNode(level: CurriculumLevel, data: Record<string, unknown>, campusId?: string): Promise<ApiResponse<CurriculumNode>> {
  return apiRequest<CurriculumNode>(withCampus(`/qirtasi/curriculum/${level}`, campusId), { method: "POST", body: JSON.stringify(data) });
}

export function updateCurriculumNode(level: CurriculumLevel, id: string, data: Record<string, unknown>, campusId?: string): Promise<ApiResponse<CurriculumNode>> {
  return apiRequest<CurriculumNode>(withCampus(`/qirtasi/curriculum/${level}/${id}`, campusId), { method: "PUT", body: JSON.stringify(data) });
}

export function deleteCurriculumNode(level: CurriculumLevel, id: string, campusId?: string): Promise<ApiResponse<{ success: true }>> {
  return apiRequest(withCampus(`/qirtasi/curriculum/${level}/${id}`, campusId), { method: "DELETE" });
}
