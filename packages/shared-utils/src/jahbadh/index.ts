import type { JgGradeDef, JgSubjectDef } from './distribution'
import type { JgComponentInput, JgRuleInput } from './engine'

export * from './distribution'
export * from './engine'
export * from './analytics'
export * from './ideas'
export * from './control'
export * from './timer'

/** Engine inputs for a seeded subject; component ids are `${stage}.${index}` (stable within a subject). */
export function jgComponentsOf(subject: JgSubjectDef): JgComponentInput[] {
  return subject.stages.flatMap((comps, i) =>
    comps.map((comp, j) => ({ id: `${i + 1}.${j + 1}`, stage: i + 1, max: comp.max, isExam: !!comp.exam })),
  )
}

export function jgRuleOf(grade: Pick<JgGradeDef, 'noFail' | 'totalMin' | 'examMin'>): JgRuleInput {
  return { noFail: grade.noFail, totalMin: grade.totalMin, examMin: grade.examMin }
}
