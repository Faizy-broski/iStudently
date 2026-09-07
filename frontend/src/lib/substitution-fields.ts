/**
 * Message substitution field definitions.
 *
 * Token format: __UPPER_SNAKE_CASE__ (double underscores, consistent with the
 * ID-card page's GROUPED_FIELDS and the backend message-substitution service).
 *
 * These are purely presentational — the actual resolution happens in
 * backend/src/services/message-substitution.service.ts at read time.
 */

export interface SubstitutionField {
  id: string   // the raw token, e.g. '__FULL_NAME__'
  label: string
}

export interface SubstitutionGroup {
  label: string
  fields: SubstitutionField[]
}

// ─── Student tokens ──────────────────────────────────────────────────────────

export const STUDENT_SUBSTITUTION_GROUPS: SubstitutionGroup[] = [
  {
    label: 'Personal',
    fields: [
      { id: '__FULL_NAME__',        label: 'Full Name' },
      { id: '__FIRST_NAME__',       label: 'First Name' },
      { id: '__FATHER_NAME__',      label: 'Father Name' },
      { id: '__GRANDFATHER_NAME__', label: 'Grandfather Name' },
      { id: '__LAST_NAME__',        label: 'Last Name' },
      { id: '__DATE_OF_BIRTH__',    label: 'Date of Birth' },
      { id: '__GENDER__',           label: 'Gender' },
      { id: '__EMAIL__',            label: 'Email' },
      { id: '__PHONE__',            label: 'Phone' },
    ],
  },
  {
    label: 'Academic',
    fields: [
      { id: '__STUDENT_NUMBER__',   label: 'Student Number' },
      { id: '__ADMISSION_NUMBER__', label: 'Admission Number' },
      { id: '__GRADE_LEVEL__',      label: 'Grade Level' },
      { id: '__SECTION__',          label: 'Section' },
    ],
  },
  {
    label: 'Parent',
    fields: [
      { id: '__PARENT_NAME__',  label: 'Parent Name' },
      { id: '__PARENT_PHONE__', label: 'Parent Phone' },
    ],
  },
  {
    label: 'System',
    fields: [
      { id: '__DATE__', label: 'Today\'s Date' },
    ],
  },
]

// ─── Staff / Teacher tokens ───────────────────────────────────────────────────

export const STAFF_SUBSTITUTION_GROUPS: SubstitutionGroup[] = [
  {
    label: 'Personal',
    fields: [
      { id: '__FULL_NAME__',  label: 'Full Name' },
      { id: '__FIRST_NAME__', label: 'First Name' },
      { id: '__LAST_NAME__',  label: 'Last Name' },
      { id: '__EMAIL__',      label: 'Email' },
      { id: '__PHONE__',      label: 'Phone' },
    ],
  },
  {
    label: 'Employment',
    fields: [
      { id: '__EMPLOYEE_NUMBER__',  label: 'Employee Number' },
      { id: '__TITLE__',            label: 'Title' },
      { id: '__DEPARTMENT__',       label: 'Department' },
      { id: '__ROLE__',             label: 'Role' },
      { id: '__QUALIFICATIONS__',   label: 'Qualifications' },
      { id: '__SPECIALIZATION__',   label: 'Specialization' },
      { id: '__DATE_OF_JOINING__',  label: 'Date of Joining' },
    ],
  },
  {
    label: 'System',
    fields: [
      { id: '__DATE__', label: 'Today\'s Date' },
    ],
  },
]

// ─── Parent tokens ───────────────────────────────────────────────────────────

export const PARENT_SUBSTITUTION_GROUPS: SubstitutionGroup[] = [
  {
    label: 'Personal',
    fields: [
      { id: '__FULL_NAME__',  label: 'Full Name' },
      { id: '__FIRST_NAME__', label: 'First Name' },
      { id: '__LAST_NAME__',  label: 'Last Name' },
      { id: '__EMAIL__',      label: 'Email' },
      { id: '__PHONE__',      label: 'Phone' },
      { id: '__ADDRESS__',    label: 'Address' },
    ],
  },
  {
    label: 'Work',
    fields: [
      { id: '__OCCUPATION__', label: 'Occupation' },
      { id: '__WORKPLACE__',  label: 'Workplace' },
    ],
  },
  {
    label: 'Child',
    fields: [
      { id: '__CHILD_NAME__',  label: 'Child Name (first linked child)' },
      { id: '__CHILD_GRADE__', label: 'Child Grade' },
    ],
  },
  {
    label: 'System',
    fields: [
      { id: '__DATE__', label: 'Today\'s Date' },
    ],
  },
]

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Returns the appropriate substitution group list for the currently active
 * recipient tab in MessageCompose.
 */
export function getSubstitutionGroupsForTab(
  tab: 'students' | 'teachers' | 'staff' | 'parents'
): SubstitutionGroup[] {
  if (tab === 'students') return STUDENT_SUBSTITUTION_GROUPS
  if (tab === 'parents')  return PARENT_SUBSTITUTION_GROUPS
  return STAFF_SUBSTITUTION_GROUPS // 'teachers' | 'staff'
}
