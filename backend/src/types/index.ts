export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent' | 'staff' | 'librarian' | 'counselor'
export type SchoolStatus = 'active' | 'suspended'
export type ParentRelationType = 'father' | 'mother' | 'guardian' | 'other' // Removed 'both'
export type EventCategory = 'academic' | 'holiday' | 'exam' | 'meeting' | 'activity' | 'reminder'
export type SubjectType = 'theory' | 'lab' | 'practical'
export type EmploymentType = 'full_time' | 'part_time' | 'contract'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Monday, 6 = Sunday

// Academics Types
export interface GradeLevel {
  id: string
  school_id: string
  name: string
  order_index: number
  base_fee: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  // Computed fields
  sections_count?: number
  subjects_count?: number
  students_count?: number
}

export interface Section {
  id: string
  school_id: string
  grade_level_id: string
  name: string
  capacity: number
  current_strength: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  // Joined data
  grade_name?: string
  available_seats?: number
}

export interface Subject {
  id: string
  school_id: string
  grade_level_id: string
  name: string
  code: string
  subject_type: SubjectType
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  // Joined data
  grade_name?: string
  grade_order?: number
}

export interface CreateGradeLevelDTO {
  school_id: string
  name: string
  order_index: number
  base_fee: number
  created_by?: string
}

export interface UpdateGradeLevelDTO {
  name?: string
  order_index?: number
  base_fee?: number
  is_active?: boolean
}

export interface CreateSectionDTO {
  school_id: string
  grade_level_id: string
  name: string
  capacity: number
  created_by?: string
}

export interface UpdateSectionDTO {
  name?: string
  capacity?: number
  is_active?: boolean
}

export interface CreateSubjectDTO {
  school_id: string
  grade_level_id: string
  name: string
  code: string
  subject_type?: SubjectType
  created_by?: string
}

export interface UpdateSubjectDTO {
  name?: string
  code?: string
  subject_type?: SubjectType
  is_active?: boolean
}

// Library Types
export type BookCopyStatus = 'available' | 'issued' | 'lost' | 'maintenance' | 'damaged'
export type LoanStatus = 'active' | 'returned' | 'overdue' | 'lost'

export interface Book {
  id: string
  school_id: string
  title: string
  author: string
  isbn: string | null
  category: string | null
  publisher: string | null
  publication_year: number | null
  description: string | null
  total_copies: number
  available_copies: number
  created_at: string
  updated_at: string
}

export interface BookCopy {
  id: string
  book_id: string
  school_id: string
  accession_number: string
  status: BookCopyStatus
  purchase_date: Date | null
  price: number | null
  condition_notes: string | null
  created_at: string
  updated_at: string
}

