/**
 * Pins the core safety property of archived messaging (spec §12): only the
 * two named participants may send; admin (PRINCIPAL) at the same school may
 * READ for oversight but can never send on someone else's behalf; super_admin
 * (SYSADMIN) has zero access, per the spec's matrix; anyone else (including a
 * same-school third party) is denied outright.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))

import { supabase } from '../../config/supabase'
import { sendMessage, listMessages, listMyStudentsForThreads } from './threads.service'

const SCHOOL_A = 'school-a'
const TEACHER_ID = 'teacher-1'
const GUARDIAN_ID = 'guardian-1'
const THREAD_ID = 'thread-1'

function makeQueryBuilder(result: { data: any; error?: any }) {
  const builder: any = {}
  for (const method of ['select', 'eq', 'in', 'order', 'update', 'is', 'neq', 'insert']) {
    builder[method] = jest.fn().mockReturnValue(builder)
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  builder.single = jest.fn().mockResolvedValue(result)
  builder.then = (resolve: any) => resolve(result)
  return builder
}

const THREAD_ROW = { id: THREAD_ID, school_id: SCHOOL_A, teacher_id: TEACHER_ID, guardian_id: GUARDIAN_ID, student_id: 'student-1' }

describe('threads.service — access control', () => {
  beforeEach(() => jest.clearAllMocks())

  it('★ denies a same-school caller who is neither a participant nor admin', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_threads') return makeQueryBuilder({ data: THREAD_ROW, error: null })
      return makeQueryBuilder({ data: null, error: null })
    })

    await expect(
      sendMessage({ profileId: 'random-teacher', role: 'teacher', schoolId: SCHOOL_A }, THREAD_ID, 'hello')
    ).rejects.toThrow(/Access denied/)

    await expect(
      listMessages({ profileId: 'random-teacher', role: 'teacher', schoolId: SCHOOL_A }, THREAD_ID)
    ).rejects.toThrow(/Access denied/)
  })

  it('lets the two named participants both send and read', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_threads') return makeQueryBuilder({ data: THREAD_ROW, error: null })
      if (table === 'fina_messages') return makeQueryBuilder({ data: [], error: null })
      return makeQueryBuilder({ data: null, error: null })
    })

    await expect(sendMessage({ profileId: TEACHER_ID, role: 'teacher', schoolId: SCHOOL_A }, THREAD_ID, 'hi')).resolves.toBeDefined()
    await expect(listMessages({ profileId: GUARDIAN_ID, role: 'parent', schoolId: SCHOOL_A }, THREAD_ID)).resolves.toEqual([])
  })

  it('★ lets admin READ for oversight but never SEND on the participants\' behalf', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_threads') return makeQueryBuilder({ data: THREAD_ROW, error: null })
      if (table === 'fina_messages') return makeQueryBuilder({ data: [], error: null })
      return makeQueryBuilder({ data: null, error: null })
    })

    await expect(listMessages({ profileId: 'principal-1', role: 'admin', schoolId: SCHOOL_A }, THREAD_ID)).resolves.toEqual([])
    await expect(
      sendMessage({ profileId: 'principal-1', role: 'admin', schoolId: SCHOOL_A }, THREAD_ID, 'butting in')
    ).rejects.toThrow(/Access denied/)
  })

  it('★ super_admin has zero access — no oversight read, matching spec §12\'s Messages: ❌', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_threads') return makeQueryBuilder({ data: THREAD_ROW, error: null })
      if (table === 'fina_messages') return makeQueryBuilder({ data: [], error: null })
      return makeQueryBuilder({ data: null, error: null })
    })

    await expect(
      listMessages({ profileId: 'vendor-1', role: 'super_admin', schoolId: SCHOOL_A }, THREAD_ID)
    ).rejects.toThrow(/Access denied/)
    await expect(
      sendMessage({ profileId: 'vendor-1', role: 'super_admin', schoolId: SCHOOL_A }, THREAD_ID, 'nope')
    ).rejects.toThrow(/Access denied/)
  })
})

describe('threads.service — listMyStudentsForThreads (teacher-initiated conversation picker)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('is teacher-only', async () => {
    await expect(
      listMyStudentsForThreads({ profileId: GUARDIAN_ID, role: 'parent', schoolId: SCHOOL_A })
    ).rejects.toThrow(/Access denied/)
  })

  it('returns every student across every section this teacher is assigned to', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'staff') return makeQueryBuilder({ data: { id: 'staff-1' }, error: null })
      if (table === 'teacher_subject_assignments') return makeQueryBuilder({ data: [{ section_id: 'section-a' }, { section_id: 'section-b' }], error: null })
      if (table === 'students') {
        return makeQueryBuilder({
          data: [
            { id: 'student-1', section_id: 'section-a', profile: { first_name: 'Amal', last_name: 'K' } },
            { id: 'student-2', section_id: 'section-b', profile: { first_name: 'Zaid', last_name: 'M' } },
          ],
          error: null,
        })
      }
      return makeQueryBuilder({ data: null, error: null })
    })

    const result = await listMyStudentsForThreads({ profileId: TEACHER_ID, role: 'teacher', schoolId: SCHOOL_A })

    expect(result).toEqual([
      { id: 'student-1', sectionId: 'section-a', name: 'Amal K' },
      { id: 'student-2', sectionId: 'section-b', name: 'Zaid M' },
    ])
  })

  it('returns an empty list for a teacher with no staff row / no section assignments', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'staff') return makeQueryBuilder({ data: null, error: null })
      return makeQueryBuilder({ data: null, error: null })
    })

    const result = await listMyStudentsForThreads({ profileId: 'teacher-2', role: 'teacher', schoolId: SCHOOL_A })

    expect(result).toEqual([])
  })
})
