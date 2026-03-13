import { getAuthToken } from './schools';
import { handleSessionExpiry } from '@/context/AuthContext';
import { API_URL } from '@/config/api';

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

export interface DisciplineField {
  id: string;
  school_id: string;
  name: string;
  field_type: DisciplineFieldType;
  options: string[] | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DisciplineReferral {
  id: string;
  school_id: string;
  campus_id: string | null;
  student_id: string;
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
  includeInactive = false
): Promise<ApiResponse<DisciplineField[]>> {
  const params = new URLSearchParams({ school_id: schoolId });
  if (includeInactive) params.append('include_inactive', 'true');
  return apiRequest<DisciplineField[]>(`/discipline/fields?${params}`);
}

export async function createDisciplineField(data: {
  school_id: string;
  name: string;
  field_type: DisciplineFieldType;
  options?: string[] | null;
  sort_order?: number;
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
  student_id?: string;
  start_date?: string;
  end_date?: string;
  academic_year_id?: string;
  page?: number;
  limit?: number;
}

export async function getDisciplineReferrals(
  params: GetReferralsParams
): Promise<ApiResponse<DisciplineReferral[]>> {
  const urlParams = new URLSearchParams({ school_id: params.school_id });
  if (params.campus_id) urlParams.append('campus_id', params.campus_id);
  if (params.student_id) urlParams.append('student_id', params.student_id);
  if (params.start_date) urlParams.append('start_date', params.start_date);
  if (params.end_date) urlParams.append('end_date', params.end_date);
  if (params.academic_year_id) urlParams.append('academic_year_id', params.academic_year_id);
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
  student_id: string;
  reporter_id?: string | null;
  incident_date?: string;
  field_values?: Record<string, any>;
  academic_year_id?: string | null;
}): Promise<ApiResponse<DisciplineReferral>> {
  return apiRequest<DisciplineReferral>('/discipline/referrals', {
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
  start_date?: string;
  end_date?: string;
}): Promise<ApiResponse<DisciplineReferral[]>> {
  const urlParams = new URLSearchParams({ school_id: params.school_id, report: 'true' });
  if (params.campus_id) urlParams.append('campus_id', params.campus_id);
  if (params.start_date) urlParams.append('start_date', params.start_date);
  if (params.end_date) urlParams.append('end_date', params.end_date);
  return apiRequest<DisciplineReferral[]>(`/discipline/referrals?${urlParams}`);
}
