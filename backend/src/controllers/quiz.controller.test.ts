jest.mock('../services/quiz.service', () => ({
  submitQuiz: jest.fn(async () => [{ id: 'a1' }]),
  getStudentQuizSubmission: jest.fn(async () => ({ maps: [], answerMap: {} })),
  hasSubmittedQuiz: jest.fn(async () => false),
}))
jest.mock('../services/chapters.service', () => ({}))
jest.mock('../services/ai-question.service', () => ({}))

import * as svc from '../services/quiz.service'
import { getStudentSubmission, submitQuiz } from './quiz.controller'

// Ownership checks on quiz submission: a student acts only as themselves.

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const student = { id: 'p-stu', role: 'student', student_id: 'stu-1' }
const teacher = { id: 'p-tea', role: 'teacher' }
const parent = { id: 'p-par', role: 'parent' }

beforeEach(() => jest.clearAllMocks())

describe('POST /quiz/:quizId/submit', () => {
  const answers = [{ quiz_question_map_id: 'm1', answer: 'A' }]

  it('student submits as themselves (web sends own student_id)', async () => {
    const res = mockRes()
    await submitQuiz({ profile: student, params: { quizId: 'q1' }, body: { student_id: 'stu-1', answers } } as any, res)
    expect(svc.submitQuiz).toHaveBeenCalledWith('q1', 'stu-1', answers)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('student id is taken from the token when the body omits it', async () => {
    await submitQuiz({ profile: student, params: { quizId: 'q1' }, body: { answers } } as any, mockRes())
    expect(svc.submitQuiz).toHaveBeenCalledWith('q1', 'stu-1', answers)
  })

  it('rejects submitting as another student', async () => {
    const res = mockRes()
    await submitQuiz({ profile: student, params: { quizId: 'q1' }, body: { student_id: 'stu-OTHER', answers } } as any, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(svc.submitQuiz).not.toHaveBeenCalled()
  })

  it('rejects a second submission (409)', async () => {
    ;(svc.hasSubmittedQuiz as jest.Mock).mockResolvedValueOnce(true)
    const res = mockRes()
    await submitQuiz({ profile: student, params: { quizId: 'q1' }, body: { answers } } as any, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(svc.submitQuiz).not.toHaveBeenCalled()
  })

  it('rejects non-students', async () => {
    const res = mockRes()
    await submitQuiz({ profile: teacher, params: { quizId: 'q1' }, body: { student_id: 'stu-1', answers } } as any, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(svc.submitQuiz).not.toHaveBeenCalled()
  })
})

describe('GET /quiz/:quizId/submissions/:studentId', () => {
  it('student views own submission', async () => {
    const res = mockRes()
    await getStudentSubmission({ profile: student, params: { quizId: 'q1', studentId: 'stu-1' } } as any, res)
    expect(svc.getStudentQuizSubmission).toHaveBeenCalledWith('q1', 'stu-1', true)
    expect(res.status).not.toHaveBeenCalled()
  })

  it("student cannot view another student's submission", async () => {
    const res = mockRes()
    await getStudentSubmission({ profile: student, params: { quizId: 'q1', studentId: 'stu-2' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(svc.getStudentQuizSubmission).not.toHaveBeenCalled()
  })

  it('teacher can review any submission', async () => {
    await getStudentSubmission({ profile: teacher, params: { quizId: 'q1', studentId: 'stu-2' } } as any, mockRes())
    expect(svc.getStudentQuizSubmission).toHaveBeenCalledWith('q1', 'stu-2', false)
  })

  it('other roles are rejected', async () => {
    const res = mockRes()
    await getStudentSubmission({ profile: parent, params: { quizId: 'q1', studentId: 'stu-1' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
