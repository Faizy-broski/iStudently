// Each assigned campus is measured against its OWN current academic year when no year is passed.
const yearFor: Record<string, string | undefined> = { s1: 'y-s1', s2: undefined }
jest.mock('../../config/supabase', () => ({ supabase: { from: () => ({}) } }))
jest.mock('../quran/quran-reference.service', () => ({ quranReferenceService: {} }))
const listSyllabusTargets = jest.fn(async () => [])
jest.mock('./ministry-syllabus.service', () => ({ hifziMinistrySyllabusService: { listSyllabusTargets: (...a: any[]) => (listSyllabusTargets as any)(...a) } }))
jest.mock('../../utils/campus-validation', () => ({ validateCampusAccess: jest.fn() }))
jest.mock('../../utils/inspector-access', () => ({ listAssignedSchoolIds: jest.fn(async () => ['s1', 's2']) }))
jest.mock('../academics.service', () => ({
  getCurrentAcademicYear: jest.fn(async (id: string) => (yearFor[id] ? { success: true, data: { id: yearFor[id] } } : { success: false })),
}))

import { hifziComplianceDashboardService } from './compliance-dashboard.service'

const caller = { profileId: 'i', role: 'inspector', schoolId: 'home' }
beforeEach(() => listSyllabusTargets.mockClear())

it('uses each campus\'s own current year, skipping a campus with none', async () => {
  await hifziComplianceDashboardService.getInspectorComplianceDashboard(caller)
  expect(listSyllabusTargets).toHaveBeenCalledTimes(1)
  expect(listSyllabusTargets).toHaveBeenCalledWith('s1', 'y-s1')
})
it('still honours an explicit year for every campus', async () => {
  await hifziComplianceDashboardService.getInspectorComplianceDashboard(caller, 'forced')
  expect(listSyllabusTargets).toHaveBeenCalledWith('s1', 'forced')
  expect(listSyllabusTargets).toHaveBeenCalledWith('s2', 'forced')
})
