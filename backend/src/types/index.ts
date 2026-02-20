import { z } from "zod";

export type UserRole =
  | "super_admin"
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | "staff"
  | "librarian"
  | "counselor";
export type SchoolStatus = "active" | "suspended";
export type ParentRelationType = "father" | "mother" | "guardian" | "other"; // Removed 'both'
export type EventCategory =
  | "academic"
  | "holiday"
  | "exam"
  | "meeting"
  | "activity"
  | "reminder";
export type SubjectType = "theory" | "lab" | "practical";
export type EmploymentType = "full_time" | "part_time" | "contract";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday, 6 = Sunday
// export type PersonType = 'student' | 'user';
export type Direction = "in" | "out";
export type EntryStatus = "authorized" | "late" | "early" | "unauthorized";

// Academics Types
export interface GradeLevel {
  id: string;
  school_id: string;
  name: string;
  order_index: number;
  base_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Computed fields
  sections_count?: number;
  subjects_count?: number;
  students_count?: number;
}

export interface Section {
  id: string;
  school_id: string;
  grade_level_id: string;
  name: string;
  capacity: number;
  current_strength: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  grade_name?: string;
  available_seats?: number;
}

export interface Subject {
  id: string;
  school_id: string;
  grade_level_id: string;
  name: string;
  code: string;
  subject_type: SubjectType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  grade_name?: string;
  grade_order?: number;
}

export interface CreateGradeLevelDTO {
  school_id: string;
  name: string;
  order_index: number;
  base_fee: number;
  created_by?: string;
}

export interface UpdateGradeLevelDTO {
  name?: string;
  order_index?: number;
  base_fee?: number;
  is_active?: boolean;
}

export interface CreateSectionDTO {
  school_id: string;
  grade_level_id: string;
  name: string;
  capacity: number;
  created_by?: string;
}

export interface UpdateSectionDTO {
  name?: string;
  capacity?: number;
  is_active?: boolean;
}

export interface CreateSubjectDTO {
  school_id: string;
  grade_level_id: string;
  name: string;
  code: string;
  subject_type?: SubjectType;
  created_by?: string;
}

export interface UpdateSubjectDTO {
  name?: string;
  code?: string;
  subject_type?: SubjectType;
  is_active?: boolean;
}

// Library Types
export type BookCopyStatus =
  | "available"
  | "issued"
  | "lost"
  | "maintenance"
  | "damaged";
export type LoanStatus = "active" | "returned" | "overdue" | "lost";

export interface Book {
  id: string;
  school_id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  publisher: string | null;
  publication_year: number | null;
  description: string | null;
  total_copies: number;
  available_copies: number;
  created_at: string;
  updated_at: string;
}

