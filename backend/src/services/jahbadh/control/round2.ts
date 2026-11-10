import { supabase } from '../../../config/supabase'
import { JC_ROUND2_PROVISIONAL_NOTE } from '../../../lib/jahbadh'
import * as gs from '../grades.service'
import { loadStudents, need, type JcContext } from './core'

export interface JcRound2Student {
  id: string
  student_id: string
  name: string
  seat_number: number | null
  grade_level_id: string
  grade_level_name: string
  section_name: string | null
  /** Memo subject keys and names the student sits in the second round. */
  subject_keys: string[]
  subjects: string[]
  decision: string
  /** Seat number in the linked second-round session, once its numbers are generated. */
  round2_seat: number | null
}

export interface JcRound2List {
  /** grades = the grades module's decision (Art. 122 / 51 applied); provisional = exam scores only. */
  source: 'grades' | 'provisional'
  note: string
  students: JcRound2Student[]
  /** Over the Article 51 limit: fail outright, no second round. */
  excluded_over_limit: { id: string; name: string; grade_level_name: string; failed: number }[]
  /** Students whose grade sheet is still incomplete (not decided yet). */
  incomplete: { id: string; name: string; grade_level_name: string; missing: string | null }[]
}

const OFFICIAL_NOTE = 'قائمة الدور الثاني حسب قرار منظومة الرصد بعد تطبيق المادة 122 (جبر الكسور وجبر +1) والمادة 51 (الحد الأقصى لعدد مواد الدور الثاني).'

/**
 * Second-round list (C6.8, E3). The decision belongs to the grades module: each section of the session's
 * students is computed there (all stages, Art. 122 «جبر» and the Art. 51 limit). When the grades module is
 * not set up for a section, the control's own exam-only list is returned, labelled provisional.
 */
export async function secondRoundList(ctx: JcContext): Promise<JcRound2List> {
  need(ctx.can.manage)
  if (!ctx.unmasked) throw new gs.JgError(409, 'The second-round list is available after unmasking', 'not_unmasked')
  const students = (await loadStudents(ctx)).filter((s) => s.status === 'participating')
  const byStudent = new Map(students.map((s) => [s.student_id, s]))
  const { data: homes } = await supabase.from('students').select('id, section_id').in('id', students.length ? students.map((s) => s.student_id) : ['00000000-0000-0000-0000-000000000000'])
  const sections = [...new Set((homes ?? []).map((h: any) => h.section_id).filter(Boolean))] as string[]

  const out: JcRound2List = { source: 'grades', note: OFFICIAL_NOTE, students: [], excluded_over_limit: [], incomplete: [] }
  let resolved = 0
  const actor: gs.JgActor = { profileId: ctx.actor.profileId, role: 'admin' }
  for (const sectionId of sections) {
    let results: gs.JgResults
    try {
      const sctx = await gs.sectionContext(sectionId, ctx.session.school_id, actor, ctx.session.academic_year_id)
      results = await gs.getResults(sctx)
    } catch (e) {
      if (e instanceof gs.JgError && ['not_setup', 'not_mapped', 'not_seeded'].includes(String(e.code))) continue
      throw e
    }
    resolved++
    for (const r of results.students) {
      const s = byStudent.get(r.student.id)
      if (!s) continue
      if (r.over_round2_limit) {
        out.excluded_over_limit.push({ id: s.id, name: s.name, grade_level_name: s.grade_level_name, failed: Object.values(r.subjects).filter((x) => x.result.result === 'fail' || x.result.result === 'round2').length })
        continue
      }
      const referred = results.subjects.filter((sub) => {
        const n = r.subjects[sub.id]?.need
        return n && (n.kind === 'need' || n.kind === 'impossible')
      })
      if (referred.length) {
        out.students.push({
          id: s.id, student_id: s.student_id, name: s.name, seat_number: s.seat_number, grade_level_id: s.grade_level_id, grade_level_name: s.grade_level_name,
          section_name: s.section_name, subject_keys: referred.map((x) => x.key), subjects: referred.map((x) => x.short_name), decision: r.decision, round2_seat: null,
        })
      } else if (r.incomplete) {
        out.incomplete.push({ id: s.id, name: s.name, grade_level_name: s.grade_level_name, missing: r.missing_text ?? null })
      }
    }
  }

  if (!resolved) {
    // Grades module not available for these sections: provisional list from the exam scores only.
    const { results } = await import('./scores')
    const r = await results(ctx)
    const grades = new Map(r.grades.map((g) => [g.grade_level_id, g]))
    out.source = 'provisional'
    out.note = JC_ROUND2_PROVISIONAL_NOTE
    out.students = r.second_round_candidates.map((c) => {
      const s = students.find((x) => x.id === c.id)!
      const subs = grades.get(s.grade_level_id)?.subjects ?? []
      const keys = [...new Set(c.subjects.map((k) => k.split('#')[0]))]
      return {
        id: s.id, student_id: s.student_id, name: s.name, seat_number: s.seat_number, grade_level_id: s.grade_level_id, grade_level_name: s.grade_level_name,
        section_name: s.section_name, subject_keys: keys, subjects: keys.map((k) => subs.find((x) => x.key.split('#')[0] === k)?.name.split(' — ')[0] ?? k),
        decision: 'دور ثانٍ (مبدئي)', round2_seat: null,
      }
    })
  }

  // Seat numbers of the linked second-round session, if it exists.
  const { data: child } = await supabase.from('jc_sessions').select('id').eq('parent_session_id', ctx.session.id).maybeSingle()
  if (child?.id) {
    const { data: seats } = await supabase.from('jc_students').select('student_id, seat_number').eq('session_id', child.id)
    const seatOf = new Map((seats ?? []).map((x: any) => [x.student_id, x.seat_number]))
    for (const s of out.students) s.round2_seat = seatOf.get(s.student_id) ?? null
  }
  out.students.sort((a, b) => a.grade_level_name.localeCompare(b.grade_level_name, 'ar') || (a.seat_number ?? 0) - (b.seat_number ?? 0))
  return out
}
