// The signed report PDF is final: no replacement once fully signed, and only the report's own
// (still assigned) inspector may replace it before that.
let report: any
let assigned = true
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const b: any = {}
      b.select = () => b
      b.eq = () => b
      b.single = () => Promise.resolve({ data: report, error: null })
      return b
    },
  },
}))
jest.mock('../utils/inspector-access', () => ({ assertInspectorCanAccessSchool: jest.fn(async () => assigned) }))
jest.mock('../utils/campus-validation', () => ({ validateCampusAccess: jest.fn(async () => true) }))
jest.mock('./inspection-evaluation.service', () => ({
  getEvaluationRowOrThrow: jest.fn(), assertCanEdit: jest.fn(), assertCanView: jest.fn(),
}))

import { assertCanUploadReportPdf } from './inspection-report.service'

const owner = { profileId: 'insp-1', role: 'inspector', schoolId: 'x' }
beforeEach(() => {
  assigned = true
  report = { id: 'r1', school_id: 's1', inspector_profile_id: 'insp-1', teacher_profile_id: 't1', status: 'pending_signatures' }
})

it('lets the owning, still-assigned inspector replace an unsigned report PDF', async () => {
  await expect(assertCanUploadReportPdf(owner, 'r1')).resolves.toMatchObject({ id: 'r1' })
})
it('refuses once the report is fully signed', async () => {
  report.status = 'fully_signed'
  await expect(assertCanUploadReportPdf(owner, 'r1')).rejects.toThrow(/fully signed/)
  await expect(assertCanUploadReportPdf({ profileId: 'a', role: 'admin', schoolId: 's1' }, 'r1')).rejects.toThrow(/fully signed/)
})
it('refuses another assigned inspector', async () => {
  await expect(assertCanUploadReportPdf({ ...owner, profileId: 'insp-2' }, 'r1')).rejects.toThrow(/only the inspector who wrote/)
})
it('refuses an owner whose campus grant was revoked', async () => {
  assigned = false
  await expect(assertCanUploadReportPdf(owner, 'r1')).rejects.toThrow(/not assigned/)
})
it('refuses the inspected teacher', async () => {
  await expect(assertCanUploadReportPdf({ profileId: 't1', role: 'teacher', schoolId: 's1' }, 'r1')).rejects.toThrow()
})