export interface BookCopy {
  id: string;
  book_id: string;
  school_id: string;
  accession_number: string;
  status: BookCopyStatus;
  purchase_date: Date | null;
  price: number | null;
  condition_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookLoan {
  id: string;
  book_copy_id: string;
  student_id: string;
  school_id: string;
  issue_date: Date;
  due_date: Date;
  return_date: Date | null;
  status: LoanStatus;
  fine_amount: number;
  collected_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryFine {
  id: string;
  loan_id: string;
  student_id: string;
  school_id: string;
  amount: number;
  paid: boolean;
  paid_at: Date | null;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  school_id: string | null;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  father_name: string | null; // NEW: Father's name
  grandfather_name: string | null; // NEW: Grandfather's name
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  profile_photo_url: string | null; // NEW: Supabase storage URL
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
  logo_url: string | null;
  website: string | null;
  contact_email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  principal_name: string | null;
  short_name: string | null;
  school_number: string | null;
  parent_school_id: string | null; // NEW: For branches
  settings?: {
    grading_scale: number;
    currency: string;
    library: {
      max_books: number;
      fine_per_day: number;
    };
  };
  modules?: {
    food_service: boolean;
    discipline: boolean;
    billing: boolean;
    activities: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateSchoolDTO {
  name: string;
  slug: string;
  contact_email: string;
  parent_school_id?: string; // NEW: Optional parent school ID
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  principal_name?: string;
  short_name?: string;
  school_number?: string;
  website?: string;
  logo_url?: string;
  settings?: School["settings"];
  modules?: School["modules"];
}

export interface UpdateSchoolDTO {
  name?: string;
  contact_email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  principal_name?: string;
  short_name?: string;
  school_number?: string;
  website?: string;
  logo_url?: string;
  status?: SchoolStatus;
}

export interface SchoolStats {
  total_schools: number;
  active_schools: number;
  suspended_schools: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================================
// STUDENT TYPES
// ============================================================================

export interface Student {
  id: string;
  profile_id: string | null;
  school_id: string;
  student_number: string;
  grade_level: string | null; // Legacy field - will be deprecated
  grade_level_id: string | null; // New: Reference to grade_levels table
  section_id: string | null; // New: Reference to sections table
  medical_info?: {
    allergies?: string[];
    medications?: string[];
    conditions?: string[];
    emergency_notes?: string;
  };
  custom_fields?: Record<string, any>;
  created_at: string;
  // Joined data
  profile?: Profile;
}

export interface CreateStudentDTO {
  profile_id?: string;
  school_id: string;
  student_number: string;
  grade_level?: string; // Legacy - keep for backward compatibility
  grade_level_id?: string; // New: UUID reference to grade_levels
  section_id?: string; // New: UUID reference to sections
  medical_info?: Student["medical_info"];
  custom_fields?: Record<string, any>;
  // Profile data (if creating new user)
  first_name?: string;
  father_name?: string; // NEW
  grandfather_name?: string; // NEW
  last_name?: string;
  email?: string;
  phone?: string;
  profile_photo_url?: string; // NEW: Supabase storage URL
  password?: string; // NEW: Optional password for creation
}

export interface UpdateStudentDTO {
  student_number?: string;
  grade_level?: string; // Legacy
  grade_level_id?: string; // New: UUID reference
  section_id?: string; // New: UUID reference
  medical_info?: Student["medical_info"];
  custom_fields?: Record<string, any>;
  // Profile updates
  first_name?: string;
  father_name?: string; // NEW
  grandfather_name?: string; // NEW
  last_name?: string;
  email?: string;
  phone?: string;
  profile_photo_url?: string; // NEW
  password?: string; // NEW: Optional password update
  is_active?: boolean; // NEW: Student active status
}

// ============================================================================
// PARENT TYPES
// ============================================================================

export interface Parent {
  id: string;
  profile_id: string | null;
  school_id: string;
  occupation: string | null;
  workplace: string | null;
  income: string | null;
  cnic: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: Profile;
  children?: StudentWithRelationship[];
}

export interface StudentWithRelationship {
  id: string;
  student_id: string;
  student_number: string;
  grade_level: string | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
  };
  relationship: string;
  is_emergency_contact: boolean;
}

export interface CreateParentDTO {
  profile_id?: string;
  school_id: string;
  occupation?: string;
  workplace?: string;
  income?: string;
  cnic?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  notes?: string;
  metadata?: Record<string, any>;
  custom_fields?: Record<string, any>;
  // Profile data (if creating new user)
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  username?: string; // Optional custom username
  password?: string; // Optional custom password
}

export interface UpdateParentDTO {
  occupation?: string;
  workplace?: string;
  income?: string;
  cnic?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  notes?: string;
  metadata?: Record<string, any>;
  custom_fields?: Record<string, any>;
  // Profile updates
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  password?: string; // Optional password update
}

export interface ParentStudentLink {
  parent_id: string;
  student_id: string;
  relationship: string;
  relation_type: ParentRelationType;
  is_emergency_contact: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateParentStudentLinkDTO {
  parent_id: string;
  student_id: string;
  relationship: string;
  relation_type: ParentRelationType;
  is_emergency_contact?: boolean;
  is_active?: boolean;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface SchoolEvent {
  id: string;
  school_id: string;
  campus_id?: string | null;
  title: string;
  description: string | null;
  category: EventCategory;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  visible_to_roles: UserRole[];
  target_grades: string[] | null;
  color_code: string;
  send_reminder: boolean;
  reminder_sent: boolean;
  hijri_offset: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEventDTO {
  school_id: string;
  campus_id?: string | null;
  title: string;
  description?: string;
  category: EventCategory;
  start_at: string;
  end_at: string;
  is_all_day?: boolean;
  visible_to_roles?: UserRole[];
  target_grades?: string[];
  color_code?: string;
  send_reminder?: boolean;
  hijri_offset?: number;
  created_by?: string;
}

export interface UpdateEventDTO {
  campus_id?: string | null;
  title?: string;
  description?: string;
  category?: EventCategory;
  start_at?: string;
  end_at?: string;
  is_all_day?: boolean;
  visible_to_roles?: UserRole[];
  target_grades?: string[];
  color_code?: string;
  send_reminder?: boolean;
  hijri_offset?: number;
}

export interface EventFilters {
  category?: EventCategory;
  start_date?: string;
  end_date?: string;
  user_role?: UserRole;
  grade_level?: string;
}

// ============================================================================
// TEACHER & WORKLOAD TYPES
// ============================================================================

export interface Staff {
  id: string;
  profile_id: string;
  school_id: string;
  employee_number: string;
  title: string | null;
  department: string | null;
  qualifications: string | null;
  specialization: string | null;
  date_of_joining: string | null;
  employment_type: EmploymentType;
  role: string | null; // teacher, admin, librarian, etc.
  grade_level_id: string | null; // Optional: assigned as class teacher
  section_id: string | null; // Optional: assigned as class teacher
  is_active: boolean;
  permissions: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  profile?: Profile;
  grade_level?: any;
  section?: any;
  assigned_subjects?: TeacherSubjectAssignment[];
}

// Staff Types
export interface Staff {
  id: string;
  profile_id: string;
  school_id: string;
  employee_number: string;
  title: string | null;
  department: string | null;
  qualifications: string | null;
  specialization: string | null;
  date_of_joining: string | null;
  employment_type: EmploymentType;
  is_active: boolean;
  permissions: Record<string, any>;
  custom_fields: any[]; // JSONB
  created_at: string;
  updated_at: string;
  created_by: string | null;
  profile?: Profile;
}

export interface CreateStaffDTO {
  profile_id?: string;
  school_id: string;
  employee_number?: string; // Optional - will be auto-generated if not provided
  title?: string;
  department?: string;
  qualifications?: string;
  specialization?: string;
  date_of_joining?: string;
  employment_type?: EmploymentType;
  payment_type?: 'fixed_salary' | 'hourly';
  permissions?: Record<string, any>;
  custom_fields?: any[]; // NEW
  created_by?: string;
  // Profile data (if creating new user)
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  profile_photo_url?: string;
  // Credentials (optional - will be auto-generated if not provided)
  username?: string;
  password?: string;
  // Salary (optional - creates salary_structure entry)
  base_salary?: number;
}

export interface UpdateStaffDTO {
  employee_number?: string;
  title?: string;
  department?: string;
  qualifications?: string;
  specialization?: string;
  date_of_joining?: string;
  employment_type?: EmploymentType;
  payment_type?: 'fixed_salary' | 'hourly';
  role?: string;
  grade_level_id?: string | null;
  section_id?: string | null;
  is_active?: boolean;
  permissions?: Record<string, any>;
  custom_fields?: any[]; // NEW
  // Profile updates
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  password?: string; // Optional password update
  base_salary?: number; // Optional base salary update
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_next: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAcademicYearDTO {
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
  is_next?: boolean;
}

export interface UpdateAcademicYearDTO {
  name?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  is_next?: boolean;
  is_active?: boolean;
}

export interface Period {
  id: string;
  school_id: string;
  campus_id?: string | null;
  period_number: number;
  start_time: string;
  end_time: string;
  period_name: string | null;
  is_break: boolean;
  is_active: boolean;
  created_at: string;
}

export interface CreatePeriodDTO {
  school_id: string;
  campus_id?: string;
  period_number: number;
  start_time: string;
  end_time: string;
  period_name?: string;
  is_break?: boolean;
}

export interface UpdatePeriodDTO {
  period_number?: number;
  start_time?: string;
  end_time?: string;
  period_name?: string;
  is_break?: boolean;
  is_active?: boolean;
}

// Step 1: Workload Allocation
export interface TeacherSubjectAssignment {
  id: string;
  school_id: string;
  teacher_id: string;
  subject_id: string;
  section_id: string;
  academic_year_id: string;
  is_primary: boolean;
  assigned_at: string;
  assigned_by: string | null;
  // Joined data
  teacher_name?: string;
  subject_name?: string;
  section_name?: string;
  grade_name?: string;
}

export interface CreateTeacherAssignmentDTO {
  school_id: string;
  teacher_id: string;
  subject_id: string;
  section_id: string;
  academic_year_id: string;
  is_primary?: boolean;
  assigned_by?: string;
}

export interface AssignmentConflict {
  has_conflict: boolean;
  message: string;
  existing_teacher?: {
    id: string;
    name: string;
  };
}

// Step 2: Timetable Construction
export interface TimetableEntry {
  id: string;
  school_id: string;
  campus_id?: string | null;
  academic_year_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  period_id: string;
  day_of_week: DayOfWeek;
  room_number: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  // Joined data
  section_name?: string;
  grade_name?: string;
  subject_name?: string;
  teacher_name?: string;
  period_number?: number;
  start_time?: string;
  end_time?: string;
}

export interface CreateTimetableEntryDTO {
  school_id: string;
  campus_id?: string;
  academic_year_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  period_id: string;
  day_of_week: DayOfWeek;
  room_number?: string;
  created_by?: string;
}

export interface UpdateTimetableEntryDTO {
  subject_id?: string;
  teacher_id?: string;
  period_id?: string;
  day_of_week?: DayOfWeek;
  room_number?: string;
  is_active?: boolean;
}

export interface TimetableConflict {
  has_conflict: boolean;
  conflict_details: string;
}

export interface TeacherSchedule {
  period_number: number;
  period_name: string | null;
  start_time: string;
  end_time: string;
  subject_name: string | null;
  section_name: string | null;
  grade_name: string | null;
  room_number: string | null;
  is_break: boolean;
}

// Step 3 & 4: Attendance Records
export interface AttendanceRecord {
  id: string;
  school_id: string;
  campus_id?: string | null;
  student_id: string;
  timetable_entry_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  marked_at: string;
  marked_by: string | null;
  auto_generated: boolean;
  remarks: string | null;
  // Joined data
  student_name?: string;
  student_number?: string;
}

export interface CreateAttendanceDTO {
  school_id: string;
  student_id: string;
  timetable_entry_id: string;
  attendance_date: string;
  status?: AttendanceStatus;
  remarks?: string;
  marked_by?: string;
}

export interface UpdateAttendanceDTO {
  status: AttendanceStatus;
  remarks?: string;
  marked_by?: string;
}

export interface BulkAttendanceUpdate {
  student_id: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface AttendanceStats {
  total_students: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
}

// ============================================================================
// ASSIGNMENTS TYPES
// ============================================================================

export type AssignmentStatus =
  | "pending"
  | "submitted"
  | "late"
  | "graded"
  | "returned";

export interface Assignment {
  id: string;
  school_id: string;
  teacher_id: string;
  section_id: string;
  subject_id: string;
  academic_year_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  assigned_date: string;
  due_date: string;
  due_time: string | null;
  max_score: number;
  is_graded: boolean;
  allow_late_submission: boolean;
  attachments: any[];
  is_published: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  teacher?: {
    id: string;
    profile: {
      first_name: string | null;
      last_name: string | null;
    };
  };
  section?: {
    id: string;
    name: string;
    current_strength?: number;
    grade_level?: {
      name: string;
    };
  };
  subject?: {
    id: string;
    name: string;
  };
  academic_year?: {
    id: string;
    year_name: string;
  };
}

export interface CreateAssignmentDTO {
  school_id: string;
  campus_id?: string; // For multi-campus support
  teacher_id: string;
  section_id: string;
  subject_id: string;
  academic_year_id: string;
  title: string;
  description?: string;
  instructions?: string;
  assigned_date?: string;
  due_date: string;
  due_time?: string;
  max_score?: number;
  is_graded?: boolean;
  allow_late_submission?: boolean;
  attachments?: any[];
  is_published?: boolean;
  created_by?: string;
}

export interface UpdateAssignmentDTO {
  title?: string;
  description?: string;
  instructions?: string;
  due_date?: string;
  due_time?: string;
  max_score?: number;
  is_graded?: boolean;
  allow_late_submission?: boolean;
  attachments?: any[];
  is_published?: boolean;
  is_archived?: boolean;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  school_id: string;
  submission_text: string | null;
  attachments: any[];
  status: AssignmentStatus;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  graded_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  student?: {
    id: string;
    student_number: string;
    profile: {
      first_name: string | null;
      last_name: string | null;
    };
  };
  assignment?: {
    title: string;
    max_score: number;
  };
}

export interface SubmitAssignmentDTO {
  assignment_id: string;
  student_id: string;
  submission_text?: string;
  attachments?: any[];
}

export interface GradeSubmissionDTO {
  score: number;
  feedback?: string;
  graded_by: string;
}

// ============================================================================
// ENTRY & EXIT MODULE TYPES
// ============================================================================

export type PersonType = "STUDENT" | "STAFF";
export type RecordType = "ENTRY" | "EXIT";
export type CheckpointMode = "entry" | "exit" | "both";
export type PackageStatus = "pending" | "collected";

export interface Checkpoint {
  id: string;
  school_id: string;
  name: string;
  mode: CheckpointMode;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined
  authorized_times?: CheckpointAuthorizedTime[];
}

export interface CheckpointAuthorizedTime {
  id: string;
  checkpoint_id: string;
  day_of_week: number; // 0=Sun, 6=Sat
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface EntryExitRecord {
  id: string;
  school_id: string;
  checkpoint_id: string;
  person_id: string;
  person_type: PersonType;
  record_type: RecordType;
  status: EntryStatus;
  description: string | null;
  recorded_at: string;
  created_at: string;
  // Joined
  checkpoint_name?: string;
  person_name?: string;
  student_number?: string;
}

export interface EveningLeave {
  id: string;
  school_id: string;
  student_id: string;
  checkpoint_id: string | null;
  start_date: string;
  end_date: string;
  days_of_week: number[];
  authorized_return_time: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined
  student_name?: string;
  student_number?: string;
  checkpoint_name?: string;
}

export interface PackageDelivery {
  id: string;
  school_id: string;
  student_id: string;
  description: string | null;
  sender: string | null;
  status: PackageStatus;
  received_at: string;
  collected_at: string | null;
  created_at: string;
  // Joined
  student_name?: string;
  student_number?: string;
}

export interface StudentCheckpointNote {
  id: string;
  school_id: string;
  student_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// DTOs

export interface CreateCheckpointDTO {
  school_id: string;
  name: string;
  mode?: CheckpointMode;
  description?: string;
}

export interface UpdateCheckpointDTO {
  name?: string;
  mode?: CheckpointMode;
  description?: string;
  is_active?: boolean;
}

export interface CreateEntryExitDTO {
  school_id: string;
  checkpoint_id: string;
  person_id: string;
  person_type: PersonType;
  record_type: RecordType;
  description?: string;
}

export interface CreateEveningLeaveDTO {
  school_id: string;
  student_id: string;
  checkpoint_id?: string;
  start_date: string;
  end_date: string;
  days_of_week: number[];
  authorized_return_time: string;
  reason?: string;
}

export interface UpdateEveningLeaveDTO {
  checkpoint_id?: string;
  start_date?: string;
  end_date?: string;
  days_of_week?: number[];
  authorized_return_time?: string;
  reason?: string;
  is_active?: boolean;
}

export interface CreatePackageDTO {
  school_id: string;
  student_id: string;
  description?: string;
  sender?: string;
}

// Zod Schemas

export const createCheckpointSchema = z.object({
  school_id: z.string().uuid(),
  name: z.string().min(1),
  mode: z.enum(["entry", "exit", "both"]).optional().default("both"),
  description: z.string().optional(),
});

export const updateCheckpointSchema = z.object({
  name: z.string().min(1).optional(),
  mode: z.enum(["entry", "exit", "both"]).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const createRecordSchema = z.object({
  school_id: z.string().uuid(),
  checkpoint_id: z.string().uuid(),
  person_id: z.string().uuid(),
  person_type: z.enum(["STUDENT", "STAFF"]),
  record_type: z.enum(["ENTRY", "EXIT"]),
  description: z.string().optional(),
});

export type CreateRecordDTO = z.infer<typeof createRecordSchema>;

export const createEveningLeaveSchema = z.object({
  school_id: z.string().uuid(),
  student_id: z.string().uuid(),
  checkpoint_id: z.string().uuid().optional(),
  start_date: z.string(),
  end_date: z.string(),
  days_of_week: z.array(z.number().min(0).max(6)),
  authorized_return_time: z.string(),
  reason: z.string().optional(),
});

export const updateEveningLeaveSchema = z.object({
  checkpoint_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  days_of_week: z.array(z.number().min(0).max(6)).optional(),
  authorized_return_time: z.string().optional(),
  reason: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const createPackageSchema = z.object({
  school_id: z.string().uuid(),
  student_id: z.string().uuid(),
  description: z.string().optional(),
  sender: z.string().optional(),
});

// =============================================================
// HOSTEL MODULE
// =============================================================

export interface HostelBuilding {
  id: string;
  school_id: string;
  name: string;
  address?: string;
  floors: number;
  description?: string;
  custom_fields: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  room_count?: number;
}

export interface HostelRoom {
  id: string;
  building_id: string;
  school_id: string;
  room_number: string;
  floor: number;
  capacity: number;
  room_type: string;
  price_per_month: number;
  description?: string;
  custom_fields: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  building_name?: string;
  occupancy?: number;
}

export interface HostelRoomAssignment {
  id: string;
  room_id: string;
  student_id: string;
  school_id: string;
  assigned_date: string;
  released_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined
  student_name?: string;
  room_number?: string;
  building_name?: string;
}

export interface HostelRoomFile {
  id: string;
  entity_type: "building" | "room";
  entity_id: string;
  school_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: string;
  created_at: string;
}

export interface HostelVisit {
  id: string;
  student_id: string;
  room_id?: string;
  school_id: string;
  visitor_name: string;
  visitor_phone?: string;
  visitor_relation?: string;
  purpose?: string;
  check_in: string;
  check_out?: string;
  notes?: string;
  recorded_by?: string;
  created_at: string;
  // joined
  student_name?: string;
  room_number?: string;
}

export interface HostelRentalFee {
  id: string;
  room_assignment_id: string;
  student_id: string;
  room_id: string;
  school_id: string;
  period_start: string;
  period_end: string;
  base_amount: number;
  factor: number;
  final_amount: number;
  status: "pending" | "paid" | "partial" | "waived";
  amount_paid: number;
  paid_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined
  student_name?: string;
  room_number?: string;
}

export interface HostelSettings {
  id: string;
  school_id: string;
  auto_remove_inactive: boolean;
  default_room_type: string;
  created_at: string;
  updated_at: string;
}

// Zod schemas

export const createBuildingSchema = z.object({
  school_id: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().optional(),
  floors: z.number().int().min(1).optional(),
  description: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
});

export const updateBuildingSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  floors: z.number().int().min(1).optional(),
  description: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

export const createRoomSchema = z.object({
  building_id: z.string().uuid(),
  school_id: z.string().uuid(),
  room_number: z.string().min(1),
  floor: z.number().int().min(0).optional(),
  capacity: z.number().int().min(1),
  room_type: z.string().optional(),
  price_per_month: z.number().min(0).optional(),
  description: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
});

export const updateRoomSchema = z.object({
  room_number: z.string().min(1).optional(),
  floor: z.number().int().min(0).optional(),
  capacity: z.number().int().min(1).optional(),
  room_type: z.string().optional(),
  price_per_month: z.number().min(0).optional(),
  description: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

export const assignStudentSchema = z.object({
  room_id: z.string().uuid(),
  student_id: z.string().uuid(),
  school_id: z.string().uuid(),
  assigned_date: z.string().optional(),
  notes: z.string().optional(),
});

export const createVisitSchema = z.object({
  student_id: z.string().uuid(),
  room_id: z.string().uuid().optional(),
  school_id: z.string().uuid(),
  visitor_name: z.string().min(1),
  visitor_phone: z.string().optional(),
  visitor_relation: z.string().optional(),
  purpose: z.string().optional(),
  notes: z.string().optional(),
});

export const generateRentalFeesSchema = z.object({
  school_id: z.string().uuid(),
  period_start: z.string(),
  period_end: z.string(),
  factor: z.number().min(0).optional(),
  building_id: z.string().uuid().optional(),
});

export const recordFeePaymentSchema = z.object({
  fee_id: z.string().uuid(),
  amount: z.number().min(0),
  notes: z.string().optional(),
});

// ============================================================================
// ATTENDANCE MODULE TYPES (Admin Attendance System)
// ============================================================================

// ---- Enums / Literal Types ----

export type AttendanceStateCode = 'P' | 'A' | 'H';
export type AttendanceCodeType = 'teacher' | 'official' | 'both';

// ---- Core Entities ----

export interface AttendanceCode {
  id: string;
  school_id: string;
  campus_id?: string | null;
  title: string;
  short_name: string;
  state_code: AttendanceStateCode;
  type: AttendanceCodeType;
  is_default: boolean;
  sort_order: number;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceDailyRecord {
  id: string;
  school_id: string;
  campus_id?: string | null;
  student_id: string;
  attendance_date: string;
  state_value: number; // 0.0, 0.5, 1.0
  total_minutes: number;
  minutes_present: number;
  comment?: string | null;
  academic_year_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  student_name?: string;
  student_number?: string;
  section_name?: string;
  grade_name?: string;
}

export interface AttendanceCalendarDay {
  id: string;
  school_id: string;
  campus_id?: string | null;
  school_date: string;
  is_school_day: boolean;
  minutes: number;
  block?: string | null;
  notes?: string | null;
  academic_year_id?: string | null;
  created_at: string;
}

export interface AttendanceCompletionRecord {
  id: string;
  school_id: string;
  staff_id: string;
  school_date: string;
  period_id: string;
  table_name: number;
  created_at: string;
  // Joined
  staff_name?: string;
  period_name?: string;
  period_number?: number;
}

// ---- DTOs ----

export interface CreateAttendanceCodeDTO {
  school_id: string;
  campus_id?: string | null;
  title: string;
  short_name: string;
  state_code: AttendanceStateCode;
  type?: AttendanceCodeType;
  is_default?: boolean;
  sort_order?: number;
  color?: string;
}

export interface UpdateAttendanceCodeDTO {
  title?: string;
  short_name?: string;
  state_code?: AttendanceStateCode;
  type?: AttendanceCodeType;
  is_default?: boolean;
  sort_order?: number;
  color?: string;
  is_active?: boolean;
}

export interface AddAbsencesDTO {
  school_id: string;
  campus_id?: string | null;
  student_ids: string[];
  attendance_date: string;
  period_ids: string[];
  attendance_code_id: string;
  reason?: string;
  admin_override?: boolean;
  override_by?: string;
}

export interface AttendanceOverrideDTO {
  attendance_record_id: string;
  attendance_code_id: string;
  override_reason: string;
  override_by: string;
}

export interface GenerateCalendarDTO {
  school_id: string;
  academic_year_id: string;
  campus_id?: string | null;
}

export interface UpdateCalendarDayDTO {
  is_school_day?: boolean;
  minutes?: number;
  block?: string;
  notes?: string;
}

export interface AttendanceSheetParams {
  school_id: string;
  campus_id?: string | null;
  section_id?: string;
  grade_id?: string;
  start_date: string;
  end_date: string;
  include_data?: boolean; // Pre-fill with recorded data
}

// ---- Report Interfaces ----

export interface TeacherCompletionStatus {
  staff_id: string;
  staff_name: string;
  periods: {
    period_id: string;
    period_name: string;
    period_number: number;
    completed: boolean;
    assigned: boolean;
    courses?: { subject_name: string; section_name: string }[];
  }[];
  date: string;
}

export interface ADAReportRow {
  date: string;
  total_enrolled: number;
  total_present: number;
  total_absent: number;
  total_half_day: number;
  total_minutes_available: number;
  total_minutes_present: number;
  ada_percentage: number;
}

export interface ADAGradeRow {
  grade_id: string;
  grade_name: string;
  students: number;
  days_possible: number;
  days_present: number;
  days_absent: number;
  ada: number;
  avg_attendance: number;
  avg_absent: number;
}

export interface AttendanceChartData {
  labels: string[];
  present: number[];
  absent: number[];
  half_day: number[];
  ada: number[];
}

export interface AttendanceSummaryRow {
  student_id: string;
  student_name: string;
  student_number?: string;
  section_name?: string;
  grade_name?: string;
  total_days: number;
  days_present: number;
  days_absent: number;
  days_half: number;
  total_minutes: number;
  minutes_present: number;
  attendance_percentage: number;
  state_code_breakdown: Record<string, number>;
}

export interface DailySummaryGridStudent {
  student_id: string;
  student_name: string;
  student_number?: string;
  grade_name?: string;
  dates: Record<string, number | null>; // date → state_value (1.0, 0.5, 0.0) or null
}

export interface DailySummaryGridResponse {
  school_dates: string[];
  students: DailySummaryGridStudent[];
}

export interface DuplicateAttendanceRecord {
  student_id: string;
  student_name?: string;
  attendance_date: string;
  period_id: string;
  period_name?: string;
  count: number;
  record_ids: string[];
}
