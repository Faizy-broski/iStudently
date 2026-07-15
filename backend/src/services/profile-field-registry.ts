// Registry of existing profile/role-table columns that a signup link can
// map an "Additional Custom Field" onto, so the applicant's answer is written
// directly to that column on approval instead of the freeform `custom_fields` JSONB.

export interface ProfileFieldOption {
  id: string
  label_en: string
  label_ar: string
}

export interface ProfileFieldDef {
  table: 'profiles' | 'parents' | 'staff'
  column: string
  label_en: string
  label_ar: string
  type: 'text' | 'select' | 'textarea' | 'date'
  options?: ProfileFieldOption[]
  appliesToRoles: string[]
}

const ALL_ROLES = ['teacher', 'student', 'parent', 'staff', 'librarian', 'counselor']
const STAFF_ROLES = ['teacher', 'staff', 'librarian', 'counselor']

export const PROFILE_FIELD_REGISTRY: ProfileFieldDef[] = [
  {
    table: 'profiles',
    column: 'gender',
    label_en: 'Gender',
    label_ar: 'الجنس',
    type: 'select',
    options: [
      { id: 'male', label_en: 'Male', label_ar: 'ذكر' },
      { id: 'female', label_en: 'Female', label_ar: 'أنثى' },
    ],
    appliesToRoles: ALL_ROLES,
  },
  {
    table: 'profiles',
    column: 'date_of_birth',
    label_en: 'Date of Birth',
    label_ar: 'تاريخ الميلاد',
    type: 'date',
    appliesToRoles: ALL_ROLES,
  },
  {
    table: 'profiles',
    column: 'national_id',
    label_en: 'National ID',
    label_ar: 'رقم الهوية',
    type: 'text',
    appliesToRoles: ALL_ROLES,
  },
  {
    table: 'profiles',
    column: 'address',
    label_en: 'Address',
    label_ar: 'العنوان',
    type: 'textarea',
    appliesToRoles: ALL_ROLES,
  },
  {
    table: 'parents',
    column: 'occupation',
    label_en: 'Occupation',
    label_ar: 'المهنة',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'parents',
    column: 'workplace',
    label_en: 'Workplace',
    label_ar: 'مكان العمل',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'parents',
    column: 'cnic',
    label_en: 'CNIC',
    label_ar: 'الرقم الوطني',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'parents',
    column: 'city',
    label_en: 'City',
    label_ar: 'المدينة',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'parents',
    column: 'state',
    label_en: 'State/Province',
    label_ar: 'المحافظة',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'parents',
    column: 'zip_code',
    label_en: 'Zip Code',
    label_ar: 'الرمز البريدي',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'parents',
    column: 'emergency_contact_name',
    label_en: 'Emergency Contact Name',
    label_ar: 'اسم جهة الاتصال في حالات الطوارئ',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'parents',
    column: 'emergency_contact_relation',
    label_en: 'Emergency Contact Relation',
    label_ar: 'صلة جهة الاتصال في حالات الطوارئ',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'parents',
    column: 'emergency_contact_phone',
    label_en: 'Emergency Contact Phone',
    label_ar: 'هاتف جهة الاتصال في حالات الطوارئ',
    type: 'text',
    appliesToRoles: ['parent'],
  },
  {
    table: 'staff',
    column: 'department',
    label_en: 'Department',
    label_ar: 'القسم',
    type: 'text',
    appliesToRoles: STAFF_ROLES,
  },
  {
    table: 'staff',
    column: 'qualifications',
    label_en: 'Qualifications',
    label_ar: 'المؤهلات',
    type: 'textarea',
    appliesToRoles: STAFF_ROLES,
  },
  {
    table: 'staff',
    column: 'specialization',
    label_en: 'Specialization',
    label_ar: 'التخصص',
    type: 'text',
    appliesToRoles: STAFF_ROLES,
  },
]

export function getProfileFieldsForRole(role: string): ProfileFieldDef[] {
  return PROFILE_FIELD_REGISTRY.filter(f => f.appliesToRoles.includes(role))
}
