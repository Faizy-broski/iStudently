import {
  matchingPermutation,
  toCanonicalMatchingAnswer,
  toDisplayedMatchingAnswer,
  toStudentQuestion,
} from './quiz-student-view'

describe('toStudentQuestion', () => {
  it('select/multiple: options kept in order, "*" markers removed, no correct_answer', () => {
    const q = toStudentQuestion({ type: 'select', answer: 'Red\n*Blue\nGreen', correct_answer: 'x' }, 'm', 's')
    expect(q.answer).toBe('Red\nBlue\nGreen')
    expect(q.correct_answer).toBeNull()
    expect(toStudentQuestion({ type: 'multiple', answer: '*A\nB\n*C' }, 'm', 's').answer).toBe('A\nB\nC')
  })

  it('text/textarea: model answer removed', () => {
    expect(toStudentQuestion({ type: 'text', answer: 'Paris' }, 'm', 's').answer).toBeNull()
    expect(toStudentQuestion({ type: 'textarea', answer: 'Essay key' }, 'm', 's').answer).toBeNull()
  })

  it('gap: blanks hidden, sentence kept', () => {
    const q = toStudentQuestion({ type: 'gap', answer: 'The sky is __blue__ and grass is __green__.' }, 'm', 's')
    expect(q.answer).toBe('The sky is ____ and grass is ____.')
  })

  it('anatomy: only the organ is sent', () => {
    const q = toStudentQuestion(
      { type: 'anatomy_label', correct_answer: { organId: 'heart', model: 'h.glb', hotspotId: 'left_ventricle' } },
      'm',
      's',
    )
    expect(q.correct_answer).toEqual({ organId: 'heart', model: 'h.glb' })
    expect(JSON.stringify(q)).not.toContain('left_ventricle')
  })

  it('matching: lefts in order, rights shuffled (never paired correctly as sent)', () => {
    const answer = 'Paris::France\nTokyo::Japan\nCairo::Egypt\nRome::Italy'
    const q = toStudentQuestion({ type: 'matching', answer }, 'map-1', 'stu-1')
    const lines = (q.answer as string).split('\n').map((l) => l.split('::'))
    expect(lines.map((l) => l[0])).toEqual(['Paris', 'Tokyo', 'Cairo', 'Rome'])
    expect(lines.map((l) => l[1]).sort()).toEqual(['Egypt', 'France', 'Italy', 'Japan'])
    expect(q.answer).not.toBe(answer)
  })

  it('does not mutate the stored question', () => {
    const raw = { type: 'select', answer: '*A\nB' }
    toStudentQuestion(raw, 'm', 's')
    expect(raw.answer).toBe('*A\nB')
  })
})

describe('matching permutation', () => {
  it('is stable per (map, student) and differs between students', () => {
    expect(matchingPermutation('m', 's1', 6)).toEqual(matchingPermutation('m', 's1', 6))
    const others = ['s2', 's3', 's4', 's5'].map((s) => matchingPermutation('m', s, 6).join())
    expect(others.some((p) => p !== matchingPermutation('m', 's1', 6).join())).toBe(true)
  })

  it('is a real permutation and never the identity', () => {
    for (let n = 2; n <= 8; n++) {
      for (const s of ['a', 'b', 'c', 'd', 'e']) {
        const p = matchingPermutation('map', s, n)
        expect([...p].sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i))
        expect(p.every((v, i) => v === i)).toBe(false)
      }
    }
  })

  it('a student who drags each right onto its true left gets full marks after translation', () => {
    const perm = matchingPermutation('map', 'stu', 4)
    // Displayed chip k shows canonical right perm[k]; the correct slot for it is perm[k].
    const displayedAnswer: string[] = []
    perm.forEach((canonical, displayed) => (displayedAnswer[canonical] = String(displayed)))
    const canonical = toCanonicalMatchingAnswer(displayedAnswer.join('||'), perm)
    expect(canonical).toBe('0||1||2||3') // autoGrade: chosen[i] === i for every i
  })

  it('round-trips stored answers to the displayed view, keeping blanks', () => {
    const perm = matchingPermutation('map', 'stu', 4)
    const stored = '2||0||||1'
    expect(toCanonicalMatchingAnswer(toDisplayedMatchingAnswer(stored, perm), perm)).toBe(stored)
  })

  it('ignores out-of-range indices', () => {
    expect(toCanonicalMatchingAnswer('9||-1||x', [1, 0, 2])).toBe('||||')
  })
})
