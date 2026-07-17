import { DayOfWeek } from './index'

// ============================================================================
// FET-STYLE AUTOMATIC TIMETABLE GENERATOR — TYPES
// ============================================================================
// Matches the style of the Period/TimetableEntry types in `./index.ts`:
// plain interfaces, CreateXDTO/UpdateXDTO naming, joined-field comments.

// ----------------------------------------------------------------------------
// Requirements ("activities" before solver expansion)
// ----------------------------------------------------------------------------

export type RoomType = 'classroom' | 'lab' | 'auditorium' | 'library' | 'gym' | 'office' | 'other';

export interface TimetableRequirement {
  id: string;
  school_id: string;
  campus_id?: string | null;
  academic_year_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string | null;
  periods_per_week: number;
  double_period: boolean;
  preferred_room_type: RoomType | null;
  min_gap_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  section_name?: string;
  grade_name?: string;
  subject_name?: string;
  subject_code?: string;
  teacher_name?: string;
}

export interface CreateTimetableRequirementDTO {
  school_id: string;
  campus_id?: string;
  academic_year_id: string;
  section_id: string;
  subject_id: string;
  teacher_id?: string | null;
  periods_per_week: number;
  double_period?: boolean;
  preferred_room_type?: RoomType | null;
  min_gap_days?: number;
  created_by?: string;
}

export interface UpdateTimetableRequirementDTO {
  teacher_id?: string | null;
  periods_per_week?: number;
  double_period?: boolean;
  preferred_room_type?: RoomType | null;
  min_gap_days?: number;
  is_active?: boolean;
}

export interface RequirementCoverageSummary {
  section_id: string;
  academic_year_id: string;
  required_periods_per_week: number;
  available_periods_per_week: number;
  is_over_capacity: boolean;
  requirement_count: number;
}

// ----------------------------------------------------------------------------
// Teacher scheduling constraints
// ----------------------------------------------------------------------------

export interface TeacherSchedulingConstraint {
  id: string;
  school_id: string;
  campus_id?: string | null;
  teacher_id: string;
  academic_year_id: string;
  max_periods_per_day: number | null;
  max_periods_per_week: number | null;
  min_gap_between_periods: number;
  max_consecutive_periods: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  teacher_name?: string;
}

export interface UpsertTeacherSchedulingConstraintDTO {
  school_id: string;
  campus_id?: string;
  teacher_id: string;
  academic_year_id: string;
  max_periods_per_day?: number | null;
  max_periods_per_week?: number | null;
  min_gap_between_periods?: number;
  max_consecutive_periods?: number | null;
}

// ----------------------------------------------------------------------------
// Generation settings
// ----------------------------------------------------------------------------

export interface TimetableGenerationSettings {
  id: string;
  school_id: string;
  campus_id?: string | null;
  academic_year_id: string;
  default_max_periods_per_day: number;
  default_min_gap_between_periods: number;
  weight_teacher_availability_preferred: number;
  weight_gap_violation: number;
  weight_daily_load_violation: number;
  weight_double_period_broken: number;
  weight_frequency_spread: number;
  solver_time_limit_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateTimetableGenerationSettingsDTO {
  school_id: string;
  campus_id?: string;
  academic_year_id: string;
  default_max_periods_per_day?: number;
  default_min_gap_between_periods?: number;
  weight_teacher_availability_preferred?: number;
  weight_gap_violation?: number;
  weight_daily_load_violation?: number;
  weight_double_period_broken?: number;
  weight_frequency_spread?: number;
  solver_time_limit_seconds?: number;
}

// ----------------------------------------------------------------------------
// Generation jobs
// ----------------------------------------------------------------------------

export type TimetableGenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TimetableGenerationJobScope = 'all' | 'sections';

export interface TimetableGenerationJob {
  id: string;
  school_id: string;
  campus_id?: string | null;
  academic_year_id: string;
  status: TimetableGenerationJobStatus;
  scope: TimetableGenerationJobScope;
  section_ids: string[] | null;
  progress_percent: number;
  total_activities: number | null;
  placed_activities: number | null;
  unplaced_activities: number | null;
  hard_violations: number;
  soft_score: number | null;
  result_summary: Record<string, any> | null;
  error_message: string | null;
  cancel_requested: boolean;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ============================================================================
// SOLVER-INTERNAL TYPES (pure, no DB dependency)
// ============================================================================

/** One unit of work the solver must place: a section+subject+teacher taught
 * for `duration` consecutive periods on a single day. A requirement with
 * periods_per_week=5 (double_period=false) expands to 5 Activities of
 * duration 1; a requirement with periods_per_week=6, double_period=true
 * expands to 3 Activities of duration 2. */
export interface Activity {
  id: string;
  requirement_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  duration: 1 | 2;
  preferred_room_type: RoomType | null;
  is_locked: boolean;
  locked_day?: DayOfWeek;
  locked_period_id?: string;
  locked_room_id?: string | null;
  /** Original requirement's periods_per_week — used as an MRV/degree tie-break
   * priority signal (requirements with higher weekly frequency are placed first). */
  source_periods_per_week?: number;
  min_gap_days?: number;
}

export interface SolverSlot {
  day_of_week: DayOfWeek;
  period_id: string;
}

export interface SolverAssignment {
  activity_id: string;
  day_of_week: DayOfWeek;
  period_id: string;
  room_id: string | null;
}

export interface SolverUnplaced {
  activity_id: string;
  reason: string;
}

export interface SolverResult {
  assignments: SolverAssignment[];
  unplaced: SolverUnplaced[];
  hard_violations: number;
  soft_score: number;
  timed_out: boolean;
}
