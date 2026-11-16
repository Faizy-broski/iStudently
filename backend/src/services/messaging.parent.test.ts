// A parent may message only their linked children's teachers, school admins and approved staff.
const tables: Record<string, any[]> = {}
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: any = {}
      let rows = tables[table] ?? []
      b.select = () => b
      b.eq = (col: string, v: unknown) => {
        // Only a profiles role filter matters here (the admins lookup); other filters pass through.
        if (table === 'profiles' && col === 'role') rows = rows.filter((r) => r.role === v)
        return b
      }
      b.in = () => b
      b.not = () => b
      b.limit = () => b
      b.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
      b.single = async () => ({ data: rows[0] ?? null, error: null })
      b.insert = () => b
      b.then = (resolve: any) => resolve({ data: rows, error: null })
      return b
    },
  },
}))
jest.mock('../utils/campus-validation', () => ({ campusIdsAllowed: async () => true }))
jest.mock('./message-substitution.service', () => ({
  substituteMessageTokens: (x: string) => x,
  resolveRecipientSubstitutionData: async () => ({}),
}))

import { MessagingAccessError, MessagingService } from './messaging.service'

const base = { schoolId: 's1', senderProfileId: 'parent1', senderRole: 'parent', subject: 'Hi', body: 'Hello' }

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  tables.parent_student_links = [{ student: { section_id: 'sec1', school_id: 's1' }, parent: { profile_id: 'parent1', school_id: 's1' } }]
  tables.course_periods = [{ teacher_id: 'st1', secondary_teacher_id: null }]
  tables.staff = [{ profile_id: 'teacherProfile' }]
  tables.schools = [{ id: 's1', parent_school_id: null }]
  tables.profiles = [{ id: 'adminProfile' }]
  tables.teacher_message_allowed_staff = [{ staff_profile_id: 'approvedProfile' }]
})

describe('parent messaging recipients', () => {
  it('refuses a profile that is not a child teacher, admin or approved staff', async () => {
    await expect(new MessagingService().sendMessage({ ...base, recipientProfileIds: ['someoneElse'] })).rejects.toBeInstanceOf(MessagingAccessError)
  })

  it('refuses more than 20 recipients', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => `p${i}`)
    await expect(new MessagingService().sendMessage({ ...base, recipientProfileIds: ids })).rejects.toBeInstanceOf(MessagingAccessError)
  })

  it('refuses non-http attachment links', async () => {
    await expect(
      new MessagingService().sendMessage({ ...base, recipientProfileIds: ['teacherProfile'], attachments: [{ url: 'file:///etc/passwd', name: 'x', mime_type: 'a/b', size: 1, path: 'x' }] }),
    ).rejects.toBeInstanceOf(MessagingAccessError)
  })

  it('lists teachers and admins/approved staff for a parent, and no students or parents', async () => {
    const svc = new MessagingService()
    tables.profiles = [{ id: 'teacherProfile', first_name: 'T', last_name: 'One', role: 'teacher', is_active: true }, { id: 'adminProfile', first_name: 'A', last_name: 'Min', role: 'admin', is_active: true }, { id: 'approvedProfile', first_name: 'S', last_name: 'Taff', role: 'librarian', is_active: true }]
    const teachers = await svc.listRecipients('s1', 'parent', 'teachers', undefined, undefined, undefined, undefined, 1, 25, 'parent1')
    expect(teachers.data.map((r) => r.profileId)).toEqual(['teacherProfile'])
    const staff = await svc.listRecipients('s1', 'parent', 'staff', undefined, undefined, undefined, undefined, 1, 25, 'parent1')
    expect(staff.data.map((r) => r.profileId).sort()).toEqual(['adminProfile', 'approvedProfile'])
    expect((await svc.listRecipients('s1', 'parent', 'students', undefined, undefined, undefined, undefined, 1, 25, 'parent1')).data).toEqual([])
    expect((await svc.listRecipients('s1', 'parent', 'parents', undefined, undefined, undefined, undefined, 1, 25, 'parent1')).data).toEqual([])
  })
})
