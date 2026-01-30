export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent' | 'staff' | 'librarian'
export type SchoolStatus = 'active' | 'suspended'

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
  book?: Book
}

export interface BookLoan {
  id: string
  book_copy_id: string
  student_id: string
  school_id: string
  issue_date: string
  due_date: string
  return_date?: string
  status: LoanStatus
  fine_amount?: number
  collected_amount?: number
  notes?: string
  created_at: string
  updated_at: string
  // Additional fields for display
  book_title?: string
  student_name?: string
  accession_number?: string
  book_price?: number
}

export interface Student {
  id: string
  school_id: string
  first_name: string
  last_name: string
  admission_number: string
  class_name: string
  email?: string
  phone?: string
  status: 'active' | 'inactive'
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
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Extended fields for role-specific data
  staff_id?: string // For teachers and staff
  student_id?: string // For students
  parent_id?: string // For parents
  section_id?: string // For students - their assigned class section
  campus_id?: string // For students - their campus
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

export interface OnboardSchoolData {
  school: {
    name: string
    slug: string
    contact_email: string
    address: string
    website?: string | null
    settings?: School['settings']
    modules?: School['modules']
  }
  admin: {
    email: string
    password: string
    first_name: string
    last_name: string
  }
}


export interface AuthContextType {
  user: any | null
  profile: Profile | null
  loading: boolean
  // Access token for authenticated API calls (optional)
  access_token?: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  // Recovery function to clear stuck loading states
  recoverFromError?: () => void
}

// Student Types
export type StudentStatus = 'active' | 'inactive' | 'suspended'
export type Gender = 'male' | 'female'
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-'

export interface PreviousSchoolHistory {
  schoolName: string
  transferDate: string
  lastGradeCompleted: string
}

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
  address: string
}

export type CustomFieldType = 'text' | 'long-text' | 'number' | 'date' | 'checkbox' | 'select' | 'multi-select' | 'file'
export type CampusScope = 'this_campus' | 'selected_campuses' | 'all_campuses'

export interface CustomField {
  id: string
  label: string
  type: CustomFieldType
  value: any
  options?: string[] // For select/multi-select
  required?: boolean
  sort_order?: number // Position in form
  campus_scope?: CampusScope // Which campuses this field applies to
  applicable_school_ids?: string[] // For selected_campuses scope
}

export interface CustomFieldCategory {
  id: string
  name: string
  fields: CustomField[]
}

export interface StudentFormData {
  // System & Identity
  studentId: string
  username: string
  password: string
  status: StudentStatus

  // Personal Information (4 Name Fields)
  firstName: string
  fatherName: string
  grandfatherName: string
  lastName: string
  dateOfBirth: Date | null
  gender: Gender | null
  studentPhoto: string
  address: string
  email: string
  phoneNumber: string

  // Academic Information
  gradeLevel: string // Legacy field
  grade_level_id?: string // New: UUID reference to grade_levels table
  section_id?: string // New: UUID reference to sections table
  admissionDate: Date | null
  previousSchoolHistory: PreviousSchoolHistory

  // Medical Information
  bloodGroup: BloodGroup | null
  hasAllergies: boolean
  allergiesList: string[]
  medicalNotes: string

  // Family & Emergency
  linkedParentId: string
  parentRelationType?: 'father' | 'mother' | 'guardian' | 'other'
  emergencyContacts: EmergencyContact[]

  // Custom Fields
  customCategories: CustomFieldCategory[]
}
