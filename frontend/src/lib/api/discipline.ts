import { getAuthToken } from './schools';
import { handleSessionExpiry } from '@/context/AuthContext';
import { API_URL } from '@/config/api';
import { getImpersonationHeaders } from './abortable-fetch';

// ============================================================================
// TYPES
// ============================================================================

export type DisciplineFieldType =
  | 'select'
  | 'multiple_radio'
  | 'multiple_checkbox'
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'numeric'
  | 'date';

export type DisciplineTargetType = 'student' | 'teacher' | 'staff';

export interface DisciplineField {
  id: string;
  school_id: string;
  name: string;
  target_type: DisciplineTargetType;
  field_type: DisciplineFieldType;
  options: string[] | null;
  sort_order: number;
  is_active: boolean;
  penalty_points: number | null;
  created_at: string;
  updated_at: string;
}

export interface DisciplineReferral {
  id: string;
  school_id: string;
  campus_id: string | null;
  target_type: 'student' | 'teacher' | 'staff';
  student_id: string | null;
  staff_id: string | null;
  academic_year_id: string | null;
  reporter_id: string | null;
  incident_date: string;
  field_values: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Joined
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string;
    grade_level?: string | null;
    section_id?: string | null;
  } | null;
  staff?: {
    id: string;
    employee_number: string;
    profile?: { first_name: string; last_name: string } | null;
  } | null;
  reporter?: {
    id: string;
    full_name: string;
  } | null;
}

interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  page?: number;
  limit?: number;
}

