"use client"

// Soroban-style visual abacus + a timed mental-arithmetic drill that uses it.
// Bilingual via the same inline tt(en, ar) + useLocale() pattern the other
// Edu Resources tools (InteractiveGeometry, CircuitSimulator) use — no
// messages.json namespace for this component family's internal UI strings.

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Calculator, RotateCcw, Play, Square, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ============================================================================
// Abacus model — a standard soroban: 1 "heaven" bead (value 5) + 4 "earth"
// beads (value 1 each) per rod. earth is a count 0-4 of how many of the 4
// beads are pushed toward the beam, not per-bead state — real abacus beads
// move as a cluster, this mirrors that.
// ============================================================================

interface RodState {
  heaven: boolean
  earth: number // 0-4
}

function rodValue(r: RodState): number {
  return (r.heaven ? 5 : 0) + r.earth
}

function abacusTotal(rods: RodState[]): number {
  return rods.reduce((sum, r, i) => sum + rodValue(r) * Math.pow(10, rods.length - 1 - i), 0)
}

function emptyRods(count: number): RodState[] {
  return Array.from({ length: count }, () => ({ heaven: false, earth: 0 }))
}

function useTT() {
  const locale = useLocale()
  const isAr = locale === "ar"
  return (en: string, ar: string) => (isAr ? ar : en)
}

// ============================================================================
// Abacus — presentational, controlled. Reused by both tabs so Free Practice
// and Timed Drill each get their own independent bead state.
// ============================================================================

