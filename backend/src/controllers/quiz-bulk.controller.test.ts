// Bulk question create: each question's school and campus must be in the caller's school family.
jest.mock('../services/quiz.service', () => ({ createQuestion: jest.fn(async (q: any) => ({ id: 'new', ...q })) }))
jest.mock('../services/chapters.service', () => ({}))
jest.mock('../services/ai-question.service', () => ({}))
jest.mock('../utils/campus-validation', () => ({
  campusIdsAllowed: async (_own: string, ids: string[]) => ids.every((id) => id === 's1' || id === 'c1'),
}))

import { bulkCreateQuestions } from './quiz.controller'

const run = async (questions: unknown[]) => {
  const res: any = { json: jest.fn(), status: jest.fn(() => res) }
  await bulkCreateQuestions({ body: { questions }, profile: { role: 'teacher', school_id: 's1' } } as any, res)
  return res
}

it("refuses questions for another school's bank and fills in the caller's school", async () => {
  expect((await run([{ title: 'a', school_id: 's9' }])).status).toHaveBeenCalledWith(403)
  expect((await run([{ title: 'a', campus_id: 's9' }])).status).toHaveBeenCalledWith(403)
  const ok = await run([{ title: 'a', campus_id: 'c1' }])
  expect(ok.status).not.toHaveBeenCalled()
  expect(ok.json.mock.calls[0][0].data[0]).toMatchObject({ school_id: 's1', campus_id: 'c1' })
})
