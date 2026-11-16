// A complaint may only be answered by its owner, an assignee or an admin of its school.
const tables: Record<string, any> = {}
const inserts: any[] = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: any = {}
      b.select = () => b
      b.eq = () => b
      b.insert = (row: any) => { inserts.push({ table, row }); return b }
      b.upsert = () => b
      b.update = () => b
      b.maybeSingle = async () => ({ data: tables[table] ?? null, error: null })
      b.single = async () => ({ data: tables[table] ?? null, error: tables[table] ? null : { message: 'not found' } })
      b.then = (resolve: any) => resolve({ data: [], error: null })
      return b
    },
  },
}))
jest.mock('./push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn(), sendToProfile: jest.fn() } }))

import { GrievanceService } from './grievance.service'

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  inserts.length = 0
  tables.grievances = { id: 'g1', school_id: 's1', submitter_profile_id: 'owner', is_confidential: false, person_involved_profile_id: null }
})

describe('grievance addComment', () => {
  it('rejects a parent who is neither owner nor assignee', async () => {
    await expect(new GrievanceService().addComment('g1', { id: 'other', role: 'parent', school_id: 's1' }, 'hi', false)).rejects.toThrow('You do not have access')
    expect(inserts.find((i) => i.table === 'grievance_comments')).toBeUndefined()
  })

  it('rejects a complaint outside the caller school', async () => {
    delete tables.grievances
    await expect(new GrievanceService().addComment('g1', { id: 'owner', role: 'parent', school_id: 's2' }, 'hi', false)).rejects.toThrow()
  })
})
