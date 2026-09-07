import { supabase } from '../config/supabase'

/**
 * Plain-string token substitution — no regex, so special characters in
 * token values can never break the replacement.
 */
export function substituteMessageTokens(
  text: string,
  tokens: Record<string, string>
): string {
  let result = text
  for (const [token, value] of Object.entries(tokens)) {
    result = result.split(token).join(value ?? '')
  }
  return result
}

/**
 * Build the substitution data map for a given recipient profile.
 * Every token in the full union of all roles is initialised to '' so that
 * a token irrelevant to the recipient's role renders blank rather than
 * leaking the raw __TOKEN__ text.
 */
export async function resolveRecipientSubstitutionData(
  recipientProfileId: string
): Promise<Record<string, string>> {
  // Full token universe — all start blank so irrelevant tokens for a
  // recipient's role render as '' rather than the raw __TOKEN__ string.
  const tokens: Record<string, string> = {
    __FULL_NAME__: '',
    __FIRST_NAME__: '',
    __FATHER_NAME__: '',
    __GRANDFATHER_NAME__: '',
    __LAST_NAME__: '',
    __DATE_OF_BIRTH__: '',
    __GENDER__: '',
    __EMAIL__: '',
    __PHONE__: '',
    __ADDRESS__: '',
    __STUDENT_NUMBER__: '',
    __ADMISSION_NUMBER__: '',
    __GRADE_LEVEL__: '',
    __SECTION__: '',
    __PARENT_NAME__: '',
    __PARENT_PHONE__: '',
    __EMPLOYEE_NUMBER__: '',
    __TITLE__: '',
    __DEPARTMENT__: '',
    __ROLE__: '',
    __QUALIFICATIONS__: '',
    __SPECIALIZATION__: '',
    __DATE_OF_JOINING__: '',
    __OCCUPATION__: '',
    __WORKPLACE__: '',
    __CHILD_NAME__: '',
    __CHILD_GRADE__: '',
    __DATE__: new Date().toLocaleDateString(),
  }

  // Fetch profile row
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, father_name, grandfather_name, last_name, email, phone, role')
    .eq('id', recipientProfileId)
    .single()

  if (profileError || !profile) return tokens

  const first = (profile.first_name as string) || ''
  const father = (profile.father_name as string) || ''
  const grandfather = (profile.grandfather_name as string) || ''
  const last = (profile.last_name as string) || ''
  const fullName = [first, father, grandfather, last].filter(Boolean).join(' ')

  tokens.__FIRST_NAME__ = first
  tokens.__FATHER_NAME__ = father
  tokens.__GRANDFATHER_NAME__ = grandfather
  tokens.__LAST_NAME__ = last
  tokens.__FULL_NAME__ = fullName
  tokens.__EMAIL__ = (profile.email as string) || ''
  tokens.__PHONE__ = (profile.phone as string) || ''
  tokens.__ROLE__ = (profile.role as string) || ''

  const role = profile.role as string

  if (role === 'student') {
    const { data: student } = await supabase
      .from('students')
      .select(
        'student_number, grade:grade_levels!grade_level_id(name), section:sections!section_id(name), parent_links:parent_student_links(is_active, parent:parents(profile:profiles(first_name, last_name, phone)))'
      )
      .eq('profile_id', recipientProfileId)
      .single()

    if (student) {
      tokens.__STUDENT_NUMBER__ = (student.student_number as string) || ''
      tokens.__GRADE_LEVEL__ = (student.grade as any)?.name || ''
      tokens.__SECTION__ = (student.section as any)?.name || ''

      // Only use the first active parent link — a student may have several
      const activeLinks = ((student.parent_links as any[]) || []).filter(
        (l: any) => l.is_active !== false
      )
      if (activeLinks.length > 0) {
        const parentProfile = activeLinks[0]?.parent?.profile
        if (parentProfile) {
          tokens.__PARENT_NAME__ = `${parentProfile.first_name || ''} ${parentProfile.last_name || ''}`.trim()
          tokens.__PARENT_PHONE__ = (parentProfile.phone as string) || ''
        }
      }
    }
  } else if (
    ['teacher', 'staff', 'librarian', 'counselor', 'inspector', 'media_officer', 'fina_supervisor'].includes(role)
  ) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('employee_number, title, department, qualifications, specialization, date_of_joining')
      .eq('profile_id', recipientProfileId)
      .single()

    if (staffRow) {
      tokens.__EMPLOYEE_NUMBER__ = (staffRow.employee_number as string) || ''
      tokens.__TITLE__ = (staffRow.title as string) || ''
      tokens.__DEPARTMENT__ = (staffRow.department as string) || ''
      tokens.__QUALIFICATIONS__ = (staffRow.qualifications as string) || ''
      tokens.__SPECIALIZATION__ = (staffRow.specialization as string) || ''
      tokens.__DATE_OF_JOINING__ = staffRow.date_of_joining
        ? new Date(staffRow.date_of_joining as string).toLocaleDateString()
        : ''
    }
  } else if (role === 'parent') {
    const { data: parentRow } = await supabase
      .from('parents')
      .select('occupation, workplace, address')
      .eq('profile_id', recipientProfileId)
      .single()

    if (parentRow) {
      tokens.__OCCUPATION__ = (parentRow.occupation as string) || ''
      tokens.__WORKPLACE__ = (parentRow.workplace as string) || ''
      tokens.__ADDRESS__ = (parentRow.address as string) || ''
    }

    // First active linked child only (a parent may have several children)
    const { data: links } = await supabase
      .from('parent_student_links')
      .select(
        'student:students(grade:grade_levels!grade_level_id(name), profile:profiles(first_name, last_name))'
      )
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)

    if (links && links.length > 0) {
      const child = (links[0] as any)?.student
      if (child) {
        const childProfile = child.profile
        tokens.__CHILD_NAME__ = childProfile
          ? `${childProfile.first_name || ''} ${childProfile.last_name || ''}`.trim()
          : ''
        tokens.__CHILD_GRADE__ = (child.grade as any)?.name || ''
      }
    }
  }
  // admin / super_admin: only the common profile tokens are filled (above); no extra table join needed

  return tokens
}
