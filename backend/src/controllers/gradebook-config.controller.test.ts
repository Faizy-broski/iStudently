// Gradebook settings: campus rows override school rows, the batch save no longer writes the campus
// into course_period_id, and the lowercase fields the settings pages read are derived from the keys.
const setConfig = jest.fn(async () => undefined)
const store: Record<string, Record<string, string>> = { s1: { ASSIGNMENT_SORTING: 'title', WEIGHT: 'N' }, c1: { WEIGHT: 'Y', 'SEM-q1': '50' } }
jest.mock('../services/gradebook.service', () => ({
  GradebookService: class {},
  gradebookService: { getConfig: async (id: string) => store[id] ?? {}, setConfig },
}))

import * as ctrl from './gradebook.controller'

const res = () => {
  const r: any = { json: jest.fn(), status: jest.fn(() => r) }
  return r
}

it('merges campus over school and normalizes', async () => {
  const r = res()
  await ctrl.getConfig({ query: { campus_id: 'c1' }, profile: { school_id: 's1' } } as any, r)
  expect(r.json.mock.calls[0][0].data).toMatchObject({ assignment_sorting: 'title', weight_assignment_types: true, 'SEM-q1': '50', auto_save_final_grades: undefined })
})

it('saves batch keys for the campus with no course period', async () => {
  const r = res()
  await ctrl.setBatchConfig({ body: { campus_id: 'c1', configs: [{ key: 'WEIGHT', value: 'N' }] }, profile: { school_id: 's1' } } as any, r)
  expect(setConfig).toHaveBeenCalledWith('c1', null, 'WEIGHT', 'N')
})
