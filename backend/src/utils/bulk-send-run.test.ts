let row: any = null
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const b: any = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: row, error: null }) }
      return b
    },
  },
}))
jest.mock('./campus-validation', () => ({ campusIdsAllowed: jest.fn(async (own: string, ids: string[]) => ids.every((i) => i.startsWith(own))) }))

import { getBulkSendRun } from './bulk-send-jobs'

describe('getBulkSendRun', () => {
  it('finds a run sent for a branch campus of the caller school (was "not found")', async () => {
    row = { id: 'r1', school_id: 'mainA-campus2', status: 'running' }
    const run = await getBulkSendRun('r1', 'mainA')
    expect(run).toMatchObject({ id: 'r1', status: 'running' })
    expect(run).not.toHaveProperty('school_id')
  })

  it("never returns another school's run", async () => {
    row = { id: 'r2', school_id: 'mainB', status: 'completed' }
    expect(await getBulkSendRun('r2', 'mainA')).toBeNull()
  })
})