function Abacus({ rods, onChange }: { rods: RodState[]; onChange: (rods: RodState[]) => void }) {
  const toggleHeaven = (i: number) => {
    onChange(rods.map((r, idx) => (idx === i ? { ...r, heaven: !r.heaven } : r)))
  }

  // Clicking earth bead `clicked` (0 = closest to the beam) sets the active
  // count to include it (and every bead between it and the beam), or — if
  // it's already active — excludes it and everything below it. Mirrors how
  // a real abacus bead drags its neighbors along.
  const setEarth = (i: number, clicked: number) => {
    const r = rods[i]
    const nextCount = clicked < r.earth ? clicked : clicked + 1
    onChange(rods.map((row, idx) => (idx === i ? { ...row, earth: nextCount } : row)))
  }

  return (
    <div className="inline-flex gap-1 rounded-lg border-4 border-amber-800 bg-amber-100 p-3 shadow-inner dark:bg-amber-950">
      {rods.map((r, i) => (
        <div key={i} className="relative flex w-10 flex-col items-center">
          <div className="pointer-events-none absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 bg-amber-900/40" />

          {/* Heaven zone — 1 bead, value 5 */}
          <div className="flex h-16 w-full flex-col items-center justify-end border-b-4 border-amber-900">
            <button
              type="button"
              onClick={() => toggleHeaven(i)}
              aria-label="heaven bead"
              className={cn(
                "z-10 h-6 w-8 rounded-full border-2 transition-transform",
                r.heaven ? "translate-y-0 border-red-800 bg-red-600" : "-translate-y-2 border-red-500 bg-red-300"
              )}
            />
          </div>

          {/* Earth zone — 4 beads, value 1 each */}
          <div className="flex w-full flex-col items-center gap-1 pt-1">
            {Array.from({ length: 4 }).map((_, bi) => {
              const active = bi < r.earth
              return (
                <button
                  type="button"
                  key={bi}
                  onClick={() => setEarth(i, bi)}
                  aria-label={`earth bead ${bi}`}
                  className={cn(
                    "z-10 h-6 w-8 rounded-full border-2 transition-all",
                    active ? "border-blue-800 bg-blue-600" : "border-blue-500 bg-blue-300",
                    !active && bi === r.earth && "mt-3"
                  )}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Free Practice — freeform bead manipulation + a "build this number" check.
// ============================================================================

function FreePractice() {
  const tt = useTT()
  const [rodCount, setRodCount] = useState(5)
  const [rods, setRods] = useState<RodState[]>(() => emptyRods(5))
  const [target, setTarget] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle")

  useEffect(() => {
    setRods(emptyRods(rodCount))
    setTarget(null)
    setFeedback("idle")
  }, [rodCount])

  const total = abacusTotal(rods)

  const newChallenge = () => {
    const max = Math.pow(10, rodCount) - 1
    setTarget(Math.floor(Math.random() * (max + 1)))
    setFeedback("idle")
  }

  const checkChallenge = () => {
    if (target === null) return
    setFeedback(total === target ? "correct" : "incorrect")
  }

  const clear = () => {
    setRods(emptyRods(rodCount))
    setFeedback("idle")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{tt("Rods:", "الأعمدة:")}</span>
        {[3, 5, 7].map((n) => (
          <Button key={n} size="sm" variant={rodCount === n ? "default" : "outline"} onClick={() => setRodCount(n)}>
            {n}
          </Button>
        ))}
        <div className="mx-2 h-6 w-px bg-border" />
        <Button size="sm" variant="outline" onClick={clear} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          {tt("Clear", "مسح")}
        </Button>
      </div>

      <Abacus rods={rods} onChange={setRods} />

      <div className="text-sm text-muted-foreground">{tt("Value", "القيمة")}</div>
      <div className="text-4xl font-bold tabular-nums">{total}</div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{tt("Build this number", "كوّن هذا الرقم")}</span>
            <Button size="sm" variant="outline" onClick={newChallenge}>
              {tt("New number", "رقم جديد")}
            </Button>
          </div>
          {target !== null && (
            <>
              <div className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{target}</div>
              <Button size="sm" onClick={checkChallenge}>
                {tt("Check", "تحقق")}
              </Button>
              {feedback === "correct" && (
                <p className="text-sm font-medium text-green-600">{tt("Correct! 🎉", "صحيح! 🎉")}</p>
              )}
              {feedback === "incorrect" && (
                <p className="text-sm font-medium text-red-600">
                  {tt("Not quite — keep adjusting the beads.", "ليس تماماً — عدّل الخرزات.")}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// Timed Drill — flashes signed terms one at a time while the abacus stays
// live on screen for the student to track the running total on (the actual
// point of abacus mental-math training), then checks a typed-in answer.
// ============================================================================

type DrillPhase = "idle" | "showing" | "answering" | "result" | "complete"
type Pace = "slow" | "medium" | "fast"

interface Problem {
  terms: number[]
  answer: number
}

const PACE_MS: Record<Pace, number> = { slow: 3000, medium: 2000, fast: 1200 }

function generateProblem(termCount: number, allowSubtraction: boolean, maxTerm: number): Problem {
  const terms: number[] = []
  let running = 0
  for (let i = 0; i < termCount; i++) {
    const magnitude = Math.floor(Math.random() * maxTerm) + 1
    let sign = 1
    if (allowSubtraction && i > 0 && Math.random() < 0.5 && running - magnitude >= 0) sign = -1
    running += sign * magnitude
    terms.push(sign * magnitude)
  }
  return { terms, answer: running }
}

function TimedDrill() {
  const tt = useTT()

  // Settings
  const [digits, setDigits] = useState(2)
  const [termCount, setTermCount] = useState(5)
  const [allowSubtraction, setAllowSubtraction] = useState(false)
  const [pace, setPace] = useState<Pace>("medium")
  const [roundLength, setRoundLength] = useState(10)

  // Round state
  const [phase, setPhase] = useState<DrillPhase>("idle")
  const [problems, setProblems] = useState<Problem[]>([])
  const [problemIndex, setProblemIndex] = useState(0)
  const [termIndex, setTermIndex] = useState(0)
  const [rods, setRods] = useState<RodState[]>(() => emptyRods(2))
  const [answerInput, setAnswerInput] = useState("")
  const [results, setResults] = useState<boolean[]>([])

  const currentProblem = problems[problemIndex]

  useEffect(() => {
    if (phase !== "showing" || !currentProblem) return
    if (termIndex >= currentProblem.terms.length) {
      setPhase("answering")
      setAnswerInput("")
      return
    }
    const timer = setTimeout(() => setTermIndex((i) => i + 1), PACE_MS[pace])
    return () => clearTimeout(timer)
  }, [phase, termIndex, currentProblem, pace])

  const startRound = () => {
    const maxTerm = Math.pow(10, digits) - 1
    const list = Array.from({ length: roundLength }, () => generateProblem(termCount, allowSubtraction, maxTerm))
    setProblems(list)
    setProblemIndex(0)
    setTermIndex(0)
    setResults([])
    setRods(emptyRods(digits))
    setPhase("showing")
  }

  const stopRound = () => setPhase("idle")

  const submitAnswer = () => {
    if (!currentProblem) return
    const correct = Number(answerInput) === currentProblem.answer
    setResults((r) => [...r, correct])
    setPhase("result")
  }

  const nextProblem = () => {
    if (problemIndex + 1 >= problems.length) {
      setPhase("complete")
      return
    }
    setProblemIndex((i) => i + 1)
    setTermIndex(0)
    setRods(emptyRods(digits))
    setPhase("showing")
  }

  const currentTerm = phase === "showing" && currentProblem ? currentProblem.terms[termIndex] : null
  const lastResult = results.length > 0 ? results[results.length - 1] : null
  const correctCount = results.filter(Boolean).length

  if (phase === "idle") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1">
              <span className="text-sm font-medium">{tt("Digits per number", "عدد الأرقام لكل عدد")}</span>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <Button key={n} size="sm" variant={digits === n ? "default" : "outline"} onClick={() => setDigits(n)}>
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium">{tt("Terms per problem", "عدد الخطوات لكل مسألة")}</span>
              <div className="flex flex-wrap gap-2">
                {[3, 4, 5, 6, 8].map((n) => (
                  <Button key={n} size="sm" variant={termCount === n ? "default" : "outline"} onClick={() => setTermCount(n)}>
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium">{tt("Operations", "العمليات")}</span>
              <div className="flex gap-2">
                <Button size="sm" variant={!allowSubtraction ? "default" : "outline"} onClick={() => setAllowSubtraction(false)}>
                  {tt("Addition only", "جمع فقط")}
                </Button>
                <Button size="sm" variant={allowSubtraction ? "default" : "outline"} onClick={() => setAllowSubtraction(true)}>
                  {tt("Addition & subtraction", "جمع وطرح")}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium">{tt("Pace", "السرعة")}</span>
              <div className="flex gap-2">
                {(["slow", "medium", "fast"] as Pace[]).map((p) => (
                  <Button key={p} size="sm" variant={pace === p ? "default" : "outline"} onClick={() => setPace(p)}>
                    {tt(
                      { slow: "Slow", medium: "Medium", fast: "Fast" }[p],
                      { slow: "بطيء", medium: "متوسط", fast: "سريع" }[p]
                    )}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium">{tt("Problems per round", "عدد المسائل في الجولة")}</span>
              <div className="flex gap-2">
                {[5, 10, 15].map((n) => (
                  <Button key={n} size="sm" variant={roundLength === n ? "default" : "outline"} onClick={() => setRoundLength(n)}>
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={startRound} className="w-full gap-1.5 gradient-blue text-white border-0">
              <Play className="h-4 w-4" />
              {tt("Start drill", "ابدأ التمرين")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === "complete") {
    const accuracy = problems.length > 0 ? Math.round((correctCount / problems.length) * 100) : 0
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="text-lg font-semibold">{tt("Round complete", "اكتملت الجولة")}</p>
          <p className="text-3xl font-bold tabular-nums">
            {correctCount} / {problems.length}
          </p>
          <p className="text-sm text-muted-foreground">{tt(`${accuracy}% accuracy`, `دقة ${accuracy}%`)}</p>
          <Button onClick={() => setPhase("idle")} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            {tt("New round", "جولة جديدة")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {tt(`Problem ${problemIndex + 1} of ${problems.length}`, `المسألة ${problemIndex + 1} من ${problems.length}`)}
        </span>
        <Button size="sm" variant="outline" onClick={stopRound} className="gap-1.5">
          <Square className="h-3.5 w-3.5" />
          {tt("Stop", "إيقاف")}
        </Button>
      </div>

      <div className="flex h-24 items-center justify-center rounded-lg border bg-muted/40">
        {phase === "showing" && currentTerm !== null && (
          <span className={cn("text-5xl font-bold tabular-nums", currentTerm >= 0 ? "text-green-600" : "text-red-600")}>
            {currentTerm >= 0 ? "+" : "−"} {Math.abs(currentTerm)}
          </span>
        )}
        {phase === "answering" && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            {tt("What's the total?", "ما هو الناتج؟")}
          </span>
        )}
        {phase === "result" && currentProblem && (
          <div className="text-center">
            <p className={cn("text-2xl font-bold", lastResult ? "text-green-600" : "text-red-600")}>
              {lastResult ? tt("Correct!", "صحيح!") : tt("Not quite", "غير صحيح")}
            </p>
            <p className="text-sm text-muted-foreground">
              {tt(`Correct answer: ${currentProblem.answer}`, `الإجابة الصحيحة: ${currentProblem.answer}`)}
            </p>
          </div>
        )}
      </div>

      <Abacus rods={rods} onChange={setRods} />

      {phase === "answering" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            placeholder={tt("Your answer", "إجابتك")}
            className="w-40"
            autoFocus
          />
          <Button onClick={submitAnswer} disabled={answerInput === ""}>
            {tt("Submit", "إرسال")}
          </Button>
        </div>
      )}

      {phase === "result" && (
        <Button onClick={nextProblem} className="gradient-blue text-white border-0">
          {problemIndex + 1 >= problems.length ? tt("Finish", "إنهاء") : tt("Next problem", "المسألة التالية")}
        </Button>
      )}
    </div>
  )
}

// ============================================================================
// Root
// ============================================================================

export function MentalMath() {
  const tt = useTT()
  const tSidebar = useTranslations("sidebar")

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-blue-900 dark:text-blue-300">
        <Calculator className="h-5 w-5" />
        {tSidebar("mental_math")}
      </h1>

      <Tabs defaultValue="practice">
        <TabsList>
          <TabsTrigger value="practice">{tt("Free Practice", "تمرين حر")}</TabsTrigger>
          <TabsTrigger value="drill">{tt("Timed Drill", "تمرين موقوت")}</TabsTrigger>
        </TabsList>
        <TabsContent value="practice">
          <FreePractice />
        </TabsContent>
        <TabsContent value="drill">
          <TimedDrill />
        </TabsContent>
      </Tabs>
    </div>
  )
}
