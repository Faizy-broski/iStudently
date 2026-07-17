// ============================================================================
// SOLVER-INTERNAL TYPES — re-exported from the shared types file, plus
// additional purely-in-memory context types used only inside the solver.
// NOTE: this whole directory must never import from '../../config/supabase'
// or any other Supabase-touching module — it is pure, DB-free, unit-testable
// logic. All data comes in as plain objects/arrays.
// ============================================================================

export type {
  Activity,
  SolverSlot,
  SolverAssignment,
  SolverUnplaced,
  SolverResult,
  RoomType
} from '../../types/timetable-generator.types'

import { Activity, SolverSlot, RoomType } from '../../types/timetable-generator.types'

/** A non-break period definition, sorted candidate for slot generation. */
export interface SolverPeriod {
  id: string;
  period_number: number;
  sort_order: number;
  is_break: boolean;
}

/** A single teacher_availability row (only 'available' | 'unavailable' | 'preferred' matter). */
export interface SolverTeacherAvailability {
  teacher_id: string;
  day_of_week: number;
  period_id: string;
  status: 'available' | 'unavailable' | 'preferred';
}

/** A pre-placed (locked) timetable entry that the solver must treat as fixed
 * occupancy but never revisit/reassign. */
export interface LockedEntryInfo {
  requirement_id?: string | null;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number;
  period_id: string;
  room_id: string | null;
}

/** A room the solver may assign activities into. */
export interface SolverRoom {
  id: string;
  room_type: RoomType;
}

/** Bundled read-only context used to compute domains (Phase: domains.ts). */
export interface SolverContext {
  /** Non-break periods, sorted ascending by sort_order/period_number. */
  periods: SolverPeriod[];
  /** Day-of-week values in play, e.g. [0,1,2,3,4] for Mon-Fri. */
  days: number[];
  teacherAvailability: SolverTeacherAvailability[];
  lockedEntries: LockedEntryInfo[];
  rooms: SolverRoom[];
}

/** Extended context used during search (solver.ts) — superset of SolverContext
 * plus scoring/soft-constraint inputs. */
export interface SolverExtendedContext extends SolverContext {
  teacherConstraints: Map<string, TeacherConstraintInfo>;
  cancelRequested?: () => boolean;
  weights?: SolverWeights;
}

export interface TeacherConstraintInfo {
  max_periods_per_day: number | null;
  max_periods_per_week: number | null;
  min_gap_between_periods: number;
  max_consecutive_periods: number | null;
}

export interface SolverWeights {
  teacher_availability_preferred: number;
  gap_violation: number;
  daily_load_violation: number;
  double_period_broken: number;
  frequency_spread: number;
}

export const DEFAULT_SOLVER_WEIGHTS: SolverWeights = {
  teacher_availability_preferred: 5,
  gap_violation: 3,
  daily_load_violation: 4,
  double_period_broken: 2,
  frequency_spread: 2
}

export type DomainMap = Map<string, SolverSlot[]>;
