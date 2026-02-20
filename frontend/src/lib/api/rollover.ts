// Rollover and Enrollment API Client
// Author: Studently Team
// Date: 2026-02-18

import type {
  RolloverPreview,
  RolloverRequest,
  RolloverResult,
  StudentEnrollment,
  SetStudentRolloverStatusRequest,
  BulkSetRolloverStatusRequest,
  CreateEnrollmentRequest,
  UpdateEnrollmentRequest,
  EnrollmentStatistics,
  CurrentEnrollmentInfo,
  GradeProgressionItem,
  RolloverPrerequisiteCheck,
  EnrollmentCode,
  RolloverStatus,
} from '@/types/enrollment.types';
import { getAuthToken } from './schools';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Shared fetch helper – injects Bearer token and handles errors */
async function rolloverFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      errorMsg = body.error || body.message || errorMsg;
    } catch { /* ignore parse error */ }
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Preview rollover operation (dry run)
 */
export async function previewRollover(
  currentYearId: string,
  nextYearId: string,
  schoolId: string
): Promise<RolloverPreview> {
  return rolloverFetch('/rollover/preview', {
    method: 'POST',
    body: JSON.stringify({
      current_year_id: currentYearId,
      next_year_id: nextYearId,
      school_id: schoolId,
    }),
  });
}

/**
 * Execute rollover operation
 */
export async function executeRollover(
  request: RolloverRequest
): Promise<RolloverResult> {
  return rolloverFetch('/rollover/execute', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Check rollover prerequisites
 */
export async function checkRolloverPrerequisites(
  currentYearId: string,
  nextYearId: string,
  schoolId: string
): Promise<RolloverPrerequisiteCheck> {
  return rolloverFetch('/rollover/check', {
    method: 'POST',
    body: JSON.stringify({
      current_year_id: currentYearId,
      next_year_id: nextYearId,
      school_id: schoolId,
    }),
  });
}

/**
 * Get student enrollment history
 */
export async function getEnrollmentHistory(
  studentId: string,
  includeCurrent: boolean = true
): Promise<StudentEnrollment[]> {
  return rolloverFetch(
    `/enrollment/student/${studentId}/history?include_current=${includeCurrent}`
  );
}

/**
 * Get current student enrollment
 */
export async function getCurrentEnrollment(
  studentId: string
): Promise<CurrentEnrollmentInfo | null> {
  try {
    return await rolloverFetch(`/enrollment/student/${studentId}/current`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) return null;
    throw e;
  }
}

/**
 * Set student rollover status
 */
export async function setStudentRolloverStatus(
  request: SetStudentRolloverStatusRequest
): Promise<StudentEnrollment> {
  return rolloverFetch(
    `/enrollment/student/${request.student_id}/rollover-status`,
    {
      method: 'PATCH',
      body: JSON.stringify(request),
    }
  );
}

/**
 * Bulk set rollover status for multiple students
 */
export async function bulkSetRolloverStatus(
  request: BulkSetRolloverStatusRequest
): Promise<{ updated_count: number }> {
  return rolloverFetch('/enrollment/bulk-rollover-status', {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

/**
 * Create new enrollment record
 */
export async function createEnrollment(
  request: CreateEnrollmentRequest
): Promise<StudentEnrollment> {
  return rolloverFetch('/enrollment', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Update enrollment record
 */
export async function updateEnrollment(
  enrollmentId: string,
  request: UpdateEnrollmentRequest
): Promise<StudentEnrollment> {
  return rolloverFetch(`/enrollment/${enrollmentId}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

/**
 * Get enrollment statistics for academic year
 */
export async function getEnrollmentStatistics(
  academicYearId: string,
  schoolId: string
): Promise<EnrollmentStatistics> {
  return rolloverFetch(
    `/enrollment/statistics?academic_year_id=${academicYearId}&school_id=${schoolId}`
  );
}

/**
 * Get grade progression chain
 */
export async function getGradeProgression(
  schoolId: string
): Promise<GradeProgressionItem[]> {
  return rolloverFetch(`/grades/progression?school_id=${schoolId}`);
}

/**
 * Update grade level (including next_grade_id)
 */
export async function updateGradeLevel(
  gradeId: string,
  updates: {
    name?: string;
    order_index?: number;
    base_fee?: number;
    next_grade_id?: string | null;
    is_active?: boolean;
  }
): Promise<{ success: boolean }> {
  return rolloverFetch(`/grades/${gradeId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Get students by rollover status
 */
export async function getStudentsByRolloverStatus(
  academicYearId: string,
  schoolId: string,
  status?: RolloverStatus
): Promise<Array<{ student_id: string; student_number: string; grade_name: string; section_name: string; rollover_status: RolloverStatus }>> {
  const params = new URLSearchParams({ academic_year_id: academicYearId, school_id: schoolId });
  if (status) params.append('status', status);
  return rolloverFetch(`/enrollment/by-status?${params}`);
}

/**
 * Export enrollment types for convenience
 */
export { EnrollmentCode, RolloverStatus };
export type {
  RolloverPreview,
  RolloverRequest,
  RolloverResult,
  StudentEnrollment,
  SetStudentRolloverStatusRequest,
  BulkSetRolloverStatusRequest,
  EnrollmentStatistics,
  CurrentEnrollmentInfo,
  GradeProgressionItem,
  RolloverPrerequisiteCheck,
};
