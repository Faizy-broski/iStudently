import { supabase } from '../../../config/supabase'
import { JgError } from '../grades.service'
import { need, sessionContext, type JcContext } from './core'
import { quality } from './scores'

type Quality = Awaited<ReturnType<typeof quality>>
type Grade = Quality['grades'][number]

const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 1000) / 1000)

/**
 * The session a comparison defaults to (C6.7): the latest earlier first-round session of the school with
 * the same stage — the previous year's when there is one, otherwise the previous term's.
 */
async function previousSession(ctx: JcContext): Promise<string | null> {
  const { data } = await supabase
    .from('jc_sessions')
    .select('id, academic_year_id, stage, round, created_at')
    .eq('school_id', ctx.session.school_id)
    .neq('id', ctx.session.id)
    .eq('round', 'first')
    .order('created_at', { ascending: false })
  const earlier = (data ?? []).filter((s: any) => String(s.created_at) < String(ctx.session.created_at))
  const otherYear = earlier.find((s: any) => s.academic_year_id !== ctx.session.academic_year_id && s.stage === ctx.session.stage)
  return (otherYear ?? earlier[0])?.id ?? null
}

/**
 * Comparison with a previous session or year (C6.7): per grade (matched by grade level, then by name) the
 * average, pass rate and completion of both sessions; per subject (matched by key) mean % and pass rate.
 * Deltas are current − previous. Only aggregates: no names, so it works before unmasking.
 */
export async function comparison(ctx: JcContext, withSessionId?: string | null) {
  need(ctx.can.manage || ctx.can.entry)
  const otherId = withSessionId || (await previousSession(ctx))
  const current = await quality(ctx)
  if (!otherId) return { current: { id: ctx.session.id, name: ctx.session.name }, previous: null, school: null, grades: [] }
  if (otherId === ctx.session.id) throw new JgError(400, 'Choose another session to compare with')
  const otherCtx = await sessionContext(otherId, ctx.actor)
  if (otherCtx.rootId !== ctx.rootId) throw new JgError(404, 'Session not found')
  const previous = await quality(otherCtx)
  const match = (g: Grade) => previous.grades.find((p) => p.grade_level_id === g.grade_level_id) ?? previous.grades.find((p) => p.name === g.name) ?? null
  const gradeRow = (g: Grade) => {
    const passOf = (x: Grade) => {
      const rates = x.subjects.map((s) => s.passRate).filter((r): r is number => r !== null)
      return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
    }
    const p = match(g)
    const cur = { average: g.tiles.average, pass_rate: passOf(g), completion: g.tiles.completion, students: g.tiles.students }
    const prev = p ? { average: p.tiles.average, pass_rate: passOf(p), completion: p.tiles.completion, students: p.tiles.students } : null
    return {
      grade_level_id: g.grade_level_id,
      name: g.name,
      current: cur,
      previous: prev,
      delta: prev ? { average: delta(cur.average, prev.average), pass_rate: delta(cur.pass_rate, prev.pass_rate) } : null,
      subjects: g.subjects.map((s) => {
        const ps = p?.subjects.find((x) => x.key === s.key) ?? p?.subjects.find((x) => x.key.split('#')[0] === s.key.split('#')[0]) ?? null
        return {
          key: s.key, name: s.name,
          current: { mean_pct: s.meanPct, pass_rate: s.passRate },
          previous: ps ? { mean_pct: ps.meanPct, pass_rate: ps.passRate } : null,
          delta: ps ? { mean_pct: delta(s.meanPct, ps.meanPct), pass_rate: delta(s.passRate, ps.passRate) } : null,
        }
      }),
    }
  }
  return {
    current: { id: ctx.session.id, name: ctx.session.name, academic_year_id: ctx.session.academic_year_id },
    previous: { id: otherCtx.session.id, name: otherCtx.session.name, academic_year_id: otherCtx.session.academic_year_id },
    school: {
      current: current.school.total,
      previous: previous.school.total,
      delta: { average: delta(current.school.total.average, previous.school.total.average), pass_rate: delta(current.school.total.pass_rate, previous.school.total.pass_rate) },
    },
    grades: current.grades.map(gradeRow),
  }
}
