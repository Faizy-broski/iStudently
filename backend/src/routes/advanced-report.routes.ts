import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { supabase } from '../config/supabase'

const router = Router()

router.use(authenticate)
router.use(requireRole('admin', 'super_admin'))

/**
 * GET /api/advanced-report/:role/search
 * Quick name/number search for picking a specific user.
 * Query: ?q=<term>&campus_id=<id>
 */
router.get('/:role/search', async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.params
    const validRoles = ['student', 'teacher', 'staff', 'librarian', 'parent']
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, error: `Invalid role: ${role}` })
      return
    }

    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'No school associated with account' })
      return
    }

    const q = ((req.query.q as string) ?? '').trim().toLowerCase()
    const campusId = req.query.campus_id as string | undefined
    const effectiveId = campusId?.trim() ? campusId.trim() : schoolId

    let results: { id: string; label: string }[] = []

    if (role === 'student') {
      const { data: rows } = await supabase
        .from('students')
        .select('id, student_number, profile:profiles(first_name, last_name)')
        .eq('school_id', effectiveId)
        .limit(200)

      results = (rows ?? [])
        .map((s: any) => {
          const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
          return { id: s.id, label: `${p?.first_name ?? ''} ${p?.last_name ?? ''} (${s.student_number})`.trim() }
        })
        .filter(r => !q || r.label.toLowerCase().includes(q))
        .slice(0, 30)
    }

    if (['teacher', 'staff', 'librarian'].includes(role)) {
      const { data: rows } = await supabase
        .from('staff')
        .select('id, employee_number, profile:profiles!staff_profile_id_fkey(first_name, last_name, role)')
        .eq('school_id', effectiveId)
        .limit(200)

      results = (rows ?? [])
        .filter((r: any) => {
          const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
          return p?.role === role
        })
        .map((s: any) => {
          const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
          return { id: s.id, label: `${p?.first_name ?? ''} ${p?.last_name ?? ''} (${s.employee_number ?? ''})`.trim() }
        })
        .filter(r => !q || r.label.toLowerCase().includes(q))
        .slice(0, 30)
    }

    if (role === 'parent') {
      const { data: schoolRow } = await supabase
        .from('schools').select('id, parent_school_id').eq('id', effectiveId).single()
      const parentSchoolId = schoolRow?.parent_school_id ?? effectiveId

      const { data: rows } = await supabase
        .from('parents')
        .select('id, profile:profiles(first_name, last_name, email)')
        .eq('school_id', parentSchoolId)
        .limit(200)

      results = (rows ?? [])
        .map((r: any) => {
          const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
          return { id: r.id, label: `${p?.first_name ?? ''} ${p?.last_name ?? ''} (${p?.email ?? ''})`.trim() }
        })
        .filter(r => !q || r.label.toLowerCase().includes(q))
        .slice(0, 30)
    }

    res.json({ success: true, data: results })
  } catch (err: any) {
    console.error('Advanced report search error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/advanced-report/:role
 * Returns all users of a given role for the admin's school/campus.
 * Supported roles: student, teacher, staff, librarian, parent
 * Query: ?campus_id=<id>&page=1&limit=1000&grade_level_id=&section_id=&department=&user_id=
 */
router.get('/:role', async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.params
    const validRoles = ['student', 'teacher', 'staff', 'librarian', 'parent']
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, error: `Invalid role: ${role}` })
      return
    }

    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'No school associated with account' })
      return
    }

    const campusId    = req.query.campus_id     as string | undefined
    const gradeLevelId = req.query.grade_level_id as string | undefined
    const sectionId   = req.query.section_id    as string | undefined
    const department  = req.query.department    as string | undefined
    const userId      = req.query.user_id       as string | undefined
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
    const limit = Math.min(2000, parseInt(req.query.limit as string) || 1000)
    const offset = (page - 1) * limit
    const effectiveId = campusId?.trim() ? campusId.trim() : schoolId

    let data: any[] = []

    // ── Students ───────────────────────────────────────────────────────────
    if (role === 'student') {
      let q = supabase
        .from('students')
        .select(`
          id, student_number, custom_fields, created_at,
          profile:profiles(
            first_name, last_name, father_name, grandfather_name,
            email, phone, is_active
          ),
          grade:grade_levels!grade_level_id(name),
          section:sections!section_id(name)
        `)
        .eq('school_id', effectiveId)
        .order('created_at', { ascending: false })

      if (gradeLevelId?.trim()) q = q.eq('grade_level_id', gradeLevelId.trim())
      if (sectionId?.trim())    q = q.eq('section_id', sectionId.trim())
      if (userId?.trim())       q = q.eq('id', userId.trim())

      const { data: rows, error } = await q.range(offset, offset + limit - 1)

      if (error) throw error
      data = (rows ?? []).map((s: any) => {
        const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
        return {
          id: s.id,
          student_number: s.student_number,
          first_name: p?.first_name ?? '',
          last_name: p?.last_name ?? '',
          father_name: p?.father_name ?? '',
          grandfather_name: p?.grandfather_name ?? '',
          email: p?.email ?? '',
          phone: p?.phone ?? '',
          is_active: p?.is_active ?? false,
          grade_level_name: s.grade?.name ?? '',
          section_name: s.section?.name ?? '',
          created_at: s.created_at,
          custom_fields: s.custom_fields ?? {},
        }
      })
    }

    // ── Teachers / Staff / Librarians ─────────────────────────────────────
    if (['teacher', 'staff', 'librarian'].includes(role)) {
      let q = supabase
        .from('staff')
        .select(`
          id, employee_number, title, department, qualifications,
          date_of_joining, employment_type, is_active, created_at, custom_fields,
          profile:profiles!staff_profile_id_fkey(
            first_name, last_name, email, phone, role
          )
        `)
        .eq('school_id', effectiveId)
        .order('created_at', { ascending: false })

      if (department?.trim()) q = q.ilike('department', `%${department.trim()}%`)
      if (userId?.trim())     q = q.eq('id', userId.trim())

      const { data: rows, error } = await q.range(offset, offset + limit - 1)

      if (error) throw error
      data = (rows ?? [])
        .filter((r: any) => {
          const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
          return p?.role === role
        })
        .map((s: any) => {
          const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
          return {
            id: s.id,
            employee_number: s.employee_number,
            first_name: p?.first_name ?? '',
            last_name: p?.last_name ?? '',
            email: p?.email ?? '',
            phone: p?.phone ?? '',
            title: s.title,
            department: s.department,
            qualifications: s.qualifications,
            date_of_joining: s.date_of_joining,
            employment_type: s.employment_type,
            is_active: s.is_active,
            created_at: s.created_at,
            custom_fields: s.custom_fields ?? {},
          }
        })
    }

    // ── Parents ────────────────────────────────────────────────────────────
    if (role === 'parent') {
      // Parents are stored at root school level. To make this campus-specific,
      // find student IDs in this campus, then get parents linked to those students.
      const { data: campusStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', effectiveId)

      const campusStudentIds = (campusStudents ?? []).map((s: any) => s.id)

      // If a campus is selected but has no students, return empty
      if (campusId && campusStudentIds.length === 0) {
        data = []
      } else {
        // Resolve root school for parents table
        const { data: schoolRow } = await supabase
          .from('schools')
          .select('id, parent_school_id')
          .eq('id', effectiveId)
          .single()

        const parentSchoolId = schoolRow?.parent_school_id ?? effectiveId

        let query = supabase
          .from('parents')
          .select(`
            id, created_at,
            profile:profiles(first_name, last_name, email, phone, is_active),
            parent_student_links(student_id, students(student_number))
          `)
          .eq('school_id', parentSchoolId)
          .order('created_at', { ascending: false })

        if (userId?.trim()) query = query.eq('id', userId.trim())

        const { data: rows, error } = await query.range(offset, offset + limit - 1)

        if (error) throw error

        const allRows = rows ?? []

        // If campus filter active, only keep parents linked to campus students
        const filtered = campusId
          ? allRows.filter((row: any) =>
              (row.parent_student_links ?? []).some((l: any) =>
                campusStudentIds.includes(l.student_id)
              )
            )
          : allRows

        data = filtered.map((row: any) => {
          const p = Array.isArray(row.profile) ? row.profile[0] : row.profile
          const children = (row.parent_student_links ?? [])
            .filter((l: any) => !campusId || campusStudentIds.includes(l.student_id))
            .map((l: any) => l.students?.student_number)
            .filter(Boolean)
            .join(', ')

          return {
            id: row.id,
            first_name: p?.first_name ?? '',
            last_name: p?.last_name ?? '',
            email: p?.email ?? '',
            phone: p?.phone ?? '',
            linked_students: children || '—',
            is_active: p?.is_active ?? false,
            created_at: row.created_at,
            custom_fields: {},
          }
        })
      }

      res.json({ success: true, data, role })
      return
    }

    res.json({ success: true, data, role })
  } catch (err: any) {
    console.error('Advanced report error:', err)
    res.status(500).json({ success: false, error: err.message || 'Failed to generate report' })
  }
})

export default router