// ============================================================================
// API REQUEST HELPER
// ============================================================================

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getImpersonationHeaders(),
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (response.status === 401) {
      await handleSessionExpiry();
      return { success: false, error: 'Session expired' };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`,
      };
    }

    return data;
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

// ============================================================================
// DISCIPLINE FIELDS
// ============================================================================

export async function getDisciplineFields(
  schoolId: string,
  targetType: DisciplineTargetType,
  includeInactive = false
): Promise<ApiResponse<DisciplineField[]>> {
  const params = new URLSearchParams({ school_id: schoolId, target_type: targetType });
  if (includeInactive) params.append('include_inactive', 'true');
  return apiRequest<DisciplineField[]>(`/discipline/fields?${params}`);
}

// Fetches fields across all three target types merged into one flat list —
// used by display-only surfaces (dashboards/reports) that show referrals of
// every type together and just need to resolve a field id/name regardless of
// which form it belongs to.
export async function getAllDisciplineFields(
  schoolId: string,
  includeInactive = false
): Promise<DisciplineField[]> {
  const targetTypes: DisciplineTargetType[] = ['student', 'teacher', 'staff'];
  const results = await Promise.all(
    targetTypes.map((t) => getDisciplineFields(schoolId, t, includeInactive))
  );
  return results.flatMap((res) => res.data ?? []);
}

export async function getDisciplineFieldNameMap(schoolId: string): Promise<Record<string, string>> {
  const all = await getAllDisciplineFields(schoolId, true);
  const map: Record<string, string> = {};
  for (const f of all) map[f.id] = f.name;
  return map;
}

export async function createDisciplineField(data: {
  school_id: string;
  name: string;
  target_type: DisciplineTargetType;
  field_type: DisciplineFieldType;
  options?: string[] | null;
  sort_order?: number;
  penalty_points?: number | null;
}): Promise<ApiResponse<DisciplineField>> {
  return apiRequest<DisciplineField>('/discipline/fields', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDisciplineField(
  id: string,
  data: Partial<{
    name: string;
    field_type: DisciplineFieldType;
    options: string[] | null;
    sort_order: number;
    is_active: boolean;
    penalty_points: number | null;
  }>
): Promise<ApiResponse<DisciplineField>> {
  return apiRequest<DisciplineField>(`/discipline/fields/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteDisciplineField(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return apiRequest<{ success: boolean }>(`/discipline/fields/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// DISCIPLINE REFERRALS
// ============================================================================

export interface GetReferralsParams {
  school_id: string;
  campus_id?: string;
  target_type?: 'student' | 'teacher' | 'staff';
  student_id?: string;
  staff_id?: string;
  start_date?: string;
  end_date?: string;
  academic_year_id?: string;
  grade_level?: string;
  section_id?: string;
  page?: number;
  limit?: number;
}

export async function getDisciplineReferrals(
  params: GetReferralsParams
): Promise<ApiResponse<DisciplineReferral[]>> {
  const urlParams = new URLSearchParams({ school_id: params.school_id });
  if (params.campus_id) urlParams.append('campus_id', params.campus_id);
  if (params.target_type) urlParams.append('target_type', params.target_type);
  if (params.student_id) urlParams.append('student_id', params.student_id);
  if (params.staff_id) urlParams.append('staff_id', params.staff_id);
  if (params.start_date) urlParams.append('start_date', params.start_date);
  if (params.end_date) urlParams.append('end_date', params.end_date);
  if (params.academic_year_id) urlParams.append('academic_year_id', params.academic_year_id);
  if (params.grade_level) urlParams.append('grade_level', params.grade_level);
  if (params.section_id) urlParams.append('section_id', params.section_id);
  if (params.page) urlParams.append('page', String(params.page));
  if (params.limit) urlParams.append('limit', String(params.limit));
  return apiRequest<DisciplineReferral[]>(`/discipline/referrals?${urlParams}`);
}

export async function getDisciplineReferralById(
  id: string
): Promise<ApiResponse<DisciplineReferral>> {
  return apiRequest<DisciplineReferral>(`/discipline/referrals/${id}`);
}

export async function createDisciplineReferral(data: {
  school_id: string;
  campus_id?: string | null;
  target_type?: 'student' | 'teacher' | 'staff';
  student_id?: string;
  student_ids?: string[];
  staff_id?: string;
  staff_ids?: string[];
  reporter_id?: string | null;
  incident_date?: string;
  field_values?: Record<string, any>;
  academic_year_id?: string | null;
}): Promise<ApiResponse<DisciplineReferral | DisciplineReferral[]>> {
  return apiRequest<DisciplineReferral | DisciplineReferral[]>('/discipline/referrals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDisciplineReferral(
  id: string,
  data: Partial<{
    campus_id: string | null;
    reporter_id: string | null;
    incident_date: string;
    field_values: Record<string, any>;
    academic_year_id: string | null;
  }>
): Promise<ApiResponse<DisciplineReferral>> {
  return apiRequest<DisciplineReferral>(`/discipline/referrals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteDisciplineReferral(
  id: string
): Promise<ApiResponse<{ success: boolean }>> {
  return apiRequest<{ success: boolean }>(`/discipline/referrals/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// DISCIPLINE SCORE
// ============================================================================

export interface DisciplineScoreBreakdown {
  referral_id: string;
  incident_date: string;
  field_name: string;
  delta: number;
  detail: string;
}

export interface DisciplineScoreResult {
  score: number;
  total_delta: number;
  referral_count: number;
  breakdown: DisciplineScoreBreakdown[];
}

export async function getStudentDisciplineScore(params: {
  studentId: string;
  campusId?: string | null;
  academicYearId?: string | null;
}): Promise<ApiResponse<DisciplineScoreResult>> {
  const urlParams = new URLSearchParams();
  if (params.campusId) urlParams.append('campus_id', params.campusId);
  if (params.academicYearId) urlParams.append('academic_year_id', params.academicYearId);
  const qs = urlParams.toString();
  return apiRequest<DisciplineScoreResult>(`/discipline/score/${params.studentId}${qs ? `?${qs}` : ''}`);
}

// ============================================================================
// DISCIPLINE REPORTS — fetch all referrals (no pagination)
// ============================================================================

export async function getAllDisciplineReferrals(params: {
  school_id: string;
  campus_id?: string;
  target_type?: 'student' | 'teacher' | 'staff';
  start_date?: string;
  end_date?: string;
  grade_level?: string;
  section_id?: string;
}): Promise<ApiResponse<DisciplineReferral[]>> {
  const urlParams = new URLSearchParams({ school_id: params.school_id, report: 'true' });
  if (params.campus_id) urlParams.append('campus_id', params.campus_id);
  if (params.target_type) urlParams.append('target_type', params.target_type);
  if (params.start_date) urlParams.append('start_date', params.start_date);
  if (params.end_date) urlParams.append('end_date', params.end_date);
  if (params.grade_level) urlParams.append('grade_level', params.grade_level);
  if (params.section_id) urlParams.append('section_id', params.section_id);
  return apiRequest<DisciplineReferral[]>(`/discipline/referrals?${urlParams}`);
}

// ============================================================================
// ZERO-TRUST ROLE ENDPOINTS (Staff / Student / Parent)
// ============================================================================

export async function getStaffDisciplineReferrals(): Promise<ApiResponse<DisciplineReferral[]>> {
  return apiRequest<DisciplineReferral[]>('/discipline/staff/referrals');
}

export async function createStaffDisciplineReferral(data: {
  student_id: string;
  incident_date?: string;
  field_values?: Record<string, any>;
}): Promise<ApiResponse<DisciplineReferral>> {
  return apiRequest<DisciplineReferral>('/discipline/staff/referrals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getStudentDisciplineReferrals(): Promise<ApiResponse<DisciplineReferral[]>> {
  return apiRequest<DisciplineReferral[]>('/discipline/student/referrals');
}

export async function getParentDisciplineReferrals(): Promise<ApiResponse<DisciplineReferral[]>> {
  return apiRequest<DisciplineReferral[]>('/discipline/parent/referrals');
}

