"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Abacus, emptyDigits, digitsToValue, valueToDigits, type Digits } from "./Abacus"
import { useTT } from "./useTT"
import { LEVELS, weakestSkill } from "./levels"
import { genProblem, planFor, type Term } from "@/lib/mentalMath/engine"
import type { useSessionLog } from "./useSessionLog"
import type { useProgress } from "./useProgress"

const PACE_MS = 3500

interface CourseState {
  terms: Term[]
  total: number
  idx: number
  t0: number
  done: boolean
  levelIndex: number
  review: boolean
}

export function Course({ session, progress }: { session: ReturnType<typeof useSessionLog>; progress: ReturnType<typeof useProgress> }) {
  const tt = useTT()
  const [level, setLevelLocal] = useState(progress.progress.level)
  const [tries, setTries] = useState(0)
  const [ok, setOk] = useState(0)
  const [times, setTimes] = useState<number[]>([])
  const [digits, setDigits] = useState<Digits>(() => emptyDigits(1))
  const [decimals] = useState(0)
  const [course, setCourse] = useState<CourseState | null>(null)
  const [ghostTarget, setGhostTarget] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ text: string; tone: "idle" | "win" | "err" }>({
    text: tt("Press \"New problem\", then work it out on the abacus.", "اضغط «مسألة جديدة» ثم نفّذ العملية على المعداد."),
    tone: "idle",
  })

  const cfg = LEVELS[level - 1]
  const rods = Math.max(cfg.digits + 1, 3)

  const medianPace = () => {
    if (!times.length) return Infinity
    const s = times.slice().sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
  }

  const runningTargetAfter = (terms: Term[], k: number) => {
    let s = 0
    for (let i = 0; i <= k; i++) s = terms[i].sign === "+" ? s + terms[i].v : s - terms[i].v
    return s
  }

  const newProblem = () => {
    let useCfg = cfg
    let review = false
    const weak = weakestSkill(session.log.filter((x) => x.mode === "course"))
    if (level > 2 && Math.random() < 0.3) {
      const pool = LEVELS.slice(0, level - 1).filter((l) => !weak || !l.req || l.req.indexOf(weak) >= 0)
      if (pool.length) {
        useCfg = pool[Math.floor(Math.random() * pool.length)]
        review = true
      }
    }
    const p = genProblem({ n: rods, decimals }, useCfg)
    if (!p) {
      setMsg({ text: tt("Couldn't generate a problem for this level — try again.", "تعذّر توليد مسألة لهذا المستوى — حاول مجددًا."), tone: "err" })
      return
    }
    setDigits(emptyDigits(rods))
    setGhostTarget(null)
    setCourse({ terms: p.terms, total: p.total, idx: 0, t0: performance.now(), done: false, levelIndex: useCfg.n, review })
    setMsg({
      text: review
        ? tt(`Review of Level ${useCfg.n} (${useCfg.name.en}) — don't lose an old skill.`, `مراجعة المستوى ${useCfg.n} (${useCfg.name.ar}) — لا تفقد مهارة قديمة.`)
        : tt("Work through the operations in order on the abacus.", "نفّذ العمليات بالترتيب على المعداد."),
      tone: "idle",
    })
  }

  const onAbacusChange = (next: Digits) => {
    setDigits(next)
    if (!course || course.done) return
    const want = runningTargetAfter(course.terms, course.idx)
    if (digitsToValue(next) !== want) return

    const nextIdx = course.idx + 1
    if (nextIdx >= course.terms.length) {
      const ms = performance.now() - course.t0
      setTries((t) => t + 1)
      setOk((o) => o + 1)
      setTimes((t) => [...t, ms / course.terms.length])
      session.add({
        mode: "course",
        ok: true,
        ms,
        detail: course.terms.map((t, i) => (i ? t.sign : "") + t.v).join(" ") + " = " + course.total,
        err: null,
        skills: cfg.req || ["direct"],
      })
      setCourse({ ...course, done: true })
      setMsg({ text: tt(`Excellent — ${course.total} in ${(ms / 1000).toFixed(1)}s.`, `ممتاز — الناتج ${course.total} في ${(ms / 1000).toFixed(1)} ثانية.`), tone: "win" })
      maybeUnlock()
    } else {
      setCourse({ ...course, idx: nextIdx })
      setGhostTarget(null)
      setMsg({ text: tt("Correct step. Keep going.", "خطوة صحيحة. تابع."), tone: "idle" })
    }
  }

  const maybeUnlock = () => {
    const accuracy = tries ? ok / tries : 0
    if (tries >= 5 && (ok + 1) / (tries + 1) >= 0.9 && medianPace() <= PACE_MS && level < LEVELS.length) {
      if (!progress.masteredBefore(level)) {
        setMsg({
          text: tt(
            `You've cleared Level ${level} today. Unlocking needs confirmation in another session — save your progress below.`,
            `أتممت المستوى ${level} اليوم. الترقية تحتاج تأكيدًا في جلسة أخرى — احفظ تقدمك أدناه.`
          ),
          tone: "win",
        })
        return
      }
      const next = level + 1
      setLevelLocal(next)
      progress.setLevel(next)
      setTries(0); setOk(0); setTimes([])
      setMsg({ text: tt(`Level ${next} unlocked: ${LEVELS[next - 1].name.en}.`, `فُتح المستوى ${next}: ${LEVELS[next - 1].name.ar}.`), tone: "win" })
    }
  }

  const explainNext = () => {
    if (!course || course.done) {
      setMsg({ text: tt("Start a problem first.", "ابدأ مسألة أولاً."), tone: "idle" })
      return
    }
    const term = course.terms[course.idx]
    const r = planFor({ n: rods, decimals }, digits, term.sign, term.v)
    if (!r.ok) {
      setMsg({ text: tt("Can't explain this step from the current bead state — reset and retry.", "لا يمكن شرح هذه الخطوة من الوضع الحالي — صفّر وأعد المحاولة."), tone: "err" })
      return
    }
    setGhostTarget(runningTargetAfter(course.terms, course.idx))
    setTries((t) => t + 1)
    setMsg({ text: (term.sign === "+" ? tt("Add ", "أضف ") : tt("Subtract ", "اطرح ")) + term.v + ": " + r.steps.map((s) => s.text).join(" "), tone: "idle" })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{tt("Level", "المستوى")}</span>
        <Select value={String(level)} onValueChange={(v) => { setLevelLocal(+v); setTries(0); setOk(0); setTimes([]); setCourse(null) }}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEVELS.map((l) => (
              <SelectItem key={l.n} value={String(l.n)}>{tt(`Level ${l.n} — ${l.name.en}`, `المستوى ${l.n} — ${l.name.ar}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={newProblem}>{tt("New problem", "مسألة جديدة")}</Button>
        <Button variant="outline" onClick={explainNext}>{tt("Explain next step", "اشرح الخطوة التالية")}</Button>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-blue-600 transition-all" style={{ width: Math.min(100, Math.round((ok / 6) * 100)) + "%" }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {tt(
          `Level ${level} — ${ok} correct of ${tries} attempts. Unlocking needs 6 attempts, 90% accuracy, and a pace under ${(PACE_MS / 1000).toFixed(1)}s/problem.`,
          `المستوى ${level} — ${ok} صحيحة من ${tries} محاولة. الترقية تحتاج 6 محاولات ودقة 90٪ وإيقاعًا أسرع من ${(PACE_MS / 1000).toFixed(1)} ث/مسألة.`
        )}
      </p>

      {course && (
        <div className="flex flex-wrap items-center gap-2 text-lg font-bold tabular-nums" dir="ltr">
          {course.terms.map((t, i) => (
            <span key={i} className={i < course.idx ? "rounded bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-400" : "rounded bg-muted px-2 py-0.5"}>
              {i === 0 ? "" : t.sign === "+" ? "+ " : "− "}
              {t.v}
            </span>
          ))}
          <span>=</span>
          <span>؟</span>
        </div>
      )}

      <Abacus digits={digits} decimals={decimals} onChange={onAbacusChange} ghostTarget={ghostTarget} />

      <p className={msg.tone === "win" ? "text-sm font-medium text-green-600" : msg.tone === "err" ? "text-sm font-medium text-red-600" : "text-sm text-muted-foreground"}>
        {msg.text}
      </p>

      <div className="rounded-lg border-s-4 border-blue-500 bg-muted/40 p-3 text-sm">
        <b>{tt("Coach tip: ", "نصيحة المدرب: ")}</b>
        {tt(cfg.tip.en, cfg.tip.ar)}
      </div>
    </div>
  )
}
