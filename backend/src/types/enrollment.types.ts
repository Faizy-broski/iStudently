// Enrollment and Rollover Type Definitions
// Author: Studently Team
// Date: 2026-02-18

/**
 * Enrollment status codes
 */
export enum EnrollmentCode {
  ADMISSION = 'ADMISSION',
  PROMOTION = 'PROMOTION',
  RETENTION = 'RETENTION',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  DROP = 'DROP',
  GRADUATE = 'GRADUATE',
  RE_ADMISSION = 'RE_ADMISSION',
}

/**
 * Rollover status for students
 */
export enum RolloverStatus {
  PENDING = 'pending',
  PROMOTED = 'promoted',
  RETAINED = 'retained',
  GRADUATED = 'graduated',
  DROPPED = 'dropped',
  TRANSFERRED = 'transferred',
}

/**
 * Enrollment code lookup table
 */
export interface EnrollmentCodeRecord {
  id: string;
  code: EnrollmentCode;
  title: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

/**
 * Student enrollment record (year-specific)
 */
export interface StudentEnrollment {
  id: string;
  student_id: string;
  academic_year_id: string;
  school_id: string;
  grade_level_id: string | null;
  section_id: string | null;
  enrollment_code_id: string | null;
  start_date: string;
  end_date: string | null;
  next_grade_id: string | null;
  rollover_status: RolloverStatus;
  rollover_notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  
  // Populated relations
  enrollment_code?: EnrollmentCodeRecord;
  academic_year?: AcademicYear;
  grade_level?: GradeLevel;
  section?: Section;
  next_grade?: GradeLevel;
  student?: Student;
}

/**
 * Academic year interface (with rollover fields)
 */
export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_next: boolean;
  is_active: boolean;
  rollover_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Grade level with progression
 */
export interface GradeLevel {
  id: string;
  school_id: string;
  name: string;
  order_index: number;
  base_fee: number;
  is_active: boolean;
  next_grade_id?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  
  // Populated
  next_grade?: GradeLevel | null;
}

/**
 * Section interface
 */
export interface Section {
  id: string;
  school_id: string;
  grade_level_id: string;
  name: string;
  capacity: number;
  current_strength: number;
  is_active: boolean;
  rollover_id?: string | null;
  created_at: string;
  updated_at: string;
  
  // Populated
  grade_level?: GradeLevel;
}

/**
 * Student interface (reference only)
 */
export interface Student {
  id: string;
  profile_id: string | null;
  school_id: string;
  student_number: string;
  grade_level_id: string | null;
  section_id: string | null;
  admission_date?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Current enrollment info (helper type)
 */
export interface CurrentEnrollmentInfo {
  enrollment_id: string;
  academic_year_id: string;
  year_name: string;
  grade_level_id: string | null;
  grade_name: string | null;
  section_id: string | null;
  section_name: string | null;
  enrollment_code: EnrollmentCode | null;
  start_date: string;
  rollover_status: RolloverStatus;
}

/**
 * Rollover preview data
 */
export interface RolloverPreview {
  current_year: string;
  next_year: string;
  students: {
    total_active: number;
    by_status: Record<RolloverStatus, number>;
    graduating: number;
  };
  marking_periods: {
    current_year_total: number;
    next_year_existing: number;
  };
  teachers: {
    current_assignments: number;
  };
}

/**
 * Rollover options
 */
export interface RolloverOptions {
  students?: boolean;
  marking_periods?: boolean;
  teachers?: boolean;
  sections?: boolean;
}

/**
 * Rollover request payload
 */
export interface RolloverRequest {
  current_year_id: string;
  next_year_id: string;
  school_id: string;
  options?: RolloverOptions;
}

/**
 * Rollover result
 */
export interface RolloverResult {
  success: boolean;
  error?: string;
  duration_ms?: number;
  students?: {
    promoted: number;
    retained: number;
    graduated: number;
    transferred: number;
    dropped: number;
    total: number;
  };
  marking_periods?: {
    full_year: number;
    semesters: number;
    quarters: number;
    progress: number;
    total: number;
  };
  teachers?: {
    assignments: number;
  };
}

/**
 * Set student rollover status payload
 */
export interface SetStudentRolloverStatusRequest {
  student_id: string;
  academic_year_id: string;
  rollover_status: RolloverStatus;
  next_grade_id?: string | null;
  notes?: string;
}

/**
 * Bulk set rollover status request
 */
export interface BulkSetRolloverStatusRequest {
  academic_year_id: string;
  school_id: string;
  filters?: {
    grade_level_id?: string;
    section_id?: string;
    student_ids?: string[];
  };
  rollover_status: RolloverStatus;
  next_grade_id?: string | null;
}

/**
 * Enrollment history query params
 */
export interface EnrollmentHistoryParams {
  student_id: string;
  include_current?: boolean;
}

/**
 * Create enrollment request
 */
export interface CreateEnrollmentRequest {
  student_id: string;
  academic_year_id: string;
  school_id: string;
  grade_level_id?: string | null;
  section_id?: string | null;
  enrollment_code: EnrollmentCode;
  start_date: string;
  next_grade_id?: string | null;
}

/**
 * Update enrollment request
 */
export interface UpdateEnrollmentRequest {
  grade_level_id?: string | null;
  section_id?: string | null;
  rollover_status?: RolloverStatus;
  next_grade_id?: string | null;
  rollover_notes?: string;
  end_date?: string | null;
}

/**
 * Grade progression chain item
 */
export interface GradeProgressionItem {
  id: string;
  name: string;
  order_index: number;
  next_grade_id: string | null;
  next_grade_name?: string | null;
  is_terminal: boolean; // No next grade (graduation)
}

/**
 * Rollover prerequisite check result
 */
export interface RolloverPrerequisiteCheck {
  is_valid: boolean;
  error_message?: string;
  warnings?: string[];
}

/**
 * Student with enrollment data (for UI)
 */
export interface StudentWithEnrollment extends Student {
  current_enrollment?: StudentEnrollment;
  enrollment_history?: StudentEnrollment[];
}

/**
 * Enrollment statistics
 */
export interface EnrollmentStatistics {
  school_id: string;
  academic_year_id: string;
  total_students: number;
  by_grade: Array<{
    grade_id: string;
    grade_name: string;
    count: number;
  }>;
  by_enrollment_code: Array<{
    code: EnrollmentCode;
    code_title: string;
    count: number;
  }>;
  by_rollover_status: Record<RolloverStatus, number>;
}

/**
 * Update grade level request (with next_grade_id)
 */
export interface UpdateGradeLevelRequest {
  name?: string;
  order_index?: number;
  base_fee?: number;
  next_grade_id?: string | null;
  is_active?: boolean;
}