export interface BookLoan {
  id: string
  book_copy_id: string
  student_id: string
  school_id: string
  issue_date: Date
  due_date: Date
  return_date: Date | null
  status: LoanStatus
  fine_amount: number
  collected_amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LibraryFine {
  id: string
  loan_id: string
  student_id: string
  school_id: string
  amount: number
  paid: boolean
  paid_at: Date | null
  reason: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  school_id: string | null
  role: UserRole
  first_name: string | null
  last_name: string | null
  father_name: string | null // NEW: Father's name
  grandfather_name: string | null // NEW: Grandfather's name
  email: string | null
  phone: string | null
  avatar_url: string | null
  profile_photo_url: string | null // NEW: Supabase storage URL
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface School {
  id: string
  name: string
  slug: string
  status: SchoolStatus
  logo_url: string | null
  website: string | null
  contact_email: string
  address: string | null
  parent_school_id: string | null // NEW: For branches
  settings?: {
    grading_scale: number
    currency: string
    library: {
      max_books: number
      fine_per_day: number
    }
  }
  modules?: {
    food_service: boolean
    discipline: boolean
    billing: boolean
    activities: boolean
  }
  created_at: string
  updated_at: string
}

export interface CreateSchoolDTO {
  name: string
  slug: string
  contact_email: string
  parent_school_id?: string // NEW: Optional parent school ID
  address?: string
  website?: string
  logo_url?: string
  settings?: School['settings']
  modules?: School['modules']
}

export interface UpdateSchoolDTO {
  name?: string
  contact_email?: string
  address?: string
  website?: string
  logo_url?: string
  status?: SchoolStatus
}

export interface SchoolStats {
  total_schools: number
  active_schools: number
  suspended_schools: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ============================================================================
// STUDENT TYPES
// ============================================================================

export interface Student {
  id: string
  profile_id: string | null
  school_id: string
  student_number: string
  grade_level: string | null // Legacy field - will be deprecated
  grade_level_id: string | null // New: Reference to grade_levels table
  section_id: string | null // New: Reference to sections table
  medical_info?: {
    allergies?: string[]
    medications?: string[]
    conditions?: string[]
    emergency_notes?: string
  }
  custom_fields?: Record<string, any>
  created_at: string
  // Joined data
  profile?: Profile
}

export interface CreateStudentDTO {
  profile_id?: string
  school_id: string
  student_number: string
  grade_level?: string // Legacy - keep for backward compatibility
  grade_level_id?: string // New: UUID reference to grade_levels
  section_id?: string // New: UUID reference to sections
  medical_info?: Student['medical_info']
  custom_fields?: Record<string, any>
  // Profile data (if creating new user)
  first_name?: string
  father_name?: string // NEW
  grandfather_name?: string // NEW
  last_name?: string
  email?: string
  phone?: string
  profile_photo_url?: string // NEW: Supabase storage URL
  password?: string // NEW: Optional password for creation
}

export interface UpdateStudentDTO {
  student_number?: string
  grade_level?: string // Legacy
  grade_level_id?: string // New: UUID reference
  section_id?: string // New: UUID reference
  medical_info?: Student['medical_info']
  custom_fields?: Record<string, any>
  // Profile updates
  first_name?: string
  father_name?: string // NEW
  grandfather_name?: string // NEW
  last_name?: string
  email?: string
  phone?: string
  profile_photo_url?: string // NEW
  password?: string // NEW: Optional password update
}

// ============================================================================
// PARENT TYPES
// ============================================================================

export interface Parent {
  id: string
  profile_id: string | null
  school_id: string
  occupation: string | null
  workplace: string | null
  income: string | null
  cnic: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  emergency_contact_name: string | null
  emergency_contact_relation: string | null
  emergency_contact_phone: string | null
  notes: string | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
  // Joined data
  profile?: Profile
  children?: StudentWithRelationship[]
}

export interface StudentWithRelationship {
  id: string
  student_id: string
  student_number: string
  grade_level: string | null
  profile?: {
    first_name: string | null
    last_name: string | null
  }
  relationship: string
  is_emergency_contact: boolean
}

export interface CreateParentDTO {
  profile_id?: string
  school_id: string
  occupation?: string
  workplace?: string
  income?: string
  cnic?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  emergency_contact_name?: string
  emergency_contact_relation?: string
  emergency_contact_phone?: string
  notes?: string
  metadata?: Record<string, any>
  custom_fields?: Record<string, any>
  // Profile data (if creating new user)
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  username?: string // Optional custom username
  password?: string // Optional custom password
}

export interface UpdateParentDTO {
  occupation?: string
  workplace?: string
  income?: string
  cnic?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  emergency_contact_name?: string
  emergency_contact_relation?: string
  emergency_contact_phone?: string
  notes?: string
  metadata?: Record<string, any>
  custom_fields?: Record<string, any>
  // Profile updates
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  password?: string // Optional password update
}

export interface ParentStudentLink {
  parent_id: string
  student_id: string
  relationship: string
  relation_type: ParentRelationType
  is_emergency_contact: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateParentStudentLinkDTO {
  parent_id: string
  student_id: string
  relationship: string
  relation_type: ParentRelationType
  is_emergency_contact?: boolean
  is_active?: boolean
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface SchoolEvent {
  id: string
  school_id: string
  title: string
  description: string | null
  category: EventCategory
  start_at: string
  end_at: string
  is_all_day: boolean
  visible_to_roles: UserRole[]
  target_grades: string[] | null
  color_code: string
  send_reminder: boolean
  reminder_sent: boolean
  hijri_offset: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateEventDTO {
  school_id: string
  title: string
  description?: string
  category: EventCategory
  start_at: string
  end_at: string
  is_all_day?: boolean
  visible_to_roles?: UserRole[]
  target_grades?: string[]
  color_code?: string
  send_reminder?: boolean
  hijri_offset?: number
  created_by?: string
}

export interface UpdateEventDTO {
  title?: string
  description?: string
  category?: EventCategory
  start_at?: string
  end_at?: string
  is_all_day?: boolean
  visible_to_roles?: UserRole[]
  target_grades?: string[]
  color_code?: string
  send_reminder?: boolean
  hijri_offset?: number
}

export interface EventFilters {
  category?: EventCategory
  start_date?: string
  end_date?: string
  user_role?: UserRole
  grade_level?: string
}

// ============================================================================
// TEACHER & WORKLOAD TYPES
// ============================================================================

export interface Staff {
  id: string
  profile_id: string
  school_id: string
  employee_number: string
  title: string | null
  department: string | null
  qualifications: string | null
  specialization: string | null
  date_of_joining: string | null
  employment_type: EmploymentType
  role: string | null // teacher, admin, librarian, etc.
  grade_level_id: string | null // Optional: assigned as class teacher
  section_id: string | null // Optional: assigned as class teacher
  is_active: boolean
  permissions: Record<string, any>
  created_at: string
  updated_at: string
  created_by: string | null
  // Joined data
  profile?: Profile
  grade_level?: any
  section?: any
  assigned_subjects?: TeacherSubjectAssignment[]
}

// Staff Types
export interface Staff {
  id: string
  profile_id: string
  school_id: string
  employee_number: string
  title: string | null
  department: string | null
  qualifications: string | null
  specialization: string | null
  date_of_joining: string | null
  employment_type: EmploymentType
  is_active: boolean
  permissions: Record<string, any>
  custom_fields: any[] // JSONB
  created_at: string
  updated_at: string
  created_by: string | null
  profile?: Profile
}

export interface CreateStaffDTO {
  profile_id?: string
  school_id: string
  employee_number?: string // Optional - will be auto-generated if not provided
  title?: string
  department?: string
  qualifications?: string
  specialization?: string
  date_of_joining?: string
  employment_type?: EmploymentType
  permissions?: Record<string, any>
  custom_fields?: any[] // NEW
  created_by?: string
  // Profile data (if creating new user)
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  profile_photo_url?: string
  // Credentials (optional - will be auto-generated if not provided)
  username?: string
  password?: string
  // Salary (optional - creates salary_structure entry)
  base_salary?: number
}

export interface UpdateStaffDTO {
  employee_number?: string
  title?: string
  department?: string
  qualifications?: string
  specialization?: string
  date_of_joining?: string
  employment_type?: EmploymentType
  role?: string
  grade_level_id?: string | null
  section_id?: string | null
  is_active?: boolean
  permissions?: Record<string, any>
  custom_fields?: any[] // NEW
  // Profile updates
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  password?: string // Optional password update
  base_salary?: number // Optional base salary update
}

export interface AcademicYear {
  id: string
  school_id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateAcademicYearDTO {
  school_id: string
  name: string
  start_date: string
  end_date: string
  is_current?: boolean
}

export interface UpdateAcademicYearDTO {
  name?: string
  start_date?: string
  end_date?: string
  is_current?: boolean
  is_active?: boolean
}

export interface Period {
  id: string
  school_id: string
  campus_id?: string | null
  period_number: number
  start_time: string
  end_time: string
  period_name: string | null
  is_break: boolean
  is_active: boolean
  created_at: string
}

export interface CreatePeriodDTO {
  school_id: string
  campus_id?: string
  period_number: number
  start_time: string
  end_time: string
  period_name?: string
  is_break?: boolean
}

export interface UpdatePeriodDTO {
  period_number?: number
  start_time?: string
  end_time?: string
  period_name?: string
  is_break?: boolean
  is_active?: boolean
}

// Step 1: Workload Allocation
export interface TeacherSubjectAssignment {
  id: string
  school_id: string
  teacher_id: string
  subject_id: string
  section_id: string
  academic_year_id: string
  is_primary: boolean
  assigned_at: string
  assigned_by: string | null
  // Joined data
  teacher_name?: string
  subject_name?: string
  section_name?: string
  grade_name?: string
}

export interface CreateTeacherAssignmentDTO {
  school_id: string
  teacher_id: string
  subject_id: string
  section_id: string
  academic_year_id: string
  is_primary?: boolean
  assigned_by?: string
}

export interface AssignmentConflict {
  has_conflict: boolean
  message: string
  existing_teacher?: {
    id: string
    name: string
  }
}

// Step 2: Timetable Construction
export interface TimetableEntry {
  id: string
  school_id: string
  campus_id?: string | null
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id: string
  period_id: string
  day_of_week: DayOfWeek
  room_number: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
  // Joined data
  section_name?: string
  grade_name?: string
  subject_name?: string
  teacher_name?: string
  period_number?: number
  start_time?: string
  end_time?: string
}

export interface CreateTimetableEntryDTO {
  school_id: string
  campus_id?: string
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id: string
  period_id: string
  day_of_week: DayOfWeek
  room_number?: string
  created_by?: string
}

export interface UpdateTimetableEntryDTO {
  subject_id?: string
  teacher_id?: string
  period_id?: string
  day_of_week?: DayOfWeek
  room_number?: string
  is_active?: boolean
}

export interface TimetableConflict {
  has_conflict: boolean
  conflict_details: string
}

export interface TeacherSchedule {
  period_number: number
  period_name: string | null
  start_time: string
  end_time: string
  subject_name: string | null
  section_name: string | null
  grade_name: string | null
  room_number: string | null
  is_break: boolean
}

// Step 3 & 4: Attendance Records
export interface AttendanceRecord {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  timetable_entry_id: string
  attendance_date: string
  status: AttendanceStatus
  marked_at: string
  marked_by: string | null
  auto_generated: boolean
  remarks: string | null
  // Joined data
  student_name?: string
  student_number?: string
}

export interface CreateAttendanceDTO {
  school_id: string
  student_id: string
  timetable_entry_id: string
  attendance_date: string
  status?: AttendanceStatus
  remarks?: string
  marked_by?: string
}

export interface UpdateAttendanceDTO {
  status: AttendanceStatus
  remarks?: string
  marked_by?: string
}

export interface BulkAttendanceUpdate {
  student_id: string
  status: AttendanceStatus
  remarks?: string
}

export interface AttendanceStats {
  total_students: number
  present: number
  absent: number
  late: number
  excused: number
  percentage: number
}

// ============================================================================
// ASSIGNMENTS TYPES
// ============================================================================

export type AssignmentStatus = 'pending' | 'submitted' | 'late' | 'graded' | 'returned'

export interface Assignment {
  id: string
  school_id: string
  teacher_id: string
  section_id: string
  subject_id: string
  academic_year_id: string
  title: string
  description: string | null
  instructions: string | null
  assigned_date: string
  due_date: string
  due_time: string | null
  max_score: number
  is_graded: boolean
  allow_late_submission: boolean
  attachments: any[]
  is_published: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  // Joined data
  teacher?: {
    id: string
    profile: {
      first_name: string | null
      last_name: string | null
    }
  }
  section?: {
    id: string
    name: string
    current_strength?: number
    grade_level?: {
      name: string
    }
  }
  subject?: {
    id: string
    name: string
  }
  academic_year?: {
    id: string
    year_name: string
  }
}

export interface CreateAssignmentDTO {
  school_id: string
  campus_id?: string  // For multi-campus support
  teacher_id: string
  section_id: string
  subject_id: string
  academic_year_id: string
  title: string
  description?: string
  instructions?: string
  assigned_date?: string
  due_date: string
  due_time?: string
  max_score?: number
  is_graded?: boolean
  allow_late_submission?: boolean
  attachments?: any[]
  is_published?: boolean
  created_by?: string
}

export interface UpdateAssignmentDTO {
  title?: string
  description?: string
  instructions?: string
  due_date?: string
  due_time?: string
  max_score?: number
  is_graded?: boolean
  allow_late_submission?: boolean
  attachments?: any[]
  is_published?: boolean
  is_archived?: boolean
}

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  student_id: string
  school_id: string
  submission_text: string | null
  attachments: any[]
  status: AssignmentStatus
  submitted_at: string | null
  score: number | null
  feedback: string | null
  graded_at: string | null
  graded_by: string | null
  created_at: string
  updated_at: string
  // Joined data
  student?: {
    id: string
    student_number: string
    profile: {
      first_name: string | null
      last_name: string | null
    }
  }
  assignment?: {
    title: string
    max_score: number
  }
}

export interface SubmitAssignmentDTO {
  assignment_id: string
  student_id: string
  submission_text?: string
  attachments?: any[]
}

export interface GradeSubmissionDTO {
  score: number
  feedback?: string
  graded_by: string
}
