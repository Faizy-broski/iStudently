import { getAuthToken } from './schools';
import { handleSessionExpiry } from '@/context/AuthContext';
import { API_URL } from '@/config/api';

// ============================================================================
// TYPES
// ============================================================================

export interface Activity {
  id: string;
  school_id: string;
  campus_id: string | null;
  academic_year_id: string | null;
  title: string;
  start_date: string | null;
  end_date: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type EligibilityCode = 'PASSING' | 'BORDERLINE' | 'FAILING' | 'INCOMPLETE';

export interface StudentEligibility {
  id: string;
  student_id: string;
  course_period_id: string;
  school_date: string;
  eligibility_code: EligibilityCode;
  school_id: string;
  campus_id: string | null;
  academic_year_id: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string;
    grade_level?: string | null;
  } | null;
}

export interface EligibilitySettings {
  school_id: string;
  start_day: number;
  start_hour: number;
  start_minute: number;
  end_day: number;
  end_hour: number;
  end_minute: number;
}

export interface StudentActivity {
  id: string;
  student_id: string;
  activity_id: string;
  school_id: string;
  campus_id: string | null;
  academic_year_id: string | null;
  created_at: string;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string;
    grade_level?: string | null;
  } | null;
}

export interface EligibilityCompleted {
  course_period_id: string;
  school_date: string;
  staff_id: string | null;
  staff?: { id: string; full_name: string } | null;
}

interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
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
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await response.json();

    if (response.status === 401) {
      await handleSessionExpiry();
      return { success: false, error: 'Session expired' };
    }

    if (!response.ok) {
      return { success: false, error: data.error || `Request failed with status ${response.status}` };
    }

    return data;
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

// ============================================================================
// ACTIVITIES
// ============================================================================

export async function getActivities(params: {
  school_id: string;
  campus_id?: string;
  academic_year_id?: string;
  include_inactive?: boolean;
}): Promise<ApiResponse<Activity[]>> {
  const p = new URLSearchParams({ school_id: params.school_id });
  if (params.campus_id) p.append('campus_id', params.campus_id);
  if (params.academic_year_id) p.append('academic_year_id', params.academic_year_id);
  if (params.include_inactive) p.append('include_inactive', 'true');
  return apiRequest<Activity[]>(`/activities?${p}`);
}

export async function createActivity(data: {
  school_id: string;
  campus_id?: string | null;
  academic_year_id?: string | null;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  comment?: string | null;
}): Promise<ApiResponse<Activity>> {
  return apiRequest<Activity>('/activities', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateActivity(
  id: string,
  data: Partial<{ title: string; start_date: string | null; end_date: string | null; comment: string | null; is_active: boolean }>
): Promise<ApiResponse<Activity>> {
  return apiRequest<Activity>(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteActivity(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return apiRequest<{ success: boolean }>(`/activities/${id}`, { method: 'DELETE' });
}

// ============================================================================
// STUDENT ENROLLMENT
// ============================================================================

export async function getActivityStudents(activityId: string): Promise<ApiResponse<StudentActivity[]>> {
  return apiRequest<StudentActivity[]>(`/activities/${activityId}/students`);
}

export async function enrollStudents(activityId: string, data: {
  student_ids: string[];
  school_id: string;
  campus_id?: string | null;
  academic_year_id?: string | null;
}): Promise<ApiResponse<StudentActivity[]>> {
  return apiRequest<StudentActivity[]>(`/activities/${activityId}/students`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function unenrollStudent(activityId: string, studentId: string): Promise<ApiResponse<{ success: boolean }>> {
  return apiRequest<{ success: boolean }>(`/activities/${activityId}/students/${studentId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// ELIGIBILITY
// ============================================================================

export async function getEligibility(params: {
  school_id: string;
  course_period_id: string;
  school_date: string;
  campus_id?: string;
}): Promise<ApiResponse<StudentEligibility[]>> {
  const p = new URLSearchParams({
    school_id: params.school_id,
    course_period_id: params.course_period_id,
    school_date: params.school_date,
  });
  if (params.campus_id) p.append('campus_id', params.campus_id);
  return apiRequest<StudentEligibility[]>(`/activities/eligibility?${p}`);
}

export async function saveEligibility(data: {
  school_id: string;
  campus_id?: string | null;
  academic_year_id?: string | null;
  course_period_id: string;
  school_date: string;
  records: { student_id: string; eligibility_code: EligibilityCode }[];
  reported_by?: string | null;
}): Promise<ApiResponse<StudentEligibility[]>> {
  return apiRequest<StudentEligibility[]>('/activities/eligibility', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getStudentEligibility(params: {
  school_id: string;
  student_id: string;
  academic_year_id?: string;
}): Promise<ApiResponse<StudentEligibility[]>> {
  const p = new URLSearchParams({ school_id: params.school_id, student_id: params.student_id });
  if (params.academic_year_id) p.append('academic_year_id', params.academic_year_id);
  return apiRequest<StudentEligibility[]>(`/activities/eligibility/student?${p}`);
}

// ============================================================================
// SETTINGS
// ============================================================================

export async function getEntryTimes(schoolId: string): Promise<ApiResponse<EligibilitySettings>> {
  return apiRequest<EligibilitySettings>(`/activities/settings/entry-times?school_id=${schoolId}`);
}

export async function saveEntryTimes(data: EligibilitySettings): Promise<ApiResponse<EligibilitySettings>> {
  return apiRequest<EligibilitySettings>('/activities/settings/entry-times', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// REPORTS
// ============================================================================

export interface StudentListReportRow {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string;
    grade_level?: string | null;
  } | null;
  eligibility_records: {
    eligibility_code: EligibilityCode;
    school_date: string;
    course_period_id: string;
  }[];
}

export async function getStudentListReport(params: {
  school_id: string;
  activity_id: string;
  campus_id?: string;
  academic_year_id?: string;
}): Promise<ApiResponse<StudentListReportRow[]>> {
  const p = new URLSearchParams({ school_id: params.school_id, activity_id: params.activity_id });
  if (params.campus_id) p.append('campus_id', params.campus_id);
  if (params.academic_year_id) p.append('academic_year_id', params.academic_year_id);
  return apiRequest<StudentListReportRow[]>(`/activities/reports/student-list?${p}`);
}

export async function getTeacherCompletionReport(params: {
  school_id: string;
  school_date: string;
  campus_id?: string;
}): Promise<ApiResponse<EligibilityCompleted[]>> {
  const p = new URLSearchParams({ school_id: params.school_id, school_date: params.school_date });
  if (params.campus_id) p.append('campus_id', params.campus_id);
  return apiRequest<EligibilityCompleted[]>(`/activities/reports/teacher-completion?${p}`);
}
